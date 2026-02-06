import type { LogEntry } from "~/core/punch-log";

/**
 * Format time as "2:30pm"
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Format duration as "2h 30m" or "(active)" if no end time
 */
export function formatDuration(start: Date, end: Date | null): string {
  if (!end) {
    return "(active)";
  }

  const durationMs = end.getTime() - start.getTime();
  const totalMinutes = Math.floor(durationMs / (1000 * 60));

  if (totalMinutes < 1) {
    return "0m";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

/**
 * Format date as "Today" / "Yesterday" / "Jan 18"
 */
export function formatDate(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  if (targetDate.getTime() === today.getTime()) {
    return "Today";
  }

  if (targetDate.getTime() === yesterday.getTime()) {
    return "Yesterday";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Format log entries as a table
 */
export function formatLogTable(entries: LogEntry[]): string {
  if (entries.length === 0) {
    return "No entries found";
  }

  // Calculate column widths
  const idWidth = 8; // Show first 8 chars of ID
  const taskWidth = Math.max(4, ...entries.map((e) => e.taskName.length));
  const projectWidth = Math.max(
    7,
    ...entries.map((e) => (e.project || "").length),
  );
  const startWidth = Math.max(
    5,
    ...entries.map((e) => e.formattedStart.length),
  );
  const endWidth = Math.max(3, ...entries.map((e) => e.formattedEnd.length));
  const durationWidth = Math.max(
    8,
    ...entries.map((e) => e.formattedDuration.length),
  );

  // Build header
  const header = [
    "ID".padEnd(idWidth),
    "Task".padEnd(taskWidth),
    "Project".padEnd(projectWidth),
    "Start".padEnd(startWidth),
    "End".padEnd(endWidth),
    "Duration".padEnd(durationWidth),
  ].join(" | ");

  const separator = "-".repeat(header.length);

  // Build rows
  const rows = entries.map((entry) => {
    return [
      entry.id.substring(0, 8).padEnd(idWidth),
      entry.taskName.padEnd(taskWidth),
      (entry.project || "").padEnd(projectWidth),
      entry.formattedStart.padEnd(startWidth),
      entry.formattedEnd.padEnd(endWidth),
      entry.formattedDuration.padEnd(durationWidth),
    ].join(" | ");
  });

  return [header, separator, ...rows].join("\n");
}
