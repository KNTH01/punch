export function parseTime(timeStr: string, baseDate?: Date): Date {
  const base = baseDate || new Date();

  // Check if it contains ISO datetime pattern (YYYY-MM-DD)
  if (/\d{4}-\d{2}-\d{2}/.test(timeStr)) {
    const match = timeStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
    if (!match) {
      throw new Error(`Invalid time format: ${timeStr}`);
    }
    const [, year, month, day, hours, minutes] = match;
    if (!year || !month || !day || !hours || !minutes) {
      throw new Error(`Invalid time format: ${timeStr}`);
    }
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes),
      0,
      0
    );
  }

  // Try HH:MM format
  const hhmmMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmmMatch) {
    const [, hours, minutes] = hhmmMatch;
    if (!hours || !minutes) {
      throw new Error(`Invalid time format: ${timeStr}`);
    }
    const result = new Date(base);
    result.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return result;
  }

  // Try 12-hour format with meridiem
  const meridiemMatch = timeStr.match(/^(\d{1,2})\s*(am|pm)$/i);
  if (meridiemMatch) {
    const [, hourStr, meridiem] = meridiemMatch;
    if (!hourStr || !meridiem) {
      throw new Error(`Invalid time format: ${timeStr}`);
    }
    let hour = parseInt(hourStr);
    const isPM = meridiem.toLowerCase() === "pm";

    if (isPM && hour !== 12) {
      hour += 12;
    } else if (!isPM && hour === 12) {
      hour = 0;
    }

    const result = new Date(base);
    result.setHours(hour, 0, 0, 0);
    return result;
  }

  // Try hour-only format (14h)
  const hourMatch = timeStr.match(/^(\d{1,2})h$/);
  if (hourMatch) {
    const [, hours] = hourMatch;
    if (!hours) {
      throw new Error(`Invalid time format: ${timeStr}`);
    }
    const result = new Date(base);
    result.setHours(parseInt(hours), 0, 0, 0);
    return result;
  }

  throw new Error(`Invalid time format: ${timeStr}`);
}
