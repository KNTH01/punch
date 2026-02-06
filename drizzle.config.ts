import { join } from "path";
import { defineConfig } from "drizzle-kit";
import { getDataDir } from "./src/lib/paths";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: `file://${join(getDataDir(), "punch.db")}`,
  },
});
