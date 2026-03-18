interface ScoreBarProps {
  label: string;
  value: number;
  max?: number;
  color?: string;
}

export default function ScoreBar({ label, value, max = 100, color }: ScoreBarProps) {
  const pct = Math.min((value / max) * 100, 100);
  const barColor = color || (pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444');

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold text-mata-text-muted w-16 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-mata-surface overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="text-[10px] font-bold text-mata-text-secondary w-6 text-right">{Math.round(value)}</span>
    </div>
  );
}
