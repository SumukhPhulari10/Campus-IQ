import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Notice, CollegeDocument } from '../types';

export interface CalendarEventItem {
  id: string;
  title: string;
  category: string; // 'Exams' | 'Academic' | 'Holiday' | 'Events'
  dateKey: string; // 'YYYY-MM-DD'
  dateStr: string;
  department: string;
  summary: string;
  fullContent?: string;
  imageUrl?: string;
  fileUrl?: string;
  rawNotice?: Notice;
  rawDoc?: CollegeDocument;
  startDate?: string;
  endDate?: string;
}

interface AcademicCalendarWidgetProps {
  notices: Notice[];
  documents?: CollegeDocument[];
  onOpenAIQuery?: (prompt: string) => void;
  onViewNotice?: (notice: Notice) => void;
  onViewDoc?: (doc: CollegeDocument) => void;
  defaultExpanded?: boolean;
}

// Robust date string normalizer to YYYY-MM-DD
export function parseDateToKey(input?: string): string | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;

  // 1. Direct standard Date parsing
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // 2. Handle DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyy) {
    const day = String(ddmmyyyy[1]).padStart(2, '0');
    const m = String(ddmmyyyy[2]).padStart(2, '0');
    const y = ddmmyyyy[3];
    return `${y}-${m}-${day}`;
  }

  // 3. Handle textual representations (e.g. "4 October 2026", "Oct 04, 2026")
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };

  const match = s.match(/([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i) ||
                s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+),?\s+(\d{4})/i);
  if (match) {
    let mPart = match[1].toLowerCase();
    let dPart = match[2];
    let yPart = match[3];
    if (!monthMap[mPart] && monthMap[match[2]?.toLowerCase()]) {
      mPart = match[2].toLowerCase();
      dPart = match[1];
    }
    const mm = monthMap[mPart];
    if (mm) {
      return `${yPart}-${mm}-${String(dPart).padStart(2, '0')}`;
    }
  }

  // Range match e.g. "21st Sep - 23rd Sep 2026" or "10th Aug"
  const rangeMatch = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s*([a-zA-Z]{3,9})?(?:\s*-\s*\d{1,2}(?:st|nd|rd|th)?)?\s*([a-zA-Z]{3,9})\s*(\d{4})?/i);
  if (rangeMatch) {
    const day = rangeMatch[1];
    const mStr = (rangeMatch[2] || rangeMatch[3] || '').toLowerCase();
    const y = rangeMatch[4] || '2026';
    const mm = monthMap[mStr];
    if (mm) {
      return `${y}-${mm}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

// Generate all YYYY-MM-DD keys between start and end date
function getDateKeysInRange(startKey: string, endKey?: string): string[] {
  if (!endKey || endKey === startKey) return [startKey];
  const keys: string[] = [];
  const s = new Date(startKey);
  const e = new Date(endKey);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return [startKey];

  const curr = new Date(s);
  // Cap at 31 days max to prevent infinite loops
  let count = 0;
  while (curr <= e && count < 35) {
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, '0');
    const d = String(curr.getDate()).padStart(2, '0');
    keys.push(`${y}-${m}-${d}`);
    curr.setDate(curr.getDate() + 1);
    count++;
  }
  return keys.length > 0 ? keys : [startKey];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const AcademicCalendarWidget: React.FC<AcademicCalendarWidgetProps> = ({
  notices,
  documents = [],
  onOpenAIQuery,
  onViewNotice,
  onViewDoc,
  defaultExpanded = true,
}) => {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [today]);

  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth()); // 0-indexed
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const [apiCalendarEvents, setApiCalendarEvents] = useState<any[]>([]);

  // ── Fetch authoritative calendar events from live database API ─────
  const fetchDbEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar-events');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.events)) {
          setApiCalendarEvents(data.events);
        }
      }
    } catch {
      // offline / server unavailable fallback
    }
  }, []);

  useEffect(() => {
    fetchDbEvents();
    const timer = setInterval(fetchDbEvents, 15000); // Live sync every 15s
    return () => clearInterval(timer);
  }, [fetchDbEvents]);

  // ── Extract and strictly deduplicate all events ──────────────────
  // No event is extracted or displayed more than once!
  const { allUniqueEvents, eventsByDate } = useMemo(() => {
    const dateMap: Record<string, CalendarEventItem[]> = {};
    const uniqueList: CalendarEventItem[] = [];
    const seenGlobalTitles = new Set<string>();

    const normalizeTitle = (t: string) =>
      t.toLowerCase().replace(/^([📢🎉📅]\s*)+/, '').replace(/[^a-z0-9]/g, '').trim();

    // 1. Process API Calendar Events (Official Academic Calendar & College DB events)
    for (const ev of apiCalendarEvents) {
      const rawTitle = ev.title || '';
      const cleanTitle = rawTitle.replace(/^([📢🎉📅]\s*)+/, '').trim();
      const normKey = `${normalizeTitle(cleanTitle)}_${ev.eventDate}`;

      if (!seenGlobalTitles.has(normKey)) {
        seenGlobalTitles.add(normKey);

        const startKey = ev.eventDate;
        const endKey = ev.endDate || ev.eventDate;
        const keysInRange = getDateKeysInRange(startKey, endKey);

        const item: CalendarEventItem = {
          id: ev.id,
          title: cleanTitle,
          category: ev.category || 'Academic',
          dateKey: startKey,
          dateStr: ev.dateStr || startKey,
          department: ev.department || 'College',
          summary: ev.description || cleanTitle,
          imageUrl: ev.imageUrl,
          fileUrl: ev.fileUrl,
          startDate: startKey,
          endDate: endKey,
        };

        uniqueList.push(item);

        // Associate with each day in the date range
        for (const k of keysInRange) {
          if (!dateMap[k]) dateMap[k] = [];
          // Deduplicate per day
          if (!dateMap[k].some(existing => normalizeTitle(existing.title) === normalizeTitle(item.title))) {
            dateMap[k].push(item);
          }
        }
      }
    }

    // 2. Process live Notices (e.g. Hackathons, Competition notices)
    for (const notice of notices) {
      const rawDate = notice.actionRequiredDate;
      const key = parseDateToKey(rawDate);
      if (key) {
        const cleanTitle = notice.title.replace(/^([📢🎉📅]\s*)+/, '').trim();
        const normKey = `${normalizeTitle(cleanTitle)}_${key}`;
        if (!seenGlobalTitles.has(normKey)) {
          seenGlobalTitles.add(normKey);

          const item: CalendarEventItem = {
            id: notice.id,
            title: cleanTitle,
            category: notice.category || 'Events',
            dateKey: key,
            dateStr: rawDate || key,
            department: notice.department || 'General Academic',
            summary: notice.aiSummary || notice.title,
            fullContent: notice.fullContent,
            imageUrl: notice.imageUrl,
            fileUrl: notice.fileUrl,
            rawNotice: notice,
          };

          uniqueList.push(item);

          if (!dateMap[key]) dateMap[key] = [];
          if (!dateMap[key].some(existing => normalizeTitle(existing.title) === normalizeTitle(item.title))) {
            dateMap[key].push(item);
          }
        }
      }
    }

    // 3. Process live Documents from DB
    for (const doc of documents) {
      const rawDate = (doc as any).actionRequiredDate || (doc.category === 'Exams' || doc.category === 'Academic' ? doc.publishedDate : undefined);
      const key = parseDateToKey(rawDate);
      if (key) {
        const cleanTitle = doc.title.replace(/^([📢🎉📅]\s*)+/, '').trim();
        const normKey = `${normalizeTitle(cleanTitle)}_${key}`;
        if (!seenGlobalTitles.has(normKey)) {
          seenGlobalTitles.add(normKey);

          const isExam = doc.category === 'Exams' || cleanTitle.toLowerCase().includes('exam') || cleanTitle.toLowerCase().includes('test');
          const item: CalendarEventItem = {
            id: doc.id,
            title: cleanTitle,
            category: isExam ? 'Exams' : (doc.category || 'Academic'),
            dateKey: key,
            dateStr: rawDate || key,
            department: doc.department || 'Academic Affairs',
            summary: doc.summary || cleanTitle,
            fullContent: doc.contentRaw,
            imageUrl: doc.imageUrl || doc.fileUrl,
            fileUrl: doc.fileUrl,
            rawDoc: doc,
          };

          uniqueList.push(item);

          if (!dateMap[key]) dateMap[key] = [];
          if (!dateMap[key].some(existing => normalizeTitle(existing.title) === normalizeTitle(item.title))) {
            dateMap[key].push(item);
          }
        }
      }
    }

    return { allUniqueEvents: uniqueList, eventsByDate: dateMap };
  }, [apiCalendarEvents, notices, documents]);

  // Count of events in current viewed month
  const currentMonthEventsCount = useMemo(() => {
    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    let count = 0;
    for (const dateKey in eventsByDate) {
      if (dateKey.startsWith(monthPrefix)) {
        count += eventsByDate[dateKey].length;
      }
    }
    return count;
  }, [eventsByDate, currentYear, currentMonth]);

  // Calendar grid calculations
  const daysInCurrentMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  }, [currentYear, currentMonth]);

  const firstDayOfWeek = useMemo(() => {
    return new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun, 1 = Mon...
  }, [currentYear, currentMonth]);

  const daysInPrevMonth = useMemo(() => {
    return new Date(currentYear, currentMonth, 0).getDate();
  }, [currentYear, currentMonth]);

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const handleGoToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDateKey(todayKey);
  };

  // ── Color coding (Professional, non-alarmist palette) ────────────
  // STRICT RULE: No urgent or warning indicators on calendar!
  const getEventDotColor = (event: CalendarEventItem) => {
    const cat = event.category.toLowerCase();
    if (cat === 'exams' || cat.includes('exam') || cat.includes('test')) {
      return 'bg-indigo-600 ring-1 ring-indigo-200';
    }
    if (cat === 'events' || cat.includes('fest') || cat.includes('hackathon') || cat.includes('contest')) {
      return 'bg-blue-600 ring-1 ring-blue-200';
    }
    if (cat === 'holiday' || cat.includes('holiday') || cat.includes('vacation')) {
      return 'bg-amber-500 ring-1 ring-amber-200';
    }
    return 'bg-[#003527] ring-1 ring-[#b0f0d6]';
  };

  const getCategoryBadgeClass = (category: string) => {
    const cat = category.toLowerCase();
    if (cat === 'exams' || cat.includes('exam') || cat.includes('test')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
    if (cat === 'events' || cat.includes('fest') || cat.includes('hackathon')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (cat === 'holiday' || cat.includes('holiday') || cat.includes('vacation')) {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    return 'bg-[#b0f0d6]/50 text-[#003527] border-[#80bea6]/40';
  };

  // Format selected date nicely
  const selectedDateFormatted = useMemo(() => {
    if (!selectedDateKey) return '';
    try {
      const parts = selectedDateKey.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return selectedDateKey;
    }
  }, [selectedDateKey]);

  const selectedDayEvents = eventsByDate[selectedDateKey] || [];

  return (
    <div className="card p-5 md:p-6 relative overflow-hidden transition-all duration-300" id="academic-calendar-widget">
      
      {/* ── Top Header / Dropdown Toggle Bar ────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#bfc9c3]/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#003527] text-white flex items-center justify-center shadow-xs shrink-0">
            <span className="material-symbols-outlined text-[22px]">calendar_month</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-headline font-bold text-lg text-[#0b1c30]">
                Academic & Events Calendar
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#003527]/10 text-[#003527] border border-[#003527]/15">
                <span className="w-1.5 h-1.5 rounded-full bg-[#003527] animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-[11px] text-[#707974]">
              Real-time schedule of exams, events, holidays, and academic milestones
            </p>
          </div>
        </div>

        {/* Dropdown Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {allUniqueEvents.length > 0 && (
            <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-[#f4f7ff] text-[#003527] border border-[#bfc9c3]/30">
              <span className="material-symbols-outlined text-[14px]">event_available</span>
              {allUniqueEvents.length} scheduled
            </span>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            id="calendar-dropdown-toggle-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f4f7ff] hover:bg-[#e5eeff] text-xs font-bold text-[#003527] border border-[#bfc9c3]/40 transition-colors shadow-2xs"
            title={isExpanded ? 'Collapse Calendar' : 'Expand Calendar'}
          >
            <span>{isExpanded ? 'Hide Calendar' : 'View Calendar'}</span>
            <span className="material-symbols-outlined text-[18px] transition-transform duration-200">
              {isExpanded ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>
      </div>

      {/* ── Collapsed Compact Preview ────────────────────────────── */}
      {!isExpanded && (
        <div className="pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#5a6672]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#003527]">info</span>
            <span>
              {currentMonthEventsCount > 0 ? (
                <><strong>{currentMonthEventsCount} scheduled activity/activities</strong> in {MONTH_NAMES[currentMonth]} {currentYear}.</>
              ) : (
                <>Calendar is collapsed. Click <strong>View Calendar</strong> to browse schedule and event details.</>
              )}
            </span>
          </div>
          <button
            onClick={() => setIsExpanded(true)}
            className="text-xs font-bold text-[#003527] hover:underline flex items-center gap-1"
          >
            Open Dropdown
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>
      )}

      {/* ── Expanded Full Real-time Calendar ─────────────────────── */}
      {isExpanded && (
        <div className="pt-5 space-y-5 animate-fade-in">
          
          {/* Controls: Month Switcher & Calm Clean Legend */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#f8f9ff] p-3 rounded-2xl border border-[#bfc9c3]/20">
            {/* Month Nav */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                id="calendar-prev-month-btn"
                className="w-8 h-8 rounded-xl bg-white hover:bg-[#e5eeff] border border-[#bfc9c3]/30 flex items-center justify-center text-[#0b1c30] transition-colors shadow-2xs"
                title="Previous Month"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>

              <span className="font-headline font-extrabold text-base md:text-lg text-[#0b1c30] min-w-[170px] text-center">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </span>

              <button
                onClick={handleNextMonth}
                id="calendar-next-month-btn"
                className="w-8 h-8 rounded-xl bg-white hover:bg-[#e5eeff] border border-[#bfc9c3]/30 flex items-center justify-center text-[#0b1c30] transition-colors shadow-2xs"
                title="Next Month"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>

              <button
                onClick={handleGoToToday}
                id="calendar-today-btn"
                className="ml-2 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-[#b0f0d6]/40 hover:bg-[#b0f0d6] text-[#003527] border border-[#80bea6]/40 transition-colors shadow-2xs"
              >
                Today
              </button>
            </div>

            {/* Category Indicator Legend (No urgent or warning labels!) */}
            <div className="flex items-center gap-3 text-[11px] font-medium text-[#707974] flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block shadow-2xs" />
                Exams & Tests
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block shadow-2xs" />
                Events & Fests
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#003527] inline-block shadow-2xs" />
                Academic
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-2xs" />
                Holidays / Breaks
              </span>
            </div>
          </div>

          {/* ── 7-Column Calendar Grid ────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-[#bfc9c3]/30 p-2 sm:p-3 shadow-xs">
            {/* Weekday Labels */}
            <div className="grid grid-cols-7 mb-1 text-center">
              {WEEKDAY_NAMES.map((day) => (
                <div key={day} className="py-2 text-[11px] font-extrabold text-[#707974] uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            {/* Day Cells Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {/* Previous Month Padding */}
              {Array.from({ length: firstDayOfWeek }).map((_, idx) => {
                const prevDayNum = daysInPrevMonth - firstDayOfWeek + idx + 1;
                return (
                  <div
                    key={`prev-${idx}`}
                    className="h-12 sm:h-14 rounded-xl p-1 flex flex-col items-center justify-center text-gray-300 opacity-40 select-none bg-gray-50/30"
                  >
                    <span className="text-xs font-medium">{prevDayNum}</span>
                  </div>
                );
              })}

              {/* Current Month Days */}
              {Array.from({ length: daysInCurrentMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const mStr = String(currentMonth + 1).padStart(2, '0');
                const dStr = String(dayNum).padStart(2, '0');
                const cellKey = `${currentYear}-${mStr}-${dStr}`;

                const isToday = cellKey === todayKey;
                const isSelected = cellKey === selectedDateKey;
                const dayEvents = eventsByDate[cellKey] || [];
                const hasEvents = dayEvents.length > 0;

                return (
                  <button
                    key={cellKey}
                    onClick={() => setSelectedDateKey(cellKey)}
                    id={`calendar-day-${cellKey}`}
                    className={`h-12 sm:h-14 rounded-xl p-1 relative flex flex-col items-center justify-between transition-all group
                      ${isSelected
                        ? 'bg-[#003527] text-white shadow-md scale-[1.03] z-10'
                        : isToday
                          ? 'bg-[#b0f0d6]/30 text-[#003527] font-extrabold border-2 border-[#003527]/50 hover:bg-[#b0f0d6]/50'
                          : hasEvents
                            ? 'bg-[#f4f7ff] text-[#0b1c30] hover:bg-[#e5eeff] border border-blue-200/80 font-bold'
                            : 'hover:bg-gray-50 text-[#0b1c30]'
                      }`}
                  >
                    {/* Day Number */}
                    <div className="flex items-center justify-center w-full">
                      <span className={`text-xs sm:text-sm font-inter leading-none mt-1 ${isSelected ? 'text-white font-bold' : ''}`}>
                        {dayNum}
                      </span>
                    </div>

                    {/* Today Pill */}
                    {isToday && !isSelected && (
                      <span className="text-[8px] font-black uppercase text-[#003527] tracking-tighter leading-none -mt-1 hidden sm:inline">
                        TODAY
                      </span>
                    )}

                    {/* Circles (Dots) for Events on this Day */}
                    <div className="flex items-center justify-center gap-1 min-h-[6px] mb-1">
                      {hasEvents && (
                        dayEvents.slice(0, 3).map((ev, evIdx) => (
                          <span
                            key={evIdx}
                            className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full ${isSelected ? 'bg-white ring-1 ring-white/60' : getEventDotColor(ev)} shadow-2xs`}
                            title={`${ev.category}: ${ev.title}`}
                          />
                        ))
                      )}
                      {dayEvents.length > 3 && (
                        <span className={`text-[8px] font-bold leading-none ${isSelected ? 'text-white' : 'text-[#003527]'}`}>
                          +{dayEvents.length - 3}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* Next Month Padding to complete grid */}
              {(() => {
                const totalCells = firstDayOfWeek + daysInCurrentMonth;
                const nextMonthPadding = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
                return Array.from({ length: nextMonthPadding }).map((_, idx) => (
                  <div
                    key={`next-${idx}`}
                    className="h-12 sm:h-14 rounded-xl p-1 flex flex-col items-center justify-center text-gray-300 opacity-40 select-none bg-gray-50/30"
                  >
                    <span className="text-xs font-medium">{idx + 1}</span>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* ── Selected Date Event Details Box ─────────────────────── */}
          <div className="rounded-2xl p-4 sm:p-5 bg-[#f8f9ff] border border-[#bfc9c3]/30 shadow-xs" id="calendar-date-details">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#707974] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">event</span>
                  Selected Date
                </span>
                <h4 className="font-headline font-bold text-base sm:text-lg text-[#0b1c30]">
                  {selectedDateFormatted}
                </h4>
              </div>

              {selectedDayEvents.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[#003527] text-white self-start sm:self-auto shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#b0f0d6]" />
                  {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'Activity' : 'Activities'} Scheduled
                </span>
              ) : (
                <span className="text-xs text-[#707974] bg-white px-2.5 py-1 rounded-lg border border-[#bfc9c3]/20 self-start sm:self-auto">
                  No scheduled activities
                </span>
              )}
            </div>

            {/* List of events on this selected date */}
            {selectedDayEvents.length > 0 ? (
              <div className="space-y-3 mt-3">
                {selectedDayEvents.map((ev) => {
                  const badgeStyle = getCategoryBadgeClass(ev.category);

                  return (
                    <div
                      key={ev.id}
                      className="bg-white rounded-xl p-4 border border-[#bfc9c3]/30 shadow-xs hover:border-[#003527]/40 transition-all group"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${badgeStyle}`}>
                            {ev.category}
                          </span>
                          <span className="text-[11px] text-[#707974] font-medium">
                            · {ev.department}
                          </span>
                        </div>

                        <span className="text-xs font-bold text-[#003527] bg-[#b0f0d6]/30 px-2 py-0.5 rounded">
                          {ev.dateStr}
                        </span>
                      </div>

                      <h5 className="font-headline font-bold text-base text-[#0b1c30] group-hover:text-[#003527] transition-colors mb-1.5">
                        {ev.title}
                      </h5>

                      <p className="text-xs text-[#5a6672] leading-relaxed mb-3">
                        {ev.summary}
                      </p>

                      {/* Interactive Action Shortcuts */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#bfc9c3]/20">
                        {onOpenAIQuery && (
                          <button
                            onClick={() => onOpenAIQuery(`Tell me all details, preparation tips, and requirements for "${ev.title}" scheduled on ${ev.dateStr}.`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#003527] hover:bg-[#064e3b] text-white text-xs font-bold transition-colors shadow-2xs"
                          >
                            <span className="material-symbols-outlined text-[15px] text-[#80bea6]">auto_awesome</span>
                            Ask AI Assistant
                          </button>
                        )}

                        {ev.rawNotice && onViewNotice && (
                          <button
                            onClick={() => onViewNotice(ev.rawNotice!)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#f4f7ff] hover:bg-[#e5eeff] text-[#003527] text-xs font-bold border border-[#bfc9c3]/30 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[15px]">campaign</span>
                            View Notice
                          </button>
                        )}

                        {ev.rawDoc && onViewDoc && (
                          <button
                            onClick={() => onViewDoc(ev.rawDoc!)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#f4f7ff] hover:bg-[#e5eeff] text-[#003527] text-xs font-bold border border-[#bfc9c3]/30 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[15px]">visibility</span>
                            View Document
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-4 text-center bg-white rounded-xl border border-dashed border-[#bfc9c3]/40">
                <span className="material-symbols-outlined text-[24px] text-[#9ca8a3] mb-1">event_busy</span>
                <p className="text-xs font-medium text-[#707974]">
                  No events or exams scheduled on {selectedDateFormatted}.
                </p>
                <p className="text-[11px] text-[#9ca8a3] mt-0.5">
                  Select dates marked with circles to view scheduled academic activities.
                </p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
