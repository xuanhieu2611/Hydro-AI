import { MaterialCommunityIcons } from '@expo/vector-icons';

import { beverageIcon } from '@/lib/beverage';
import { colors } from '@/lib/theme';
import type { BeverageType } from '@/lib/data/types';

/**
 * Brand-tinted vector icon for a beverage. Replaces emoji glyphs, which render
 * as tofu on iOS Simulators and drift across OS versions.
 */
export function BeverageIcon({
  type,
  size = 20,
  color = colors.hydro[500],
}: {
  type: BeverageType | null;
  size?: number;
  color?: string;
}) {
  return <MaterialCommunityIcons name={beverageIcon(type)} size={size} color={color} />;
}
