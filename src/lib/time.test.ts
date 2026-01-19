import { test, expect, describe } from "bun:test";
import { parseTime } from "./time";

describe("parseTime", () => {
  test("parses HH:MM format on current date", () => {
    const result = parseTime("14:30");

    expect(result).toBeInstanceOf(Date);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
    expect(result.getSeconds()).toBe(0);
  });

  test("parses 12-hour format with pm", () => {
    const result = parseTime("2pm");

    expect(result).toBeInstanceOf(Date);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(0);
  });

  test("parses 12-hour format with am", () => {
    const result = parseTime("9am");

    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
  });

  test("parses 12pm as noon", () => {
    const result = parseTime("12pm");

    expect(result.getHours()).toBe(12);
  });

  test("parses 12am as midnight", () => {
    const result = parseTime("12am");

    expect(result.getHours()).toBe(0);
  });

  test("parses hour-only format", () => {
    const result = parseTime("14h");

    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(0);
  });

  test("parses ISO datetime format", () => {
    const result = parseTime("2026-01-18 14:30");

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0); // January is 0
    expect(result.getDate()).toBe(18);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
  });

  test("applies time to baseDate when provided", () => {
    const baseDate = new Date(2025, 5, 15); // June 15, 2025
    const result = parseTime("14:30", baseDate);

    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
  });

  test("throws error for invalid format", () => {
    expect(() => parseTime("invalid")).toThrow("Invalid time format");
  });
});
