'use client';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export default function Logo({ size = 'md', showSubtitle = true }: LogoProps) {
  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-5xl',
  };

  const subtitleClasses = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  return (
    <div className="flex flex-col items-start">
      <h1 className={`${sizeClasses[size]} font-black tracking-tight leading-none`}>
        <span className="text-mata-text">ai</span>
        <span className="gradient-text">MATA</span>
      </h1>
      {showSubtitle && (
        <p
          className={`${subtitleClasses[size]} font-medium tracking-widest uppercase text-mata-text-muted mt-0.5`}
        >
          Multi-Agent Trading Advisor
        </p>
      )}
    </div>
  );
}
