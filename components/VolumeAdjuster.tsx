import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { tapSelection } from '@/lib/haptics';

import { formatVolume } from '@/lib/units';
import type { UnitPreference } from '@/lib/data/types';

interface VolumeAdjusterProps {
  /** Current volume in canonical ml. */
  valueMl: number;
  onChange: (nextMl: number) => void;
  unit: UnitPreference;
  /** Step in ml per tap. */
  stepMl?: number;
  minMl?: number;
  maxMl?: number;
}

/**
 * One-line volume stepper used by the result card and the edit sheet. Storage
 * stays canonical ml (CLAUDE.md); we only format to the user's unit for display.
 */
export function VolumeAdjuster({
  valueMl,
  onChange,
  unit,
  stepMl = 50,
  minMl = 50,
  maxMl = 2000,
}: VolumeAdjusterProps) {
  const clamp = (v: number) => Math.max(minMl, Math.min(maxMl, v));
  const step = (next: number) => {
    tapSelection();
    onChange(clamp(next));
  };
  const dec = () => step(valueMl - stepMl);
  const inc = () => step(valueMl + stepMl);

  return (
    <View className="flex-row items-center justify-between">
      <StepButton icon="remove" onPress={dec} disabled={valueMl <= minMl} />
      <View className="items-center">
        <Text className="text-4xl font-bold text-slate-900">
          {formatVolume(valueMl, unit)}
        </Text>
      </View>
      <StepButton icon="add" onPress={inc} disabled={valueMl >= maxMl} />
    </View>
  );
}

function StepButton({
  icon,
  onPress,
  disabled,
}: {
  icon: 'add' | 'remove';
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      className={`h-14 w-14 items-center justify-center rounded-full border ${
        disabled ? 'border-slate-100 bg-slate-50' : 'border-hydro-100 bg-hydro-50 active:bg-hydro-100'
      }`}
    >
      <Ionicons name={icon} size={26} color={disabled ? '#CBD5E1' : '#0284C7'} />
    </Pressable>
  );
}
