'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Logo from '@/components/ui/Logo';

interface Step {
  type: 'intro' | 'agent' | 'product' | 'final';
  agent?: string;
  image?: string;
  ringColor?: string;
  title: string;
  quote: string;
  detail?: string;
  bg?: string;
}

const STEPS: Step[] = [
  {
    type: 'intro',
    title: 'Welcome to aiMATA',
    quote: 'Your short-term trading co-pilot.',
    detail: 'We help you find stronger setups, build smarter baskets, and manage positions with discipline. Three AI agents work alongside you — each with a different specialty.',
    bg: 'from-mata-orange/5 to-mata-bg',
  },
  {
    type: 'product',
    title: 'How it works',
    quote: 'Scan. Pick. Build. Manage.',
    detail: 'Mark scans the market and surfaces the best opportunities. You drag them into your basket. Rex watches the basket and tells you when to act. Nia explains the story behind the moves. It\'s that simple.',
    bg: 'from-mata-surface/50 to-mata-bg',
  },
  {
    type: 'agent',
    agent: 'Mark',
    image: '/agents/mark.png',
    ringColor: 'ring-orange-400',
    title: 'Meet Mark',
    quote: '"I\'m Mark — I scan the entire market every day to find you the strongest short-term setups. Momentum, breakouts, timing — that\'s my world. When something scores high, I\'ll make sure you see it first. I live for the hunt."',
    detail: 'Mark owns the left column — the Scanned Market. Every opportunity card you see comes from his engine.',
    bg: 'from-orange-50/50 to-mata-bg',
  },
  {
    type: 'agent',
    agent: 'Rex',
    image: '/agents/rex.png',
    ringColor: 'ring-red-400',
    title: 'Meet Rex',
    quote: '"I\'m Rex. Once you build your basket, I take over. I watch your risk, concentration, and balance — and I tell you exactly what to do. Add, hold, trim, or exit. No sugarcoating. I\'m the one who keeps you disciplined when the market tries to make you emotional."',
    detail: 'Rex owns the middle column — Your Basket. Every action signal, risk warning, and profit-taking nudge comes from him.',
    bg: 'from-red-50/50 to-mata-bg',
  },
  {
    type: 'agent',
    agent: 'Nia',
    image: '/agents/nia.png',
    ringColor: 'ring-violet-400',
    title: 'Meet Nia',
    quote: '"Hey, I\'m Nia. I read between the lines — news, catalysts, sentiment shifts, and the stories that actually move markets. I\'ll tell you whether a setup has real substance behind it, or if it\'s just noise. Think of me as your narrative radar."',
    detail: 'Nia owns the right column — Latest News. She interprets what matters and connects the dots the numbers can\'t see.',
    bg: 'from-violet-50/50 to-mata-bg',
  },
  {
    type: 'final',
    title: 'You\'re ready',
    quote: 'Your team is assembled.',
    detail: 'Mark finds the setups. Rex manages the basket. Nia explains the story. Together, they help you trade smarter. Let\'s go.',
    bg: 'from-mata-orange/5 to-mata-bg',
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  function next() {
    if (isLast) {
      // Mark onboarding as done
      try { localStorage.setItem('aimata_onboarded', 'true'); } catch {}
      router.push('/dashboard');
    } else {
      setStep(step + 1);
    }
  }

  function skip() {
    try { localStorage.setItem('aimata_onboarded', 'true'); } catch {}
    router.push('/dashboard');
  }

  return (
    <div className={`flex min-h-screen items-center justify-center bg-gradient-to-br ${current.bg ?? 'from-mata-bg to-mata-bg'} px-4 transition-colors duration-500`}>
      <div className="w-full max-w-md">
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-mata-orange' : i < step ? 'w-1.5 bg-mata-orange/40' : 'w-1.5 bg-mata-border'
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-mata-border bg-mata-card p-8 shadow-xl shadow-black/5 animate-[fadeIn_0.4s_ease-out]" key={step}>
          {/* Logo on intro/final */}
          {(current.type === 'intro' || current.type === 'final') && (
            <div className="flex justify-center mb-6">
              <Logo size="lg" showSubtitle={false} />
            </div>
          )}

          {/* Agent image */}
          {current.type === 'agent' && current.image && (
            <div className="flex justify-center mb-5">
              <div className={`w-24 h-24 rounded-full overflow-hidden ring-4 ${current.ringColor ?? 'ring-mata-border'} shadow-lg`}>
                <Image
                  src={current.image}
                  alt={current.agent ?? ''}
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Product illustration for "how it works" */}
          {current.type === 'product' && (
            <div className="flex justify-center gap-4 mb-6">
              {[
                { img: '/agents/mark.png', ring: 'ring-orange-400', label: 'Mark' },
                { img: '/agents/rex.png', ring: 'ring-red-400', label: 'Rex' },
                { img: '/agents/nia.png', ring: 'ring-violet-400', label: 'Nia' },
              ].map((a) => (
                <div key={a.label} className="flex flex-col items-center gap-1">
                  <div className={`w-14 h-14 rounded-full overflow-hidden ring-2 ${a.ring} shadow-sm`}>
                    <Image src={a.img} alt={a.label} width={56} height={56} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[9px] font-black text-mata-text">{a.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-xl font-black text-mata-text text-center mb-3">
            {current.title}
          </h1>

          {/* Quote */}
          <p className={`text-center leading-relaxed mb-4 ${
            current.type === 'agent'
              ? 'text-[13px] text-mata-text-secondary italic'
              : 'text-sm font-semibold text-mata-text-secondary'
          }`}>
            {current.quote}
          </p>

          {/* Detail */}
          {current.detail && (
            <p className="text-xs text-mata-text-muted text-center leading-relaxed mb-6">
              {current.detail}
            </p>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            {!isFirst && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 rounded-xl border border-mata-border bg-mata-surface py-3 text-sm font-bold text-mata-text-secondary hover:bg-mata-border transition-all"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="flex-1 rounded-xl bg-gradient-to-r from-mata-orange to-mata-orange-dark py-3 text-sm font-bold text-white hover:shadow-lg hover:shadow-mata-orange/20 transition-all active:scale-[0.98]"
            >
              {isLast ? 'Start Trading' : 'Next'}
            </button>
          </div>

          {/* Skip */}
          {!isLast && (
            <button
              onClick={skip}
              className="w-full mt-3 text-[11px] text-mata-text-muted hover:text-mata-text transition-colors"
            >
              Skip onboarding
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
