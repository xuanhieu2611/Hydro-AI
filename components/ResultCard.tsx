import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { VolumeAdjuster } from './VolumeAdjuster';
import {
  beverageEmoji,
  beverageLabel,
  containerLabel,
  hydrationClass,
  HYDRATION_CLASS_META,
} from '@/lib/beverage';
import { formatVolume } from '@/lib/units';
import type {
  AnalysisResult,
  NewLogEntry,
  UnitPreference,
} from '@/lib/data/types';

/** < 0.70 forces explicit confirmation rather than one-tap accept (CLAUDE.md). */
const LOW_CONFIDENCE = 0.7;

interface ResultCardProps {
  result: AnalysisResult;
  /** Local image URI used as the thumbnail until Storage upload (Phase B). */
  imageUri: string | null;
  unit: UnitPreference;
  /** True while the optimistic log mutation is in flight. */
  logging?: boolean;
  onLog: (entry: NewLogEntry) => void;
  onRetake: () => void;
}

/**
 * Slide-up card shown after analysis. For a confident drink the primary action
 * is a one-tap "Log It"; a low-confidence result surfaces the estimate range and
 * downgrades the button to "Confirm & Log". A non-drink offers only a retake.
 */
export function ResultCard({
  result,
  imageUri,
  unit,
  logging,
  onLog,
  onRetake,
}: ResultCardProps) {
  if (!result.is_drink) {
    return <NonDrinkCard reasoning={result.reasoning} onRetake={onRetake} />;
  }

  return (
    <DrinkCard
      result={result}
      imageUri={imageUri}
      unit={unit}
      logging={logging}
      onLog={onLog}
      onRetake={onRetake}
    />
  );
}

function DrinkCard({
  result,
  imageUri,
  unit,
  logging,
  onLog,
  onRetake,
}: ResultCardProps) {
  const estimate = result.estimated_volume_ml ?? 250;
  const coefficient = result.hydration_coefficient ?? 1.0;
  const lowConfidence = result.confidence < LOW_CONFIDENCE;

  // Volume the user is about to log; starts at the AI estimate.
  const [volumeMl, setVolumeMl] = useState(estimate);
  const adjusted = volumeMl !== estimate;

  const hClass = hydrationClass(coefficient);
  const hMeta = HYDRATION_CLASS_META[hClass];

  const handleLog = () => {
    onLog({
      beverage_type: result.beverage_type ?? 'other',
      estimated_volume_ml: estimate,
      user_adjusted_volume_ml: adjusted ? volumeMl : null,
      hydration_coefficient: coefficient,
      thumbnail_url: imageUri,
      ai_confidence_score: result.confidence,
    });
  };

  return (
    <CardShell>
      <View className="flex-row items-center gap-3">
        <Text className="text-4xl">{beverageEmoji(result.beverage_type)}</Text>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-slate-900">
            {beverageLabel(result.beverage_type)}
          </Text>
          <Text className="text-sm text-slate-500">
            in a {containerLabel(result.container_type)}
          </Text>
        </View>
        <View
          className="rounded-full px-3 py-1"
          style={{ backgroundColor: hMeta.bg }}
        >
          <Text className="text-xs font-semibold" style={{ color: hMeta.tint }}>
            {hMeta.label}
          </Text>
        </View>
      </View>

      <View className="my-5">
        <VolumeAdjuster valueMl={volumeMl} onChange={setVolumeMl} unit={unit} />
        {lowConfidence && result.volume_range_ml && (
          <Text className="mt-2 text-center text-xs text-amber-600">
            Low confidence · we estimate{' '}
            {formatVolume(result.volume_range_ml[0], unit)}–
            {formatVolume(result.volume_range_ml[1], unit)}. Adjust if needed.
          </Text>
        )}
      </View>

      {result.reasoning && (
        <View className="mb-4 flex-row items-start gap-2 rounded-xl bg-slate-50 px-3 py-2">
          <Ionicons name="sparkles-outline" size={14} color="#64748B" />
          <Text className="flex-1 text-xs text-slate-500">{result.reasoning}</Text>
        </View>
      )}

      <Pressable
        onPress={handleLog}
        disabled={logging}
        className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-hydro-500 active:bg-hydro-600"
      >
        {logging ? (
          <ActivityIndicator color="white" />
        ) : (
          <>
            <Ionicons
              name={lowConfidence ? 'checkmark-circle' : 'water'}
              size={20}
              color="white"
            />
            <Text className="text-lg font-semibold text-white">
              {lowConfidence ? 'Confirm & Log' : 'Log It'}
            </Text>
          </>
        )}
      </Pressable>

      <Pressable onPress={onRetake} disabled={logging} className="mt-2 py-3">
        <Text className="text-center text-sm font-medium text-slate-500">
          Retake
        </Text>
      </Pressable>
    </CardShell>
  );
}

function NonDrinkCard({
  reasoning,
  onRetake,
}: {
  reasoning?: string;
  onRetake: () => void;
}) {
  return (
    <CardShell>
      <View className="items-center py-2">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-slate-100">
          <Ionicons name="help-outline" size={32} color="#94A3B8" />
        </View>
        <Text className="mt-4 text-xl font-bold text-slate-900">
          That doesn&apos;t look like a drink
        </Text>
        <Text className="mt-1 text-center text-sm text-slate-500">
          {reasoning ?? 'Point the camera at a glass, mug, or bottle and try again.'}
        </Text>
      </View>

      <Pressable
        onPress={onRetake}
        className="mt-5 h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-hydro-500 active:bg-hydro-600"
      >
        <Ionicons name="camera" size={20} color="white" />
        <Text className="text-lg font-semibold text-white">Retake</Text>
      </Pressable>
    </CardShell>
  );
}

/** Shared slide-up sheet chrome (rounded top, grab handle, entrance animation). */
function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <Animated.View
      entering={SlideInDown.springify().damping(20).mass(0.6)}
      className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white px-6 pb-10 pt-3"
      style={{ shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -4 } }}
    >
      <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-slate-200" />
      <Animated.View entering={FadeIn.delay(120)}>{children}</Animated.View>
    </Animated.View>
  );
}
