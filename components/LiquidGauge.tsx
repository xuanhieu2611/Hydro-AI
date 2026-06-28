import { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, Path, ClipPath, G } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';

import { colors } from '@/lib/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface LiquidGaugeProps {
  /** 0..1 (clamped). The water rises to this fraction of the circle. */
  progress: number;
  size?: number;
  /** Center content (e.g. the percentage label). */
  children?: React.ReactNode;
}

const WAVE_STEPS = 40;
const WAVE_COUNT = 1.6; // crests across the diameter
const AMPLITUDE = 7; // px

/**
 * Hydration gauge as a glass of water: an SVG circle whose fill rises to `progress`,
 * with two layered sine waves rippling continuously on the UI thread. Logging a
 * drink raises the waterline (PRD §6 — the dashboard reacts instantly). The fluid
 * metaphor is the app's visual identity (water-forward, on-brand).
 */
export function LiquidGauge({ progress, size = 240, children }: LiquidGaugeProps) {
  const inset = 8; // room for the rim stroke
  const r = (size - inset * 2) / 2;
  const cx = size / 2;

  const fill = useSharedValue(0);
  const phase = useSharedValue(0);

  useEffect(() => {
    fill.value = withTiming(Math.max(0, Math.min(1, progress)), {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, fill]);

  useEffect(() => {
    // Continuous horizontal drift — the surface never sits still.
    phase.value = withRepeat(
      withTiming(2 * Math.PI, { duration: 2600, easing: Easing.linear }),
      -1,
      false,
    );
  }, [phase]);

  // The water body. waterY is the surface; fall to the bottom and close the shape.
  const makeWave = (offset: number, amp: number) =>
    useAnimatedProps(() => {
      'worklet';
      const top = inset;
      const span = size - inset * 2;
      const waterY = top + span * (1 - fill.value);
      let d = `M ${0} ${waterY}`;
      for (let i = 0; i <= WAVE_STEPS; i++) {
        const x = (i / WAVE_STEPS) * size;
        const y =
          waterY +
          Math.sin((i / WAVE_STEPS) * 2 * Math.PI * WAVE_COUNT + phase.value + offset) * amp;
        d += ` L ${x} ${y}`;
      }
      d += ` L ${size} ${size} L 0 ${size} Z`;
      return { d };
    });

  const backWave = makeWave(Math.PI, AMPLITUDE * 0.7);
  const frontWave = makeWave(0, AMPLITUDE);

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="water" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.aqua[300]} />
            <Stop offset="0.55" stopColor={colors.hydro[400]} />
            <Stop offset="1" stopColor={colors.hydro[600]} />
          </LinearGradient>
          <ClipPath id="bowl">
            <Circle cx={cx} cy={cx} r={r} />
          </ClipPath>
        </Defs>

        {/* Empty vessel */}
        <Circle cx={cx} cy={cx} r={r} fill={colors.hydro[50]} />

        {/* Water, clipped to the circle */}
        <G clipPath="url(#bowl)">
          <AnimatedPath animatedProps={backWave} fill={colors.hydro[300]} opacity={0.55} />
          <AnimatedPath animatedProps={frontWave} fill="url(#water)" />
        </G>

        {/* Glass rim */}
        <Circle cx={cx} cy={cx} r={r} fill="none" stroke={colors.hydro[200]} strokeWidth={3} />
      </Svg>

      <View className="absolute items-center justify-center">{children}</View>
    </View>
  );
}
