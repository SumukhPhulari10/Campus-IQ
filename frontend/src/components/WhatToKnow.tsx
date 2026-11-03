import React, { useMemo, useState } from 'react';
import { CollegeDocument, Notice } from '../types';

interface WhatToKnowProps {
  documents: CollegeDocument[];
  notices: Notice[];
  onViewDocument: (document: CollegeDocument) => void;
  onViewNotice: (notice: Notice) => void;
}

interface Topic {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  accent: string;
  description: string;
  keywords: RegExp;
  starterGuide: string[];
}

type TopicSource =
  | { kind: 'document'; id: string; title: string; summary: string; date?: string; document: CollegeDocument }
  | { kind: 'notice'; id: string; title: string; summary: string; date?: string; notice: Notice };

const TOPICS: Topic[] = [
  {
    id: 'scholarships',
    title: 'Scholarships',
    subtitle: 'Funding and eligibility updates',
    icon: 'school',
    accent: 'from-emerald-500 to-teal-700',
    description: 'Find official scholarship announcements and financial-aid information relevant to students.',
    keywords: /scholarship|financial aid|fee waiver|freeship|tuition waiver|education grant/i,
    starterGuide: [
      'Check official notices for eligibility, application dates, and required documents.',
      'Use only application links and instructions published by your institution or the scholarship provider.',
    ],
  },
  {
    id: 'subjects',
    title: 'Subjects & Syllabus',
    subtitle: 'Your course and curriculum material',
    icon: 'menu_book',
    accent: 'from-blue-500 to-indigo-700',
    description: 'Browse uploaded syllabi, subject details, and curriculum updates.',
    keywords: /syllabus|curriculum|subjects?|course outline|course structure|semester plan/i,
    starterGuide: [
      'Choose the syllabus that matches your department, academic year, and semester.',
      'Check uploaded curriculum documents for the official subject list and course details.',
    ],
  },
  {
    id: 'exams',
    title: 'Exams',
    subtitle: 'Schedules, instructions, and updates',
    icon: 'assignment',
    accent: 'from-amber-500 to-orange-700',
    description: 'Keep exam-related schedules and official instructions together.',
    keywords: /exam|examination|hall ticket|admit card|assessment|mid.?term|end.?sem|question paper/i,
    starterGuide: [
      'Review the latest official exam timetable and any follow-up notices.',
      'Confirm dates and instructions against the source document, since schedules can change.',
    ],
  },
  {
    id: 'attendance',
    title: 'Attendance',
    subtitle: 'Rules and attendance notices',
    icon: 'fact_check',
    accent: 'from-violet-500 to-purple-700',
    description: 'Find official attendance policies and notices that explain what students should do.',
    keywords: /attendance|condonation|shortage of attendance|attendance requirement/i,
    starterGuide: [
      'Refer to your current handbook or official department notice for the applicable rules.',
      'Contact the relevant academic office if you need clarification about your attendance record.',
    ],
  },
  {
    id: 'fees',
    title: 'Fees & Financial Aid',
    subtitle: 'Payments, dues, and support',
    icon: 'payments',
    accent: 'from-rose-500 to-pink-700',
    description: 'See official fee-related notices, payment instructions, and available support information.',
    keywords: /fees?|payment|tuition|dues|financial aid|fee structure|scholarship/i,
    starterGuide: [
      'Check official notices for current amounts, payment instructions, and due dates.',
      'Use the college’s verified payment channels and contact the accounts office for questions.',
    ],
  },
];

function normalizeDepartment(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function isRelevantDepartment(department: string | undefined, studentDepartment: string): boolean {
  const value = normalizeDepartment(department);
  if (!value || ['general academic', 'academic affairs', 'all'].includes(value)) return true;
  if (!studentDepartment) return true;
  const studentIsCse = studentDepartment === 'cse' || studentDepartment.includes('computer science');
  if (studentIsCse) return value.includes('computer science') || value.includes('cse');
  return value === studentDepartment || value.includes(studentDepartment) || studentDepartment.includes(value);
}

function getTopicSources(topic: Topic, documents: CollegeDocument[], notices: Notice[]): TopicSource[] {
  const sources: TopicSource[] = [];
  const seen = new Set<string>();

  for (const document of documents) {
    const text = `${document.title} ${document.category} ${document.summary} ${document.contentRaw}`;
    if (!topic.keywords.test(text)) continue;
    const id = `doc:${document.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    sources.push({
      kind: 'document',
      id,
      title: document.title,
      summary: document.summary || document.contentRaw || document.title,
      date: document.actionRequiredDate,
      document,
    });
  }

  for (const notice of notices) {
    const text = `${notice.title} ${notice.category} ${notice.aiSummary} ${notice.fullContent}`;
    if (!topic.keywords.test(text)) continue;
    const id = `notice:${notice.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    sources.push({
      kind: 'notice',
      id,
      title: notice.title,
      summary: notice.aiSummary || notice.fullContent || notice.title,
      date: notice.actionRequiredDate,
      notice,
    });
  }

  return sources;
}

export const WhatToKnow: React.FC<WhatToKnowProps> = ({
  documents,
  notices,
  onViewDocument,
  onViewNotice,
}) => {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const selectedTopic = TOPICS.find(topic => topic.id === selectedTopicId) || null;
  const topicSources = useMemo(
    () => selectedTopic ? getTopicSources(selectedTopic, documents, notices) : [],
    [selectedTopic, documents, notices],
  );

  return (
    <>
      <section className="mb-8" id="what-to-know">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-[#003527] text-[22px]">lightbulb</span>
              <h2 className="font-headline font-bold text-xl text-[#0b1c30]">What to Know</h2>
            </div>
            <p className="text-sm text-[#707974]">
              Helpful topics, with the latest information from your campus documents.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start sm:self-auto text-[10px] font-bold
                           text-[#003527] bg-[#b0f0d6]/35 px-3 py-1.5 rounded-full border border-[#80bea6]/40">
            <span className="w-1.5 h-1.5 rounded-full bg-[#003527] animate-pulse" />
            Campus topics
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {TOPICS.map(topic => {
            const sources = getTopicSources(topic, documents, notices);
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => setSelectedTopicId(topic.id)}
                className="group relative overflow-hidden rounded-2xl bg-white border border-[#bfc9c3]/35
                           p-4 text-left shadow-xs hover:shadow-lg hover:-translate-y-0.5
                           transition-all focus:outline-none focus:ring-2 focus:ring-[#003527]/30"
              >
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${topic.accent}`} />
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${topic.accent}
                                   text-white flex items-center justify-center shadow-sm`}>
                    <span className="material-symbols-outlined text-[21px]">{topic.icon}</span>
                  </div>
                  <span className={`text-[9px] font-extrabold uppercase tracking-wide px-2 py-1 rounded-full
                                    ${sources.length
                                      ? 'bg-[#b0f0d6]/45 text-[#003527]'
                                      : 'bg-[#eff4ff] text-[#64748b]'}`}>
                    {sources.length ? `${sources.length} live` : 'Starter guide'}
                  </span>
                </div>
                <h3 className="font-headline font-bold text-[15px] text-[#0b1c30] mb-1 group-hover:text-[#003527]">
                  {topic.title}
                </h3>
                <p className="text-[11px] leading-relaxed text-[#707974] min-h-[34px]">{topic.subtitle}</p>
                <div className="flex items-center gap-1 mt-3 text-[11px] font-bold text-[#003527]">
                  Explore topic
                  <span className="material-symbols-outlined text-[15px] group-hover:translate-x-0.5 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {selectedTopic && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#0b1c30]/55 backdrop-blur-sm"
          onClick={() => setSelectedTopicId(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="what-to-know-title"
            className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl bg-white shadow-2xl animate-fade-in"
            onClick={event => event.stopPropagation()}
          >
            <header className="flex items-start gap-4 p-5 sm:p-6 border-b border-[#bfc9c3]/30">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${selectedTopic.accent}
                               text-white flex items-center justify-center shrink-0`}>
                <span className="material-symbols-outlined text-[24px]">{selectedTopic.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#707974] mb-1">What to Know</p>
                <h2 id="what-to-know-title" className="font-headline font-bold text-xl text-[#0b1c30]">
                  {selectedTopic.title}
                </h2>
                <p className="text-xs text-[#707974] mt-1">{selectedTopic.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTopicId(null)}
                aria-label="Close topic"
                className="w-9 h-9 rounded-xl bg-[#f4f7ff] hover:bg-[#e5eeff] text-[#64748b]
                           flex items-center justify-center shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </header>

            <div className="p-5 sm:p-6 overflow-y-auto max-h-[calc(85vh-100px)] space-y-5">
              {topicSources.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 text-[#003527]">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    <h3 className="text-sm font-bold">From campus uploads</h3>
                  </div>
                  <div className="space-y-3">
                    {topicSources.map(source => (
                      <article key={source.id} className="rounded-2xl border border-[#bfc9c3]/35 bg-[#fbfcff] p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                          <div>
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#003527]">
                              {source.kind === 'document' ? 'Document' : 'Notice'}
                            </span>
                            <h4 className="font-bold text-sm text-[#0b1c30] mt-0.5">{source.title}</h4>
                          </div>
                          {source.date && (
                            <span className="text-[10px] font-bold text-[#7c4a03] bg-amber-50 border border-amber-100
                                             rounded-full px-2.5 py-1 shrink-0">
                              Date: {source.date}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#5a6672] leading-relaxed whitespace-pre-line line-clamp-5">
                          {source.summary}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTopicId(null);
                            if (source.kind === 'document') onViewDocument(source.document);
                            else onViewNotice(source.notice);
                          }}
                          className="inline-flex items-center gap-1 mt-3 text-[11px] font-bold text-[#003527]
                                     hover:underline"
                        >
                          Open official source
                          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        </button>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#bfc9c3] bg-[#f8fafe] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-[18px] text-[#64748b]">info</span>
                    <h3 className="text-sm font-bold text-[#334155]">Starter guide · no matching upload yet</h3>
                  </div>
                  <p className="text-[11px] text-[#64748b] mb-3">
                    This general guidance is not an official campus rule. Check the college source before acting.
                  </p>
                  <ul className="space-y-2">
                    {selectedTopic.starterGuide.map(item => (
                      <li key={item} className="flex items-start gap-2 text-xs text-[#475569] leading-relaxed">
                        <span className="material-symbols-outlined text-[15px] text-[#003527] mt-0.5">check_circle</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-[10px] text-[#9ca8a3] flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[14px]">shield</span>
                Campus-uploaded information is shown as provided; confirm dates and requirements in the official source.
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  );
};
