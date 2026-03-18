'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  colorize?: boolean; // green if positive, red if negative
}

export default function AnimatedNumber({
  value,
  duration = 600,
  decimals = 2,
  prefix = '',
  suffix = '',
  className = '',
  colorize = false,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const frameRef = useRef<number>(0);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;

    // Flash direction
    setFlash(to > from ? 'up' : 'down');
    const flashTimer = setTimeout(() => setFlash(null), 400);

    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      setDisplay(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(to);
        prevRef.current = to;
      }
    }

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
      clearTimeout(flashTimer);
    };
  }, [value, duration]);

  const colorClass = colorize
    ? display >= 0 ? 'text-mata-green' : 'text-mata-red'
    : '';

  const flashClass = flash === 'up'
    ? 'animate-[flashGreen_0.4s_ease-out]'
    : flash === 'down'
    ? 'animate-[flashRed_0.4s_ease-out]'
    : '';

  return (
    <span className={`${className} ${colorClass} ${flashClass} transition-colors`}>
      {prefix}{display >= 0 && colorize ? '+' : ''}{display.toFixed(decimals)}{suffix}
    </span>
  );
}
