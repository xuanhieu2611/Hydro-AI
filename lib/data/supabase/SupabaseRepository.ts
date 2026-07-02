import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';

import type { DataRepository } from '../repository';
import type {
  ConnectionInvite,
  ConnectionSummary,
  DailySummary,
  LogEntry,
  NewLogEntry,
  Profile,
} from '../types';
import { supabase, currentUserId, resetSession } from '../../supabase/client';
import { dateKeyDaysAgo, toDateKey, todayKey } from '../../date';
import { InviteError, type InviteFailure } from '../errors';
import { inviteUrl } from '../../invite';

const THUMBNAIL_BUCKET = 'thumbnails';
/** Signed-URL lifetime for thumbnails. Comfortably longer than query staleTime. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Columns we read for a full LogEntry (thumbnail_url holds a storage path). */
const LOG_COLUMNS =
  'id, user_id, logged_at, beverage_type, estimated_volume_ml, ' +
  'user_adjusted_volume_ml, hydration_coefficient, effective_hydration_ml, ' +
  'thumbnail_url, ai_confidence_score';

/** A log_entries row as stored (thumbnail_url = object path, not a URL yet). */
type LogRow = Omit<LogEntry, 'thumbnail_url'> & { thumbnail_url: string | null };

function actualVolume(e: Pick<LogEntry, 'estimated_volume_ml' | 'user_adjusted_volume_ml'>) {
  return e.user_adjusted_volume_ml ?? e.estimated_volume_ml;
}

/** Inclusive-start, exclusive-end ISO bounds for a local calendar day. */
function dayBounds(dateKey: string): { startISO: string; endISO: string } {
  const start = new Date(`${dateKey}T00:00:00`); // device-local midnight
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

/**
 * Real backend behind the unchanged DataRepository interface (CLAUDE.md: the
 * backend swap changes the provider, not the screens). Auth is Apple/Google +
 * RLS-scoped, so every query implicitly operates on the current user's rows.
 *
 * Daily summaries are rolled up client-side (mirroring MockRepository) so day
 * boundaries use device-local time exactly like the rest of the app — the
 * `daily_summary` SQL view exists for server-side/analytics use, but using it
 * here would group by UTC dates and drift from the on-device date keys.
 */
export class SupabaseRepository implements DataRepository {
  async getProfile(): Promise<Profile> {
    const uid = await currentUserId();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as Profile;

    // The signup trigger normally creates this row; insert defaults if a race
    // (or a pre-trigger account) left it missing.
    const { data: created, error: insertError } = await supabase
      .from('profiles')
      .insert({ id: uid })
      .select('*')
      .single();
    if (insertError) throw insertError;
    return created as Profile;
  }

  async updateProfile(patch: Partial<Profile>): Promise<Profile> {
    const uid = await currentUserId();
    // Identity/derived columns can't be patched.
    const { id: _id, created_at: _created, ...rest } = patch;
    const { data, error } = await supabase
      .from('profiles')
      .update(rest)
      .eq('id', uid)
      .select('*')
      .single();
    if (error) throw error;
    return data as Profile;
  }

  async getLogEntries(date: string): Promise<LogEntry[]> {
    await currentUserId();
    const { startISO, endISO } = dayBounds(date);
    const { data, error } = await supabase
      .from('log_entries')
      .select(LOG_COLUMNS)
      .gte('logged_at', startISO)
      .lt('logged_at', endISO)
      .order('logged_at', { ascending: false });
    if (error) throw error;
    return this.withSignedThumbnails((data ?? []) as unknown as LogRow[]);
  }

  async addLogEntry(entry: NewLogEntry): Promise<LogEntry> {
    const uid = await currentUserId();

    // A local file URI means we have a thumbnail to persist (camera/picker).
    let thumbnailPath: string | null = null;
    if (entry.thumbnail_url && isLocalUri(entry.thumbnail_url)) {
      thumbnailPath = await uploadThumbnail(uid, entry.thumbnail_url);
    } else if (entry.thumbnail_url) {
      thumbnailPath = entry.thumbnail_url; // already a storage path
    }

    const volume = entry.user_adjusted_volume_ml ?? entry.estimated_volume_ml;
    const { data, error } = await supabase
      .from('log_entries')
      .insert({
        user_id: uid,
        logged_at: entry.logged_at ?? new Date().toISOString(),
        beverage_type: entry.beverage_type,
        estimated_volume_ml: entry.estimated_volume_ml,
        user_adjusted_volume_ml: entry.user_adjusted_volume_ml ?? null,
        hydration_coefficient: entry.hydration_coefficient,
        effective_hydration_ml: Math.round(volume * entry.hydration_coefficient),
        thumbnail_url: thumbnailPath,
        ai_confidence_score: entry.ai_confidence_score ?? null,
      })
      .select(LOG_COLUMNS)
      .single();
    if (error) throw error;
    const [row] = await this.withSignedThumbnails([data as unknown as LogRow]);
    return row;
  }

  async updateLogEntry(id: string, patch: Partial<LogEntry>): Promise<LogEntry> {
    await currentUserId();
    // Read-merge-recompute so effective hydration stays consistent (matches mock).
    const { data: current, error: readError } = await supabase
      .from('log_entries')
      .select(LOG_COLUMNS)
      .eq('id', id)
      .single();
    if (readError) throw readError;

    const merged = { ...(current as unknown as LogRow), ...patch, id } as LogRow;
    const effective = Math.round(actualVolume(merged) * merged.hydration_coefficient);

    const { data, error } = await supabase
      .from('log_entries')
      .update({
        beverage_type: merged.beverage_type,
        estimated_volume_ml: merged.estimated_volume_ml,
        user_adjusted_volume_ml: merged.user_adjusted_volume_ml,
        hydration_coefficient: merged.hydration_coefficient,
        effective_hydration_ml: effective,
        ai_confidence_score: merged.ai_confidence_score,
      })
      .eq('id', id)
      .select(LOG_COLUMNS)
      .single();
    if (error) throw error;
    const [row] = await this.withSignedThumbnails([data as unknown as LogRow]);
    return row;
  }

  async deleteLogEntry(id: string): Promise<void> {
    await currentUserId();
    // Best-effort: remove the backing thumbnail object first, then the row.
    const { data: row } = await supabase
      .from('log_entries')
      .select('thumbnail_url')
      .eq('id', id)
      .maybeSingle();
    const path = (row as { thumbnail_url: string | null } | null)?.thumbnail_url;
    if (path) await supabase.storage.from(THUMBNAIL_BUCKET).remove([path]);

    const { error } = await supabase.from('log_entries').delete().eq('id', id);
    if (error) throw error;
  }

  async getDailySummary(date: string): Promise<DailySummary> {
    const [entries, profile] = await Promise.all([
      this.rawEntriesForRange(dayBounds(date).startISO, dayBounds(date).endISO),
      this.getProfile(),
    ]);
    return summaryFor(date, entries, profile.daily_goal_ml);
  }

  async getHistory(rangeDays: number): Promise<DailySummary[]> {
    const earliest = dayBounds(dateKeyDaysAgo(rangeDays - 1)).startISO;
    const [entries, profile] = await Promise.all([
      this.rawEntriesForRange(earliest, new Date().toISOString()),
      this.getProfile(),
    ]);
    // Most-recent-first, including today — same shape as MockRepository.
    return Array.from({ length: rangeDays }, (_, i) => {
      const dateKey = dateKeyDaysAgo(i);
      const dayEntries = entries.filter((e) => toDateKey(new Date(e.logged_at)) === dateKey);
      return summaryFor(dateKey, dayEntries, profile.daily_goal_ml);
    });
  }

  async clearAllLogs(): Promise<void> {
    const uid = await currentUserId();
    await this.removeAllThumbnails(uid);
    const { error } = await supabase.from('log_entries').delete().eq('user_id', uid);
    if (error) throw error;
  }

  async deleteAccount(): Promise<void> {
    const uid = await currentUserId();
    await this.removeAllThumbnails(uid);
    await supabase.from('log_entries').delete().eq('user_id', uid);
    // The client can't delete its own `auth.users` row (that needs an admin
    // Edge Function — see IMPLEMENTATION_PLAN follow-up). Sign out instead: the
    // auth-state listener routes back to the sign-in gate, and signing in again
    // (or with another provider) starts a fresh, un-onboarded profile.
    await resetSession();
  }

  /* ----------------------------- connections ------------------------------ */

  async getConnections(): Promise<ConnectionSummary[]> {
    await currentUserId();
    const { startISO, endISO } = dayBounds(todayKey());
    const { data, error } = await supabase.rpc('get_connections_overview', {
      p_day_start: startISO,
      p_day_end: endISO,
    });
    if (error) throw error;
    return ((data ?? []) as OverviewRow[]).map(toConnectionSummary);
  }

  async createConnectionInvite(): Promise<ConnectionInvite> {
    await currentUserId();
    const { data, error } = await supabase.rpc('create_connection_invite');
    if (error) throw error;
    const row = (data ?? [])[0] as { code: string; expires_at: string } | undefined;
    if (!row) throw new Error('Could not create an invite.');
    return { code: row.code, url: inviteUrl(row.code), expires_at: row.expires_at };
  }

  async claimConnectionInvite(code: string): Promise<ConnectionSummary> {
    await currentUserId();
    const { startISO, endISO } = dayBounds(todayKey());
    const { data, error } = await supabase.rpc('claim_connection_invite', {
      p_code: code.trim(),
      p_day_start: startISO,
      p_day_end: endISO,
    });
    if (error) throw mapInviteError(error);
    const row = (data ?? [])[0] as OverviewRow | undefined;
    if (!row) throw new InviteError('not_found', "That code doesn't look right.");
    return toConnectionSummary(row);
  }

  async removeConnection(connectionId: string): Promise<void> {
    await currentUserId();
    const { error } = await supabase.rpc('remove_connection', {
      p_connection_id: connectionId,
    });
    if (error) throw error;
  }

  /* ------------------------------- helpers -------------------------------- */

  /** Volume-only rows for a time range (lean; no thumbnail signing). */
  private async rawEntriesForRange(startISO: string, endISO: string) {
    const { data, error } = await supabase
      .from('log_entries')
      .select('logged_at, estimated_volume_ml, user_adjusted_volume_ml')
      .gte('logged_at', startISO)
      .lt('logged_at', endISO);
    if (error) throw error;
    return (data ?? []) as Pick<
      LogEntry,
      'logged_at' | 'estimated_volume_ml' | 'user_adjusted_volume_ml'
    >[];
  }

  /** Replace stored thumbnail paths with short-lived signed URLs for display. */
  private async withSignedThumbnails(rows: LogRow[]): Promise<LogEntry[]> {
    const paths = rows
      .map((r) => r.thumbnail_url)
      .filter((p): p is string => !!p);
    if (paths.length === 0) {
      return rows.map((r) => ({ ...r, thumbnail_url: r.thumbnail_url }));
    }

    const { data: signed } = await supabase.storage
      .from(THUMBNAIL_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

    const urlByPath = new Map<string, string>();
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }

    return rows.map((r) => ({
      ...r,
      thumbnail_url: r.thumbnail_url ? urlByPath.get(r.thumbnail_url) ?? null : null,
    }));
  }

  /** Delete every thumbnail object under the user's folder. */
  private async removeAllThumbnails(uid: string): Promise<void> {
    const { data: files } = await supabase.storage.from(THUMBNAIL_BUCKET).list(uid);
    if (files && files.length > 0) {
      await supabase.storage
        .from(THUMBNAIL_BUCKET)
        .remove(files.map((f) => `${uid}/${f.name}`));
    }
  }
}

/* --------------------------------- module helpers --------------------------- */

function isLocalUri(uri: string): boolean {
  return uri.startsWith('file:') || uri.startsWith('content:') || uri.startsWith('/');
}

/** Flat row shape returned by the connection overview / claim RPCs. */
interface OverviewRow {
  connection_id: string;
  partner_id: string;
  display_name: string | null;
  avatar_url: string | null;
  total_intake_ml: number;
  goal_ml: number;
  goal_met: boolean;
  streak: number;
}

function toConnectionSummary(row: OverviewRow): ConnectionSummary {
  return {
    connection_id: row.connection_id,
    partner: {
      id: row.partner_id,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
    },
    today: {
      total_intake_ml: row.total_intake_ml ?? 0,
      goal_ml: row.goal_ml ?? 0,
      goal_met: !!row.goal_met,
    },
    streak: row.streak ?? 0,
  };
}

/** Map the claim RPC's raised messages to a typed, user-friendly InviteError. */
function mapInviteError(error: { message?: string }): Error {
  const msg = error.message ?? '';
  const cases: Record<string, [InviteFailure, string]> = {
    invite_not_found: ['not_found', "We couldn't find that invite code."],
    invite_expired: ['expired', 'That invite has expired — ask for a new one.'],
    invite_already_claimed: ['already_claimed', 'That invite has already been used.'],
    invite_self: ['self', "That's your own invite code."],
    already_connected: ['already_connected', "You're already connected with them."],
  };
  for (const key of Object.keys(cases)) {
    if (msg.includes(key)) {
      const [reason, friendly] = cases[key];
      return new InviteError(reason, friendly);
    }
  }
  return error as Error;
}

function summaryFor(
  date: string,
  entries: Pick<LogEntry, 'estimated_volume_ml' | 'user_adjusted_volume_ml'>[],
  goal: number,
): DailySummary {
  const total = entries.reduce((sum, e) => sum + actualVolume(e), 0);
  return {
    date,
    total_intake_ml: total,
    goal_ml: goal,
    goal_met: total >= goal,
    entry_count: entries.length,
  };
}

/** Upload a downscaled local image to the user's private thumbnail folder. */
async function uploadThumbnail(uid: string, localUri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = decodeBase64(base64);
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabase.storage
    .from(THUMBNAIL_BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}
