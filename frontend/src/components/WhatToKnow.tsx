import React, { useMemo, useState } from 'react';
import { CollegeDocument, Notice } from '../types';
import { SectionTranslation } from './SectionTranslation';

interface WhatToKnowProps {
  documents: CollegeDocument[];
  notices: Notice[];
  onViewDocument: (document: CollegeDocument) => void;
  onViewNotice: (notice: Notice) => void;
  translationEnabled: boolean;
}

interface Topic {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  accent: string;
  description: string;
  keywords: RegExp;
}

type TopicSource =
  | { kind: 'document'; id: string; title: string; summary: string; date?: string; document: CollegeDocument }
  | { kind: 'notice'; id: string; title: string; summary: string; date?: string; notice: Notice };

interface MarkdownTable {
  title: string;
  headers: string[];
  rows: string[][];
}

const TOPICS: Topic[] = [
  {
    id: 'scholarships',
    title: 'Scholarships',
    subtitle: 'Funding and eligibility updates',
    icon: 'school',
    accent: 'from-emerald-500 to-teal-700',
    description: 'Find official scholarship announcements and financial-aid information relevant to students.',
    keywords: /scholarship|financial aid|fee waiver|freeship|tuition waiver|education grant/i,
  },
  {
    id: 'subjects',
    title: 'Subjects & Syllabus',
    subtitle: 'Your course and curriculum material',
    icon: 'menu_book',
    accent: 'from-blue-500 to-indigo-700',
    description: 'Browse uploaded syllabi, subject details, and curriculum updates.',
    keywords: /syllabus|curriculum|subjects?|course outline|course structure|semester plan/i,
  },
  {
    id: 'exams',
    title: 'Exams',
    subtitle: 'Schedules, instructions, and updates',
    icon: 'assignment',
    accent: 'from-amber-500 to-orange-700',
    description: 'Keep exam-related schedules and official instructions together.',
    keywords: /exam|examination|hall ticket|admit card|assessment|mid.?term|end.?sem|question paper/i,
  },
  {
    id: 'attendance',
    title: 'Attendance',
    subtitle: 'Rules and attendance notices',
    icon: 'fact_check',
    accent: 'from-violet-500 to-purple-700',
    description: 'Find official attendance policies and notices that explain what students should do.',
    keywords: /attendance|condonation|shortage of attendance|attendance requirement|academic requirements|subject-wise attendance|overall attendance/i,
  },
  {
    id: 'fees',
    title: 'Fees & Financial Aid',
    subtitle: 'Payments, dues, and support',
    icon: 'payments',
    accent: 'from-rose-500 to-pink-700',
    description: 'See official fee-related notices, payment instructions, and available support information.',
    keywords: /fees?|payment|tuition|dues|financial aid|fee structure|scholarship/i,
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

function isAttendanceRuleContent(title: string, summary: string): boolean {
  const combined = `${title} ${summary}`.toLowerCase();

  const hasAttendanceKeyword = /(overall attendance|subject-wise attendance|attendance rules|attendance rule|attendance policy|attendance requirements|minimum attendance|medical leave|unit test attendance|practical attendance|assignment submission|academic discipline)/i.test(combined);
  const hasAcademicRuleKeyword = /(rule|rules|policy|requirement|requirements|minimum|semester|academic|discipline|deadline|examination eligibility|subject-wise)/i.test(combined);
  const isDefaulterReport = /(?:^|\s)(?:defaulter|attendance list|attendance sheet|attendance status|defaulter list)(?:\s|$)/i.test(title) && !/(rules|requirements|policy|discipline|minimum attendance)/i.test(combined);

  if (isDefaulterReport) return false;

  return hasAttendanceKeyword && hasAcademicRuleKeyword;
}

function getTopicSources(topic: Topic, documents: CollegeDocument[], notices: Notice[]): TopicSource[] {
  if (['subjects', 'exams'].includes(topic.id)) return [];

  const sources: TopicSource[] = [];
  const seen = new Set<string>();

  for (const document of documents) {
    if (topic.id === 'attendance' && /academic\s+calend[ae]r/i.test(document.title)) continue;
    const text = `${document.title} ${document.category} ${document.summary} ${document.contentRaw}`;
    if (topic.id === 'attendance') {
      if (!isAttendanceRuleContent(document.title, text)) continue;
    } else if (!topic.keywords.test(text)) {
      continue;
    }
    if (topic.id === 'fees' && !(
      document.category === 'Financial Aid' ||
      /fee structure|tuition fee|total payable fees/i.test(text)
    )) continue;
    const id = `doc:${document.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    sources.push({
      kind: 'document',
      id,
      title: document.title,
      summary: document.contentRaw || document.summary || document.title,
      date: document.actionRequiredDate,
      document,
    });
  }

  for (const notice of notices) {
    if (topic.id === 'attendance' && /academic\s+calend[ae]r/i.test(notice.title)) continue;
    const text = `${notice.title} ${notice.category} ${notice.aiSummary} ${notice.fullContent}`;
    if (topic.id === 'attendance') {
      if (!isAttendanceRuleContent(notice.title, text)) continue;
    } else if (!topic.keywords.test(text)) {
      continue;
    }
    if (topic.id === 'fees' && !/fee structure|tuition fee|total payable fees/i.test(text)) continue;
    const id = `notice:${notice.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    sources.push({
      kind: 'notice',
      id,
      title: notice.title,
      summary: notice.fullContent || notice.aiSummary || notice.title,
      date: notice.actionRequiredDate,
      notice,
    });
  }

  return sources;
}

const SCHOLARSHIP_GROUPS = ['SC/ST', 'OBC/SBC', 'EBC'] as const;
type ScholarshipGroup = typeof SCHOLARSHIP_GROUPS[number];

function parseScholarshipChecklist(text: string): Partial<Record<ScholarshipGroup, string[]>> {
  const sections: Partial<Record<ScholarshipGroup, string[]>> = {};
  let currentGroup: ScholarshipGroup | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const heading = line.replace(/^#{1,6}\s*/, '').replace(/[*_`]/g, '').replace(/:$/, '').trim().toUpperCase();
    const group = SCHOLARSHIP_GROUPS.find(item => heading.replace(/\s+/g, '') === item.replace(/\s+/g, ''));
    if (group) {
      currentGroup = group;
      sections[group] = [];
      continue;
    }

    if (!currentGroup || !line) continue;
    const item = line
      .replace(/^#{1,6}\s*/, '')
      .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
      .replace(/[*_`]/g, '')
      .trim();
    if (item && !/^(?:list of documents|scholarship form)$/i.test(item)) {
      sections[currentGroup]?.push(item);
    }
  }

  return sections;
}

function contentLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(line => line
      .replace(/^#{1,6}\s*/, '')
      .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
      .replace(/[*_`]/g, '')
      .trim())
    .filter(line => line && !/^list of documents for scholarship form$/i.test(line));
}

function parseMarkdownTables(text: string): MarkdownTable[] {
  const lines = text.split(/\r?\n/);
  const tables: MarkdownTable[] = [];
  let title = 'Fee details';

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const heading = line.replace(/^#{1,6}\s*/, '').replace(/[*_`]/g, '').trim();
    if (/fee structure/i.test(heading) && !/^(?:fee structure|fee structure\s+20\d{2})$/i.test(heading)) {
      title = heading;
    }

    if (!line.startsWith('|')) continue;
    const tableLines: string[] = [];
    while (index < lines.length && lines[index].trim().startsWith('|')) {
      tableLines.push(lines[index].trim());
      index += 1;
    }
    index -= 1;

    const parsedRows = tableLines
      .map(row => row.split('|').slice(1, -1).map(cell => cell.trim().replace(/\*\*/g, '')))
      .filter(cells => cells.some(Boolean));
    if (parsedRows.length < 2) continue;

    const headers = parsedRows[0];
    const rows = parsedRows.slice(1).filter(cells => !cells.every(cell => /^:?-{2,}:?$/.test(cell)));
    if (headers.length > 1 && rows.length) {
      tables.push({ title, headers, rows });
    }
  }

  return tables;
}

function formatFeeCell(value: string): string {
  if (!/^\d+(?:\.\d+)?$/.test(value.trim())) return value || '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export const WhatToKnow: React.FC<WhatToKnowProps> = ({
  documents,
  notices,
  onViewDocument,
  onViewNotice,
  translationEnabled,
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
              {selectedTopic.id === 'scholarships' && (
                <aside className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined mt-0.5 text-[20px] text-[#003527]">account_balance</span>
                    <div>
                      <h3 className="text-sm font-bold text-[#0b1c30]">Official Maharashtra scholarship portal</h3>
                      <p className="mt-1 text-xs leading-relaxed text-[#475569]">
                        For Maharashtra government scholarship schemes, applications, and updates, visit MahaDBT.
                      </p>
                    </div>
                  </div>
                  <a
                    href="https://mahadbt.maharashtra.gov.in/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#004e45] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#003527] focus:outline-none focus:ring-2 focus:ring-[#003527]/40 focus:ring-offset-2"
                  >
                    Visit MahaDBT
                    <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                  </a>
                </aside>
              )}
              {selectedTopic.id === 'fees' && (
                <aside className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined mt-0.5 text-[20px] text-[#9f1239]">payments</span>
                    <div>
                      <h3 className="text-sm font-bold text-[#0b1c30]">Official MGM College fee structure</h3>
                      <p className="mt-1 text-xs leading-relaxed text-[#475569]">
                        For the college’s published fees and related details, visit the official fee structure page.
                      </p>
                    </div>
                  </div>
                  <a
                    href="https://www.mgmcen.ac.in/fee-structure.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#9f1239] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#881337] focus:outline-none focus:ring-2 focus:ring-[#9f1239]/40 focus:ring-offset-2"
                  >
                    View Fee Structure
                    <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                  </a>
                </aside>
              )}
              {topicSources.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 text-[#003527]">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    <h3 className="text-sm font-bold">From campus uploads</h3>
                  </div>
                  <div className="space-y-3">
                    {topicSources.map(source => (
                      <article key={source.id} className="rounded-2xl border border-[#bfc9c3]/35 bg-[#fbfcff] p-4 sm:p-5">
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
                        {selectedTopic.id === 'scholarships' && Object.values(parseScholarshipChecklist(source.summary)).some(items => (items?.length || 0) > 0) ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            {SCHOLARSHIP_GROUPS.map((group, index) => {
                              const items = parseScholarshipChecklist(source.summary)[group] || [];
                              const styles = [
                                { border: 'border-emerald-200', note: 'bg-[#f0fdf4]', header: 'bg-emerald-100/80 text-emerald-950', bullet: 'bg-emerald-600', pin: 'bg-emerald-500' },
                                { border: 'border-sky-200', note: 'bg-[#f0f9ff]', header: 'bg-sky-100/80 text-sky-950', bullet: 'bg-sky-600', pin: 'bg-sky-500' },
                                { border: 'border-amber-200', note: 'bg-[#fffbeb]', header: 'bg-amber-100/80 text-amber-950', bullet: 'bg-amber-600', pin: 'bg-amber-500' },
                              ][index];
                              return (
                                <section key={group} className={`relative overflow-hidden rounded-2xl border ${styles.border} ${styles.note} shadow-sm`}>
                                  <span className={`absolute left-1/2 top-2 h-2.5 w-2.5 -translate-x-1/2 rounded-full ${styles.pin} shadow-sm`} />
                                  <h5 className={`flex items-center justify-between gap-2 px-4 pb-3 pt-6 text-sm font-extrabold tracking-wide ${styles.header}`}>
                                    <span>{group}</span>
                                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold">
                                      {items.length} items
                                    </span>
                                  </h5>
                                  {items.length > 0 ? (
                                    <ul className="space-y-2 px-4 py-4 select-text">
                                      {items.map((item, index) => (
                                        <li key={`${group}-${index}`} className="group/item flex items-start gap-2 rounded-lg border border-transparent px-2 py-1.5 text-xs leading-relaxed text-[#334155] transition-colors hover:border-white hover:bg-white/80">
                                          <span className={`mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${styles.bullet} text-[10px] font-extrabold text-white`}>
                                            {index + 1}
                                          </span>
                                          <span className="font-medium">{item}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="px-4 py-4 text-xs text-[#64748b]">No items listed for this group.</p>
                                  )}
                                  <div className="border-t border-white/80 px-4 pb-4">
                                    <SectionTranslation
                                      text={`${group} scholarship documents:\n${items.map((item, itemIndex) => `${itemIndex + 1}. ${item}`).join('\n')}`}
                                      enabled={translationEnabled}
                                    />
                                  </div>
                                </section>
                              );
                            })}
                          </div>
                        ) : selectedTopic.id === 'fees' && parseMarkdownTables(source.summary).length > 0 ? (
                          <div className="mt-4 space-y-4">
                            {parseMarkdownTables(source.summary).map((table, tableIndex) => {
                              const totalIndex = table.rows.findIndex(row => row[0]?.toLowerCase().includes('total payable'));
                              return (
                                <section key={`${source.id}-table-${tableIndex}`} className="overflow-hidden rounded-2xl border border-[#cbd5e1] bg-white shadow-sm">
                                  <header className="flex flex-col gap-1 border-b border-[#e2e8f0] bg-gradient-to-r from-[#eff6ff] to-[#f8fafc] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                    <h5 className="font-headline text-sm font-extrabold text-[#15304b]">{table.title}</h5>
                                    <span className="text-[10px] font-semibold text-[#64748b]">Academic year 2026–27 · amounts as shown in uploaded source</span>
                                  </header>
                                  <div className="overflow-x-auto">
                                    <table className="min-w-[760px] w-full border-collapse text-left text-xs">
                                      <thead className="bg-[#f1f5f9] text-[10px] uppercase tracking-wide text-[#475569]">
                                        <tr>
                                          {table.headers.map((header, headerIndex) => (
                                            <th key={`${header}-${headerIndex}`} scope="col" className={`whitespace-nowrap border-b border-[#dbe3ec] px-3 py-2.5 ${headerIndex === 0 ? 'sticky left-0 z-10 bg-[#f1f5f9] text-left' : 'text-right'}`}>
                                              {header}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {table.rows.map((row, rowIndex) => {
                                          const isTotal = row[0]?.toLowerCase().includes('total payable');
                                          return (
                                            <tr key={`${row[0]}-${rowIndex}`} className={`${isTotal ? 'bg-emerald-50 font-extrabold text-[#064e3b]' : rowIndex % 2 ? 'bg-slate-50/70' : 'bg-white'} hover:bg-amber-50/70`}>
                                              {table.headers.map((_, cellIndex) => (
                                                <td key={`${rowIndex}-${cellIndex}`} className={`whitespace-nowrap border-b border-[#edf1f5] px-3 py-2.5 ${cellIndex === 0 ? 'sticky left-0 z-[1] bg-inherit font-semibold' : 'text-right tabular-nums'} ${isTotal ? 'border-t-2 border-emerald-200' : ''}`}>
                                                  {cellIndex === 0 ? row[cellIndex] || '—' : formatFeeCell(row[cellIndex])}
                                                </td>
                                              ))}
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                  <div className="border-t border-[#e8edf2] px-4 pb-3">
                                    <SectionTranslation
                                      text={`${table.title}\n${table.headers.join(' | ')}\n${table.rows.map(row => row.join(' | ')).join('\n')}`}
                                      enabled={translationEnabled}
                                    />
                                  </div>
                                  {totalIndex < 0 && <span className="sr-only">Total row not present in this table.</span>}
                                </section>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl bg-white border border-[#e5e9ef] p-4">
                            <p className="text-[9px] font-bold uppercase tracking-wide text-[#718096] mb-2">Key information</p>
                            <ul className="space-y-2">
                              {contentLines(source.summary).map((line, index) => (
                                <li key={`${source.id}-${index}`} className="flex items-start gap-2 text-xs text-[#475569] leading-relaxed">
                                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1b8065]" />
                                  <span>{line}</span>
                                </li>
                              ))}
                            </ul>
                            <SectionTranslation text={source.summary} enabled={translationEnabled} />
                          </div>
                        )}
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
                    <h3 className="text-sm font-bold text-[#334155]">Guide coming soon</h3>
                  </div>
                  <p className="text-[11px] text-[#64748b] mb-3">
                    Official information for this topic will appear here after it is uploaded and verified.
                  </p>
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
