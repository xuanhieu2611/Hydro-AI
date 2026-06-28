import { useEffect, useRef, useState } from 'react';
import { Text, type TextProps } from 'react-native';

interface CountUpProps extends TextProps {
  value: number;
  /** Appended after the number, e.g. "%". */
  suffix?: string;
  /** Animation length in ms. */
  duration?: number;
}

/**
 * Animates a whole number from its previous value to `value` with an ease-out,
 * so the hydration percentage ticks up when a drink is logged instead of snapping.
 * Drives a JS-side rAF (the value is text, not a transformable prop).
 */
export function CountUp({ value, suffix = '', duration = 700, ...textProps }: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = from.current;
    const delta = value - start;
    if (delta === 0) return;

    const t0 = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setDisplay(Math.round(start + delta * eased));
      if (p < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        from.current = value;
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      from.current = value;
    };
  }, [value, duration]);

  return (
    <Text {...textProps}>
      {display}
      {suffix}
    </Text>
  );
}
