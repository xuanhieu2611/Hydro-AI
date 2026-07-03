import { View, Text, Pressable } from 'react-native';

import { BeverageIcon } from './BeverageIcon';
import { BEVERAGE_LABELS } from '@/lib/beverage';
import { colors } from '@/lib/theme';
import type { BeverageType } from '@/lib/data/types';

const ORDER: BeverageType[] = [
  'water',
  'coffee',
  'tea',
  'juice',
  'soda',
  'smoothie',
  'other',
];

interface BeveragePickerProps {
  value: BeverageType;
  onChange: (type: BeverageType) => void;
}

/** Chip grid for picking a beverage type (manual log). */
export function BeveragePicker({ value, onChange }: BeveragePickerProps) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {ORDER.map((type) => {
        const selected = type === value;
        return (
          <Pressable
            key={type}
            onPress={() => onChange(type)}
            className={`flex-row items-center gap-1.5 rounded-full border px-3 py-2 ${
              selected
                ? 'border-hydro-500 bg-hydro-50'
                : 'border-slate-200 bg-white active:bg-slate-50'
            }`}
          >
            <BeverageIcon
              type={type}
              size={18}
              color={selected ? colors.hydro[700] : colors.slate[500]}
            />
            <Text
              className={`text-sm font-medium ${
                selected ? 'text-hydro-700' : 'text-slate-600'
              }`}
            >
              {BEVERAGE_LABELS[type]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
