import React, { useState, useEffect } from 'react';
import { StudentProfile, Notice, DeadlineItem, CollegeDocument } from '../types';
import { findNextClass, CSE_B_WEEKLY_SCHEDULE, DAY_NAMES } from '../lib/timetable';
import { AcademicCalendarWidget } from './AcademicCalendarWidget';

interface StudentDashboardProps {
  student: StudentProfile & { section?: string };
  notices: Notice[];
  deadlines: DeadlineItem[];
  documents: CollegeDocument[];
  onOpenAIQuery: (initialPrompt?: string) => void;
  onViewNotice: (notice: Notice) => void;
  onNavigateTab: (tab: string) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  student,
  notices,
  deadlines,
  documents,
  onOpenAIQuery,
  onViewNotice,
  onNavigateTab,
}) => {
  const studentSection = (student as { section?: string }).section || '';

  const now = new Date();
  const getGreeting = () => {
    const h = now.getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Real-time next class using the authoritative CSE B schedule
  const nextClassInfo = React.useMemo(() => findNextClass(CSE_B_WEEKLY_SCHEDULE), []);

  // ── Fetch documents from DB for centralized view ────────────────
  const [dbDocs, setDbDocs] = useState<CollegeDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [viewingDoc, setViewingDoc] = useState<CollegeDocument | null>(null);
  const [activeDay, setActiveDay] = useState<string>('MON');
  const [deadlinePriorityFilter, setDeadlinePriorityFilter] = useState<'all' | 'high' | 'medium' | 'normal'>('all');
  const [urgentAlertDismissed, setUrgentAlertDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('campusiq_urgent_alert_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  // Calculate deadlines requiring immediate 24-hour action (< 1 day remaining, active)
  const criticalDeadlines = React.useMemo(() => {
    return deadlines.filter(d => {
      const t = d.title.toLowerCase();
      if (t.includes('academic calendar') || t.includes('academic calender')) return false;
      return typeof d.daysRemaining === 'number' && d.daysRemaining >= 0 && d.daysRemaining <= 1;
    });
  }, [deadlines]);

  const TIMETABLE_DATA: Record<string, { time: string; code: string; name: string; room: string; instructor: string }[]> = {
    MON: [
      { time: '9:00 TO 10:00', code: 'CC', name: 'Cloud Computing', room: 'G-01', instructor: 'SSN' },
      { time: '10:30 TO 11:30', code: 'DT', name: 'Design Thinking', room: 'G-04', instructor: 'RSD' },
      { time: '11:30 TO 12:30', code: 'AI', name: 'Artificial Intelligence', room: 'G-04', instructor: 'JSK' },
      { time: '01:00 TO 03:00', code: 'LAB', name: 'AI LAB 9 / CC LAB 7', room: 'LAB 9 / 7', instructor: 'JSK / SSN' }
    ],
    TUE: [
      { time: '10:30 TO 11:30', code: 'CC', name: 'Cloud Computing', room: 'RC', instructor: 'SSN' },
      { time: '11:30 TO 12:30', code: 'BDA', name: 'Big Data Analytics', room: 'RC', instructor: 'MGS' },
      { time: '01:00 TO 02:00', code: 'AI', name: 'Artificial Intelligence', room: 'G-04', instructor: 'JSK' }
    ],
    WED: [
      { time: '9:00 TO 10:00', code: 'DT', name: 'Design Thinking', room: 'G-02', instructor: 'RSD' },
      { time: '10:30 TO 11:30', code: 'BDA', name: 'Big Data Analytics', room: 'RC', instructor: 'MGS' },
      { time: '11:30 TO 12:30', code: 'AI', name: 'Artificial Intelligence', room: 'RC', instructor: 'JSK' },
      { time: '01:00 TO 03:00', code: 'LAB', name: 'CC LAB 7 / AI LAB 9', room: 'LAB 7 / 9', instructor: 'SSN / JSK' },
      { time: '03:30 TO 04:30', code: 'BI', name: 'Business Intelligence', room: 'RC', instructor: 'SSP' },
      { time: '4:30 TO 5:30', code: 'CC', name: 'Cloud Computing', room: 'RC', instructor: 'SSN' }
    ],
    THU: [
      { time: '01:00 TO 03:00', code: 'LAB', name: 'Project - I', room: 'LAB 7,8,9', instructor: 'HDG' },
      { time: '03:30 TO 04:30', code: 'BDA', name: 'Big Data Analytics', room: 'G-03', instructor: 'MGS' },
      { time: '4:30 TO 5:30', code: 'BI', name: 'Business Intelligence', room: 'G-03', instructor: 'SSP' }
    ],
    FRI: [
      { time: '9:00 TO 10:00', code: 'DT', name: 'Design Thinking', room: 'G-01', instructor: 'RSD' },
      { time: '10:30 TO 11:30', code: 'BI', name: 'Business Intelligence', room: 'RC', instructor: 'SSP' },
      { time: '11:30 TO 12:30', code: 'CC', name: 'Cloud Computing', room: 'RC', instructor: 'SSN' },
      { time: '01:00 TO 03:00', code: 'LAB', name: 'AI LAB 2 / CC LAB 1', room: 'LAB 2 / 1', instructor: 'JSK / SSN' }
    ],
    SAT: [
      { time: '10:30 TO 11:30', code: 'BDA', name: 'Big Data Analytics', room: 'F-12', instructor: 'MGS' },
      { time: '11:30 TO 12:30', code: 'BI', name: 'Business Intelligence', room: 'F-12', instructor: 'SSP' },
      { time: '01:00 TO 02:00', code: 'AI', name: 'Artificial Intelligence', room: 'RC', instructor: 'JSK' },
      { time: '02:00 TO 03:00', code: 'DT', name: 'Design Thinking', room: 'RC', instructor: 'RSD' },
      { time: '03:30 TO 05:30', code: 'LAB', name: 'CC LAB 7 / AI LAB 9', room: 'LAB 7 / 9', instructor: 'SSN / JSK' }
    ]
  };

  useEffect(() => {
    let cancelled = false;
    const fetchDocs = async () => {
      setDocsLoading(true);
      try {
        const res = await fetch('/api/documents');
        const data = await res.json();
        if (!cancelled && data.documents) {
          setDbDocs(data.documents);
        }
      } catch {
        // offline
      } finally {
        if (!cancelled) setDocsLoading(false);
      }
    };
    fetchDocs();
    const interval = setInterval(fetchDocs, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Merge: DB docs first, then passed-in documents (deduplicated)
  const allDocs = React.useMemo(() => {
    const seen = new Set<string>();
    const merged: CollegeDocument[] = [];
    for (const d of [...dbDocs, ...documents]) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        merged.push(d);
      }
    }
    return merged;
  }, [dbDocs, documents]);

  // Recently uploaded docs (last 5) — these are highlighted
  const recentDocs = allDocs.slice(0, 5);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Events': return 'celebration';
      case 'Exams': return 'assignment_turned_in';
      case 'Timetable': return 'calendar_today';
      case 'Syllabus': return 'menu_book';
      case 'Circular': return 'campaign';
      case 'Handbook': return 'book';
      case 'Regulations': return 'gavel';
      case 'Scholarships': return 'school';
      case 'Placements': return 'work';
      case 'Financial Aid': return 'payments';
      default: return 'description';
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Events': return { bg: 'bg-[#eff4ff]', text: 'text-[#1e40af]', border: 'border-blue-300', accent: 'bg-[#2563eb]' };
      case 'Exams': return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', accent: 'bg-red-600' };
      case 'Timetable': return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', accent: 'bg-blue-500' };
      case 'Syllabus': return { bg: 'bg-[#f0fdf4]', text: 'text-[#003527]', border: 'border-[#b0f0d6]', accent: 'bg-[#003527]' };
      case 'Circular': return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', accent: 'bg-amber-500' };
      case 'Handbook': return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', accent: 'bg-purple-500' };
      case 'Regulations': return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', accent: 'bg-red-500' };
      case 'Scholarships': return { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', accent: 'bg-[#004e45]' };
      case 'Placements': return { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200', accent: 'bg-teal-600' };
      case 'Financial Aid': return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', accent: 'bg-green-500' };
      default: return { bg: 'bg-[#eff4ff]', text: 'text-[#0b1c30]', border: 'border-[#bfc9c3]', accent: 'bg-[#003527]' };
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#f4f7ff] text-[#0b1c30] pt-[64px] pb-16">

      {/* Ambient Blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-24 right-0 w-[600px] h-[600px] rounded-full
                        bg-gradient-radial from-[#b0f0d6]/20 to-transparent blur-[100px]" />
        <div className="absolute top-[40%] -left-24 w-[500px] h-[500px] rounded-full
                        bg-gradient-radial from-[#fea619]/10 to-transparent blur-[90px]" />
      </div>

      <div className="max-w-[1200px] w-full mx-auto px-4 md:px-6">

        {/* ── Welcome Header ─────────────────────────────────────── */}
        <header className="pt-10 pb-8" id="dashboard-welcome-header">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h1 className="font-headline text-3xl md:text-[2.75rem] font-extrabold text-[#0b1c30] leading-tight">
              {getGreeting()},{' '}
              <span className="gradient-text">{student.name}.</span>
            </h1>
            <span className="badge badge-surface flex items-center gap-1.5 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#fea619] animate-pulse" />
              Active Academic Session
            </span>
          </div>
          <p className="font-inter text-[0.9375rem] text-[#5a6672] max-w-2xl leading-relaxed">
            Welcome to CampusIQ — your centralized college information hub.
          </p>
        </header>

        {/* ── Main Grid ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 mb-10">

          {/* Left — Central Info (8 cols) */}
          <section className="lg:col-span-8 flex flex-col gap-6" id="for-you-section">

            <div className="flex items-center justify-between mb-2">
              <h2 className="font-headline font-bold text-xl text-[#0b1c30] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#003527] text-[22px]">space_dashboard</span>
                Central Information Hub
              </h2>
              {!docsLoading && allDocs.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#003527]
                                 bg-[#b0f0d6]/35 px-3 py-1 rounded-full border border-[#80bea6]/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#003527] animate-pulse" />
                  Live · {allDocs.length} documents
                </span>
              )}
            </div>

            {/* ── Highlighted Recent Uploads — "NEW" documents pop up here ── */}
            {recentDocs.length > 0 && (
              <div className="space-y-3" id="highlighted-uploads">
                {recentDocs.map((doc, idx) => {
                  const colors = getCategoryColor(doc.category);
                  const isNew = idx < 2; // top 2 are "new" and highlighted
                  return (
                    <div
                      key={doc.id}
                      onClick={() => setViewingDoc(doc)}
                      className={`relative rounded-2xl p-5 border cursor-pointer transition-all
                                  hover:shadow-lg hover:-translate-y-0.5 group overflow-hidden
                                  ${isNew
                                    ? `${colors.bg} ${colors.border} border-2 shadow-md`
                                    : 'bg-white border-[#bfc9c3]/30 shadow-xs'
                                  }`}
                    >
                      {/* New badge for most recent */}
                      {isNew && (
                        <div className="absolute top-0 right-0">
                          <div className={`${colors.accent} text-white text-[9px] font-extrabold uppercase tracking-wider
                                          px-3 py-1 rounded-bl-xl`}>
                            NEW
                          </div>
                        </div>
                      )}

                      {/* Accent strip on left */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${colors.accent} rounded-l-2xl`} />

                      <div className="flex items-start gap-4 pl-3">
                        <div className={`w-12 h-12 rounded-2xl ${isNew ? colors.accent : 'bg-[#eff4ff]'} flex items-center
                                        justify-center shrink-0 ${isNew ? 'text-white' : colors.text} shadow-sm`}>
                          <span className="material-symbols-outlined text-[24px]">
                            {getCategoryIcon(doc.category)}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className={`text-[10px] font-extrabold uppercase tracking-wider ${colors.text}`}>
                              {doc.category}
                            </span>
                            <span className="text-[10px] text-[#9ca8a3]">·</span>
                            <span className="text-[11px] text-[#707974] font-medium">{doc.department}</span>
                          </div>

                          <h4 className={`font-inter font-bold text-[0.9375rem] leading-snug mb-1.5
                                         group-hover:text-[#003527] transition-colors
                                         ${isNew ? 'text-[#0b1c30]' : 'text-[#17283a]'}`}>
                            {doc.title}
                          </h4>

                          <p className="text-xs text-[#707974] line-clamp-2 leading-relaxed">
                            {(doc.summary || '').replace(/Indexed with \d+ semantic chunks\.?/gi, '').trim() || doc.title}
                          </p>

                          <div className="flex items-center gap-3 mt-2 text-[11px] text-[#9ca8a3]">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">apartment</span>
                              {doc.department}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity self-center">
                          <div className={`w-8 h-8 rounded-full ${colors.accent} text-white flex items-center justify-center`}>
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {docsLoading && allDocs.length === 0 && (
              <div className="card p-8 animate-pulse space-y-3">
                <div className="h-16 bg-[#e5eeff] rounded-xl w-full" />
                <div className="h-16 bg-[#e5eeff]/70 rounded-xl w-full" />
                <div className="h-16 bg-[#e5eeff]/50 rounded-xl w-full" />
              </div>
            )}

            {!docsLoading && allDocs.length === 0 && (
              <div className="card p-10 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#eff4ff] flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-[32px] text-[#003527]">description</span>
                </div>
                <h4 className="font-headline font-bold text-lg text-[#0b1c30] mb-2">
                  No documents uploaded yet
                </h4>
                <p className="text-sm text-[#5a6672] max-w-md mx-auto">
                  Documents, circulars, and notices will appear here once published by administration.
                </p>
              </div>
            )}

            {/* ── Notices & Announcements ────────────────────────────── */}
            <div className="card p-6 relative overflow-hidden" id="central-notices-main">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-[#fea619]/15 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px] text-[#855300]">campaign</span>
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-lg text-[#0b1c30]">
                      Notices & Announcements
                    </h3>
                    <p className="text-[11px] text-[#9ca8a3]">
                      Centralized updates for all students
                    </p>
                  </div>
                </div>
                {notices.length > 0 && (
                  <button
                    onClick={() => onNavigateTab('notices')}
                    className="text-[11px] font-bold text-[#003527] hover:underline"
                  >
                    View all →
                  </button>
                )}
              </div>

              {notices.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-14 h-14 rounded-2xl bg-[#eff4ff] flex items-center justify-center mx-auto mb-3">
                    <span className="material-symbols-outlined text-[28px] text-[#003527]">notifications_none</span>
                  </div>
                  <h4 className="font-headline font-bold text-base text-[#0b1c30] mb-1">No notices yet</h4>
                  <p className="text-sm text-[#5a6672]">Notices will appear here once published.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notices
                    .filter(n => n.category !== 'Timetable' && !n.title.toLowerCase().includes('timetable') && !n.title.toLowerCase().includes(' cse b tt'))
                    .slice(0, 4).map((notice) => (
                    <div
                      key={notice.id}
                      onClick={() => onViewNotice(notice)}
                      className="flex gap-3.5 p-3.5 rounded-xl bg-[#f4f7ff]/60 hover:bg-[#e5eeff]/70
                                 border border-transparent hover:border-[#bfc9c3]/30
                                 cursor-pointer transition-all group"
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center
                                      shrink-0 text-[15px]
                                      ${notice.urgency === 'urgent'
                                        ? 'bg-red-100 text-red-600'
                                        : notice.category === 'Scholarships'
                                        ? 'bg-[#b0f0d6] text-[#003527]'
                                        : 'bg-[#e5eeff] text-[#0b1c30]'
                                      }`}>
                        <span className="material-symbols-outlined text-[15px]">
                          {notice.urgency === 'urgent'
                            ? 'priority_high'
                            : notice.category === 'Scholarships'
                            ? 'school'
                            : 'campaign'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className={`text-[10px] font-bold uppercase tracking-wider
                                        ${notice.urgency === 'urgent' ? 'text-red-500' : 'text-[#9ca8a3]'}`}>
                            {notice.publishDate}
                          </p>
                          {notice.urgency === 'urgent' && (
                            <span className="text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                              URGENT
                            </span>
                          )}
                        </div>
                        <h4 className="font-inter font-bold text-[0.8125rem] text-[#0b1c30]
                                       group-hover:text-[#003527] transition-colors leading-snug mb-0.5">
                          {notice.title}
                        </h4>
                        <p className="text-xs text-[#707974] line-clamp-1 leading-relaxed">
                          {(notice.aiSummary || '').replace(/Indexed with \d+ semantic chunks\.?/gi, '').trim()}
                        </p>
                      </div>
                      <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="material-symbols-outlined text-[16px] text-[#003527]">arrow_forward</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {notices.length > 4 && (
                <>
                  <hr className="section-divider my-4" />
                  <button
                    onClick={() => onNavigateTab('notices')}
                    className="w-full py-2 rounded-xl text-xs font-bold text-[#003527]
                               hover:bg-[#eff4ff] transition-colors flex items-center justify-center gap-1.5"
                  >
                    View All {notices.length} Notices
                    <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                  </button>
                </>
              )}
            </div>

            {/* ── Academic & Events Calendar Widget (Real-Time Dropdown) ── */}
            <AcademicCalendarWidget
              notices={notices}
              documents={allDocs}
              onOpenAIQuery={onOpenAIQuery}
              onViewNotice={onViewNotice}
              onViewDoc={(doc) => setViewingDoc(doc)}
              defaultExpanded={true}
            />

            {/* ── Deadline Timeline — horizontal pipe ────────────────── */}
            <div className="card p-6" id="deadline-timeline">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-[#003527] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px] text-[#3cddc7]">event_note</span>
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-lg text-[#0b1c30]">
                      Upcoming Deadlines
                    </h3>
                    <p className="text-[11px] text-[#9ca8a3]">
                      Real-time dates from official notices &amp; circulars
                    </p>
                  </div>
                </div>

                {/* Priority Filter Pills */}
                {deadlines.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    {[
                      { key: 'all', label: `All (${deadlines.length})` },
                      { key: 'high', label: `🔴 Urgent (${deadlines.filter(d => d.urgency === 'high').length})` },
                      { key: 'medium', label: `🟠 Medium (${deadlines.filter(d => d.urgency === 'medium').length})` },
                      { key: 'normal', label: `🟢 Standard (${deadlines.filter(d => d.urgency === 'normal').length})` },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setDeadlinePriorityFilter(tab.key as any)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                          deadlinePriorityFilter === tab.key
                            ? 'bg-[#003527] text-white shadow-xs'
                            : 'bg-[#f4f7ff] text-[#5a6672] hover:bg-[#e5eeff]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Horizontal pipe/line timeline */}
              {deadlines.length === 0 ? (
                <div className="p-6 text-center bg-[#f8f9ff] rounded-2xl border border-dashed border-[#bfc9c3]/50">
                  <span className="material-symbols-outlined text-[32px] text-[#9ca8a3] mb-1">event_available</span>
                  <p className="text-xs font-bold text-[#0b1c30]">No Action Deadlines Currently Required</p>
                  <p className="text-[11px] text-[#707974] mt-0.5">Posts without specific action dates do not display artificial deadlines.</p>
                </div>
              ) : (() => {
                  const displayDeadlines = deadlines.filter(
                    d => {
                      const t = d.title.toLowerCase();
                      if (t.includes('academic calendar') || t.includes('academic calender')) return false;
                      return deadlinePriorityFilter === 'all' || d.urgency === deadlinePriorityFilter;
                    }
                  );

                  if (displayDeadlines.length === 0) {
                    return (
                      <p className="text-xs text-[#9ca8a3] py-6 text-center">
                        No deadlines in this priority level.
                      </p>
                    );
                  }

                  return (
                    <div className="relative overflow-x-auto pb-2">
                      <div className="min-w-[700px] relative px-4">
                        {/* The pipe line */}
                        <div className="absolute left-8 right-8 h-[3px] top-[20px]
                                        bg-gradient-to-r from-red-400 via-amber-300 via-[#b0f0d6] to-[#dbeafe]
                                        rounded-full" />

                        <div className="flex items-start justify-between relative gap-3">
                          {displayDeadlines.map((dl) => {
                            const isUrgent = dl.urgency === 'high';
                            const isMedium = dl.urgency === 'medium';
                            const dotColor = isUrgent ? 'bg-red-500 ring-red-100' :
                                             isMedium ? 'bg-[#fea619] ring-[#ffddb8]' :
                                             'bg-[#003527] ring-[#b0f0d6]';
                            const textColor = isUrgent ? 'text-red-600' :
                                              isMedium ? 'text-[#855300]' :
                                              'text-[#003527]';
                            const priorityBadge = isUrgent ? 'URGENT' : isMedium ? 'HIGH' : 'STANDARD';
                            const priorityBg = isUrgent ? 'bg-red-100 text-red-700' : isMedium ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';

                            return (
                              <div key={dl.id} className="flex flex-col items-center text-center flex-1 px-1">
                                {/* Dot on the pipe */}
                                <div className={`w-5 h-5 rounded-full ${dotColor} ring-4 z-10 mb-3 shrink-0
                                                transition-transform hover:scale-125`} />

                                {/* Priority Pill */}
                                <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full mb-1.5 ${priorityBg}`}>
                                  {priorityBadge}
                                </span>

                                {/* Date chip */}
                                <div className={`text-[10px] font-extrabold uppercase tracking-wider mb-2 ${textColor}`}>
                                  {dl.dateStr}
                                </div>

                                {/* Card below */}
                                <div
                                  onClick={() => onOpenAIQuery(`Tell me about ${dl.title} and what action is required.`)}
                                  className={`w-full bg-white rounded-xl p-3.5 border cursor-pointer text-left
                                              transition-all hover:-translate-y-1 hover:shadow-lg
                                              ${isUrgent ? 'border-red-200 shadow-sm' :
                                                isMedium ? 'border-amber-200' :
                                                'border-[#bfc9c3]/30'}`}
                                >
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="text-[9px] font-bold text-[#707974] uppercase">{dl.category}</span>
                                    <span className="text-[9px] font-bold text-[#003527]">{dl.daysRemaining}d left</span>
                                  </div>
                                  <p className="font-inter font-bold text-[0.8125rem] text-[#0b1c30] mb-1 leading-snug">
                                    {dl.title}
                                  </p>
                                  <p className="text-[11px] text-[#9ca8a3] line-clamp-2 leading-relaxed">{dl.description}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

          </section>

          {/* Right — Quick Access Sidebar (4 cols) */}
          <section className="lg:col-span-4 flex flex-col gap-5" id="sidebar-section">
            
            {/* ── Next Class Widget (Green) — Real-Time ── */}
            {nextClassInfo ? (
              <div className="bg-gradient-to-br from-[#003527] to-[#064e3b] text-white rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#80bea6]">
                      <span className="material-symbols-outlined text-[18px]">school</span>
                    </div>
                    <div>
                      <h3 className="font-headline font-bold text-base leading-tight">Next Class</h3>
                      <p className="text-[11px] text-[#80bea6] font-medium">
                        {nextClassInfo.dayLabel || nextClassInfo.dayName}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold bg-[#80bea6]/20 text-[#80bea6] px-2.5 py-0.5 rounded-full border border-[#80bea6]/30">
                    {nextClassInfo.dayName}
                  </span>
                </div>

                <h4 className="font-bold text-lg mb-1">{nextClassInfo.name}</h4>
                <p className="text-xs text-[#80bea6] mb-4 font-mono">{nextClassInfo.code}</p>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-white/90">
                    <span className="material-symbols-outlined text-[16px] text-[#80bea6]">calendar_today</span>
                    <span>{nextClassInfo.isNextDay ? (nextClassInfo.dayLabel || nextClassInfo.dayName) : `Today — ${nextClassInfo.dayName}`}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/90">
                    <span className="material-symbols-outlined text-[16px] text-[#80bea6]">schedule</span>
                    {nextClassInfo.time}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/90">
                    <span className="material-symbols-outlined text-[16px] text-[#80bea6]">room</span>
                    {nextClassInfo.room}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/90">
                    <span className="material-symbols-outlined text-[16px] text-[#80bea6]">person</span>
                    {nextClassInfo.instructor}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-[#003527] to-[#064e3b] text-white rounded-3xl p-6 shadow-sm flex items-center gap-3">
                <span className="material-symbols-outlined text-[28px] text-[#80bea6]">event_available</span>
                <div>
                  <p className="font-bold text-base">No Classes Today</p>
                  <p className="text-xs text-[#80bea6] mt-0.5">Check back on the next working day</p>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="card p-5">
              <h3 className="font-headline font-bold text-base text-[#0b1c30] mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#003527]">bolt</span>
                Quick Actions
              </h3>
              <div className="space-y-2.5">
                <button
                  onClick={() => onNavigateTab('notices')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#f4f7ff]
                             hover:bg-[#e5eeff] transition-colors text-left group"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#fea619]/15 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px] text-[#855300]">campaign</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#0b1c30]">All Notices</p>
                    <p className="text-[11px] text-[#9ca8a3]">{notices.length} published</p>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-[#9ca8a3]
                                   ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    arrow_forward
                  </span>
                </button>

                <button
                  onClick={() => onOpenAIQuery()}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#f4f7ff]
                             hover:bg-[#e5eeff] transition-colors text-left group"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#003527] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px] text-[#80bea6]">auto_awesome</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#0b1c30]">AI Assistant</p>
                    <p className="text-[11px] text-[#9ca8a3]">Ask anything</p>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-[#9ca8a3]
                                   ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    arrow_forward
                  </span>
                </button>

                <button
                  onClick={() => onNavigateTab('profile')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#f4f7ff]
                             hover:bg-[#e5eeff] transition-colors text-left group"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#004e45] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px] text-[#0cc8b3]">person</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#0b1c30]">My Profile</p>
                    <p className="text-[11px] text-[#9ca8a3]">View & edit</p>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-[#9ca8a3]
                                   ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    arrow_forward
                  </span>
                </button>

                <button
                  onClick={() => {
                    const el = document.getElementById('academic-calendar-widget');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#f4f7ff]
                             hover:bg-[#e5eeff] transition-colors text-left group"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#003527] flex items-center justify-center shrink-0 text-white">
                    <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#0b1c30]">Academic Calendar</p>
                    <p className="text-[11px] text-[#9ca8a3]">Events & exam dates</p>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-[#9ca8a3]
                                   ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    arrow_forward
                  </span>
                </button>
              </div>
            </div>


          </section>
        </div>

        {/* ── Feature Cards ───────────────────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8" id="core-features-section">
          {[
            {
              icon: 'gavel',
              iconBg: 'bg-[#003527]',
              iconText: 'text-[#80bea6]',
              title: 'Grounded AI',
              desc: 'Evidence-based answers derived strictly from official university sources, policies, and verified documentation.',
            },
            {
              icon: 'campaign',
              iconBg: 'bg-[#fea619]',
              iconText: 'text-[#684000]',
              title: 'Instant Notices',
              desc: 'Never miss a deadline. Intelligent alerts for registration dates, financial aid deadlines, and campus events.',
            },
            {
              icon: 'library_books',
              iconBg: 'bg-[#004e45]',
              iconText: 'text-[#0cc8b3]',
              title: 'Document Intelligence',
              desc: "A fully searchable, systematically organised library of all your college's knowledge, immediately accessible.",
            },
          ].map((f) => (
            <div key={f.title} className="card p-7 relative overflow-hidden group">
              <div className={`w-12 h-12 rounded-2xl ${f.iconBg} ${f.iconText}
                              flex items-center justify-center mb-5 relative z-10 shadow-sm`}>
                <span className="material-symbols-outlined text-[24px]">{f.icon}</span>
              </div>
              <h3 className="font-headline font-bold text-lg text-[#0b1c30] mb-2 relative z-10">
                {f.title}
              </h3>
              <p className="text-sm text-[#5a6672] leading-relaxed relative z-10">
                {f.desc}
              </p>
            </div>
          ))}
        </section>

      </div>

      {/* ── VIEW DOCUMENT MODAL ── */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
             onClick={() => setViewingDoc(null)}>
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-fade-in"
               onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#bfc9c3]/30">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl ${getCategoryColor(viewingDoc.category).accent}
                                text-white flex items-center justify-center`}>
                  <span className="material-symbols-outlined text-[22px]">
                    {getCategoryIcon(viewingDoc.category)}
                  </span>
                </div>
                <div>
                  <h3 className="font-headline font-bold text-[#0b1c30] leading-snug">{viewingDoc.title}</h3>
                  <p className="text-xs text-[#9ca8a3]">{viewingDoc.department} · {viewingDoc.category}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingDoc(null)}
                className="w-9 h-9 rounded-xl bg-[#f4f7ff] hover:bg-[#e5eeff] flex items-center justify-center
                           text-[#9ca8a3] hover:text-[#003527] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* Event Poster / Uploaded Image Preview */}
              {(() => {
                const imgSource = viewingDoc.imageUrl || viewingDoc.fileUrl;
                const isImage = !!imgSource && (
                  imgSource.startsWith('data:image') ||
                  /\.(png|jpe?g|webp|gif|svg)$/i.test(imgSource) ||
                  viewingDoc.fileType === 'image'
                );
                if (!isImage) return null;
                return (
                  <div className="mb-5 rounded-2xl overflow-hidden border border-[#bfc9c3]/40 bg-[#051329] p-3 shadow-md flex flex-col items-center">
                    <div className="w-full flex items-center justify-between px-2 py-1 text-xs text-white/90 border-b border-white/10 mb-2">
                      <span className="font-bold flex items-center gap-1.5 text-[#3cddc7]">
                        <span className="material-symbols-outlined text-[16px]">photo_size_select_actual</span>
                        Official Uploaded Poster
                      </span>
                      <a
                        href={imgSource}
                        target="_blank"
                        rel="noreferrer"
                        download={`${viewingDoc.title.replace(/\s+/g, '_')}_poster`}
                        className="text-[#3cddc7] hover:underline flex items-center gap-1 text-[11px] font-bold"
                      >
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        Open Full Resolution
                      </a>
                    </div>
                    <img
                      src={imgSource}
                      alt={viewingDoc.title}
                      className="max-h-[380px] w-auto object-contain rounded-xl shadow-xl hover:scale-[1.01] transition-transform"
                    />
                  </div>
                );
              })()}

              {/* Meta grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                {[
                  { label: 'Category', value: viewingDoc.category },
                  { label: 'Department', value: viewingDoc.department },
                  { label: 'Academic Year', value: viewingDoc.academicYear },
                  { label: 'Audience', value: viewingDoc.section ? `Section ${viewingDoc.section}` : 'All Students' },
                  { label: 'Published', value: viewingDoc.publishedDate },
                ].map(item => (
                  <div key={item.label} className="bg-[#f8f9ff] rounded-xl p-3">
                    <p className="text-[10px] font-bold text-[#9ca8a3] uppercase tracking-wider mb-0.5">{item.label}</p>
                    <p className="text-sm font-semibold text-[#0b1c30]">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Summary */}
              {viewingDoc.summary && viewingDoc.category !== 'Timetable' && (
                <div className="mb-4">
                  <p className="text-xs font-bold text-[#404944] uppercase mb-2">Summary</p>
                  <div className="bg-[#f8f9ff] rounded-xl p-4 border border-[#bfc9c3]/20">
                    <p className="text-sm text-[#5a6672] leading-relaxed">
                      {viewingDoc.summary.replace(/Indexed with \d+ semantic chunks./g, '')}
                    </p>
                  </div>
                </div>
              )}

              {/* Full content */}
              {(viewingDoc.contentRaw && viewingDoc.contentRaw.length > 50) || viewingDoc.category === 'Timetable' ? (
                <div>
                  <p className="text-xs font-bold text-[#404944] uppercase mb-2">
                    {viewingDoc.category === 'Timetable' ? 'Schedule' : 'Document Content'}
                  </p>
                  <div className="bg-white rounded-xl border border-[#bfc9c3]/30 overflow-hidden shadow-xs">
                    {viewingDoc.category === 'Timetable' ? (
                      <div>
                        {/* Day Tabs */}
                        <div className="flex border-b border-[#bfc9c3]/30 bg-[#f4f7ff] overflow-x-auto">
                          {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                            <button
                              key={day}
                              onClick={() => setActiveDay(day)}
                              className={`flex-1 py-3 px-4 text-xs font-bold transition-colors border-b-2
                                ${activeDay === day 
                                  ? 'border-[#003527] text-[#003527] bg-white' 
                                  : 'border-transparent text-[#707974] hover:bg-[#e5eeff]'}`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                        {/* Timetable List */}
                        <div className="p-0">
                          {TIMETABLE_DATA[activeDay]?.map((slot, idx) => (
                            <div key={idx} className="flex flex-col sm:flex-row sm:items-center p-4 border-b border-[#bfc9c3]/20 last:border-0 hover:bg-[#f8f9ff] transition-colors gap-3">
                              <div className="bg-[#e5eeff] text-[#003527] font-mono text-[10px] font-bold px-3 py-1.5 rounded-lg shrink-0 sm:w-32 text-center">
                                {slot.time}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-bold text-sm text-[#0b1c30] truncate">{slot.name}</span>
                                  <span className="text-[10px] bg-[#b0f0d6]/30 text-[#003527] font-bold px-2 py-0.5 rounded-full border border-[#80bea6]/30">
                                    {slot.code}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-[#707974]">
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">person</span>
                                    {slot.instructor}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">room</span>
                                    {slot.room}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-[#f8f9ff] max-h-[300px] overflow-y-auto">
                        <pre className="text-sm text-[#5a6672] leading-relaxed whitespace-pre-wrap font-inter">
                          {viewingDoc.contentRaw}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[#bfc9c3]/30">
              <button
                onClick={() => setViewingDoc(null)}
                className="w-full py-3 bg-[#003527] text-white font-bold text-sm rounded-xl hover:bg-[#064e3b] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 🚨 24-Hour Urgent Alert Modal (Appears when deadline is <= 1 day) ── */}
      {criticalDeadlines.length > 0 && !urgentAlertDismissed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1c30]/75 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-red-200 animate-scale-up">
            {/* Top red pulsing header accent */}
            <div className="h-2.5 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 w-full animate-pulse" />
            
            <div className="p-6 md:p-8">
              {/* Alert Badge & Icon */}
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600 shadow-sm animate-bounce">
                    <span className="material-symbols-outlined text-[28px]">notification_important</span>
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                      <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                      Critical Attention
                    </div>
                    <h3 className="font-headline font-extrabold text-xl text-[#0b1c30]">
                      Urgent Deadline Approaching!
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setUrgentAlertDismissed(true);
                    try { sessionStorage.setItem('campusiq_urgent_alert_dismissed', 'true'); } catch {}
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
                  title="Close alert"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <p className="text-xs text-[#5a6672] mb-5 leading-relaxed">
                The following campus notice has a critical deadline in <strong className="text-red-600 font-bold">less than 24 hours / today</strong>. Please review the details below to ensure timely submission or attendance:
              </p>

              {/* Critical Items Box */}
              <div className="space-y-3 mb-6 max-h-[260px] overflow-y-auto pr-1">
                {criticalDeadlines.map((dl) => (
                  <div
                    key={dl.id}
                    className="p-4 rounded-2xl bg-gradient-to-br from-red-50/70 to-amber-50/50 border border-red-200/80 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-black tracking-wide uppercase">
                        {dl.daysRemaining === 0 ? '🔥 CLOSING TODAY' : '⏰ DUE TOMORROW'}
                      </span>
                      <span className="text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                        {dl.dateStr}
                      </span>
                    </div>
                    <h4 className="font-headline font-bold text-base text-[#0b1c30] mb-1">
                      {dl.title}
                    </h4>
                    <p className="text-xs text-[#5a6672] line-clamp-2 leading-relaxed mb-3">
                      {dl.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setUrgentAlertDismissed(true);
                          try { sessionStorage.setItem('campusiq_urgent_alert_dismissed', 'true'); } catch {}
                          onOpenAIQuery(`What are the key requirements and urgent action steps for "${dl.title}"?`);
                        }}
                        className="text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1 group"
                      >
                        <span className="material-symbols-outlined text-[16px] group-hover:scale-110 transition-transform">smart_toy</span>
                        Ask AI What To Do
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={() => {
                    setUrgentAlertDismissed(true);
                    try { sessionStorage.setItem('campusiq_urgent_alert_dismissed', 'true'); } catch {}
                    const topDl = criticalDeadlines[0];
                    if (topDl) {
                      onOpenAIQuery(`Tell me full details and action plan for urgent notice: ${topDl.title}`);
                    }
                  }}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold text-xs shadow-md shadow-red-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  View Action Plan with AI
                </button>
                <button
                  onClick={() => {
                    setUrgentAlertDismissed(true);
                    try { sessionStorage.setItem('campusiq_urgent_alert_dismissed', 'true'); } catch {}
                  }}
                  className="w-full sm:w-auto py-3 px-5 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#0b1c30] font-bold text-xs transition-colors"
                >
                  Acknowledge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
