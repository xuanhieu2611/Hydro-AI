import { useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { ResultCard } from '@/components/ResultCard';
import { useAnalyzeImage, useAddLog, useProfile } from '@/lib/query/hooks';
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
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const unit = profile.data?.unit_preference ?? 'ml';
  const busy = capturing || analyze.isPending;

  /** Downscale a source image, then run it through the (mock) analyzer. */
  const analyzeUri = async (uri: string) => {
    const thumb = await downscale(uri);
    setImageUri(thumb);
    setCapturing(false);
    const analysis = await analyze.mutateAsync(thumb);
    setResult(analysis);
  };

  const handleCapture = async () => {
    if (!cameraRef.current || busy) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!photo) {
        setCapturing(false);
        return;
      }
      await analyzeUri(photo.uri);
    } catch {
      setCapturing(false);
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
    setCapturing(true);
    try {
      await analyzeUri(picked.assets[0].uri);
    } catch {
      setCapturing(false);
    }
  };

  const handleRetake = () => {
    setResult(null);
    setImageUri(null);
    analyze.reset();
  };

  const handleLog = (entry: NewLogEntry) => {
    addLog.mutate(entry, { onSuccess: () => router.back() });
  };

  if (!permission) {
    return <Centered><ActivityIndicator color="white" /></Centered>;
  }

  if (!permission.granted) {
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

  return (
    <View className="flex-1 bg-black">
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />

      <CloseButton onPress={() => router.back()} />

      {/* Capture/analyze overlay */}
      {busy && (
        <View className="absolute inset-0 items-center justify-center bg-black/40">
          <ActivityIndicator size="large" color="white" />
          <Text className="mt-3 text-base font-medium text-white">
            {capturing ? 'Capturing…' : 'Estimating your drink…'}
          </Text>
        </View>
      )}

      {/* Shutter + gallery — hidden once we have a result so the card has room. */}
      {!result && !busy && (
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

      {result && (
        <ResultCard
          result={result}
          imageUri={imageUri}
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
