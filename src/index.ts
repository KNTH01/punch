import { sql } from "drizzle-orm";
import { db } from "./db";

console.log("Hello via Bun!");

const query = sql`select "hello world" as text`;
const result = db.get<{ text: string }>(query);

console.log(result);

