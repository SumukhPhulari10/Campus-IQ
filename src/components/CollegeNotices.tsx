import React, { useState, useEffect } from 'react';
import { Notice, NoticeCategory, DeadlineItem } from '../types';
import { isDatePast } from '../lib/dateUtils';

interface CollegeNoticesProps {
  notices: Notice[];
  deadlines: DeadlineItem[];
  onOpenAIQuery: (prompt: string) => void;
}

export const CollegeNotices: React.FC<CollegeNoticesProps> = ({
  notices,
  deadlines,
  onOpenAIQuery,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<NoticeCategory>('All');
  const [searchFilter, setSearchFilter] = useState('');
  const [activeNoticeModal, setActiveNoticeModal] = useState<Notice | null>(null);
  const [showHandbookModal, setShowHandbookModal] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const categories: NoticeCategory[] = ['All', 'Events', 'Circular', 'Exams', 'Academic', 'Scholarships', 'Placements'];

  const filteredNotices = notices.filter((n) => {
    // Exclude timetables from general notices and circulars
    if (n.category === 'Timetable' || n.title?.toLowerCase().includes('timetable') || n.title?.toLowerCase().includes(' cse b tt')) {
      return false;
    }
    const matchesCategory =
      selectedCategory === 'All' ||
      n.category?.toLowerCase() === selectedCategory.toLowerCase() ||
      (selectedCategory === 'Events' && (
        n.category === 'Events' ||
        n.tags?.some(t => ['events', 'hackathon', 'aithon', 'competition', 'fest', 'symposium'].includes(t.toLowerCase())) ||
        n.title?.toLowerCase().includes('hackathon') ||
        n.title?.toLowerCase().includes('aithon') ||
        n.title?.toLowerCase().includes('symposium') ||
        n.title?.toLowerCase().includes('event')
      ));
    const matchesSearch =
      n.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      n.department.toLowerCase().includes(searchFilter.toLowerCase()) ||
      n.aiSummary.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full min-h-screen bg-[#f4f7ff] text-[#0b1c30] pt-[64px] pb-16">
      <div className="max-w-[1200px] w-full mx-auto px-4 md:px-6">
        
        {/* Header */}
        <div className="mb-8 pb-6 border-b border-[#bfc9c3]/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-[#0b1c30]">
                College Updates & Circulars
              </h1>
              <p className="text-sm md:text-base text-[#404944] mt-1">
                Official institutional announcements, exam schedules, and circulars summarized by AI.
              </p>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#707974] text-[20px]">
                search
              </span>
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search notices, department, keywords..."
                className="w-full bg-white border border-[#bfc9c3]/40 rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium text-[#0b1c30] focus:outline-none focus:border-[#003527]"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-hide">
              {categories.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-[#003527] text-white shadow-xs'
                        : 'bg-white hover:bg-[#eff4ff] text-[#404944] border border-[#bfc9c3]/30'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Notices Feed (8 cols) */}
          <div className="lg:col-span-8 space-y-6" id="notices-list">
            {filteredNotices.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-[#bfc9c3]/30">
                <span className="material-symbols-outlined text-[48px] text-[#707974] mb-2">
                  search_off
                </span>
                <p className="font-bold text-base text-[#0b1c30]">No notices match your criteria</p>
                <p className="text-xs text-[#707974] mt-1">Try clearing search filters or selecting another category.</p>
              </div>
            ) : (
              filteredNotices.map((notice) => {
                // Check if the event date/deadline has already passed (robust parser handles "2nd October" etc.)
                const isDatePastFlag = isDatePast(notice.actionRequiredDate);
                const isUrgent = (notice.urgency === 'urgent' || notice.urgency === 'high') && !isDatePastFlag;
                const isScholarship = notice.category === 'Scholarships';
                const hasPoster = !!(notice.imageUrl || notice.fileUrl);

                return (
                  <div
                    key={notice.id}
                    className={`bg-white rounded-3xl p-6 sm:p-7 shadow-xs border transition-all flex flex-col justify-between ${
                      isDatePastFlag
                        ? 'border-[#bfc9c3]/20 opacity-80'
                        : 'border-[#bfc9c3]/30 hover:border-[#80bea6] hover:shadow-md'
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                              isDatePastFlag
                                ? 'bg-[#e5eeff] text-[#9ca8a3]'
                                : isUrgent
                                ? 'bg-[#ffdad6] text-[#ba1a1a]'
                                : isScholarship
                                ? 'bg-[#b0f0d6] text-[#003527]'
                                : 'bg-[#e5eeff] text-[#003527]'
                            }`}
                          >
                            {isUrgent && <span className="material-symbols-outlined text-[12px]">priority_high</span>}
                            {isDatePastFlag && <span className="material-symbols-outlined text-[12px]">event_available</span>}
                            {notice.category}
                          </span>
                          <span className="text-xs text-[#707974] font-medium">• {notice.department}</span>
                          {hasPoster && (
                            <span className="text-[10px] font-bold bg-[#003527]/10 text-[#003527] px-2 py-0.5 rounded-md flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">image</span>
                              Poster Attached
                            </span>
                          )}
                          {isDatePastFlag && (
                            <span className="text-[9px] font-bold bg-[#e5eeff] text-[#9ca8a3] px-2 py-0.5 rounded-full">
                              Event Completed
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-[#707974]">{notice.publishDate}</span>
                      </div>

                      {/* Notice Title */}
                      <h3 className={`font-headline font-bold text-lg sm:text-xl mb-3 leading-snug ${
                        isDatePastFlag ? 'text-[#9ca8a3]' : 'text-[#0b1c30]'
                      }`}>
                        {notice.title}
                      </h3>

                      {/* Summary Box */}
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-[#eff4ff] to-[#f8f9ff] border border-[#80bea6]/40 mb-4">
                        <p className="text-xs text-[#0b1c30] leading-relaxed font-medium">
                          {(notice.aiSummary || '').replace(/Indexed with \d+ semantic chunks\.?/gi, '').trim()}
                        </p>
                      </div>

                      {/* Action Required Date */}
                      {notice.actionRequiredDate && (
                        <div className={`flex items-center gap-2 text-xs font-bold mb-4 ${
                          isDatePastFlag ? 'text-[#9ca8a3]' : 'text-[#ba1a1a]'
                        }`}>
                          <span className="material-symbols-outlined text-[16px]">
                            {isDatePastFlag ? 'event_available' : 'schedule'}
                          </span>
                          <span>
                            {isDatePastFlag
                              ? `Completed on: ${notice.actionRequiredDate}`
                              : `Action Required by: ${notice.actionRequiredDate}`}
                          </span>
                        </div>
                      )}

                    </div>

                    {/* Bottom Action Footer */}
                    <div className="pt-4 border-t border-[#e5eeff] flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-1.5">
                        {notice.tags.map((tag, ti) => (
                          <span key={ti} className="text-[10px] font-medium bg-[#f8f9ff] text-[#707974] px-2 py-0.5 rounded border border-[#bfc9c3]/20">
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setActiveNoticeModal(notice)}
                          className="bg-[#003527] hover:bg-[#064e3b] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            {hasPoster ? 'image' : 'article'}
                          </span>
                          <span>{hasPoster ? 'View Poster & Circular' : 'Read Full Circular'}</span>
                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Sidebar (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Upcoming Deadlines Widget */}
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#bfc9c3]/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-headline font-bold text-base text-[#0b1c30] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#004e45]">event_upcoming</span>
                  Critical Action Dates
                </h3>
                <span className="text-[10px] font-bold text-[#707974] bg-[#eff4ff] px-2 py-0.5 rounded-full">
                  By Priority
                </span>
              </div>

              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {deadlines.map((dl) => {
                  const isHigh = dl.urgency === 'high';
                  const isMed = dl.urgency === 'medium';
                  const badgeColor = isHigh
                    ? 'bg-red-100 text-red-700 border-red-200'
                    : isMed
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-[#b0f0d6] text-[#003527] border-[#80bea6]/30';

                  const priorityLabel = isHigh ? 'Urgent' : isMed ? 'High' : 'Normal';

                  return (
                    <div
                      key={dl.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isHigh
                          ? 'bg-red-50/40 border-red-200/80 hover:border-red-400'
                          : isMed
                          ? 'bg-amber-50/30 border-amber-200/70 hover:border-amber-400'
                          : 'bg-[#f8f9ff] border-[#bfc9c3]/20 hover:border-[#80bea6]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${badgeColor}`}>
                          {priorityLabel} • {dl.category}
                        </span>
                        <span className="text-xs font-bold text-[#003527] bg-white px-2 py-0.5 rounded-lg border border-[#bfc9c3]/30 shadow-2xs shrink-0">
                          {dl.dateStr}
                        </span>
                      </div>
                      <p className="font-bold text-xs text-[#0b1c30] mt-1">{dl.title}</p>
                      <p className="text-[11px] text-[#707974] mt-0.5 leading-snug">{dl.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ingestion Information Card */}
            <div className="bg-gradient-to-br from-[#003527] to-[#064e3b] text-white rounded-3xl p-6 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#80bea6] mb-3">
                <span className="material-symbols-outlined text-[24px]">verified_user</span>
              </div>
              <h4 className="font-headline font-bold text-base mb-1">Official University Feed</h4>
              <p className="text-xs text-white/80 leading-relaxed mb-4">
                All notices and event posters are officially verified by the college administration and added to the CampusIQ system.
              </p>
              <button
                onClick={() => onOpenAIQuery('Are there any active circulars or events affecting Semester 7 CS students?')}
                className="w-full bg-white text-[#003527] font-bold text-xs py-2.5 rounded-xl shadow-xs hover:bg-[#f8f9ff] transition-colors"
              >
                Scan My Eligible Circulars
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Full Notice Content Modal */}
      {activeNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0b1c30]/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl border border-[#bfc9c3]/40 flex flex-col overflow-hidden">
            <div className="p-5 sm:p-6 bg-[#f8f9ff] border-b border-[#bfc9c3]/30 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-[#b0f0d6] text-[#003527] px-2.5 py-0.5 rounded-full">
                    {activeNoticeModal.category}
                  </span>
                  {(() => {
                    const isPast = (() => {
                      if (!activeNoticeModal.actionRequiredDate) return false;
                      try {
                        const d = new Date(activeNoticeModal.actionRequiredDate);
                        if (isNaN(d.getTime())) return false;
                        const today = new Date();
                        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                        const eventMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                        return eventMidnight.getTime() < todayMidnight.getTime();
                      } catch { return false; }
                    })();
                    if (isPast) return (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[#e5eeff] text-[#9ca8a3] px-2.5 py-0.5 rounded-full">
                        Completed
                      </span>
                    );
                    if (activeNoticeModal.urgency === 'urgent') return (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-600 px-2.5 py-0.5 rounded-full">
                        URGENT
                      </span>
                    );
                    return null;
                  })()}
                </div>
                <h3 className="font-headline font-bold text-lg sm:text-xl text-[#0b1c30] mt-1.5">
                  {activeNoticeModal.title}
                </h3>

              </div>
              <button
                onClick={() => setActiveNoticeModal(null)}
                className="w-9 h-9 rounded-full bg-white border border-[#bfc9c3]/40 flex items-center justify-center text-[#707974] hover:text-[#0b1c30] hover:bg-[#eff4ff] transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
              <div className="text-xs text-[#707974] font-medium flex flex-wrap justify-between gap-2 border-b border-[#bfc9c3]/20 pb-3">
                <span className="font-bold text-[#0b1c30]">Department: {activeNoticeModal.department}</span>
                <span>Published: {activeNoticeModal.publishDate}</span>
              </div>

              {/* Event Poster / Uploaded Image Preview */}
              {(() => {
                const imgSource = activeNoticeModal.imageUrl || activeNoticeModal.fileUrl;
                const isImage = !!imgSource && (
                  imgSource.startsWith('data:image') ||
                  /\.(png|jpe?g|webp|gif|svg)$/i.test(imgSource)
                );
                if (!isImage) return null;
                return (
                  <div className="rounded-2xl overflow-hidden border border-[#bfc9c3]/40 bg-[#051329] p-3 shadow-md flex flex-col items-center">
                    <div className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-white/90 border-b border-white/10 mb-3">
                      <span className="font-bold flex items-center gap-1.5 text-[#3cddc7]">
                        <span className="material-symbols-outlined text-[17px]">photo_size_select_actual</span>
                        Official Uploaded Poster
                      </span>
                      <a
                        href={imgSource}
                        target="_blank"
                        rel="noreferrer"
                        download={`${activeNoticeModal.title.replace(/\s+/g, '_')}_poster`}
                        className="text-[#3cddc7] hover:underline flex items-center gap-1 text-xs font-bold"
                      >
                        <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                        Open Full Size
                      </a>
                    </div>
                    <img
                      src={imgSource}
                      alt={activeNoticeModal.title}
                      className="max-h-[420px] w-auto object-contain rounded-xl shadow-2xl hover:scale-[1.01] transition-transform"
                    />
                  </div>
                );
              })()}

              <div className="p-4 bg-[#f8f9ff] rounded-2xl border border-[#80bea6]/30">
                <p className="text-xs font-bold text-[#003527] mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                  AI Executive Summary:
                </p>
                <p className="text-xs text-[#0b1c30] leading-relaxed">{activeNoticeModal.aiSummary}</p>
              </div>

              <div className="pt-2">
                <p className="text-xs font-bold text-[#404944] uppercase tracking-wider mb-2">
                  Official Notice Transcript:
                </p>
                <pre className="whitespace-pre-wrap font-mono text-xs text-[#0b1c30] bg-[#f8f9ff] p-4 rounded-xl border border-[#bfc9c3]/20 leading-relaxed max-h-[260px] overflow-y-auto">
                  {activeNoticeModal.fullContent}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-[#f8f9ff] border-t border-[#bfc9c3]/30 flex flex-wrap justify-between items-center gap-3 shrink-0">
              <button
                onClick={() => {
                  const prompt = `Explain in detail: ${activeNoticeModal.title}`;
                  setActiveNoticeModal(null);
                  onOpenAIQuery(prompt);
                }}
                className="text-xs font-bold text-[#003527] hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                <span>Ask AI Questions on this Notice</span>
              </button>
              <button
                onClick={() => setActiveNoticeModal(null)}
                className="bg-[#003527] text-white text-xs font-bold px-5 py-2 rounded-xl shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Handbook Modal */}
      {showHandbookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0b1c30]/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-3xl shadow-2xl border border-[#bfc9c3]/40 flex flex-col overflow-hidden">
            <div className="p-6 bg-[#f8f9ff] border-b border-[#bfc9c3]/30 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#003527] text-[#80bea6] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">menu_book</span>
                </div>
                <div>
                  <h3 className="font-headline font-bold text-lg text-[#0b1c30]">
                    2024-25 Student Regulations Handbook
                  </h3>
                  <p className="text-xs text-[#707974]">Official Senate Approved University Guidelines</p>
                </div>
              </div>
              <button
                onClick={() => setShowHandbookModal(false)}
                className="p-1 rounded-full text-[#707974] hover:text-[#0b1c30]"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-[#0b1c30]">
              <div className="p-4 bg-[#eff4ff] rounded-2xl border border-[#80bea6]/30">
                <p className="font-bold text-[#003527] mb-1">Section 4.1: Attendance & Condonation Rules</p>
                <p>Every registered student is mandated to maintain a minimum attendance of 75% in each course. A condonation of up to 10% (65% floor) may be granted by the Dean upon verified medical certificates submitted within 7 calendar days.</p>
              </div>

              <div className="p-4 bg-[#eff4ff] rounded-2xl border border-[#80bea6]/30">
                <p className="font-bold text-[#003527] mb-1">Section 7.2: Grade Re-Evaluation Protocol</p>
                <p>Students dissatisfied with evaluated exam sheets may apply within 14 days of declaration ($20 fee). If revised score varies by &gt;15%, a third independent evaluator is assigned.</p>
              </div>

              <div className="p-4 bg-[#eff4ff] rounded-2xl border border-[#80bea6]/30">
                <p className="font-bold text-[#003527] mb-1">Section 11.4: Parking Ticket Appeals</p>
                <p>Students issued parking citations for unauthorized parking have the right to file an online grievance with the Campus Transport Cell within 5 working days.</p>
              </div>
            </div>

            <div className="p-4 bg-[#f8f9ff] border-t border-[#bfc9c3]/30 flex justify-end">
              <button
                onClick={() => setShowHandbookModal(false)}
                className="bg-[#003527] text-white text-xs font-bold px-5 py-2 rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
