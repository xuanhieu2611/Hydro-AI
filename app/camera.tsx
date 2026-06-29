import { useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { PolaroidResult } from '@/components/PolaroidResult';
import { useAnalyzeImage, useAddLog, useProfile } from '@/lib/query/hooks';
import { analytics } from '@/lib/analytics';
import { tapLight } from '@/lib/haptics';
import {
  FAKE_CAMERA_ENABLED,
  FAKE_CAMERA_SAMPLES,
  fakeCaptureUri,
} from '@/lib/dev/fakeCamera';
import { RateLimitError } from '@/lib/data/errors';
import type { AnalysisResult, NewLogEntry } from '@/lib/data/types';

/** Downscale captured photos before analysis — keeps the eventual upload cheap
 *  and the AI round-trip fast (CLAUDE.md privacy/cost notes). */
const MAX_WIDTH = 1024;

async function downscale(uri: string): Promise<string> {
  const rendered = await ImageManipulator.manipulate(uri)
    .resize({ width: MAX_WIDTH })
    .renderAsync();
  const result = await rendered.saveAsync({ compress: 0.6, format: SaveFormat.JPEG });
  return result.uri;
}

export default function CameraModal() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const profile = useProfile();
  const analyze = useAnalyzeImage();
  const addLog = useAddLog();

  const [capturing, setCapturing] = useState(false);
  // The frozen full-res shot shown in the polaroid (set instantly on capture).
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  // The downscaled thumbnail kept for logging / Storage upload (Phase B).
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  // Which entry point produced the current result — for log_added analytics.
  const [source, setSource] = useState<'camera' | 'gallery'>('camera');
  // Fake-camera dev mode: which scripted sample the viewfinder is showing.
  // Mirrors the MockAnalyzer cursor so the still matches the returned result.
  const [fakeIndex, setFakeIndex] = useState(0);

  const unit = profile.data?.unit_preference ?? 'ml';
  const busy = capturing || analyze.isPending;

  /** Bail out of a failed capture: drop the frozen frame, return to the
   *  viewfinder, and tell the user what went wrong (rate limit gets a tailored
   *  message). Without this the polaroid would spin on "Analyzing" forever. */
  const handleAnalyzeError = (err: unknown) => {
    setCapturing(false);
    handleRetake();
    const message =
      err instanceof RateLimitError
        ? err.message
        : 'Could not analyze that photo. Please try again.';
    Alert.alert(
      err instanceof RateLimitError ? 'Slow down a sec' : 'Analysis failed',
      message,
    );
  };

  /** Freeze the frame, downscale, then run it through the (mock) analyzer. */
  const analyzeUri = async (uri: string) => {
    setCapturedUri(uri); // freeze instantly — the polaroid takes over from here
    const thumb = await downscale(uri);
    setImageUri(thumb);
    setCapturing(false);
    const analysis = await analyze.mutateAsync(thumb);
    setResult(analysis);
  };

  const handleCapture = async () => {
    if (busy) return;
    tapLight();
    setSource('camera');
    setCapturing(true);
    try {
      // Fake mode: feed the bundled sample (no real camera on the simulator);
      // advance the cursor so the next viewfinder/result pair stays in sync.
      if (FAKE_CAMERA_ENABLED) {
        const uri = await fakeCaptureUri(fakeIndex);
        setFakeIndex((i) => i + 1);
        await analyzeUri(uri);
        return;
      }
      if (!cameraRef.current) {
        setCapturing(false);
        return;
      }
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!photo) {
        setCapturing(false);
        return;
      }
      await analyzeUri(photo.uri);
    } catch (err) {
      handleAnalyzeError(err);
    }
  };

  // Add from camera roll (US-05) — same downscale → analyze → log path.
  const handlePickImage = async () => {
    if (busy) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (picked.canceled || !picked.assets[0]) return;
    setSource('gallery');
    setCapturing(true);
    try {
      await analyzeUri(picked.assets[0].uri);
    } catch (err) {
      handleAnalyzeError(err);
    }
  };

  const handleRetake = () => {
    setResult(null);
    setCapturedUri(null);
    setImageUri(null);
    analyze.reset();
  };

  const handleLog = (entry: NewLogEntry) => {
    addLog.mutate(entry, {
      onSuccess: () => {
        analytics.track('log_added', {
          method: source,
          beverage_type: entry.beverage_type,
          volume_ml: entry.user_adjusted_volume_ml ?? entry.estimated_volume_ml,
        });
        router.back();
      },
    });
  };

  // Fake mode bypasses the real camera, so skip its permission gate entirely.
  if (!FAKE_CAMERA_ENABLED && !permission) {
    return <Centered><ActivityIndicator color="white" /></Centered>;
  }

  if (!FAKE_CAMERA_ENABLED && !permission?.granted) {
    return (
      <Centered>
        <Ionicons name="camera-outline" size={56} color="#94A3B8" />
        <Text className="mt-4 text-center text-base text-slate-300">
          Hydro AI needs camera access to estimate your drink.
        </Text>
        <Pressable
          onPress={requestPermission}
          className="mt-6 rounded-2xl bg-hydro-500 px-6 py-3 active:bg-hydro-600"
        >
          <Text className="text-base font-semibold text-white">Grant access</Text>
        </Pressable>
        <CloseButton onPress={() => router.back()} />
      </Centered>
    );
  }

  const fakeSample = FAKE_CAMERA_SAMPLES[fakeIndex % FAKE_CAMERA_SAMPLES.length];

  return (
    <View className="flex-1 bg-black">
      {FAKE_CAMERA_ENABLED ? (
        // Simulator-friendly stand-in for the (black) camera preview.
        <Image source={fakeSample.source} style={{ flex: 1 }} resizeMode="cover" />
      ) : (
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
      )}

      <CloseButton onPress={() => router.back()} />

      {FAKE_CAMERA_ENABLED && !capturedUri && (
        <View className="absolute inset-x-0 top-16 flex-row items-center justify-center">
          <View className="flex-row items-center gap-1.5 rounded-full bg-amber-500/90 px-3 py-1">
            <Ionicons name="construct" size={12} color="white" />
            <Text className="text-xs font-semibold text-white">
              Fake camera · {fakeSample.label}
            </Text>
          </View>
        </View>
      )}

      {/* Shutter + gallery — hidden once a shot is captured so the print has room. */}
      {!capturedUri && (
        <View className="absolute inset-x-0 bottom-12 flex-row items-center justify-center">
          <Pressable
            onPress={handleCapture}
            className="h-20 w-20 items-center justify-center rounded-full border-4 border-white/80 bg-white/30 active:bg-white/50"
          >
            <View className="h-16 w-16 rounded-full bg-white" />
          </Pressable>
          <Pressable
            onPress={handlePickImage}
            hitSlop={8}
            className="absolute right-10 h-14 w-14 items-center justify-center rounded-2xl bg-black/40 active:bg-black/60"
          >
            <Ionicons name="images-outline" size={26} color="white" />
          </Pressable>
        </View>
      )}

      {/* Privacy reassurance (PRD privacy promise). */}
      {!capturedUri && (
        <View className="absolute inset-x-0 bottom-2 flex-row items-center justify-center gap-1.5">
          <Ionicons name="lock-closed" size={11} color="rgba(255,255,255,0.6)" />
          <Text className="text-xs text-white/60">Photos are processed and discarded</Text>
        </View>
      )}

      {/* Post-capture: frozen photo develops, then docks the result panel. */}
      {capturedUri && (
        <PolaroidResult
          imageUri={capturedUri}
          result={result}
          unit={unit}
          logging={addLog.isPending}
          onLog={handleLog}
          onRetake={handleRetake}
        />
      )}
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-1 items-center justify-center bg-black px-8">{children}</View>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="absolute top-14 left-6 h-10 w-10 items-center justify-center rounded-full bg-black/40"
    >
      <Ionicons name="close" size={24} color="white" />
    </Pressable>
  );
}
