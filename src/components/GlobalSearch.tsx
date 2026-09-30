import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Notice, CollegeDocument, DeadlineItem } from '../types';

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
  notices: Notice[];
  documents: CollegeDocument[];
  deadlines: DeadlineItem[];
  onNavigateTab: (tab: string) => void;
}

type ResultType = 'notice' | 'document' | 'deadline';

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  tag: string;
  tagColor: string;
  icon: string;
  iconBg: string;
  urgency?: string;
}

const TYPE_META: Record<ResultType, { label: string; tab: string }> = {
  notice:   { label: 'Notice',   tab: 'notices'   },
  document: { label: 'Document', tab: 'dashboard' },
  deadline: { label: 'Deadline', tab: 'dashboard' },
};

function score(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  if (t === q) return 10;
  if (t.startsWith(q)) return 8;
  if (t.includes(q)) return 5;
  const words = q.split(/\s+/);
  return words.reduce((acc, w) => acc + (t.includes(w) ? 1 : 0), 0);
}

function urgencyColor(urgency?: string): { tag: string; tagColor: string } {
  switch (urgency) {
    case 'urgent': return { tag: 'Urgent', tagColor: 'bg-red-100 text-red-600' };
    case 'high':   return { tag: 'High',   tagColor: 'bg-amber-100 text-amber-700' };
    default:       return { tag: 'Notice', tagColor: 'bg-[#e8f5ef] text-[#003527]' };
  }
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  open, onClose, notices, documents, deadlines, onNavigateTab,
}) => {
  const [query, setQuery]           = useState('');
  const [selected, setSelected]     = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  // Build results
  const results: SearchResult[] = React.useMemo(() => {
    if (!query.trim()) {
      // Show recent/suggested items when empty
      const recent: SearchResult[] = [
        ...notices.slice(0, 3).map(n => {
          const { tag, tagColor } = urgencyColor(n.urgency);
          return {
            id: n.id, type: 'notice' as ResultType,
            title: n.title, subtitle: n.department,
            tag, tagColor,
            icon: 'campaign', iconBg: 'bg-amber-50',
            urgency: n.urgency,
          };
        }),
        ...documents.slice(0, 2).map(d => ({
          id: d.id, type: 'document' as ResultType,
          title: d.title, subtitle: `${d.category} · ${d.department}`,
          tag: d.category, tagColor: 'bg-[#eff4ff] text-[#1d4ed8]',
          icon: 'description', iconBg: 'bg-[#eff4ff]',
        })),
      ];
      return recent;
    }

    const q = query.trim();

    const noticeResults = notices
      .map(n => ({
        item: n,
        score: score(n.title + ' ' + n.department + ' ' + (n.tags?.join(' ') ?? ''), q),
      }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item: n }) => {
        const { tag, tagColor } = urgencyColor(n.urgency);
        return {
          id: n.id, type: 'notice' as ResultType,
          title: n.title, subtitle: n.department,
          tag, tagColor,
          icon: 'campaign', iconBg: 'bg-amber-50',
          urgency: n.urgency,
        };
      });

    const docResults = documents
      .map(d => ({
        item: d,
        score: score(d.title + ' ' + d.department + ' ' + d.category + ' ' + d.summary, q),
      }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item: d }) => ({
        id: d.id, type: 'document' as ResultType,
        title: d.title, subtitle: `${d.category} · ${d.department}`,
        tag: d.category, tagColor: 'bg-[#eff4ff] text-[#1d4ed8]',
        icon: 'description', iconBg: 'bg-[#eff4ff]',
      }));

    const dlResults = deadlines
      .map(dl => ({
        item: dl,
        score: score(dl.title + ' ' + dl.category + ' ' + dl.description, q),
      }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item: dl }) => ({
        id: dl.id, type: 'deadline' as ResultType,
        title: dl.title,
        subtitle: `Due ${dl.dateStr} · ${dl.daysRemaining} day${dl.daysRemaining !== 1 ? 's' : ''} left`,
        tag: 'Deadline', tagColor: 'bg-red-50 text-red-600',
        icon: 'event', iconBg: 'bg-red-50',
      }));

    return [...noticeResults, ...docResults, ...dlResults].slice(0, 10);
  }, [query, notices, documents, deadlines]);

  // Reset selected when results change
  useEffect(() => setSelected(0), [results]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    }
    if (e.key === 'Enter' && results[selected]) {
      e.preventDefault();
      const r = results[selected];
      onNavigateTab(TYPE_META[r.type].tab);
      onClose();
    }
  }, [open, results, selected, onClose, onNavigateTab]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  const highlightMatch = (text: string, q: string) => {
    if (!q.trim()) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(q.toLowerCase().trim());
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-[#b0f0d6] text-[#003527] rounded px-0.5 not-italic">{text.slice(idx, idx + q.trim().length)}</mark>
        {text.slice(idx + q.trim().length)}
      </>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0b1c30]/40 backdrop-blur-sm z-[90] animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-[10vh] left-1/2 -translate-x-1/2 w-full max-w-[640px] z-[91] px-4"
           style={{ animation: 'slideDown 0.18s ease' }}>
        <div className="bg-white rounded-2xl shadow-2xl border border-[#e0e9e4] overflow-hidden"
             style={{ boxShadow: '0 24px 80px rgba(0,53,39,0.18)' }}>

          {/* Search input bar */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[#f0f4f0]">
            <span className="material-symbols-outlined text-[22px] text-[#003527] shrink-0">search</span>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search notices, documents, deadlines…"
              className="flex-1 text-[15px] text-[#0b1c30] placeholder:text-[#b0b8b4] bg-transparent outline-none font-medium"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 rounded-lg hover:bg-[#f4f7ff] text-[#9ca8a3] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
            <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] font-mono text-[#9ca8a3]
                            bg-[#f4f7ff] border border-[#e0e5e2] rounded px-1.5 py-0.5 shrink-0">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="overflow-y-auto max-h-[420px]">
            {results.length === 0 && query.trim() ? (
              <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#f4f7ff] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px] text-[#9ca8a3]">search_off</span>
                </div>
                <p className="text-sm font-semibold text-[#5a6672]">No results for "<span className="text-[#003527]">{query}</span>"</p>
                <p className="text-xs text-[#9ca8a3]">Try different keywords — e.g. "exam", "scholarship", "attendance"</p>
              </div>
            ) : (
              <>
                {/* Section label */}
                <p className="px-5 pt-3 pb-1 text-[10px] font-bold text-[#9ca8a3] uppercase tracking-widest">
                  {query.trim() ? `${results.length} result${results.length !== 1 ? 's' : ''}` : 'Recent & Suggested'}
                </p>

                {results.map((r, i) => (
                  <button
                    key={r.id}
                    data-idx={i}
                    onClick={() => {
                      onNavigateTab(TYPE_META[r.type].tab);
                      onClose();
                    }}
                    onMouseEnter={() => setSelected(i)}
                    className={`w-full flex items-center gap-3.5 px-5 py-3.5 text-left transition-colors
                                ${selected === i ? 'bg-[#f0f9f6]' : 'hover:bg-[#f8fafe]'}`}
                  >
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-xl ${r.iconBg} flex items-center justify-center shrink-0`}>
                      <span className="material-symbols-outlined text-[18px] text-[#003527]">{r.icon}</span>
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#0b1c30] truncate leading-snug">
                        {highlightMatch(r.title, query)}
                      </p>
                      <p className="text-[11px] text-[#9ca8a3] truncate mt-0.5">{r.subtitle}</p>
                    </div>

                    {/* Tag + type */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.tagColor}`}>
                        {r.tag}
                      </span>
                      <span className="text-[9px] text-[#b0b8b4] font-medium uppercase tracking-wide">
                        {TYPE_META[r.type].label}
                      </span>
                    </div>

                    {/* Enter hint on selected */}
                    {selected === i && (
                      <span className="material-symbols-outlined text-[16px] text-[#9ca8a3] shrink-0">
                        keyboard_return
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Footer hint */}
          <div className="border-t border-[#f0f4f0] px-5 py-2.5 flex items-center gap-4 text-[10px] text-[#b0b8b4]">
            <span className="flex items-center gap-1">
              <kbd className="bg-[#f4f7ff] border border-[#e0e5e2] rounded px-1 py-0.5 font-mono">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-[#f4f7ff] border border-[#e0e5e2] rounded px-1 py-0.5 font-mono">↵</kbd>
              Go to section
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-[#f4f7ff] border border-[#e0e5e2] rounded px-1 py-0.5 font-mono">ESC</kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </>
  );
};
