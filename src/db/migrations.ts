export interface Migration {
  readonly id: string;
  readonly sql: string;
}

/** Inline migration definitions — embedded in the compiled binary */
export const migrations: ReadonlyArray<Migration> = [
  {
    id: "0000_initial",
    sql: `CREATE TABLE IF NOT EXISTS \`entries\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`task_name\` text NOT NULL,
      \`project\` text,
      \`start_time\` integer NOT NULL,
      \`end_time\` integer,
      \`last_activity\` integer,
      \`created_at\` integer NOT NULL,
      \`updated_at\` integer NOT NULL
    );`,
  },
];
