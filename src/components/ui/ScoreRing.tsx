'use client';

import { useMemo } from 'react';

interface ScoreRingProps {
  score: number;
  size?: number;
  label?: string;
}

function scoreColor(score: number): string {
  if (score <= 30) return '#ef4444'; // red
  if (score <= 50) return '#f59e0b'; // yellow
  if (score <= 70) return '#84cc16'; // lime
  return '#22c55e'; // green
}

export default function ScoreRing({ score, size = 64, label }: ScoreRingProps) {
  const strokeWidth = size * 0.1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  const color = useMemo(() => scoreColor(clamped), [clamped]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-mata-border"
          />
          {/* Score ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        {/* Score number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-black leading-none text-mata-text"
            style={{ fontSize: size * 0.3 }}
          >
            {Math.round(clamped)}
          </span>
        </div>
      </div>
      {label && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-mata-text-muted">
          {label}
        </span>
      )}
    </div>
  );
}
