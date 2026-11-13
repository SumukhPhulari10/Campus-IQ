import React, { useState } from 'react';
import { apiFetch as fetch } from '../lib/api';
import { AuthUser, CollegeDocument } from '../types';

interface TextStudentGuideUploadProps {
  user?: AuthUser;
  onDocumentAdded: (document: CollegeDocument) => void;
  onViewMaterials: () => void;
}

const categories: CollegeDocument['category'][] = [
  'Regulations',
  'Handbook',
  'Syllabus',
  'Exams',
  'Academic',
  'Circular',
  'Scholarships',
  'Financial Aid',
  'Placements',
  'Timetable',
  'Events',
];

export const TextStudentGuideUpload: React.FC<TextStudentGuideUploadProps> = ({
  user,
  onDocumentAdded,
  onViewMaterials,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CollegeDocument['category']>('Regulations');
  const [department, setDepartment] = useState('General Academic');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess(false);

    const guideTitle = title.trim();
    const guideContent = content.trim();
    if (guideTitle.length < 3) {
      setError('Enter a guide title with at least 3 characters.');
      return;
    }
    if (guideContent.length < 15 || guideContent.length > 20000) {
      setError('Guide text must be between 15 and 20,000 characters.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: guideTitle,
          department: department.trim() || 'General Academic',
          category,
          contentRaw: guideContent,
          summary: guideContent.slice(0, 160) + (guideContent.length > 160 ? '…' : ''),
          fileType: 'txt',
          targetBucket: 'student_guide',
          uploadedBy: user?.id,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.document) {
        setError(data.error || 'Could not publish the student guide.');
        return;
      }

      onDocumentAdded(data.document);
      setTitle('');
      setContent('');
      setSuccess(true);
    } catch {
      setError('Could not connect to the server. The guide was not published.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-[#bfc9c3]/30 bg-white p-6 shadow-xs md:p-8">
      <div className="mb-6 flex items-start gap-3 border-b border-[#bfc9c3]/20 pb-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff8e7] text-[#855300]">
          <span className="material-symbols-outlined text-[22px]">menu_book</span>
        </div>
        <div>
          <h2 className="font-headline text-lg font-bold text-[#0b1c30]">Write a Text Student Guide</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#5a6672]">
            Publish official guidance directly to What to Know and the AI, without uploading a file or creating a dashboard notice.
          </p>
        </div>
      </div>

      {success && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <span>Student guide published to What to Know and the AI.</span>
          <button type="button" onClick={onViewMaterials} className="shrink-0 font-bold underline">
            View materials
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="guide-title" className="mb-1.5 block text-xs font-bold uppercase text-[#404944]">Guide title *</label>
          <input
            id="guide-title"
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="e.g. Attendance Rules and Condonation"
            required
            maxLength={160}
            className="w-full rounded-xl border border-[#bfc9c3]/40 bg-[#f8f9ff] px-3.5 py-2.5 text-sm focus:border-[#003527] focus:outline-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="guide-category" className="mb-1.5 block text-xs font-bold uppercase text-[#404944]">Topic *</label>
            <select
              id="guide-category"
              value={category}
              onChange={event => setCategory(event.target.value as CollegeDocument['category'])}
              className="w-full rounded-xl border border-[#bfc9c3]/40 bg-[#f8f9ff] px-3 py-2.5 text-sm focus:border-[#003527] focus:outline-none"
            >
              {categories.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="guide-department" className="mb-1.5 block text-xs font-bold uppercase text-[#404944]">Department</label>
            <input
              id="guide-department"
              value={department}
              onChange={event => setDepartment(event.target.value)}
              placeholder="General Academic"
              className="w-full rounded-xl border border-[#bfc9c3]/40 bg-[#f8f9ff] px-3.5 py-2.5 text-sm focus:border-[#003527] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="guide-content" className="block text-xs font-bold uppercase text-[#404944]">Guide text *</label>
            <span className="text-[10px] text-[#707974]">{content.length}/20,000</span>
          </div>
          <textarea
            id="guide-content"
            value={content}
            onChange={event => setContent(event.target.value)}
            placeholder="Paste or type the official college guidance here. Include the relevant rules, dates, eligibility, and steps students should follow."
            required
            minLength={15}
            maxLength={20000}
            rows={10}
            className="w-full resize-y rounded-xl border border-[#bfc9c3]/40 bg-[#f8f9ff] px-3.5 py-3 text-sm leading-relaxed focus:border-[#003527] focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#003527] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#064e3b] disabled:cursor-not-allowed disabled:bg-[#9ca8a3]"
        >
          <span className="material-symbols-outlined text-[18px]">{saving ? 'sync' : 'publish'}</span>
          {saving ? 'Publishing guide…' : 'Publish to What to Know'}
        </button>
      </form>
    </div>
  );
};
