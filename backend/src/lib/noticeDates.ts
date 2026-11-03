const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};
const MONTH_PATTERN = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

function toIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseDateToIso(input?: string | null): string | null {
  if (!input) return null;
  const value = input.trim().replace(/^[,.\s]+|[,.\s]+$/g, '');
  if (!value) return null;

  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // Campus notices use day/month/year (for example, 04/11/2026).
  const numeric = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (numeric) {
    let year = Number(numeric[3]);
    if (year < 100) year += 2000;
    return toIsoDate(year, Number(numeric[2]), Number(numeric[1]));
  }

  const monthFirst = value.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/i);
  const dayFirst = value.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:,?\s+(\d{4}))?$/i);
  const textual = monthFirst || dayFirst;
  if (textual) {
    const monthName = (monthFirst ? textual[1] : textual[2]).toLowerCase();
    const month = MONTHS[monthName];
    if (!month) return null;
    const day = Number(monthFirst ? textual[2] : textual[1]);
    const year = Number(textual[3] || new Date().getFullYear());
    return toIsoDate(year, month, day);
  }

  return null;
}

export function extractDeadlineDate(text: string): string | null {
  if (!text) return null;
  const normalizedText = text.replace(/\s+/g, ' ');

  const datePattern = new RegExp(
    `\\b(\\d{4}-\\d{1,2}-\\d{1,2}|\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|(?:${MONTH_PATTERN})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_PATTERN})(?:\\s+\\d{4})?)\\b`,
    'gi',
  );
  const strongContext =
    /\b(?:deadline|last\s+date|due\s+date|submission|submit|registration|register|payment|pay\s+by)\b[^.!?\r\n]{0,100}$/i;
  const eventContext =
    /\b(?:event|exam(?:ination)?|test|holidays?|vacations?|starts?\s+from|begins?)\b[^.!?\r\n]{0,100}$/i;

  let eventDate: string | null = null;
  for (const match of normalizedText.matchAll(datePattern)) {
    const dateText = match[0];
    const index = match.index ?? 0;
    const context = normalizedText.slice(Math.max(0, index - 120), index);
    const isoDate = parseDateToIso(dateText);
    if (!isoDate) continue;

    if (strongContext.test(context)) return isoDate;
    if (!eventDate && eventContext.test(context)) eventDate = isoDate;
  }

  return eventDate;
}
