import React, { useState } from 'react';
import { ConflictItem, QueryLogItem } from '../types';

interface KnowledgeBaseHealthProps {
  conflicts: ConflictItem[];
  queryLogs: QueryLogItem[];
  onResolveConflict: (id: string) => void;
  onNavigateUpload: () => void;
  onOpenQuery: (queryText: string) => void;
}

export const KnowledgeBaseHealth: React.FC<KnowledgeBaseHealthProps> = ({
  conflicts,
  queryLogs,
  onResolveConflict,
  onNavigateUpload,
  onOpenQuery,
}) => {
  const [timeRange, setTimeRange] = useState<'30D' | '90D' | 'YTD'>('30D');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const handleForceSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    }, 1200);
  };

  return (
    <div className="w-full min-h-screen bg-[#f4f7ff] text-[#0b1c30] pt-[64px] pb-20">
      <div className="max-w-[1320px] w-full mx-auto px-5 md:px-10">

        {/* ── Page Header ─────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-start justify-between
                        gap-6 pt-10 mb-10 pb-8 border-b border-[#bfc9c3]/25">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <h1 className="font-headline text-2xl md:text-[2rem] font-extrabold text-[#0b1c30] leading-tight">
                Knowledge Base Health
              </h1>
              <span className="badge badge-primary text-[9px] tracking-widest">Database v2.4</span>
            </div>
            <p className="text-[0.9rem] text-[#5a6672] max-w-xl leading-relaxed">
              Monitor performance, ingestion telemetry, and semantic ground-truth retrieval
              of your institution's central AI repository.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              id="force-sync-btn"
              onClick={handleForceSync}
              disabled={isSyncing}
              className="btn btn-secondary text-xs"
            >
              <span className={`material-symbols-outlined text-[17px]
                               ${isSyncing ? 'animate-spin' : ''}`}>
                sync
              </span>
              {isSyncing ? 'Syncing…' : syncSuccess ? 'Synchronized!' : 'Force Sync'}
            </button>
            <button
              id="admin-ingest-btn"
              onClick={onNavigateUpload}
              className="btn btn-primary text-xs"
            >
              <span className="material-symbols-outlined text-[17px]">add</span>
              Ingest Document
            </button>
          </div>
        </div>

        {/* ── Telemetry Stat Cards ─────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

          {/* Indexed Chunks */}
          <div className="card p-6 relative overflow-hidden group">
            <div className="stat-blob bg-[#003527]" />
            <div className="flex justify-between items-start mb-5">
              <div>
                <p className="text-[11px] font-bold text-[#9ca8a3] uppercase tracking-widest mb-2">
                  Indexed Chunks
                </p>
                <h3 className="font-headline text-3xl font-extrabold text-[#0b1c30]">12,482</h3>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-[#003527]/8 flex items-center
                              justify-center text-[#003527]">
                <span className="material-symbols-outlined text-[22px]">dataset</span>
              </div>
            </div>
            <div className="progress-track mb-2.5">
              <div className="progress-fill bg-[#003527]" style={{ width: '85%' }} />
            </div>
            <div className="flex justify-between text-xs">
              <span className="font-bold text-[#003527]">+420 this week</span>
              <span className="text-[#9ca8a3]">85% of cluster capacity</span>
            </div>
          </div>

          {/* Active Documents */}
          <div className="card p-6 relative overflow-hidden group">
            <div className="stat-blob bg-[#fea619]" />
            <div className="flex justify-between items-start mb-5">
              <div>
                <p className="text-[11px] font-bold text-[#9ca8a3] uppercase tracking-widest mb-2">
                  Active Official Documents
                </p>
                <h3 className="font-headline text-3xl font-extrabold text-[#0b1c30]">328</h3>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-[#fea619]/15 flex items-center
                              justify-center text-[#855300]">
                <span className="material-symbols-outlined text-[22px]">folder_special</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2.5">
              {[['240 PDF', 'bg-[#e5eeff] text-[#003527]'],
                ['62 DOCX', 'bg-[#f0f4ff] text-[#404944]'],
                ['26 WEB', 'bg-[#ffddb8] text-[#855300]']].map(([label, cls]) => (
                <span key={label}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${cls}`}>
                  {label}
                </span>
              ))}
            </div>
            <p className="text-xs text-[#707974]">
              <span className="font-bold text-[#855300]">12 processing</span> in ingestion pipeline
            </p>
          </div>

          {/* Grounded Answer Rate */}
          <div className="card p-6 relative overflow-hidden group">
            <div className="stat-blob bg-[#003527]" />
            <div className="flex justify-between items-start mb-5">
              <div>
                <p className="text-[11px] font-bold text-[#9ca8a3] uppercase tracking-widest mb-2">
                  Grounded Answer Rate
                </p>
                <h3 className="font-headline text-3xl font-extrabold text-[#003527]">94.7%</h3>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-[#b0f0d6] flex items-center
                              justify-center text-[#003527]">
                <span className="material-symbols-outlined text-[22px]">verified</span>
              </div>
            </div>
            {/* Sparkline */}
            <div className="flex items-end gap-1.5 h-7 mb-2.5">
              {[60, 70, 65, 80, 85, 90, 95].map((h, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-sm ${i === 6 ? 'bg-[#003527]' : 'bg-[#b0f0d6]'}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <p className="text-xs text-[#707974]">
              <span className="font-bold text-[#003527]">+1.2%</span> accuracy improvement this month
            </p>
          </div>
        </div>

        {/* ── Charts & Status ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">

          {/* Query Volume Chart (8 cols) */}
          <div className="lg:col-span-8 card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="font-headline font-bold text-lg text-[#0b1c30]">Daily AI Query Volume</h3>
                <p className="text-xs text-[#9ca8a3] mt-0.5">Aggregated student inquiries across departments</p>
              </div>
              {/* Time range toggle */}
              <div className="flex bg-[#f0f4ff] p-1 rounded-xl gap-0.5">
                {(['30D', '90D', 'YTD'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setTimeRange(tab)}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all
                                ${timeRange === tab
                                  ? 'bg-white text-[#003527] shadow-sm'
                                  : 'text-[#9ca8a3] hover:text-[#0b1c30]'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative h-52 w-full">
              <svg viewBox="0 0 500 140" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="queryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#003527" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#003527" stopOpacity="0"    />
                  </linearGradient>
                </defs>

                {/* Grid lines */}
                {[30, 70, 110].map(y => (
                  <line key={y} x1="0" y1={y} x2="500" y2={y}
                        stroke="#e5eeff" strokeWidth="1" />
                ))}

                {/* Area */}
                <path
                  d="M0,125 Q50,108 100,115 T200,75 T300,90 T400,40 T500,22 L500,135 L0,135 Z"
                  fill="url(#queryGrad)"
                />

                {/* Line */}
                <path
                  d="M0,125 Q50,108 100,115 T200,75 T300,90 T400,40 T500,22"
                  fill="none" stroke="#003527" strokeWidth="2.5" strokeLinecap="round"
                />

                {/* Points */}
                <circle cx="200" cy="75" r="4" fill="#003527" className="animate-pulse" />
                <circle cx="400" cy="40" r="4" fill="#fea619" />
                <circle cx="500" cy="22" r="5" fill="#003527" />
              </svg>

              {/* X-axis */}
              <div className="flex justify-between text-[10px] text-[#9ca8a3] font-medium pt-2">
                <span>Aug 01</span>
                <span>Aug 08</span>
                <span>Aug 15</span>
                <span>Aug 22 (Peak)</span>
                <span>Today</span>
              </div>
            </div>
          </div>

          {/* Right column (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-5">

            {/* Query Categories */}
            <div className="card p-5">
              <h3 className="font-headline font-bold text-[0.9375rem] text-[#0b1c30] mb-4">
                Top Query Categories
              </h3>
              <div className="space-y-4">
                {[
                  { label: 'Academic & Syllabus',        pct: 45, color: 'bg-[#003527]',  textColor: 'text-[#003527]'  },
                  { label: 'Exams & Schedules',           pct: 30, color: 'bg-[#fea619]',  textColor: 'text-[#855300]'  },
                  { label: 'Scholarships & Financial Aid', pct: 25, color: 'bg-[#0cc8b3]', textColor: 'text-[#004e45]'  },
                ].map((cat) => (
                  <div key={cat.label}>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className="text-[#0b1c30]">{cat.label}</span>
                      <span className={cat.textColor}>{cat.pct}%</span>
                    </div>
                    <div className="progress-track">
                      <div className={`progress-fill ${cat.color}`} style={{ width: `${cat.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* System Diagnostics */}
            <div className="card p-5">
              <h3 className="font-headline font-bold text-[0.9375rem] text-[#0b1c30] mb-4">
                System Diagnostics
              </h3>
              <div className="space-y-2.5">
                {[
                  { label: 'Campus Database', status: 'Synchronized',     dot: 'bg-[#003527]', statusColor: 'text-[#003527]' },
                  { label: 'Review Flagged',  status: '3 Docs Need Review', dot: 'bg-[#fea619]', statusColor: 'text-[#855300]' },
                  { label: 'Contradictions',  status: `${conflicts.filter(c => c.status === 'pending').length} Active Conflicts`,
                    dot: 'bg-red-500', statusColor: 'text-red-500' },
                ].map((row) => (
                  <div key={row.label}
                       className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#f8f9ff]">
                    <span className="flex items-center gap-2 text-xs text-[#5a6672]">
                      <span className={`w-2 h-2 rounded-full ${row.dot}`} />
                      {row.label}
                    </span>
                    <span className={`text-xs font-bold ${row.statusColor}`}>{row.status}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── Conflict Detection ───────────────────────────────────── */}
        {conflicts.length > 0 && (
          <div className="mb-10" id="conflict-detection-section">
            <h3 className="font-headline font-bold text-xl text-[#0b1c30] flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-red-500">warning</span>
              Information Conflict Detection Engine
            </h3>

            {conflicts.map((conf) => (
              <div
                key={conf.id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-red-100 mb-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between
                                gap-4 pb-4 border-b border-[#f0f4ff] mb-5">
                  <div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full
                                      ${conf.status === 'pending'
                                        ? 'bg-red-50 text-red-600'
                                        : 'bg-[#b0f0d6] text-[#003527]'}`}>
                      {conf.status === 'pending' ? 'Conflict Pending Resolution' : 'Resolved'}
                    </span>
                    <h4 className="font-headline font-bold text-lg text-[#0b1c30] mt-2">
                      {conf.topic}
                    </h4>
                    <p className="text-xs text-[#9ca8a3] mt-0.5">
                      {conf.courseOrDept} · Detected {conf.detectedAt}
                    </p>
                  </div>

                  {conf.status === 'pending' ? (
                    <button
                      onClick={() => onResolveConflict(conf.id)}
                      className="btn btn-primary text-xs"
                    >
                      Resolve: Accept V2.0 as Ground Truth
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-[#003527] bg-[#b0f0d6] px-3 py-1.5
                                     rounded-lg flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">check_circle</span>
                      Saved in Document Library
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="p-4 rounded-xl bg-red-50 border border-red-100">
                    <div className="flex items-center justify-between text-xs font-bold mb-2">
                      <span className="text-red-600">{conf.docA.title}</span>
                      <span className="font-mono text-[10px] text-[#9ca8a3]">{conf.docA.version}</span>
                    </div>
                    <p className="text-xs text-[#5a6672] leading-relaxed">"{conf.docA.text}"</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#f0f9f6] border border-[#80bea6]/40">
                    <div className="flex items-center justify-between text-xs font-bold mb-2">
                      <span className="text-[#003527]">{conf.docB.title}</span>
                      <span className="font-mono text-[10px] text-[#003527] font-bold">
                        {conf.docB.version} (Active)
                      </span>
                    </div>
                    <p className="text-xs text-[#0b1c30] leading-relaxed font-medium">
                      "{conf.docB.text}"
                    </p>
                  </div>
                </div>

                {conf.resolutionNotes && (
                  <p className="text-[11px] text-[#9ca8a3] mt-4 italic">{conf.resolutionNotes}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Real-Time Query Log ──────────────────────────────────── */}
        <div id="realtime-query-log-section">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-headline font-bold text-xl text-[#0b1c30]">Real-Time Query Log</h3>
              <p className="text-xs text-[#9ca8a3] mt-0.5">
                Live monitoring of student queries, ground truth retrieval, and confidence levels
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {queryLogs.map((log) => {
              const isGrounded  = log.status === 'grounded';
              const isReview    = log.status === 'review_needed';
              const isEscalated = log.status === 'escalated';

              return (
                <div
                  key={log.id}
                  onClick={() => onOpenQuery(log.query)}
                  className="card card-interactive p-5 flex flex-col justify-between
                             hover:border-[#003527]/20"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-mono text-[#9ca8a3]">{log.timestamp}</span>
                      <span className={`badge text-[10px]
                                       ${isGrounded  ? 'bg-[#b0f0d6] text-[#003527]'
                                       : isReview    ? 'bg-[#ffddb8] text-[#855300]'
                                       : 'bg-red-50 text-red-600'}`}>
                        {isGrounded  && <span className="material-symbols-outlined text-[12px]">verified</span>}
                        {isReview    && <span className="material-symbols-outlined text-[12px]">flag</span>}
                        {isEscalated && <span className="material-symbols-outlined text-[12px]">support_agent</span>}
                        {isGrounded ? 'Grounded' : isReview ? 'Review Needed' : 'Escalated'}
                      </span>
                    </div>
                    <h4 className="font-inter font-bold text-[0.8125rem] text-[#0b1c30] leading-snug">
                      "{log.query}"
                    </h4>
                  </div>

                  <div className="pt-3 mt-3 border-t border-[#f0f4ff] flex items-center justify-between">
                    <span className="text-[11px] text-[#9ca8a3] truncate max-w-[200px]">
                      {log.sourceDoc || log.ticketId}
                    </span>
                    <span className="font-bold text-[#003527] text-[11px]">
                      {log.confidence}% Conf.
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};
