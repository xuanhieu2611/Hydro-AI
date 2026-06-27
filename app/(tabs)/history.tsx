import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HistoryScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-1 px-6 pt-4">
        <Text className="text-3xl font-bold text-slate-900">History</Text>
        <View className="mt-10 flex-1 items-center justify-center">
          {/* Phase 2/Beyond-MVP: weekly bar chart + monthly heatmap. */}
          <Text className="text-slate-400">7-day & 30-day history coming soon</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
