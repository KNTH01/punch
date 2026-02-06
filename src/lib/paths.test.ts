import { test, expect, describe, afterEach } from "bun:test";
import { getDataDir } from "./paths";

describe("getDataDir", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("linux", () => {
    test("uses XDG_DATA_HOME when set", () => {
      process.env.XDG_DATA_HOME = "/custom/data";

      const result = getDataDir("linux");

      expect(result).toBe("/custom/data/punch");
    });

    test("falls back to ~/.local/share when XDG_DATA_HOME is not set", () => {
      delete process.env.XDG_DATA_HOME;
      process.env.HOME = "/home/testuser";

      const result = getDataDir("linux");

      expect(result).toBe("/home/testuser/.local/share/punch");
    });
  });

  describe("darwin", () => {
    test("uses ~/Library/Application Support by default", () => {
      delete process.env.XDG_DATA_HOME;
      process.env.HOME = "/Users/testuser";

      const result = getDataDir("darwin");

      expect(result).toBe("/Users/testuser/Library/Application Support/punch");
    });

    test("respects XDG_DATA_HOME when set", () => {
      process.env.XDG_DATA_HOME = "/custom/data";

      const result = getDataDir("darwin");

      expect(result).toBe("/custom/data/punch");
    });
  });

  describe("win32", () => {
    // Note: path.join uses OS-native separators, so on Linux these tests
    // produce forward slashes. On an actual Windows binary, backslashes
    // are used. We test the logic (correct env vars, correct segments).

    test("uses APPDATA when set", () => {
      process.env.APPDATA = "C:/Users/testuser/AppData/Roaming";

      const result = getDataDir("win32");

      expect(result).toBe("C:/Users/testuser/AppData/Roaming/punch");
    });

    test("falls back to USERPROFILE/AppData/Roaming when APPDATA is not set", () => {
      delete process.env.APPDATA;
      process.env.USERPROFILE = "C:/Users/testuser";

      const result = getDataDir("win32");

      expect(result).toBe("C:/Users/testuser/AppData/Roaming/punch");
    });
  });

  describe("defaults", () => {
    test("uses current platform when no argument given", () => {
      const result = getDataDir();

      expect(result).toContain("punch");
    });
  });
});
