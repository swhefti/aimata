'use client';

import { useMemo } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
  strokeWidth?: number;
  className?: string;
}

export default function Sparkline({
  data,
  width = 120,
  height = 32,
  color,
  fillOpacity = 0.1,
  strokeWidth = 1.5,
  className = '',
}: SparklineProps) {
  const { path, fillPath, lineColor } = useMemo(() => {
    if (!data || data.length < 2) return { path: '', fillPath: '', lineColor: '#9e9b96' };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;
    const w = width - padding * 2;
    const h = height - padding * 2;

    const points = data.map((val, i) => ({
      x: padding + (i / (data.length - 1)) * w,
      y: padding + h - ((val - min) / range) * h,
    }));

    const pathD = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');

    const fillD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;

    // Green if trending up, red if down
    const trend = data[data.length - 1] >= data[0];
    const lineColor = color || (trend ? '#22c55e' : '#ef4444');

    return { path: pathD, fillPath: fillD, lineColor };
  }, [data, width, height, color]);

  if (!data || data.length < 2) {
    return <div style={{ width, height }} className={className} />;
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
    >
      <path d={fillPath} fill={lineColor} opacity={fillOpacity} />
      <path
        d={path}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
