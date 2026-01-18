import { test, expect, describe } from "bun:test";
import { formatTime, formatDuration, formatDate, formatLogTable, type LogEntry } from "./format";

describe("formatTime", () => {
  test("formats time in 12-hour format with am/pm", () => {
    const date = new Date("2026-01-18T14:30:00");
    expect(formatTime(date)).toMatch(/2:30\s*PM/i);
  });

  test("formats morning time", () => {
    const date = new Date("2026-01-18T09:15:00");
    expect(formatTime(date)).toMatch(/9:15\s*AM/i);
  });

  test("formats midnight", () => {
    const date = new Date("2026-01-18T00:00:00");
    expect(formatTime(date)).toMatch(/12:00\s*AM/i);
  });
});

describe("formatDuration", () => {
  test("returns (active) when end time is null", () => {
    const start = new Date("2026-01-18T10:00:00");
    expect(formatDuration(start, null)).toBe("(active)");
  });

  test("formats duration less than 1 hour as minutes only", () => {
    const start = new Date("2026-01-18T10:00:00");
    const end = new Date("2026-01-18T10:45:00");
    expect(formatDuration(start, end)).toBe("45m");
  });

  test("formats exact hours without minutes", () => {
    const start = new Date("2026-01-18T10:00:00");
    const end = new Date("2026-01-18T12:00:00");
    expect(formatDuration(start, end)).toBe("2h");
  });

  test("formats hours and minutes", () => {
    const start = new Date("2026-01-18T10:00:00");
    const end = new Date("2026-01-18T12:30:00");
    expect(formatDuration(start, end)).toBe("2h 30m");
  });

  test("formats duration less than 1 minute as 0m", () => {
    const start = new Date("2026-01-18T10:00:00");
    const end = new Date("2026-01-18T10:00:30");
    expect(formatDuration(start, end)).toBe("0m");
  });

  test("formats single minute", () => {
    const start = new Date("2026-01-18T10:00:00");
    const end = new Date("2026-01-18T10:01:00");
    expect(formatDuration(start, end)).toBe("1m");
  });
});

describe("formatDate", () => {
  test("returns 'Today' for current date", () => {
    const today = new Date();
    expect(formatDate(today)).toBe("Today");
  });

  test("returns 'Yesterday' for yesterday's date", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatDate(yesterday)).toBe("Yesterday");
  });

  test("returns month and day for older dates", () => {
    const oldDate = new Date("2026-01-15T10:00:00");
    const formatted = formatDate(oldDate);
    expect(formatted).toMatch(/Jan 15/);
  });

  test("handles different times on same day as Today", () => {
    const morning = new Date();
    morning.setHours(8, 0, 0, 0);
    expect(formatDate(morning)).toBe("Today");
  });
});

describe("formatLogTable", () => {
  test("returns 'No entries found' for empty array", () => {
    expect(formatLogTable([])).toBe("No entries found");
  });

  test("formats single entry with all fields", () => {
    const entries: LogEntry[] = [
      {
        id: "1",
        taskName: "Fix bug",
        project: "acme-app",
        startTime: new Date("2026-01-18T10:00:00"),
        endTime: new Date("2026-01-18T11:00:00"),
        duration: 3600000,
        formattedDuration: "1h",
        formattedStart: "10:00 AM",
        formattedEnd: "11:00 AM",
      },
    ];

    const result = formatLogTable(entries);
    expect(result).toContain("ID");
    expect(result).toContain("Task");
    expect(result).toContain("Project");
    expect(result).toContain("Start");
    expect(result).toContain("End");
    expect(result).toContain("Duration");
    expect(result).toContain("Fix bug");
    expect(result).toContain("acme-app");
    expect(result).toContain("10:00 AM");
    expect(result).toContain("11:00 AM");
    expect(result).toContain("1h");
  });

  test("handles active entries with no end time", () => {
    const entries: LogEntry[] = [
      {
        id: "1",
        taskName: "Active task",
        project: null,
        startTime: new Date("2026-01-18T10:00:00"),
        endTime: null,
        duration: null,
        formattedDuration: "(active)",
        formattedStart: "10:00 AM",
        formattedEnd: "",
      },
    ];

    const result = formatLogTable(entries);
    expect(result).toContain("Active task");
    expect(result).toContain("(active)");
  });

  test("handles entries without project", () => {
    const entries: LogEntry[] = [
      {
        id: "1",
        taskName: "Personal task",
        project: null,
        startTime: new Date("2026-01-18T10:00:00"),
        endTime: new Date("2026-01-18T11:00:00"),
        duration: 3600000,
        formattedDuration: "1h",
        formattedStart: "10:00 AM",
        formattedEnd: "11:00 AM",
      },
    ];

    const result = formatLogTable(entries);
    expect(result).toContain("Personal task");
  });

  test("formats multiple entries", () => {
    const entries: LogEntry[] = [
      {
        id: "1",
        taskName: "First task",
        project: "project-a",
        startTime: new Date("2026-01-18T09:00:00"),
        endTime: new Date("2026-01-18T10:00:00"),
        duration: 3600000,
        formattedDuration: "1h",
        formattedStart: "9:00 AM",
        formattedEnd: "10:00 AM",
      },
      {
        id: "2",
        taskName: "Second task",
        project: "project-b",
        startTime: new Date("2026-01-18T10:30:00"),
        endTime: new Date("2026-01-18T11:45:00"),
        duration: 4500000,
        formattedDuration: "1h 15m",
        formattedStart: "10:30 AM",
        formattedEnd: "11:45 AM",
      },
    ];

    const result = formatLogTable(entries);
    expect(result).toContain("First task");
    expect(result).toContain("Second task");
    expect(result).toContain("project-a");
    expect(result).toContain("project-b");
  });

  test("adjusts column widths based on content", () => {
    const entries: LogEntry[] = [
      {
        id: "1",
        taskName: "Very long task name that should expand the column width",
        project: "short",
        startTime: new Date("2026-01-18T10:00:00"),
        endTime: new Date("2026-01-18T11:00:00"),
        duration: 3600000,
        formattedDuration: "1h",
        formattedStart: "10:00 AM",
        formattedEnd: "11:00 AM",
      },
    ];

    const result = formatLogTable(entries);
    expect(result).toContain("Very long task name that should expand the column width");
  });
});
