import React, { useState, useEffect } from 'react';
import { apiFetch as fetch } from '../lib/api';
import { StudentProfile, Notice, DeadlineItem, CollegeDocument, StudentReview } from '../types';
import { findNextClass, CSE_B_WEEKLY_SCHEDULE, DAY_NAMES, resolveScheduleFromDocs, isTimetableDoc } from '../lib/timetable';
import { AcademicCalendarWidget } from './AcademicCalendarWidget';
import { WhatToKnow } from './WhatToKnow';
import { SectionTranslation } from './SectionTranslation';
import { isDatePast, daysUntil } from '../lib/dateUtils';

interface StudentDashboardProps {
  student: StudentProfile & { section?: string };
  notices: Notice[];
  deadlines: DeadlineItem[];
  documents: CollegeDocument[];
  onOpenAIQuery: (initialPrompt?: string) => void;
  onViewNotice: (notice: Notice) => void;
  onNavigateTab: (tab: string) => void;
}

const PdfViewer = ({ fileSource, title }: { fileSource: string, title: string }) => {
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (fileSource.startsWith('data:application/pdf;base64,')) {
      try {
        const base64Data = fileSource.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        return () => URL.revokeObjectURL(url);
      } catch (e) {
        setBlobUrl(fileSource);
      }
    } else {
      setBlobUrl(fileSource);
    }
  }, [fileSource]);

  if (!blobUrl) return <div className="p-4 text-center text-white">Loading PDF...</div>;

  return (
    <iframe
      src={blobUrl}
      title={title}
      className="w-full h-full rounded-xl"
      style={{ minHeight: '480px', border: 'none' }}
    />
  );
};

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

  // ── Fetch documents from DB for centralized view ────────────────
  const [dbDocs, setDbDocs] = useState<CollegeDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [viewingDoc, setViewingDoc] = useState<CollegeDocument | null>(null);
  const [reviews, setReviews] = useState<StudentReview[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');
  const [activeDay, setActiveDay] = useState<string>('MON');
  const [translationEnabled, setTranslationEnabled] = useState(false);
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

  // Build the student's normalised department string for filtering
  const studentDept = (student.department || '').trim();

  useEffect(() => {
    let cancelled = false;
    const fetchDocs = async () => {
      setDocsLoading(true);
      try {
        // Use the student-filtered endpoint so branch-specific docs
        // (e.g. CSE circulars) are only shown to students in that branch.
        // General Academic docs are always included by the server.
        const params = new URLSearchParams();
        if (studentDept) params.set('department', studentDept);
        const section = (student as { section?: string }).section;
        if (section) params.set('section', section);
        const res = await fetch(`/api/documents/for-student?${params.toString()}`);
        const data = await res.json();
        if (!cancelled && data.documents) {
          setDbDocs(data.documents);
        }
      } catch {
        // offline — fall back gracefully, no docs shown from DB
      } finally {
        if (!cancelled) setDocsLoading(false);
      }
    };
    fetchDocs();
    const interval = setInterval(fetchDocs, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentDept]);
  useEffect(() => {
    let cancelled = false;
    const fetchReviews = async () => {
      try {
        const response = await fetch('/api/reviews?limit=20');
        const data = await response.json();
        if (!cancelled && Array.isArray(data.reviews)) setReviews(data.reviews);
      } catch {}
    };
    fetchReviews();
    const interval = setInterval(fetchReviews, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const submitReview = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = reviewText.trim();
    if (text.length < 10) {
      setReviewMessage('Please write at least 10 characters.');
      return;
    }
    setReviewSubmitting(true);
    setReviewMessage('');
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: student.id,
          name: student.name,
          department: student.department,
          year: student.year,
          semester: student.semester,
          section: studentSection,
          rating: reviewRating,
          text,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not submit review');
      setReviews(prev => [data.review, ...prev.filter(item => item.id !== data.review.id)].slice(0, 20));
      setReviewText('');
      setReviewMessage('Review submitted successfully.');
    } catch (error: any) {
      setReviewMessage(error.message || 'Could not submit review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Merge: DB docs first, then passed-in documents (deduplicated)
  // Also filter out any passed-in (local) documents that belong to a
  // DIFFERENT specific branch (i.e. not General Academic / not the student's branch).
  const allDocs = React.useMemo(() => {
    const seen = new Set<string>();
    const merged: CollegeDocument[] = [];
    const deptNorm = studentDept.toLowerCase();
    const isCse = deptNorm === 'cse' || deptNorm.includes('computer science');

    const isRelevantDept = (dept: string) => {
      if (!dept) return true; // no department set → general
      const d = dept.toLowerCase().trim();
      if (d === 'general academic' || d === 'academic affairs' || d === '' || d === 'all') return true;
      if (!deptNorm) return true; // student has no dept set → show everything
      if (isCse) return d.includes('computer science') || d.includes('cse') || d === 'general academic';
      return d === deptNorm || d.includes(deptNorm) || deptNorm.includes(d);
    };

    for (const d of [...dbDocs, ...documents]) {
      if (d.targetBucket !== 'ai_bucket' && !seen.has(d.id) && isRelevantDept(d.department)) {
        seen.add(d.id);
        merged.push(d);
      }
    }
    return merged;
  }, [dbDocs, documents, studentDept]);

  const dashboardDocs = React.useMemo(
    () => allDocs.filter(document => document.targetBucket !== 'student_guide'),
    [allDocs],
  );

  const activeDocs = React.useMemo(
    () => dashboardDocs.filter(document => !isDatePast(document.actionRequiredDate)),
    [dashboardDocs],
  );

  // Resolve schedule dynamically from uploaded documents, falling back to CSE_B_WEEKLY_SCHEDULE
  const currentSchedule = React.useMemo(() => {
    const resolved = resolveScheduleFromDocs(dashboardDocs);
    return resolved.schedule || CSE_B_WEEKLY_SCHEDULE;
  }, [dashboardDocs]);

  // Real-time next class dynamically updated from current schedule for the green widget
  const nextClassInfo = React.useMemo(() => findNextClass(currentSchedule), [currentSchedule]);

  // Dynamic timetable grid for the schedule viewer modal
  const TIMETABLE_DATA = React.useMemo(() => {
    const res: Record<string, { time: string; code: string; name: string; room: string; instructor: string }[]> = {};
    const mapDay: Record<string, string> = {
      MON: 'monday',
      TUE: 'tuesday',
      WED: 'wednesday',
      THU: 'thursday',
      FRI: 'friday',
      SAT: 'saturday',
    };
    for (const [shortD, fullD] of Object.entries(mapDay)) {
      const slots = currentSchedule[fullD] || [];
      res[shortD] = slots.map(s => ({
        time: s.time,
        code: s.code,
        name: s.name,
        room: s.room,
        instructor: s.instructor,
      }));
    }
    return res;
  }, [currentSchedule]);

  // Only documents still active for the students should count as live.
  const recentDocs = activeDocs.filter(d => !isTimetableDoc(d)).slice(0, 5);
  const liveDocs = recentDocs;

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
          <div className="mt-4 flex min-w-0 flex-col items-start gap-2">
            <button
              type="button"
              aria-pressed={translationEnabled}
              onClick={() => setTranslationEnabled(enabled => !enabled)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold shadow-sm transition-all
                          ${translationEnabled
                            ? 'border-[#003527] bg-[#003527] text-white'
                            : 'border-[#b0f0d6] bg-white text-[#003527] hover:bg-[#effaf5]'}`}
            >
              <span className="material-symbols-outlined text-[18px]">translate</span>
              {translationEnabled ? 'Translation tools are on' : 'Translate sections'}
              <span className={`relative h-5 w-9 rounded-full transition-colors ${translationEnabled ? 'bg-[#80bea6]' : 'bg-[#cbd5e1]'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] duration-200 ease-in-out ${translationEnabled ? 'left-[18px]' : 'left-0.5'}`} />
              </span>
            </button>
            <span className="block max-w-2xl text-xs leading-relaxed text-[#707974]">
              {translationEnabled
                ? 'Choose Marathi on any section you want translated.'
                : 'Turn on to show Marathi translation buttons throughout your dashboard.'}
            </span>
          </div>
          <SectionTranslation
            text={`Welcome to CampusIQ, ${student.name} — your centralized college information hub.`}
            enabled={translationEnabled}
          />
        </header>

        <WhatToKnow
          documents={allDocs}
          notices={notices.filter(notice => {
            const dept = (notice.department || '').trim().toLowerCase();
            const studentDepartment = studentDept.trim().toLowerCase();
            if (!dept || ['general academic', 'academic affairs', 'all'].includes(dept) || !studentDepartment) return true;
            const studentIsCse = studentDepartment === 'cse' || studentDepartment.includes('computer science');
            if (studentIsCse) return dept.includes('computer science') || dept.includes('cse');
            return dept === studentDepartment || dept.includes(studentDepartment) || studentDepartment.includes(dept);
          })}
          onViewDocument={setViewingDoc}
          onViewNotice={onViewNotice}
          translationEnabled={translationEnabled}
        />

        {/* ── Main Grid ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 mb-10">

          {/* Left — Central Info (8 cols) */}
          <section className="lg:col-span-8 flex flex-col gap-6" id="for-you-section">

            <div className="flex items-center justify-between mb-2">
              <h2 className="font-headline font-bold text-xl text-[#0b1c30] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#003527] text-[22px]">space_dashboard</span>
                Central Information Hub
              </h2>
              <SectionTranslation text="Central Information Hub" enabled={translationEnabled} />
              {!docsLoading && liveDocs.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#003527]
                                 bg-[#b0f0d6]/35 px-3 py-1 rounded-full border border-[#80bea6]/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#003527] animate-pulse" />
                  Live · {liveDocs.length} documents
                </span>
              )}
            </div>

            {/* ── Highlighted Recent Uploads — newest first, completed last ── */}
            {recentDocs.length > 0 && (() => {
              const getUploadTime = (doc: CollegeDocument) => {
                const rawDate = doc.createdAt || doc.publishedDate || '';
                const parsed = new Date(rawDate);
                return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
              };
              const sorted = [...recentDocs].sort((a, b) => {
                const aDays = daysUntil(a.actionRequiredDate);
                const bDays = daysUntil(b.actionRequiredDate);
                const aCompleted = aDays !== null && aDays < 0;
                const bCompleted = bDays !== null && bDays < 0;
                if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
                return getUploadTime(b) - getUploadTime(a);
              });

              return (
                <div className="space-y-3" id="highlighted-uploads">
                  {sorted.map((doc, idx) => {
                    const colors = getCategoryColor(doc.category);
                    const docDays = daysUntil(doc.actionRequiredDate);
                    const docCompleted = docDays !== null && docDays < 0;
                    // NEW remains visible for up to 4 days after upload.
                    const uploadDateStr = doc.createdAt || doc.publishedDate || '';
                    const uploadDate = uploadDateStr ? new Date(uploadDateStr) : null;
                    const elapsedDays = uploadDate && !isNaN(uploadDate.getTime())
                      ? (Date.now() - uploadDate.getTime()) / 86400000
                      : 999;
                    const isNew = !docCompleted && elapsedDays >= 0 && elapsedDays <= 4;

                    return (
                      <div
                        key={doc.id}
                        onClick={() => setViewingDoc(doc)}
                        className={`relative rounded-2xl p-5 border cursor-pointer transition-all
                                    hover:shadow-lg hover:-translate-y-0.5 group overflow-hidden
                                    ${docCompleted
                                      ? 'bg-[#f4f5f7] border-[#d1d5db] opacity-75'
                                      : isNew
                                      ? `${colors.bg} ${colors.border} border-2 shadow-md`
                                      : 'bg-white border-[#bfc9c3]/30 shadow-xs'
                                    }`}
                      >
                        {/* COMPLETED banner — highly visible */}
                        {docCompleted && (
                          <div className="absolute top-0 right-0">
                            <div className="bg-[#6b7280] text-white text-[9px] font-extrabold uppercase tracking-wider
                                            px-3.5 py-1.5 rounded-bl-xl flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">check_circle</span>
                              COMPLETED
                            </div>
                          </div>
                        )}

                        {/* New badge for most recent active docs */}
                        {isNew && !docCompleted && (
                          <div className="absolute top-0 right-0">
                            <div className={`${colors.accent} text-white text-[9px] font-extrabold uppercase tracking-wider
                                            px-3 py-1 rounded-bl-xl`}>
                              NEW
                            </div>
                          </div>
                        )}

                        {/* Accent strip on left */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${docCompleted ? 'bg-[#9ca3af]' : colors.accent} rounded-l-2xl`} />

                        <div className="flex items-start gap-4 pl-3">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm
                                          ${docCompleted
                                            ? 'bg-[#e5e7eb] text-[#9ca3af]'
                                            : isNew
                                            ? `${colors.accent} text-white`
                                            : `bg-[#eff4ff] ${colors.text}`
                                          }`}>
                            <span className="material-symbols-outlined text-[24px]">
                              {docCompleted ? 'event_available' : getCategoryIcon(doc.category)}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className={`text-[10px] font-extrabold uppercase tracking-wider
                                               ${docCompleted ? 'text-[#9ca3af]' : colors.text}`}>
                                {doc.category}
                              </span>
                              <span className="text-[10px] text-[#9ca8a3]">·</span>
                              <span className="text-[11px] text-[#707974] font-medium">{doc.department}</span>
                              {docCompleted && doc.actionRequiredDate && (
                                <span className="text-[9px] font-bold bg-[#f3f4f6] text-[#6b7280] px-2 py-0.5 rounded-full
                                               border border-[#d1d5db] flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[10px]">event_available</span>
                                  Ended: {doc.actionRequiredDate}
                                </span>
                              )}
                            </div>

                            <h4 className={`font-inter font-bold text-[0.9375rem] leading-snug mb-1.5
                                           transition-colors
                                           ${docCompleted
                                             ? 'text-[#9ca3af] line-through decoration-[#d1d5db]'
                                             : isNew
                                             ? 'text-[#0b1c30] group-hover:text-[#003527]'
                                             : 'text-[#17283a] group-hover:text-[#003527]'
                                           }`}>
                              {doc.title}
                            </h4>

                            <p className={`text-xs line-clamp-2 leading-relaxed
                                          ${docCompleted ? 'text-[#9ca3af]' : 'text-[#707974]'}`}>
                              {(doc.summary || '').replace(/Indexed with \d+ semantic chunks\.?/gi, '').trim() || doc.title}
                            </p>
                            <SectionTranslation
                              text={`${doc.title}\n${(doc.summary || '').replace(/Indexed with \d+ semantic chunks\.?/gi, '').trim()}`}
                              enabled={translationEnabled}
                            />

                            <div className="flex items-center gap-3 mt-2 text-[11px] text-[#9ca8a3]">
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">apartment</span>
                                {doc.department}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity self-center">
                            <div className={`w-8 h-8 rounded-full ${docCompleted ? 'bg-[#9ca3af]' : colors.accent} text-white flex items-center justify-center`}>
                              <span className="material-symbols-outlined text-[16px]">visibility</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {docsLoading && dashboardDocs.length === 0 && (
              <div className="card p-8 animate-pulse space-y-3">
                <div className="h-16 bg-[#e5eeff] rounded-xl w-full" />
                <div className="h-16 bg-[#e5eeff]/70 rounded-xl w-full" />
                <div className="h-16 bg-[#e5eeff]/50 rounded-xl w-full" />
              </div>
            )}

            {!docsLoading && dashboardDocs.length === 0 && (
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
                      Notices &amp; Announcements
                    </h3>
                    <p className="text-[11px] text-[#9ca8a3]">
                      Centralized updates for all students
                    </p>
                    <SectionTranslation
                      text="Notices and announcements. Centralized updates for all students."
                      enabled={translationEnabled}
                    />
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

              {(() => {
                // Split: fresh = no date or future date; completed = past date
                const filtered = notices;
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const freshNotices = filtered.filter(n => {
                  // Only active notices should appear in the live dashboard.
                  if (isDatePast(n.actionRequiredDate)) return false;
                  // Hide stale event/exam/timetable notices (published > 30 days ago)
                  const isTimeboxed = n.category === 'Events' || n.category === 'Exams' ||
                    /timetable|midsem|mid-sem|midterm|exam schedule/i.test(n.title || '');
                  if (isTimeboxed && n.publishDate) {
                    const pub = new Date(n.publishDate);
                    if (!isNaN(pub.getTime()) && (Date.now() - pub.getTime()) > 7 * 86400000) return false;
                  }
                  return true;
                });

                if (notices.length === 0) {
                  return (
                    <div className="text-center py-10">
                      <div className="w-14 h-14 rounded-2xl bg-[#eff4ff] flex items-center justify-center mx-auto mb-3">
                        <span className="material-symbols-outlined text-[28px] text-[#003527]">notifications_none</span>
                      </div>
                      <h4 className="font-headline font-bold text-base text-[#0b1c30] mb-1">No notices yet</h4>
                      <p className="text-sm text-[#5a6672]">Notices will appear here once published.</p>
                    </div>
                  );
                }

                if (freshNotices.length === 0) {
                  return (
                    <div className="text-center py-8 bg-[#f8f9ff] rounded-2xl border border-dashed border-[#bfc9c3]/50">
                      <span className="material-symbols-outlined text-[32px] text-[#9ca8a3] mb-1">check_circle</span>
                      <p className="text-xs font-bold text-[#0b1c30]">All caught up!</p>
                      <p className="text-[11px] text-[#707974] mt-0.5">No active notices right now. Past events are in the sidebar.</p>
                    </div>
                  );
                }

                const sortedFreshNotices = [...freshNotices].sort((a, b) => {
                  const getNoticeTime = (notice: Notice) => {
                    const rawDate = notice.createdAt || notice.publishDate;
                    const parsed = new Date(rawDate);
                    return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
                  };
                  return getNoticeTime(b) - getNoticeTime(a);
                });

                return (
                  <div className="space-y-3">
                    {sortedFreshNotices.slice(0, 4).map((notice) => {
                      const showUrgent = (notice.urgency === 'urgent' || notice.urgency === 'high') && !isDatePast(notice.actionRequiredDate);
                      const pubDate = notice.createdAt || notice.publishDate ? new Date(notice.createdAt || notice.publishDate) : null;
                      const elapsedDays = pubDate && !isNaN(pubDate.getTime()) ? (Date.now() - pubDate.getTime()) / 86400000 : 999;
                      const isNew = elapsedDays >= 0 && elapsedDays <= 4;
                      return (
                        <div
                          key={notice.id}
                          onClick={() => onViewNotice(notice)}
                          className="flex gap-3.5 p-3.5 rounded-xl bg-[#f4f7ff]/60 hover:bg-[#e5eeff]/70
                                     border border-transparent hover:border-[#bfc9c3]/30
                                     cursor-pointer transition-all group"
                        >
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center
                                          shrink-0 text-[15px]
                                          ${showUrgent
                                            ? 'bg-red-100 text-red-600'
                                            : notice.category === 'Scholarships'
                                            ? 'bg-[#b0f0d6] text-[#003527]'
                                            : 'bg-[#e5eeff] text-[#0b1c30]'
                                          }`}>
                            <span className="material-symbols-outlined text-[15px]">
                              {showUrgent
                                ? 'priority_high'
                                : notice.category === 'Scholarships'
                                ? 'school'
                                : 'campaign'}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className={`text-[10px] font-bold uppercase tracking-wider
                                            ${showUrgent ? 'text-red-500' : 'text-[#9ca8a3]'}`}>
                                {notice.publishDate}
                              </p>
                              {showUrgent && (
                                <span className="text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                                  URGENT
                                </span>
                              )}
                              {isNew && (
                                <span className="text-[9px] font-extrabold bg-[#003527] text-[#80bea6] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#80bea6] animate-pulse"></span>
                                  NEW
                                </span>
                              )}
                            </div>
                            <h4 className="font-inter font-bold text-[0.8125rem] leading-snug mb-0.5
                                           text-[#0b1c30] group-hover:text-[#003527] transition-colors">
                              {notice.title}
                            </h4>
                            <p className="text-xs text-[#707974] line-clamp-1 leading-relaxed">
                              {(notice.aiSummary || '').replace(/Indexed with \d+ semantic chunks\.?/gi, '').trim()}
                            </p>
                            <SectionTranslation
                              text={`${notice.title}\n${(notice.aiSummary || '').replace(/Indexed with \d+ semantic chunks\.?/gi, '').trim()}`}
                              enabled={translationEnabled}
                            />
                          </div>
                          <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="material-symbols-outlined text-[16px] text-[#003527]">arrow_forward</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {notices.filter(
                 n => !n.title.toLowerCase().includes('timetable') &&
                     !n.title.toLowerCase().includes(' cse b tt') &&
                     !isDatePast(n.actionRequiredDate)
              ).length > 4 && (
                <>
                  <hr className="section-divider my-4" />
                  <button
                    onClick={() => onNavigateTab('notices')}
                    className="w-full py-2 rounded-xl text-xs font-bold text-[#003527]
                               hover:bg-[#eff4ff] transition-colors flex items-center justify-center gap-1.5"
                  >
                    View All Active Notices
                    <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                  </button>
                </>
              )}
            </div>

            {/* ── Academic & Events Calendar Widget (Real-Time Dropdown) ── */}
            <AcademicCalendarWidget
              notices={notices}
              documents={dashboardDocs}
              onOpenAIQuery={onOpenAIQuery}
              onViewNotice={onViewNotice}
              onViewDoc={(doc) => setViewingDoc(doc)}
              defaultExpanded={true}
              translationEnabled={translationEnabled}
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
                    <SectionTranslation
                      text="Upcoming deadlines. Real-time dates from official notices and circulars."
                      enabled={translationEnabled}
                    />
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
                                  <SectionTranslation
                                    text={`${dl.title}\n${dl.description}`}
                                    enabled={translationEnabled}
                                  />
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
                <SectionTranslation
                  text={`Next Class: ${nextClassInfo.name}\n${nextClassInfo.dayLabel || nextClassInfo.dayName}\n${nextClassInfo.time}\nRoom: ${nextClassInfo.room}\nInstructor: ${nextClassInfo.instructor}`}
                  enabled={translationEnabled}
                />

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
              <SectionTranslation text="Quick Actions: All Notices, AI Assistant, My Profile, and Academic Calendar." enabled={translationEnabled} />
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


            {/* ── Completed / Past Events Sidebar Widget ───────────── */}
            {(() => {
              const completedNotices = notices.filter(
                 n => !n.title.toLowerCase().includes('timetable') &&
                     !n.title.toLowerCase().includes(' cse b tt') &&
                     isDatePast(n.actionRequiredDate)
              );
              if (completedNotices.length === 0) return null;
              return (
                <div className="card p-5" id="completed-events-sidebar">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-[#e5eeff] flex items-center justify-center">
                      <span className="material-symbols-outlined text-[18px] text-[#707974]">event_available</span>
                    </div>
                    <div>
                      <h3 className="font-headline font-bold text-sm text-[#5a6672]">Past Events</h3>
                      <p className="text-[10px] text-[#9ca8a3]">{completedNotices.length} completed</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {completedNotices.map(notice => (
                      <button
                        key={notice.id}
                        onClick={() => onViewNotice(notice)}
                        className="w-full flex items-start gap-2.5 p-3 rounded-xl
                                   bg-[#f4f7ff]/50 hover:bg-[#e5eeff]/60
                                   border border-[#bfc9c3]/20 hover:border-[#bfc9c3]/40
                                   transition-all group text-left"
                      >
                        <div className="w-7 h-7 rounded-full bg-[#e5eeff] flex items-center justify-center shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-[14px] text-[#9ca8a3]">check_circle</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider
                                           bg-[#e5eeff] text-[#9ca8a3] px-1.5 py-0.5 rounded-full
                                           flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[10px]">event_available</span>
                              Completed
                            </span>
                            <span className="text-[9px] text-[#9ca8a3] font-medium">
                              {notice.actionRequiredDate}
                            </span>
                          </div>
                          <p className="text-[0.75rem] font-semibold text-[#9ca8a3]
                                        line-clamp-2 leading-snug group-hover:text-[#5a6672]
                                        transition-colors line-through decoration-[#bfc9c3]/60">
                            {notice.title}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

          </section>
        </div>

        {/* ── Student Review ───────────────────────────────────────── */}
        <section className="card p-5 mb-7" id="student-review-section">
          <div className="flex flex-col lg:flex-row gap-5 lg:items-start">
            <form onSubmit={submitReview} className="lg:w-[320px] shrink-0">
              <h3 className="font-headline font-bold text-base text-[#0b1c30] mb-1">Share your experience</h3>
              <p className="text-[11px] text-[#707974] mb-3">Your review will appear on CampusIQ.</p>
              <div className="flex items-center gap-1 mb-3" aria-label="Review rating">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setReviewRating(rating)}
                    className="text-[#fea619] hover:scale-110 transition-transform"
                    aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
                  >
                    <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: rating <= reviewRating ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                  </button>
                ))}
              </div>
              <textarea
                value={reviewText}
                onChange={event => setReviewText(event.target.value)}
                maxLength={280}
                placeholder="Write your review..."
                className="w-full h-20 resize-none rounded-xl border border-[#bfc9c3]/40 bg-white px-3 py-2 text-xs text-[#0b1c30] outline-none focus:border-[#003527]"
              />
              <div className="flex items-center justify-between gap-3 mt-2">
                <span className={`text-[10px] ${reviewMessage.includes('successfully') ? 'text-[#15803d]' : 'text-[#ba1a1a]'}`}>{reviewMessage}</span>
                <button
                  type="submit"
                  disabled={reviewSubmitting || reviewText.trim().length < 10}
                  className="px-3 py-2 rounded-lg bg-[#003527] text-white text-xs font-bold disabled:opacity-50"
                >
                  {reviewSubmitting ? 'Submitting...' : 'Submit review'}
                </button>
              </div>
            </form>

            <div className="min-w-0 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {reviews.slice(0, 3).map(review => {
                  const classLine = [review.year, review.department, review.section ? `Section ${review.section}` : null].filter(Boolean).join(' · ');
                  const initials = review.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <article key={review.id} className="rounded-xl border border-[#bfc9c3]/30 bg-white p-4">
                      <div className="flex gap-0.5 mb-2">
                        {[1, 2, 3, 4, 5].map(star => (
                          <span key={star} className="material-symbols-outlined text-[14px] text-[#fea619]" style={{ fontVariationSettings: star <= review.rating ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                        ))}
                      </div>
                      <p className="text-xs leading-relaxed text-[#404944] line-clamp-3 mb-3">“{review.text}”</p>
                      <div className="flex items-center gap-2 pt-3 border-t border-[#f0f4f8]">
                        <span className="w-8 h-8 rounded-full bg-[#003527] text-white flex items-center justify-center text-[10px] font-bold">{initials}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{review.name}</p>
                          <p className="text-[9px] text-[#707974] truncate">{classLine}</p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

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
              {/* Actual Uploaded File Preview — Image or PDF */}
              {(() => {
                const fileSource = viewingDoc.imageUrl || viewingDoc.fileUrl;
                if (!fileSource) return null;
                const isImage = (
                  fileSource.startsWith('data:image') ||
                  /\.(png|jpe?g|webp|gif|svg)$/i.test(fileSource) ||
                  viewingDoc.fileType === 'image'
                );
                const isPdf = (
                  fileSource.startsWith('data:application/pdf') ||
                  /\.pdf$/i.test(fileSource) ||
                  viewingDoc.fileType === 'pdf'
                );

                if (isImage) {
                  return (
                    <div className="mb-5 rounded-2xl overflow-hidden border border-[#bfc9c3]/40 bg-[#051329] p-3 shadow-md flex flex-col items-center">
                      <div className="w-full flex items-center justify-between px-2 py-1 text-xs text-white/90 border-b border-white/10 mb-2">
                        <span className="font-bold flex items-center gap-1.5 text-[#3cddc7]">
                          <span className="material-symbols-outlined text-[16px]">photo_size_select_actual</span>
                          Official Uploaded Document
                        </span>
                        <a
                          href={fileSource}
                          target="_blank"
                          rel="noreferrer"
                          download={`${viewingDoc.title.replace(/\s+/g, '_')}_document`}
                          className="text-[#3cddc7] hover:underline flex items-center gap-1 text-[11px] font-bold"
                        >
                          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                          Open Full Resolution
                        </a>
                      </div>
                      <img
                        src={fileSource}
                        alt={viewingDoc.title}
                        className="max-h-[420px] w-auto object-contain rounded-xl shadow-xl hover:scale-[1.01] transition-transform"
                      />
                    </div>
                  );
                }

                if (isPdf) {
                  return (
                    <div className="mb-5 rounded-2xl overflow-hidden border border-[#bfc9c3]/40 bg-[#051329] p-3 shadow-md flex flex-col">
                      <div className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-white/90 border-b border-white/10 mb-2">
                        <span className="font-bold flex items-center gap-1.5 text-[#3cddc7]">
                          <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                          Official Document (PDF)
                        </span>
                        <a
                          href={fileSource}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#3cddc7] hover:underline flex items-center gap-1 text-[11px] font-bold"
                        >
                          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                          Open / Download PDF
                        </a>
                      </div>
                      <PdfViewer fileSource={fileSource} title={viewingDoc.title} />
                    </div>
                  );
                }

                return null;
              })()}

              {/* Meta grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                {[
                  { label: 'Category', value: viewingDoc.category },
                  { label: 'Department', value: viewingDoc.department },
                  { label: 'Academic Year', value: viewingDoc.academicYear },
                  { label: 'Audience', value: viewingDoc.section ? `Section ${viewingDoc.section}` : 'All Students' },
                  { label: 'Published', value: viewingDoc.publishedDate },
                  ...(viewingDoc.actionRequiredDate ? [{ label: 'Action Deadline', value: viewingDoc.actionRequiredDate }] : []),
                ].map(item => (
                  <div key={item.label} className="bg-[#f8f9ff] rounded-xl p-3">
                    <p className="text-[10px] font-bold text-[#9ca8a3] uppercase tracking-wider mb-0.5">{item.label}</p>
                    <p className={`text-sm font-semibold ${item.label === 'Action Deadline' ? 'text-[#ba1a1a]' : 'text-[#0b1c30]'}`}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Important Highlights (Short and Important Only) */}
              {viewingDoc.category === 'Timetable' ? (
                <div>
                  <p className="text-xs font-bold text-[#404944] uppercase mb-2">Schedule</p>
                  <div className="bg-white rounded-xl border border-[#bfc9c3]/30 overflow-hidden shadow-xs">
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
                </div>
              ) : (
                <div className="bg-[#f8f9ff] rounded-2xl p-4 border border-[#80bea6]/30">
                  <p className="text-xs font-bold text-[#003527] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">info</span>
                    Important Highlights &amp; Key Details
                  </p>
                  <p className="text-xs text-[#0b1c30] leading-relaxed">
                    {(viewingDoc.summary || viewingDoc.contentRaw || '')
                      .replace(/Indexed with \d+ semantic chunks\.?/gi, '')
                      .replace(/This document (has been|was) (uploaded|published|added)[^.]*\./gi, '')
                      .trim()
                      .split('\n')
                      .filter(Boolean)
                      .slice(0, 3)
                      .join(' ')}
                  </p>
                </div>
              )}
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
