import React from 'react';
import { Text as RNText, TextInput as RNTextInput, StyleSheet } from 'react-native';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';

/**
 * Nunito is the app's typeface. In React Native each weight is its own font
 * face, so a `fontWeight` (what Tailwind's `font-bold`/`font-semibold` set)
 * won't select the right face on its own. This module maps each resolved weight
 * to the matching Nunito face and patches Text/TextInput once at load — so every
 * existing `font-*` class renders the correct weight with zero per-component edits.
 */
const FACE_FOR_WEIGHT: Record<string, string> = {
  '100': 'Nunito_400Regular',
  '200': 'Nunito_400Regular',
  '300': 'Nunito_400Regular',
  '400': 'Nunito_400Regular',
  normal: 'Nunito_400Regular',
  '500': 'Nunito_500Medium',
  '600': 'Nunito_600SemiBold',
  '700': 'Nunito_700Bold',
  bold: 'Nunito_700Bold',
  '800': 'Nunito_800ExtraBold',
  '900': 'Nunito_800ExtraBold',
};

function patchComponent(Component: unknown) {
  const C = Component as any;
  if (!C || C.__nunitoPatched) return;
  const orig = C.render;
  if (typeof orig !== 'function') return;

  C.render = function patchedRender(...args: unknown[]) {
    const el = orig.apply(this, args);
    if (!el) return el;
    const flat = (StyleSheet.flatten((el.props as any).style) ?? {}) as {
      fontWeight?: string | number;
      fontFamily?: string;
    };
    // An explicit fontFamily wins; otherwise pick the face for the weight.
    const family =
      flat.fontFamily ??
      FACE_FOR_WEIGHT[String(flat.fontWeight ?? '400')] ??
      'Nunito_400Regular';
    return React.cloneElement(el, {
      // Our family first (so it applies), caller's style next (explicit wins),
      // then clear fontWeight so the OS doesn't double-synthesize a heavier face.
      style: [{ fontFamily: family }, (el.props as any).style, { fontWeight: undefined }],
    } as any);
  };
  C.__nunitoPatched = true;
}

patchComponent(RNText);
patchComponent(RNTextInput);

/** Load the Nunito faces; returns true once they're ready to render. */
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  return loaded;
}
