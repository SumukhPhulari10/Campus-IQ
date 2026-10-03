/**
 * Robustly parses informal/formal date strings used in campus notices.
 * Handles: "2nd October", "Oct 04, 2026", "November 13, 2026",
 *          "2026-10-04", "4/10/2026", "Oct 4", "4 Oct", etc.
 *
 * Returns a Date object or null if parsing fails.
 */
export function parseFlexibleDate(input?: string | null): Date | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;

  const currentYear = new Date().getFullYear();

  // 1. Standard ISO / native parseable (e.g. "2026-10-04", "Oct 04, 2026")
  const d1 = new Date(s);
  if (!isNaN(d1.getTime())) {
    // Sanity: discard clearly wrong years
    const y = d1.getFullYear();
    if (y >= 2020 && y <= 2035) return d1;
  }

  const MONTH_MAP: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  };

  /**
   * Helper — builds a Date with correct local midnight, accepting the year to
   * use (defaults to currentYear when the string has no year).
   */
  const make = (day: number, month: number, year: number): Date | null => {
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    return new Date(year, month, day);
  };

  const lower = s.toLowerCase();

  // 2. "2nd October [2026]" or "October 2nd [2026]"
  const withOrdinal = lower.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:[,\s]+(\d{4}))?/
  );
  if (withOrdinal) {
    const day = parseInt(withOrdinal[1], 10);
    const monthStr = withOrdinal[2];
    const year = withOrdinal[3] ? parseInt(withOrdinal[3], 10) : currentYear;
    const month = MONTH_MAP[monthStr];
    if (month !== undefined) return make(day, month, year);
  }

  // 3. "October 2 [2026]" or "October 2nd [2026]"
  const monthFirst = lower.match(
    /([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:[,\s]+(\d{4}))?/
  );
  if (monthFirst) {
    const monthStr = monthFirst[1];
    const day = parseInt(monthFirst[2], 10);
    const year = monthFirst[3] ? parseInt(monthFirst[3], 10) : currentYear;
    const month = MONTH_MAP[monthStr];
    if (month !== undefined) return make(day, month, year);
  }

  // 4. dd/mm/yyyy or dd-mm-yyyy
  const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    return make(parseInt(dmyMatch[1], 10), parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[3], 10));
  }

  return null;
}

/**
 * Calculates how many full calendar days remain until `dateStr`.
 * Negative means past, 0 means today.
 * Returns null if the date cannot be parsed.
 */
export function daysUntil(dateStr?: string | null): number | null {
  const target = parseFlexibleDate(dateStr);
  if (!target) return null;
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / 86400000);
}

/**
 * Returns true if the date has already passed (strictly before today's midnight).
 */
export function isDatePast(dateStr?: string | null): boolean {
  const days = daysUntil(dateStr);
  if (days === null) return false; // unparseable → don't mark as past
  return days < 0;
}
