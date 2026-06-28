import { Asset } from 'expo-asset';

/**
 * Fake-camera dev mode. The iOS simulator has no camera (the preview is just
 * black and `takePictureAsync` can't produce a usable photo), so this lets us
 * iterate on the capture → analyze → result-card UI without a device — and
 * without spending money, since it pairs with the `MockAnalyzer`.
 *
 * Enabled by `EXPO_PUBLIC_FAKE_CAMERA=1`. On a real device it's off and the
 * real `CameraView` is used.
 *
 * The sample order mirrors `MockAnalyzer`'s SCRIPT so the still shown in the
 * viewfinder visually matches the result the analyzer returns for that capture
 * (coffee mug → confident coffee, glass → confident water, tumbler → a
 * low-confidence range, laptop → "not a drink").
 */
export const FAKE_CAMERA_ENABLED = process.env.EXPO_PUBLIC_FAKE_CAMERA === '1';

export interface FakeCameraSample {
  label: string;
  /** A bundled-asset module id (the number `require()` returns). */
  source: number;
}

export const FAKE_CAMERA_SAMPLES: FakeCameraSample[] = [
  { label: 'Coffee mug', source: require('../../assets/fake-camera/coffee-mug.jpg') },
  { label: 'Glass of water', source: require('../../assets/fake-camera/water-glass.jpg') },
  { label: 'Tumbler', source: require('../../assets/fake-camera/tumbler.jpg') },
  { label: 'Not a drink', source: require('../../assets/fake-camera/not-a-drink.jpg') },
];

/**
 * Resolve a bundled sample to a real local file URI so the existing capture
 * pipeline (downscale via ImageManipulator → analyze) works unchanged.
 */
export async function fakeCaptureUri(index: number): Promise<string> {
  const sample = FAKE_CAMERA_SAMPLES[index % FAKE_CAMERA_SAMPLES.length];
  const asset = Asset.fromModule(sample.source);
  await asset.downloadAsync();
  return asset.localUri ?? asset.uri;
}
