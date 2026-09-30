import { CollegeDocument } from '../types';

/** One lecture / lab slot in the weekly grid */
export interface ClassSlot {
  time: string;
  startMin: number;
  endMin: number;
  code: string;
  name: string;
  room: string;
  instructor: string;
}

export type WeeklySchedule = Record<string, ClassSlot[]>;

export interface NextClassInfo {
  code: string;
  name: string;
  time: string;
  room: string;
  instructor: string;
  dayKey: string;
  dayName: string;
  isNextDay?: boolean;
  dayLabel?: string;
}

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const WEEKDAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

/** Faculty initials → full name (from MGM CSE timetable legend) */
export const FACULTY_CODES: Record<string, string> = {
  SSN: 'Prof. S. S. Wagre',
  SSW: 'Ms. S. S. Wagre',
  JSK: 'Ms. J. S. Kale',
  RSO: 'Ms. R. S. Dumne',
  RSD: 'Mr. R. S. Deshpande',
  GRD: 'Mr. G. R. Deshpande',
  MGS: 'Ms. M. G. Shelke',
  SSP: 'Ms. S. S. Panchal',
  HDG: 'Ms. H. O. Gujar',
  HOG: 'Ms. H. O. Gujar',
  AMR: 'Dr. A. M. Rajurkar',
  JHP: 'Ms. J. H. Patil',
  MYJ: 'Dr. M. Y. Joshi',
  SYG: 'Dr. S. Y. Gaikwad',
  SIT: 'Mr. S. I. Titare',
  NLP: 'Ms. N. L. Pariyal',
  MNB: 'Mr. M. N. Bhandare',
  BSK: 'Dr. B. S. Kapre',
  PPP: 'Mr. P. P. Pawar',
  MAA: 'Md. Aijaz Ahmed',
  OBA: 'Ms. O. B. Aghor',
  CMR: 'Mr. M. R. Chennoji',
  DSN: 'Ms. D. S. Naik',
  WGS: 'Mr. G. S. Wahi',
  HUJ: 'Mr. H. U. Joshi',
  PSB: 'Ms. P. S. Bihade',
  LBJ: 'Ms. L. B. Isal',
  MHK: 'Ms. M. H. Khan',
  KPP: 'Ms. K. P. Pople',
  SAB: 'Syed Ateeq B.',
  JTS: 'Ms. J. T. Siledar',
  RBB: 'Ms. R. B. Bacchewar',
  YDN: 'Mr. Y. D. Nikhate',
  SPB: 'Mr. S. P. Bawne',
  SGS: 'Mr. S. G. Salve',
};

/** Subject short codes → full names */
export const SUBJECT_CODES: Record<string, string> = {
  CC: 'Cloud Computing',
  DT: 'Design Thinking',
  AI: 'Artificial Intelligence',
  AL: 'Artificial Intelligence',
  OT: 'Optimization Techniques',
  BOA: 'Business Analytics',
  BDA: 'Big Data Analytics',
  BI: 'Business Intelligence',
  PROJECT: 'Project-I Lab',
  LAB: 'Laboratory',
};

/**
 * Authoritative B.Tech CSE Section B final-year weekly grid
 * (Odd Semester 2026-27 — matches teacher-uploaded "B.TECH CSE B TT").
 * PDF text extraction scrambles table columns, so this structured matrix
 * is the reliable source when that timetable is present.
 */
export const CSE_B_WEEKLY_SCHEDULE: WeeklySchedule = {
  // Exact grid from official CSE B B.Tech Final Year TT (w.e.f. 14 Sep 2026).
  // Faculty shown as short codes only (SSN, RSD, JSK, …) as printed on the sheet.
  monday: [
    { time: '9:00 TO 10:00', startMin: 540, endMin: 600, code: 'CC', name: 'Cloud Computing', room: 'G-01', instructor: 'SSN' },
    { time: '10:30 TO 11:30', startMin: 630, endMin: 690, code: 'DT', name: 'Design Thinking', room: 'G-04', instructor: 'RSD' },
    { time: '11:30 TO 12:30', startMin: 690, endMin: 750, code: 'AI', name: 'Artificial Intelligence', room: 'G-04', instructor: 'JSK' },
    { time: '01:00 TO 03:00', startMin: 780, endMin: 900, code: 'LAB', name: 'B5: AI Lab / B7: CC Lab', room: 'LAB 9 / LAB 7', instructor: 'JSK / SSN' },
  ],
  tuesday: [
    { time: '10:30 TO 11:30', startMin: 630, endMin: 690, code: 'CC', name: 'Cloud Computing', room: 'RC', instructor: 'SSN' },
    { time: '11:30 TO 12:30', startMin: 690, endMin: 750, code: 'BDA', name: 'Big Data Analytics', room: 'RC', instructor: 'MGS' },
    { time: '01:00 TO 02:00', startMin: 780, endMin: 840, code: 'AI', name: 'Artificial Intelligence', room: 'G-04', instructor: 'JSK' },
  ],
  wednesday: [
    { time: '9:00 TO 10:00', startMin: 540, endMin: 600, code: 'DT', name: 'Design Thinking', room: 'G-02', instructor: 'RSD' },
    { time: '10:30 TO 11:30', startMin: 630, endMin: 690, code: 'BDA', name: 'Big Data Analytics', room: 'RC', instructor: 'MGS' },
    { time: '11:30 TO 12:30', startMin: 690, endMin: 750, code: 'AI', name: 'Artificial Intelligence', room: 'RC', instructor: 'JSK' },
    { time: '01:00 TO 03:00', startMin: 780, endMin: 900, code: 'LAB', name: 'B6: CC Lab / B7: AI Lab', room: 'LAB 7 / LAB 9', instructor: 'SSN / JSK' },
    { time: '03:30 TO 04:30', startMin: 930, endMin: 990, code: 'BI', name: 'Business Intelligence', room: 'RC', instructor: 'SSP' },
    { time: '04:30 TO 05:30', startMin: 990, endMin: 1050, code: 'CC', name: 'Cloud Computing', room: 'RC', instructor: 'SSN' },
  ],
  thursday: [
    { time: '01:00 TO 03:00', startMin: 780, endMin: 900, code: 'PROJECT', name: 'Project-I', room: 'LAB 7, 8, 9', instructor: 'HDG' },
    { time: '03:30 TO 04:30', startMin: 930, endMin: 990, code: 'BDA', name: 'Big Data Analytics', room: 'G-03', instructor: 'MGS' },
    { time: '04:30 TO 05:30', startMin: 990, endMin: 1050, code: 'BI', name: 'Business Intelligence', room: 'G-03', instructor: 'SSP' },
  ],
  friday: [
    { time: '9:00 TO 10:00', startMin: 540, endMin: 600, code: 'DT', name: 'Design Thinking', room: 'G-01', instructor: 'RSD' },
    { time: '10:30 TO 11:30', startMin: 630, endMin: 690, code: 'BI', name: 'Business Intelligence', room: 'RC', instructor: 'SSP' },
    { time: '11:30 TO 12:30', startMin: 690, endMin: 750, code: 'CC', name: 'Cloud Computing', room: 'RC', instructor: 'SSN' },
    { time: '01:00 TO 03:00', startMin: 780, endMin: 900, code: 'LAB', name: 'B6: AI Lab / B8: CC Lab', room: 'LAB 2 / LAB 1', instructor: 'JSK / SSN' },
  ],
  saturday: [
    { time: '10:30 TO 11:30', startMin: 630, endMin: 690, code: 'BDA', name: 'Big Data Analytics', room: 'F-12', instructor: 'MGS' },
    { time: '11:30 TO 12:30', startMin: 690, endMin: 750, code: 'BI', name: 'Business Intelligence', room: 'F-12', instructor: 'SSP' },
    { time: '01:00 TO 02:00', startMin: 780, endMin: 840, code: 'AI', name: 'Artificial Intelligence', room: 'RC', instructor: 'JSK' },
    { time: '02:00 TO 03:00', startMin: 840, endMin: 900, code: 'DT', name: 'Design Thinking', room: 'RC', instructor: 'RSD' },
    { time: '03:30 TO 05:30', startMin: 930, endMin: 1050, code: 'LAB', name: 'B5: CC Lab / B8: AI Lab', room: 'LAB 7 / LAB 9', instructor: 'SSN / JSK' },
  ],
};

export function isTimetableDoc(doc: CollegeDocument): boolean {
  const title = (doc.title || '').toLowerCase();
  return (
    doc.category === 'Timetable' ||
    title.includes('timetable') ||
    title.includes('time table') ||
    title.includes('time-table') ||
    title.includes('schedule')
  );
}

/** Detect teacher-uploaded B.Tech CSE Section B final-year timetable */
export function isCseSectionBTimetable(doc: CollegeDocument): boolean {
  if (!isTimetableDoc(doc)) return false;
  const blob = `${doc.title} ${doc.department || ''} ${doc.section || ''} ${doc.contentRaw || ''}`.toLowerCase();
  const isCse =
    blob.includes('cse') ||
    blob.includes('computer science') ||
    (doc.department || '').toLowerCase().includes('cse') ||
    (doc.department || '').toLowerCase().includes('computer science');
  const isSectionB =
    (doc.section || '').trim().toUpperCase() === 'B' ||
    /\bcse\s*[•·\-]?\s*b\b/.test(blob) ||
    /\bsection\s*b\b/.test(blob) ||
    /\bcse\s*b\b/.test(blob) ||
    /b\.?\s*tech\s*cse\s*b/.test(blob);
  return isCse && isSectionB;
}

export function parseTimeToMinutes(t: string): number {
  const cleaned = t.trim().toUpperCase();
  const m = cleaned.match(/(\d{1,2})[:.]?(\d{2})\s*(AM|PM)?/);
  if (!m) return -1;
  let hours = parseInt(m[1], 10);
  const mins = parseInt(m[2], 10);
  const period = m[3];

  if (period === 'PM' && hours !== 12) hours += 12;
  else if (period === 'AM' && hours === 12) hours = 0;
  else if (!period) {
    // College grids often omit AM/PM; 1–6 usually means afternoon
    if (hours >= 1 && hours <= 6) hours += 12;
  }
  return hours * 60 + mins;
}

function resolveSubject(code: string): string {
  const key = code.replace(/[^A-Za-z]/g, '').toUpperCase();
  return SUBJECT_CODES[key] || code;
}

function resolveFaculty(raw: string): string {
  const codes = raw.toUpperCase().match(/\b[A-Z]{2,4}\b/g) || [];
  const names = codes
    .map((c) => FACULTY_CODES[c])
    .filter(Boolean);
  if (names.length) return `${names.join(' / ')} (${codes.filter((c) => FACULTY_CODES[c]).join(', ')})`;
  return raw.trim() || '—';
}

/**
 * Best-effort parse for non-CSE-B text timetables.
 * Looks for day headers + time ranges + nearby subject/faculty tokens.
 */
export function parseWeeklyScheduleFromText(content: string): WeeklySchedule | null {
  if (!content || content.trim().length < 40) return null;

  const dayPattern =
    /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|MON|TUE|WED|THU|FRI|SAT|SUN)\b/gi;
  const positions: Array<{ day: string; index: number }> = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(dayPattern.source, 'gi');
  while ((m = re.exec(content)) !== null) {
    const raw = m[1].toUpperCase();
    let norm = raw.toLowerCase();
    if (raw.startsWith('MON')) norm = 'monday';
    else if (raw.startsWith('TUE')) norm = 'tuesday';
    else if (raw.startsWith('WED')) norm = 'wednesday';
    else if (raw.startsWith('THU')) norm = 'thursday';
    else if (raw.startsWith('FRI')) norm = 'friday';
    else if (raw.startsWith('SAT')) norm = 'saturday';
    else if (raw.startsWith('SUN')) norm = 'sunday';
    positions.push({ day: norm, index: m.index });
  }

  const isHeaderList =
    positions.length >= 3 &&
    positions[positions.length - 1].index - positions[0].index < 120;

  const dayBlocks: Record<string, string> = {};
  if (positions.length === 0 || isHeaderList) {
    // Can't reliably split PDF table dumps — refuse rather than invent wrong slots
    return null;
  }

  for (let i = 0; i < positions.length; i++) {
    const { day, index } = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1].index : content.length;
    dayBlocks[day] = (dayBlocks[day] || '') + '\n' + content.slice(index, end);
  }

  const schedule: WeeklySchedule = {};
  const timeRe =
    /(\d{1,2}[:.]\d{2}\s*(?:AM|PM)?)\s*(?:[-–]|TO|\bto\b)\s*(\d{1,2}[:.]\d{2}\s*(?:AM|PM)?)/gi;

  for (const [day, block] of Object.entries(dayBlocks)) {
    if (day === 'sunday') continue;
    const slots: ClassSlot[] = [];
    let tm: RegExpExecArray | null;
    const tre = new RegExp(timeRe.source, 'gi');
    while ((tm = tre.exec(block)) !== null) {
      const startMin = parseTimeToMinutes(tm[1]);
      const endMin = parseTimeToMinutes(tm[2]);
      if (startMin < 0 || endMin < 0) continue;

      const after = block.slice(tm.index + tm[0].length, tm.index + tm[0].length + 180);
      const codeMatch = after.match(/\b([A-Z]{2,5}(?:[-\s]?\d{2,4})?)\b/);
      const code = codeMatch ? codeMatch[1].replace(/\s/g, '').toUpperCase() : 'CLASS';
      const roomMatch = after.match(
        /\b(?:Room|Lab|Hall|CR|LH|G-\d+|F-\d+|RC)\s*[\w,/ -]*/i
      );
      const facultyMatch = after.match(
        /(?:Prof\.?|Dr\.?|Mr\.?|Ms\.?)\s+[A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+)*/ 
      ) || after.match(/\b([A-Z]{2,4})\b/);

      slots.push({
        time: `${tm[1].trim()} TO ${tm[2].trim()}`.replace(/\s+/g, ' '),
        startMin,
        endMin,
        code,
        name: resolveSubject(code),
        room: roomMatch ? roomMatch[0].trim() : '—',
        instructor: facultyMatch
          ? resolveFaculty(Array.isArray(facultyMatch) ? facultyMatch[0] : facultyMatch[0])
          : '—',
      });
    }
    if (slots.length) {
      schedule[day] = slots.sort((a, b) => a.startMin - b.startMin);
    }
  }

  return Object.keys(schedule).length ? schedule : null;
}

/** Pick the best weekly schedule from fetched student documents */
export function resolveScheduleFromDocs(docs: CollegeDocument[]): {
  schedule: WeeklySchedule | null;
  sourceDoc: CollegeDocument | null;
  sourceLabel: string;
} {
  const timetables = docs.filter(isTimetableDoc);
  if (!timetables.length) {
    return { schedule: null, sourceDoc: null, sourceLabel: '' };
  }

  // Prefer section-tagged / newest CSE B match
  const cseB = timetables.find(isCseSectionBTimetable);
  if (cseB) {
    return {
      schedule: CSE_B_WEEKLY_SCHEDULE,
      sourceDoc: cseB,
      sourceLabel: cseB.title,
    };
  }

  for (const doc of timetables) {
    const parsed = parseWeeklyScheduleFromText(doc.contentRaw || '');
    if (parsed) {
      return { schedule: parsed, sourceDoc: doc, sourceLabel: doc.title };
    }
  }

  // Timetable uploaded but unparseable PDF dump — still surface CSE B grid
  // only when title/dept strongly suggests it; otherwise null
  const fallback = timetables[0];
  return { schedule: null, sourceDoc: fallback, sourceLabel: fallback.title };
}

export function getClassesForDay(
  schedule: WeeklySchedule,
  dayKey: string
): ClassSlot[] {
  return schedule[dayKey.toLowerCase()] || [];
}

export function findNextClass(
  schedule: WeeklySchedule,
  now: Date = new Date()
): NextClassInfo | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayIdx = now.getDay();

  if (todayIdx >= 1 && todayIdx <= 6) {
    const todayKey = DAY_NAMES[todayIdx].toLowerCase();
    const todayClasses = getClassesForDay(schedule, todayKey);
    const upcoming = todayClasses.find((c) => c.endMin > nowMinutes);
    if (upcoming) {
      return {
        ...upcoming,
        dayKey: todayKey,
        dayName: DAY_NAMES[todayIdx],
      };
    }
  }

  for (let offset = 1; offset <= 6; offset++) {
    const nextIdx = (todayIdx + offset) % 7;
    if (nextIdx === 0) continue;
    const nextKey = DAY_NAMES[nextIdx].toLowerCase();
    const nextClasses = getClassesForDay(schedule, nextKey);
    if (nextClasses.length > 0) {
      const first = nextClasses[0];
      const isTomorrow = offset === 1;
      return {
        ...first,
        dayKey: nextKey,
        dayName: DAY_NAMES[nextIdx],
        isNextDay: true,
        dayLabel: isTomorrow
          ? `Tomorrow — ${DAY_NAMES[nextIdx]}`
          : DAY_NAMES[nextIdx],
      };
    }
  }

  return null;
}

export function countWeeklyClasses(schedule: WeeklySchedule): number {
  return WEEKDAY_KEYS.reduce(
    (n, day) => n + (schedule[day]?.length || 0),
    0
  );
}
