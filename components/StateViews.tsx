import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Shared empty / loading / error blocks so every screen handles its query
 * states consistently (Phase 4 polish). Keep these dumb and presentational —
 * screens decide which to render from their query status.
 */

export function LoadingState({ label }: { label?: string }) {
  return (
    <View className="items-center py-12">
      <ActivityIndicator color="#0EA5E9" />
      {label && <Text className="mt-3 text-sm text-slate-400">{label}</Text>}
    </View>
  );
}

export function EmptyState({
  emoji = '💧',
  title,
  subtitle,
}: {
  emoji?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View className="items-center py-10">
      <Text className="text-4xl">{emoji}</Text>
      <Text className="mt-3 text-base font-medium text-slate-500">{title}</Text>
      {subtitle && <Text className="mt-0.5 text-sm text-slate-400">{subtitle}</Text>}
    </View>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  subtitle = 'Check your connection and try again.',
  onRetry,
}: {
  title?: string;
  subtitle?: string;
  onRetry?: () => void;
}) {
  return (
    <View className="items-center py-10">
      <Ionicons name="cloud-offline-outline" size={40} color="#94A3B8" />
      <Text className="mt-3 text-base font-medium text-slate-600">{title}</Text>
      <Text className="mt-0.5 text-center text-sm text-slate-400">{subtitle}</Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          className="mt-4 flex-row items-center gap-1.5 rounded-2xl bg-hydro-50 px-5 py-2.5 active:bg-hydro-100"
        >
          <Ionicons name="refresh" size={16} color="#0284C7" />
          <Text className="text-sm font-semibold text-hydro-600">Try again</Text>
        </Pressable>
      )}
    </View>
  );
}
