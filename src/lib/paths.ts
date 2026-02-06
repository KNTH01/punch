import { join } from "path";

const APP_NAME = "punch";

type Platform = "linux" | "darwin" | "win32";

/** Returns the platform-appropriate data directory for punch */
export function getDataDir(platform?: Platform): string {
  const p = platform ?? (process.platform as Platform);

  if (p === "win32") {
    const appData = process.env.APPDATA;
    if (appData) return join(appData, APP_NAME);
    const userProfile = process.env.USERPROFILE ?? "";
    return join(userProfile, "AppData", "Roaming", APP_NAME);
  }

  if (p === "darwin") {
    // Respect XDG_DATA_HOME for power users, otherwise use macOS convention
    if (process.env.XDG_DATA_HOME) {
      return join(process.env.XDG_DATA_HOME, APP_NAME);
    }
    const home = process.env.HOME ?? "";
    return join(home, "Library", "Application Support", APP_NAME);
  }

  // Linux / other Unix — XDG Base Directory Specification
  const home = process.env.HOME ?? "";
  const xdgDataHome = process.env.XDG_DATA_HOME ?? join(home, ".local", "share");
  return join(xdgDataHome, APP_NAME);
}
