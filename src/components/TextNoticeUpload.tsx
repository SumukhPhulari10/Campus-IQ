import React, { useState } from 'react';
import { AuthUser, CollegeDocument, Notice, NoticeCategory } from '../types';

interface TextNoticeUploadProps {
  user?: AuthUser;
  onDocumentAdded?: (doc: CollegeDocument) => void;
  onNoticeAdded?: (notice: Notice) => void;
  onViewMaterials?: () => void;
}

export const TextNoticeUpload: React.FC<TextNoticeUploadProps> = ({
  user,
  onDocumentAdded,
  onNoticeAdded,
  onViewMaterials,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<NoticeCategory>('Circular');
  const [department, setDepartment] = useState(user?.department || 'Computer Science & Engineering');
  const [audience, setAudience] = useState<'all' | 'branch'>('all');
  const [section, setSection] = useState('');
  const [publishedDate, setPublishedDate] = useState(new Date().toISOString().split('T')[0]);
  const [actionRequiredDate, setActionRequiredDate] = useState('');
  const [urgency, setUrgency] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [content, setContent] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Validate text notice content
  const validateNotice = (): string | null => {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle) {
      return 'Notice Title is required.';
    }
    if (!/^[a-zA-Z]/.test(trimmedTitle)) {
      return 'Notice Title must begin with an alphabet letter.';
    }
    if (trimmedTitle.length < 3) {
      return 'Notice Title must be at least 3 characters long.';
    }
    if (!trimmedContent) {
      return 'Notice message content cannot be empty.';
    }
    if (trimmedContent.length < 15) {
      return 'Notice message is too short. Please provide at least 15 characters of detailed information.';
    }

    // Check for non-notice gibberish / repetition
    if (/^(.)\1{10,}$/.test(trimmedContent)) {
      return 'Notice content appears to be repetitive characters. Please provide a meaningful announcement.';
    }

    return null;
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validationErr = validateNotice();
    if (validationErr) {
      setErrorMessage(validationErr);
      return;
    }

    setIsProcessing(true);

    const targetDept = audience === 'all' ? 'General Academic' : department;
    const summary = content.trim().slice(0, 160) + (content.trim().length > 160 ? '…' : '');

    const localDoc: CollegeDocument = {
      id: `doc_${Date.now()}`,
      title: title.trim(),
      department: targetDept,
      category: category as any,
      academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      publishedDate,
      fileType: 'txt',
      fileSize: `${(content.length / 1024).toFixed(1)} KB`,
      status: 'indexed',
      totalChunks: Math.max(1, Math.ceil(content.length / 200)),
      summary,
      contentRaw: content.trim(),
      section: section.trim() ? section.trim().toUpperCase() : undefined,
      uploadedBy: user?.id,
      actionRequiredDate: actionRequiredDate.trim() || undefined,
    };

    const localNotice: Notice = {
      id: `not_${localDoc.id}`,
      title: title.trim(),
      category,
      urgency,
      publishDate: publishedDate,
      department: targetDept,
      actionRequiredDate: actionRequiredDate.trim() || undefined,
      aiSummary: summary,
      fullContent: content.trim(),
      sourceDocId: localDoc.id,
      tags: [category, targetDept, 'Text Notice'],
    };

    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          department: targetDept,
          category,
          section: section.trim() ? section.trim().toUpperCase() : undefined,
          publishedDate,
          actionRequiredDate: actionRequiredDate.trim() || undefined,
          urgency,
          contentRaw: content.trim(),
          fileType: 'txt',
          uploadedBy: user?.id,
          summary,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setErrorMessage(data.error || 'Failed to verify and publish text notice. Please review content.');
        setIsProcessing(false);
        return;
      }

      const finalDoc = data.document || localDoc;
      const finalNotice = data.notice || localNotice;

      onDocumentAdded?.(finalDoc);
      onNoticeAdded?.(finalNotice);

      setIsSuccess(true);
      setTitle('');
      setContent('');
      setActionRequiredDate('');
      setSection('');
      setUrgency('normal');
    } catch (err: any) {
      console.warn('Network error publishing notice, publishing locally:', err);
      onDocumentAdded?.(localDoc);
      onNoticeAdded?.(localNotice);
      setIsSuccess(true);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Notification */}
      {isSuccess && (
        <div className="p-4 rounded-2xl bg-[#b0f0d6]/70 border border-[#003527]/30 text-[#002117] flex items-center justify-between animate-fade-in shadow-xs">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[24px] text-[#003527]">check_circle</span>
            <div>
              <p className="font-bold text-sm">Text Notice Published Successfully!</p>
              <p className="text-xs text-[#003527]">
                The notice is now active and immediately visible to students on their dashboard in standard card format.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {onViewMaterials && (
              <button
                onClick={() => { onViewMaterials(); setIsSuccess(false); }}
                className="bg-[#003527] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs hover:bg-[#064e3b]"
              >
                View Materials
              </button>
            )}
            <button
              onClick={() => setIsSuccess(false)}
              className="text-xs font-bold px-3 py-2 text-[#003527] hover:bg-[#b0f0d6] rounded-xl"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 flex items-start justify-between animate-fade-in shadow-xs">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[22px] text-red-600 mt-0.5">error</span>
            <div>
              <p className="font-bold text-sm">Notice Verification Failed</p>
              <p className="text-xs text-red-700 mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-bold text-red-600 hover:text-red-800 px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Compose Form */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 md:p-8 border border-[#bfc9c3]/30 shadow-xs">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#bfc9c3]/20">
            <div className="w-10 h-10 rounded-2xl bg-[#eff4ff] text-[#003527] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">edit_note</span>
            </div>
            <div>
              <h3 className="font-headline font-bold text-lg text-[#0b1c30]">
                Compose Text Notice / Circular
              </h3>
              <p className="text-xs text-[#5a6672]">
                Broadcast direct official announcements when you do not have a PDF or poster image.
              </p>
            </div>
          </div>

          <form onSubmit={handlePublish} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-[#404944] uppercase mb-1.5">
                Notice Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Schedule Revision for Mid-Term Examinations"
                required
                className="w-full bg-[#f8f9ff] border border-[#bfc9c3]/40 rounded-xl px-3.5 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]"
              />
            </div>

            {/* Category & Urgency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#404944] uppercase mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-[#f8f9ff] border border-[#bfc9c3]/40 rounded-xl px-3 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]"
                >
                  <option value="Circular">📢 Circular</option>
                  <option value="Events">🎉 Events</option>
                  <option value="Exams">📝 Exams / Notice</option>
                  <option value="Timetable">🗓 Timetable / Schedule</option>
                  <option value="Syllabus">📘 Syllabus</option>
                  <option value="Scholarships">🎓 Scholarships</option>
                  <option value="Placements">💼 Placements</option>
                  <option value="Regulations">⚖️ Regulations</option>
                  <option value="Financial Aid">💰 Financial Aid</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#404944] uppercase mb-1.5">
                  Urgency Level
                </label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as any)}
                  className="w-full bg-[#f8f9ff] border border-[#bfc9c3]/40 rounded-xl px-3 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]"
                >
                  <option value="normal">🟢 Normal</option>
                  <option value="high">🟠 High Priority</option>
                  <option value="urgent">🔴 Urgent (Immediate Action)</option>
                </select>
              </div>
            </div>

            {/* Target Audience */}
            <div>
              <label className="block text-xs font-bold text-[#404944] uppercase mb-2">
                Target Audience
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setAudience('all'); setSection(''); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border-2 transition-all
                    ${audience === 'all'
                      ? 'bg-[#003527] text-white border-[#003527]'
                      : 'bg-white text-[#5a6672] border-[#bfc9c3]/40 hover:border-[#003527]/30'}`}
                >
                  <span className="material-symbols-outlined text-[16px]">public</span>
                  All Students (Centralized)
                </button>
                <button
                  type="button"
                  onClick={() => setAudience('branch')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border-2 transition-all
                    ${audience === 'branch'
                      ? 'bg-[#003527] text-white border-[#003527]'
                      : 'bg-white text-[#5a6672] border-[#bfc9c3]/40 hover:border-[#003527]/30'}`}
                >
                  <span className="material-symbols-outlined text-[16px]">school</span>
                  Specific Branch
                </button>
              </div>
            </div>

            {/* Branch / Department & Section (Conditional) */}
            {audience === 'branch' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#404944] uppercase mb-1.5">
                    Department / Branch
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-[#f8f9ff] border border-[#bfc9c3]/40 rounded-xl px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]"
                  >
                    <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                    <option value="Examination Cell">Examination Cell</option>
                    <option value="Dean of Students & Senate">Dean of Students & Senate</option>
                    <option value="Bursar & Financial Aid Office">Bursar & Financial Aid Office</option>
                    <option value="Centre for Career Development">Centre for Career Development</option>
                    <option value="Mechanical Engineering">Mechanical Engineering</option>
                    <option value="Electrical Engineering">Electrical Engineering</option>
                    <option value="Civil Engineering">Civil Engineering</option>
                    <option value="Electronics & Communication">Electronics & Communication</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#404944] uppercase mb-1.5">
                    Section <span className="text-[#9ca8a3] font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={section}
                    onChange={(e) => setSection(e.target.value.toUpperCase())}
                    placeholder="e.g. A, B — blank for all"
                    className="w-full bg-[#f8f9ff] border border-[#bfc9c3]/40 rounded-xl px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]"
                  />
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#404944] uppercase mb-1.5">
                  Published Date
                </label>
                <input
                  type="date"
                  value={publishedDate}
                  onChange={(e) => setPublishedDate(e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-[#bfc9c3]/40 rounded-xl px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#404944] uppercase mb-1.5">
                  Action Deadline <span className="text-[#9ca8a3] font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="date"
                  value={actionRequiredDate}
                  onChange={(e) => setActionRequiredDate(e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-[#bfc9c3]/40 rounded-xl px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]"
                />
              </div>
            </div>

            {/* Notice Message / Announcement Content */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[#404944] uppercase">
                  Notice Message Content *
                </label>
                <span className={`text-[11px] font-mono ${content.length < 15 ? 'text-amber-600' : 'text-[#707974]'}`}>
                  {content.length} characters (min 15)
                </span>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                required
                placeholder="Type the full announcement, guidelines, venue, instructions, or exam timings here...

Example:
All final-year B.Tech students are hereby informed that the Campus Placement Orientation will be held on Monday at 10:00 AM in the Main Seminar Hall. Attendance is mandatory."
                className="w-full bg-[#f8f9ff] border border-[#bfc9c3]/40 rounded-xl p-3.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527] leading-relaxed resize-y font-inter"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full bg-[#003527] hover:bg-[#064e3b] disabled:bg-[#bfc9c3] text-white font-bold text-sm py-3.5 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all mt-2"
            >
              {isProcessing ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                  Scanning & Publishing Notice…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  Publish Text Notice to Dashboard
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right: Live Card Preview */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white rounded-3xl p-6 border border-[#bfc9c3]/30 shadow-xs">
            <h4 className="font-headline font-bold text-sm text-[#0b1c30] uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#003527] text-[18px]">preview</span>
              Live Dashboard Card Preview
            </h4>
            <p className="text-xs text-[#707974] mb-4">
              This preview shows how your text notice appears on the student dashboard in the exact card box format:
            </p>

            {/* Card preview identical to student dashboard */}
            <div className="rounded-2xl p-5 border-2 border-[#b0f0d6] bg-[#f0fdf4]/50 shadow-md relative overflow-hidden group">
              <div className="absolute top-0 right-0">
                <div className="bg-[#003527] text-white text-[9px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-bl-xl">
                  NEW
                </div>
              </div>
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#003527] rounded-l-2xl" />

              <div className="flex items-start gap-4 pl-3">
                <div className="w-12 h-12 rounded-2xl bg-[#003527] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <span className="material-symbols-outlined text-[24px]">
                    {category === 'Exams' ? 'description' : category === 'Events' ? 'celebration' : 'campaign'}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#003527]">
                      {category}
                    </span>
                    <span className="text-[10px] text-[#9ca8a3]">·</span>
                    <span className="text-[11px] text-[#707974] font-medium">
                      {audience === 'all' ? 'All Students' : department}
                    </span>
                  </div>

                  <h4 className="font-inter font-bold text-[0.9375rem] leading-snug mb-1.5 text-[#0b1c30]">
                    {title.trim() || 'Notice Title Will Appear Here'}
                  </h4>

                  <p className="text-xs text-[#707974] line-clamp-2 leading-relaxed">
                    {content.trim() || 'Type your message in the composer to preview the notice text preview snippet here...'}
                  </p>

                  <div className="flex items-center gap-3 mt-2 text-[11px] text-[#9ca8a3]">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">apartment</span>
                      {audience === 'all' ? 'General Academic' : department}
                    </span>
                    {actionRequiredDate && (
                      <span className="flex items-center gap-1 text-[#ba1a1a] font-semibold">
                        <span className="material-symbols-outlined text-[13px]">event</span>
                        {actionRequiredDate}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center shrink-0 self-center">
                  <div className="w-8 h-8 rounded-full bg-[#003527] text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-[#f8f9ff] border border-[#bfc9c3]/20 text-[11px] text-[#5a6672]">
              <span className="font-bold text-[#0b1c30]">👁 Click to expand:</span> When a student hovers and clicks the eye icon or the card, a full-format popup displays your entire formatted message.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
