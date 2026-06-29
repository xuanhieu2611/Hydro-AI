import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
  interpolate,
  Easing,
  FadeIn,
  FadeOut,
  FadeInDown,
  ZoomIn,
  LinearTransition,
} from 'react-native-reanimated';

import { ResultPanel } from './ResultPanel';
import { tapSuccess } from '@/lib/haptics';
import type { AnalysisResult, NewLogEntry, UnitPreference } from '@/lib/data/types';

/** Reasoning steps cycled while analyzing — reads like the app is working it out. */
const STATUS_STEPS = [
  'Finding the container…',
  'Reading the fill level…',
  'Estimating volume…',
];

const DEVELOP_MS = 1600; // dim → bright + haze clear
// One shimmer pass == one reasoning step: the sweep "scans" the photo, the text
// flips to the next step the moment the sweep reaches the right edge, then the
// bar rests off-screen for GAP_MS before the next scan — a deliberate
// scan → conclude → beat → scan rhythm. Both run off this one cadence.
const SWEEP_MS = 800; // visible left → right scan
const GAP_MS = 400; // pause after a scan before the next
const CYCLE_MS = SWEEP_MS + GAP_MS;
// Floor on the "thinking" sequence so every step gets its own scan even if the
// analyzer returns instantly (mock, or a fast backend): last step appears after
// (n-1) cycles, then we let its scan play + a beat. A slower API extends past this.
const MIN_ANALYZE_MS = (STATUS_STEPS.length - 1) * CYCLE_MS + SWEEP_MS + 250; // ≈ 3450ms
const PRINT_W = 280; // film-print width (photo + frame)

interface PolaroidResultProps {
  /** The frozen captured photo. */
  imageUri: string | null;
  /** null while analyzing; set once the estimate lands. */
  result: AnalysisResult | null;
  unit: UnitPreference;
  logging?: boolean;
  onLog: (entry: NewLogEntry) => void;
  onRetake: () => void;
}

/**
 * Post-capture overlay. The captured photo is treated as one continuous object:
 * it floats in as a film print, "develops" (dim → bright, a milky haze clears,
 * a shimmer sweeps) while step-by-step status text cycles, then — once the
 * estimate arrives — straightens, rises, and grows the result panel out of its
 * base. The opaque scrim also hides the live `CameraView` behind it, freezing
 * the frame during analysis.
 */
export function PolaroidResult({
  imageUri,
  result,
  unit,
  logging,
  onLog,
  onRetake,
}: PolaroidResultProps) {
  const develop = useSharedValue(0); // 0 = dim/hazed, 1 = fully developed
  const shimmer = useSharedValue(-1); // -1 → 1 sweep position
  const straighten = useSharedValue(0); // 0 = tilted, 1 = upright (on develop)

  const [stepIndex, setStepIndex] = useState(0);
  // Minimum-thinking gate: hold the working sequence open for at least
  // MIN_ANALYZE_MS so the user always sees the app reason through all 3 steps,
  // however fast the analyzer is. We only reveal once the result is in AND the
  // floor has passed; a slow API just pushes the reveal later (lingering on the
  // last step). The app should never feel like it "cheated" the answer.
  const [minElapsed, setMinElapsed] = useState(false);
  const reveal = result != null && minElapsed;
  const analyzing = !reveal;
  const revealed = useRef(false);

  // Kick off the develop animation + the minimum-thinking timer on mount.
  useEffect(() => {
    develop.value = withTiming(1, { duration: DEVELOP_MS, easing: Easing.out(Easing.cubic) });
    const t = setTimeout(() => setMinElapsed(true), MIN_ANALYZE_MS);
    return () => clearTimeout(t);
  }, [develop]);

  // Walk the status steps in order and hold on the last; shimmer loops. Both
  // stop the instant we reveal the result.
  useEffect(() => {
    if (reveal) return;
    // Each cycle: scan L→R (visible), rest off-screen-right for GAP_MS, then
    // snap back off-screen-left (instant, unseen) and scan again.
    shimmer.value = -1;
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: SWEEP_MS, easing: Easing.linear }),
        withTiming(1, { duration: GAP_MS }), // hold off-screen (the pause)
        withTiming(-1, { duration: 0 }), // reset off-screen-left, unseen
      ),
      -1,
      false,
    );
    // Flip the text the instant each scan reaches the right edge: first at
    // SWEEP_MS, then once per cycle. Holds on the last step.
    const flip = () => setStepIndex((i) => Math.min(i + 1, STATUS_STEPS.length - 1));
    let interval: ReturnType<typeof setInterval> | undefined;
    const first = setTimeout(() => {
      flip();
      interval = setInterval(flip, CYCLE_MS);
    }, SWEEP_MS);
    return () => {
      cancelAnimation(shimmer);
      clearTimeout(first);
      if (interval) clearInterval(interval);
    };
  }, [reveal, shimmer]);

  // The "developed!" beat: snap to fully clear, straighten, and buzz once.
  useEffect(() => {
    if (!reveal || revealed.current) return;
    revealed.current = true;
    develop.value = withTiming(1, { duration: 300 });
    straighten.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    tapSuccess();
  }, [reveal, develop, straighten]);

  const frameStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(straighten.value, [0, 1], [-2, 0])}deg` }],
  }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - develop.value) }));
  const hazeStyle = useAnimatedStyle(() => ({ opacity: 0.7 * (1 - develop.value) }));
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(shimmer.value, [-1, 1], [-200, PRINT_W + 80]) },
      { rotate: '18deg' },
    ],
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={StyleSheet.absoluteFill} className="bg-black/80" />

      <View className="flex-1 items-center justify-center px-6" pointerEvents="box-none">
        <Animated.View
          layout={LinearTransition.duration(550).easing(Easing.out(Easing.cubic))}
          className="w-full items-center"
        >
          {/* The film print. Entrance lives on the wrapper and the tilt
              transform on the inner view, so the layout/entering animation and
              our animated transform don't fight over the same node. */}
          <Animated.View entering={ZoomIn.springify().damping(16).mass(0.7)}>
           <Animated.View
            style={[
              frameStyle,
              {
                width: PRINT_W,
                shadowColor: '#000',
                shadowOpacity: 0.4,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 12 },
              },
            ]}
            className="rounded-2xl bg-white p-3 pb-4"
           >
            <View className="overflow-hidden rounded-xl bg-hydro-950">
              {imageUri ? (
                <Image source={{ uri: imageUri }} className="h-56 w-full" resizeMode="cover" />
              ) : (
                <View className="h-56 w-full" />
              )}

              {/* Develop overlays: dim (brightness) + milky haze, both clearing. */}
              <Animated.View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, dimStyle]}
                className="bg-black"
              />
              <Animated.View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, hazeStyle]}
                className="bg-white"
              />

              {/* Shimmer sweep while analyzing. */}
              {analyzing && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    { position: 'absolute', top: -40, bottom: -40, width: 70 },
                    shimmerStyle,
                  ]}
                >
                  <LinearGradient
                    colors={['transparent', 'rgba(255,255,255,0.45)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ flex: 1 }}
                  />
                </Animated.View>
              )}
            </View>

            {/* Caption strip (the polaroid's white border) — cycling status. */}
            {analyzing && (
              <View className="mt-3 h-6 items-center justify-center">
                <Animated.Text
                  key={stepIndex}
                  entering={FadeIn.duration(250)}
                  exiting={FadeOut.duration(200)}
                  className="text-sm font-medium text-slate-700"
                >
                  {STATUS_STEPS[stepIndex]}
                </Animated.Text>
              </View>
            )}

            {/* Analyzing badge, overlapping the print's top edge. */}
            {analyzing && (
              <Animated.View
                exiting={FadeOut.duration(200)}
                style={{ position: 'absolute', top: -12, alignSelf: 'center' }}
                className="flex-row items-center gap-1.5 rounded-full bg-hydro-500 px-3 py-1"
              >
                <Ionicons name="sparkles" size={12} color="white" />
                <Text className="text-xs font-semibold text-white">Analyzing</Text>
              </Animated.View>
            )}
           </Animated.View>
          </Animated.View>

          {/* Result panel slides out of the base of the print — only once the
              full "thinking" sequence has played (reveal), not the instant the
              estimate arrives. */}
          {reveal && (
            <Animated.View
              entering={FadeInDown.duration(500).easing(Easing.out(Easing.cubic))}
              className="mt-5 w-full rounded-3xl bg-white px-6 py-5"
              style={{
                shadowColor: '#000',
                shadowOpacity: 0.18,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 8 },
              }}
            >
              <ResultPanel
                result={result}
                imageUri={imageUri}
                unit={unit}
                logging={logging}
                onLog={onLog}
                onRetake={onRetake}
              />
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}
