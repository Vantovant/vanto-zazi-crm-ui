/**
 * Parser for APLGO birthday table data.
 *
 * Supports pasted text from the APLGO back-office birthday report.
 * Columns typically: Level | ID Associate | First and Last Name | Date of Birth | When to congratulate
 *
 * Example rows:
 *   1    1129930    John Smith    03 May    After 20 days
 *   2    934517     Jane Doe      05 May    the day after tomorrow
 */

export interface BirthdayRow {
  level: string;
  associateId: string;
  fullName: string;
  firstName: string;
  birthDateText: string;
  birthDate: Date | null;
  whenToCongratulate: string;
  congratulateByDate: Date | null;
}

const MONTHS: Record<string, number> = {
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

function parseDateText(text: string): Date | null {
  if (!text) return null;
  const cleaned = text.trim().toLowerCase();

  // "03 May" or "May 03" or "3 May"
  const dmMatch = cleaned.match(/^(\d{1,2})\s+([a-z]+)$/);
  if (dmMatch) {
    const day = parseInt(dmMatch[1], 10);
    const month = MONTHS[dmMatch[2]];
    if (month !== undefined && day >= 1 && day <= 31) {
      const year = new Date().getFullYear();
      return new Date(year, month, day);
    }
  }

  const mdMatch = cleaned.match(/^([a-z]+)\s+(\d{1,2})$/);
  if (mdMatch) {
    const month = MONTHS[mdMatch[1]];
    const day = parseInt(mdMatch[2], 10);
    if (month !== undefined && day >= 1 && day <= 31) {
      const year = new Date().getFullYear();
      return new Date(year, month, day);
    }
  }

  // "03/05" or "03-05"
  const numMatch = cleaned.match(/^(\d{1,2})[/\-](\d{1,2})$/);
  if (numMatch) {
    const day = parseInt(numMatch[1], 10);
    const month = parseInt(numMatch[2], 10) - 1;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return new Date(new Date().getFullYear(), month, day);
    }
  }

  return null;
}

function parseCongratulateDate(text: string, birthDate: Date | null): Date | null {
  if (!text) return birthDate;
  const cleaned = text.trim().toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (cleaned === 'today' || cleaned === 'сегодня') return today;
  if (cleaned === 'tomorrow' || cleaned === 'the day after tomorrow') {
    const d = new Date(today);
    d.setDate(d.getDate() + (cleaned.includes('after') ? 2 : 1));
    return d;
  }

  // "After N days"
  const afterDays = cleaned.match(/after\s+(\d+)\s*day/);
  if (afterDays) {
    const d = new Date(today);
    d.setDate(d.getDate() + parseInt(afterDays[1], 10));
    return d;
  }

  // "Via 22 of the day" or "Via N"
  const viaMatch = cleaned.match(/via\s+(\d+)/);
  if (viaMatch) {
    const targetDay = parseInt(viaMatch[1], 10);
    const d = new Date(today.getFullYear(), today.getMonth(), targetDay);
    if (d < today) d.setMonth(d.getMonth() + 1);
    return d;
  }

  // "In N days"
  const inDays = cleaned.match(/in\s+(\d+)\s*day/);
  if (inDays) {
    const d = new Date(today);
    d.setDate(d.getDate() + parseInt(inDays[1], 10));
    return d;
  }

  return birthDate;
}

/**
 * Parse pasted birthday table text.
 * Handles tab-separated, pipe-separated, and multi-space-separated formats.
 */
export function parseBirthdayReport(text: string): BirthdayRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const rows: BirthdayRow[] = [];

  // Detect header row
  const headerPatterns = [/level/i, /id\s*associate/i, /name/i, /birth/i, /congratulat/i];

  for (const line of lines) {
    // Skip headers
    if (headerPatterns.filter(p => p.test(line)).length >= 2) continue;
    // Skip pure "Level N" section headers
    if (/^level\s+\d+$/i.test(line)) continue;

    // Split by tab, pipe, or 2+ spaces
    const parts = line.split(/\t|\|/).map(s => s.trim()).filter(Boolean);
    
    // If tab/pipe didn't produce enough columns, try multi-space
    const cells = parts.length >= 3 ? parts : line.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);

    if (cells.length < 3) continue;

    let level = '';
    let associateId = '';
    let fullName = '';
    let birthDateText = '';
    let whenToCongratulate = '';

    if (cells.length >= 5) {
      // Full 5-column format: Level | ID | Name | DOB | When
      level = cells[0];
      associateId = cells[1];
      fullName = cells[2];
      birthDateText = cells[3];
      whenToCongratulate = cells[4];
    } else if (cells.length === 4) {
      // 4 columns: could be ID | Name | DOB | When  OR  Level | ID | Name | DOB
      if (/^\d{4,}$/.test(cells[0])) {
        associateId = cells[0];
        fullName = cells[1];
        birthDateText = cells[2];
        whenToCongratulate = cells[3];
      } else {
        level = cells[0];
        associateId = cells[1];
        fullName = cells[2];
        birthDateText = cells[3];
      }
    } else if (cells.length === 3) {
      // 3 columns: ID | Name | DOB
      if (/^\d{4,}$/.test(cells[0])) {
        associateId = cells[0];
        fullName = cells[1];
        birthDateText = cells[2];
      } else {
        fullName = cells[0];
        birthDateText = cells[1];
        whenToCongratulate = cells[2];
      }
    }

    // Clean associate ID (remove non-numeric)
    associateId = associateId.replace(/[^\d]/g, '');

    if (!fullName) continue;

    const firstName = fullName.split(/\s+/)[0] || fullName;
    const birthDate = parseDateText(birthDateText);
    const congratulateByDate = parseCongratulateDate(whenToCongratulate, birthDate);

    rows.push({
      level: level.replace(/^level\s*/i, '').trim(),
      associateId,
      fullName,
      firstName,
      birthDateText,
      birthDate,
      whenToCongratulate,
      congratulateByDate,
    });
  }

  return rows;
}

/**
 * Parse a date string (YYYY-MM-DD) as LOCAL midnight to avoid UTC timezone shifts.
 */
function parseLocalDate(d: Date | string | null): Date | null {
  if (!d) return null;
  if (typeof d === 'string') {
    const parts = d.split('T')[0].split('-');
    if (parts.length === 3) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
  }
  return new Date(d);
}

/**
 * Classify a birthday relative to today (using local timezone).
 */
export function classifyBirthday(date: Date | string | null): 'today' | 'tomorrow' | 'this_week' | 'upcoming' | 'past' {
  if (!date) return 'upcoming';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseLocalDate(date as any);
  if (!target) return 'upcoming';
  target.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays >= 2 && diffDays <= 7) return 'this_week';
  if (diffDays < 0) return 'past';
  return 'upcoming';
}

export function daysUntil(date: Date | string | null): number | null {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseLocalDate(date as any);
  if (!target) return null;
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Get this year's calendar date for a birthday from its text ("17 April", "May 03", "03/05").
 * Always returns the date in the CURRENT calendar year (local timezone), so
 * classification is timezone-safe and independent of how birth_date was stored.
 */
export function birthdayThisYear(birthDateText: string | null | undefined): Date | null {
  if (!birthDateText) return null;
  const parsed = parseDateText(birthDateText);
  if (!parsed) return null;
  const today = new Date();
  return new Date(today.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/**
 * Classify a birthday entry using its birth_date_text (the source of truth for month+day).
 * Falls back to stored birth_date / congratulate_by_date when text is missing.
 * Overdue (past) only triggers if congratulate_by_date is in the past AND birthday hasn't been hit yet this year.
 */
export function classifyBirthdayEntry(entry: {
  birth_date_text?: string | null;
  birth_date?: string | null;
  congratulate_by_date?: string | null;
}): 'today' | 'tomorrow' | 'this_week' | 'upcoming' | 'past' {
  const calendarDate = birthdayThisYear(entry.birth_date_text || '') || parseLocalDate(entry.birth_date || null);
  if (!calendarDate) {
    return classifyBirthday(entry.congratulate_by_date || entry.birth_date || null);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  calendarDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round((calendarDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays >= 2 && diffDays <= 7) return 'this_week';
  if (diffDays < 0) return 'past';
  return 'upcoming';
}

export function daysUntilEntry(entry: {
  birth_date_text?: string | null;
  birth_date?: string | null;
}): number | null {
  const d = birthdayThisYear(entry.birth_date_text || '') || parseLocalDate(entry.birth_date || null);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
