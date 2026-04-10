/**
 * Client-side parser for APLGO monthly activity purchase reports.
 *
 * Input format example:
 *   Level 1
 *   1129930(6): 2520.00 R
 *   934517: 2385.00 R
 *
 * Rules:
 * - "Level N" header sets the displayed level for subsequent rows
 * - Number before colon = user ID (APLGoID)
 * - Optional (N) after user ID = actual level override
 * - Amount after colon = ZAR purchase amount
 */

export interface MonthlyActivityRow {
  userId: string;          // APLGO user ID
  displayedLevel: string;  // section level header
  actualLevel: string;     // bracketed override or same as displayed
  amount: number;          // ZAR amount
  currency: string;
  purchaseType: 'monthly_activity';
}

export function parseMonthlyActivityReport(text: string): MonthlyActivityRow[] {
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const rows: MonthlyActivityRow[] = [];
  let currentLevel = '';

  const levelHeaderRe = /^level\s+(\d+)$/i;
  // Match: 1129930(6): 2,520.00 R  or  934517: 2385.00 R
  const entryRe = /(\d+)(?:\((\d+)\))?\s*:\s*([\d,.]+)\s*R/gi;

  for (const rawLine of rawLines) {
    const headerMatch = rawLine.match(levelHeaderRe);
    if (headerMatch) {
      currentLevel = headerMatch[1];
      continue;
    }

    // Extract all entries from the line (handles comma-separated entries on one line)
    let match: RegExpExecArray | null;
    entryRe.lastIndex = 0;
    while ((match = entryRe.exec(rawLine)) !== null) {
      const userId = match[1];
      const bracketLevel = match[2] || '';
      const amount = parseFloat(match[3].replace(/,/g, ''));

      rows.push({
        userId,
        displayedLevel: currentLevel || '?',
        actualLevel: bracketLevel || currentLevel || '?',
        amount: isNaN(amount) ? 0 : amount,
        currency: 'ZAR',
        purchaseType: 'monthly_activity',
      });
    }
  }

  return rows;
}
