'use client';

import { useState, useEffect } from 'react';

interface NewsItem {
  id: string;
  ticker: string;
  headline: string;
  summary: string;
  source: string;
  published_at: string;
  url: string;
}

export default function NewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/news?limit=25');
        if (res.ok) setNews(await res.json());
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  return (
    <div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-mata-border bg-mata-card p-2.5">
              <div className="h-3 w-3/4 rounded bg-mata-surface mb-1" />
              <div className="h-2 w-1/3 rounded bg-mata-surface" />
            </div>
          ))}
        </div>
      ) : news.length === 0 ? (
        <div className="rounded-xl border border-dashed border-mata-border bg-mata-surface/50 p-6 text-center">
          <p className="text-[10px] text-mata-text-muted">No news available right now</p>
        </div>
      ) : (
        <div className="space-y-1">
          {news.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                className="rounded-lg border border-mata-border bg-mata-card overflow-hidden hover:border-mata-purple/30 transition-colors"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full text-left px-2.5 py-2"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[8px] font-black text-mata-purple bg-mata-purple/10 px-1 py-0.5 rounded flex-shrink-0 mt-0.5">
                      {item.ticker}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-mata-text leading-snug line-clamp-2">
                        {item.headline}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[8px] text-mata-text-muted">{item.source}</span>
                        <span className="text-[8px] text-mata-text-muted">{timeAgo(item.published_at)}</span>
                      </div>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-2.5 pb-2 animate-[slideInUp_0.15s_ease-out]">
                    <p className="text-[9px] text-mata-text-secondary leading-relaxed mb-1.5">
                      {item.summary}
                    </p>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[8px] font-bold text-mata-purple hover:text-mata-purple/80 transition-colors"
                    >
                      Read full article →
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
