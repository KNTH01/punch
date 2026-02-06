import { Effect } from "effect";
import { runMigrations } from "./src/db";

Effect.runSync(runMigrations);

console.log("Migration successful");
