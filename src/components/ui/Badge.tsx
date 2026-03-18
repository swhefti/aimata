type BadgeVariant = 'hot' | 'swing' | 'run' | 'low' | 'medium' | 'high' | 'default';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  hot: 'bg-mata-red/10 text-mata-red border-mata-red/20',
  swing: 'bg-mata-blue/10 text-mata-blue border-mata-blue/20',
  run: 'bg-mata-green/10 text-mata-green border-mata-green/20',
  low: 'bg-mata-green/10 text-mata-green border-mata-green/20',
  medium: 'bg-mata-yellow/10 text-mata-yellow border-mata-yellow/20',
  high: 'bg-mata-red/10 text-mata-red border-mata-red/20',
  default: 'bg-mata-surface text-mata-text-secondary border-mata-border',
};

export default function Badge({ label, variant = 'default' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${VARIANT_CLASSES[variant]}`}
    >
      {label}
    </span>
  );
}
