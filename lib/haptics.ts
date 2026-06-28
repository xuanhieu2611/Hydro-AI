import * as Haptics from 'expo-haptics';

/**
 * Haptics are a non-essential nicety: a tap should never crash logging just
 * because the native module is missing (e.g. an older dev client build, or a
 * simulator). These wrappers swallow any failure and no-op.
 */
export function tapLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function tapSelection() {
  Haptics.selectionAsync().catch(() => {});
}

export function tapSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
