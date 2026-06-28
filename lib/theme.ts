/**
 * JS-side design tokens. NativeWind classes own styling in markup, but SVG fills,
 * gradient stops, and Reanimated values need raw color strings — keep them here so
 * the two stay in sync with tailwind.config.js (the fluid/water identity).
 */
export const colors = {
  hydro: {
    50: '#E6F4FE',
    100: '#CDE9FD',
    200: '#A9D9FB',
    300: '#7CC6F8',
    400: '#38BDF8',
    500: '#0EA5E9',
    600: '#0284C7',
    700: '#0369A1',
    800: '#075985',
    900: '#0C4A6E',
    950: '#082F49',
  },
  aqua: {
    300: '#5EEAD4',
    400: '#2DD4BF',
    500: '#14B8A6',
  },
  slate: {
    400: '#94A3B8',
    500: '#64748B',
    900: '#0F172A',
  },
} as const;

/** Tuple gradients for expo-linear-gradient (top → bottom unless noted). */
export const gradients = {
  /** App background — pale sky fading to white. */
  sky: ['#EAF6FF', '#F7FBFF', '#FFFFFF'] as const,
  /** The liquid body inside the gauge — deep water with an aqua sheen. */
  water: ['#5EEAD4', '#38BDF8', '#0284C7'] as const,
  /** Primary action / hero surfaces. */
  hero: ['#0EA5E9', '#0369A1'] as const,
} as const;
