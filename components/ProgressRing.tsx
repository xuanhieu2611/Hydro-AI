import { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  /** 0..1 (clamped). Values > 1 cap the ring but the label can show the real total. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  /** Center content (e.g. the intake label). */
  children?: React.ReactNode;
  trackColor?: string;
  progressColor?: string;
}

/**
 * Animated hydration ring. The arc grows on every progress change so logging a
 * drink visibly fills it toward the goal (PRD §6 — the dashboard should react
 * instantly). Built on react-native-svg + Reanimated so it runs on the UI thread.
 */
export function ProgressRing({
  progress,
  size = 220,
  strokeWidth = 18,
  children,
  trackColor = '#E6F4FE',
  progressColor = '#0EA5E9',
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animated = useSharedValue(0);

  useEffect(() => {
    const clamped = Math.max(0, Math.min(1, progress));
    animated.value = withTiming(clamped, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, animated]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animated.value),
  }));

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          // Start the arc at 12 o'clock and sweep clockwise.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View className="absolute items-center justify-center">{children}</View>
    </View>
  );
}
