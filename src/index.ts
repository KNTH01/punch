import { Effect } from "effect";
import { db } from "./db";
import { punchIn } from "./core/punch-in";
import {
  InvalidEndTimeError,
  NoActiveTask,
  TaskAlreadyRunningError,
} from "./core/errors";
import { punchLog } from "./commands/log";
import { punchOut } from "~/core/punch-out";
import { punchEdit } from "./commands/edit";
import { formatLogTable } from "./lib/format";

const HELP_TEXT = `
Usage: punch <command> [options]

Commands:
  in, start <task>         Start tracking time
    -p, --project <name>   Project name

  out, stop                Stop tracking
    -a, --at <HH:MM>       Custom end time

  edit [<id>] [task]       Edit an entry
    -p, --project <name>   Update project
    --start <time>         Update start time (HH:MM, 2pm, YYYY-MM-DD HH:MM)
    --end <time>           Update end time (HH:MM, 2pm, YYYY-MM-DD HH:MM)

  log                      List time entries
    --today                Today's entries
    --week                 This week's entries
    --month                This month's entries
    -p, --project <name>   Filter by project

  status                   Show active task (coming soon)
  summary                  Aggregate reports (coming soon)
  cancel                   Delete active task (coming soon)
`;

function parseArgs(args: string[]) {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      // Check if next arg is a value or another flag
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("-")) {
        flags[key] = nextArg;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      // Check if next arg is a value or another flag
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("-")) {
        flags[key] = nextArg;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { flags, positional };
}

async function main() {
  const command = process.argv[2];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  try {
    switch (command) {
      case "in":
      case "start": {
        const { flags, positional } = parseArgs(process.argv.slice(3));
        const taskName = positional[0];

        if (!taskName) {
          console.error("Error: Task name is required");
          console.log("\nUsage: punch in <task> [-p <project>]");
          process.exit(1);
        }

        const project = (flags.p || flags.project) as string | undefined;
        const program = punchIn(db, taskName, { project });
        const exit = await Effect.runPromiseExit(program);

        if (exit._tag === "Failure") {
          // Extract typed error from Cause
          const cause = exit.cause;
          if (cause._tag === "Fail" && cause.error instanceof TaskAlreadyRunningError) {
            const err = cause.error;
            const time = err.startTime.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            });
            console.error(`Error: Task already running: "${err.taskName}" started at ${time}`);
          } else {
            console.error("Error: Failed to start task");
          }
          process.exit(1);
        }

        const result = exit.value;
        const time = result.startTime.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
        const projectPart = result.project ? ` on ${result.project}` : "";
        console.log(`✓ Started '${result.taskName}'${projectPart} at ${time}`);
        break;
      }

      case "out":
      case "stop": {
        const { flags } = parseArgs(process.argv.slice(3));
        const at = (flags.a || flags.at) as string | undefined;

        const exit = await Effect.runPromiseExit(punchOut(db, { at }));

        if (exit._tag === "Failure") {
          const cause = exit.cause;
          if (cause._tag === "Fail") {
            if (cause.error instanceof NoActiveTask) {
              console.error("Error: No active task to stop");
            } else if (cause.error instanceof InvalidEndTimeError) {
              const timeStr = cause.error.startTime.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              });
              console.error(`Error: End time must be after start time (${timeStr})`);
            } else {
              console.error("Error: Failed to stop task");
            }
          } else {
            console.error("Error: Failed to stop task");
          }
          process.exit(1);
        }

        const result = exit.value;
        // Calculate duration in minutes
        const durationMs = result.endTime!.getTime() - result.startTime.getTime();
        const durationMinutes = Math.floor(durationMs / 1000 / 60);
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

        console.log(`✓ Stopped '${result.taskName}' - worked ${durationStr}`);
        break;
      }

      case "edit": {
        const rawArgs = process.argv.slice(3);
        const { flags, positional } = parseArgs(rawArgs);

        // Handle position references (-N) which parseArgs treats as flags
        let idOrPosition: string | undefined;
        let taskName: string | undefined;

        // Check if first arg is a position reference (-1, -2, etc.)
        const firstArg = rawArgs[0];
        if (firstArg && /^-\d+$/.test(firstArg)) {
          idOrPosition = firstArg;
          // Find next non-flag arg as task name
          for (let i = 1; i < rawArgs.length; i++) {
            const arg = rawArgs[i];
            if (arg && !arg.startsWith("--")) {
              // Skip if it's a value for a flag
              const prevArg = rawArgs[i - 1];
              if (!prevArg || !prevArg.startsWith("-") || /^-\d+$/.test(prevArg)) {
                taskName = arg;
                break;
              }
            }
          }
        } else if (positional.length === 1) {
          const arg = positional[0];
          if (!arg) break;
          if (/^[0-9a-f]+$/i.test(arg)) {
            idOrPosition = arg;
          } else {
            taskName = arg;
          }
        } else if (positional.length === 2) {
          idOrPosition = positional[0];
          taskName = positional[1];
        } else if (positional.length > 2) {
          throw new Error("Too many arguments. Usage: punch edit [<id-or-position>] [task-name] [--flags]");
        }

        const options: {
          idOrPosition?: string;
          taskName?: string;
          project?: string;
          start?: string;
          end?: string;
        } = {};

        if (idOrPosition) options.idOrPosition = idOrPosition;
        if (taskName) options.taskName = taskName;
        if (flags.project || flags.p) options.project = (flags.project || flags.p) as string;
        if (flags.start) options.start = flags.start as string;
        if (flags.end) options.end = flags.end as string;

        const result = await punchEdit(db, options);

        const time = result.startTime.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
        const projectPart = result.project ? ` on ${result.project}` : "";
        console.log(`✓ Updated '${result.taskName}'${projectPart} starting at ${time}`);
        break;
      }

      case "log": {
        const { flags } = parseArgs(process.argv.slice(3));

        const filters: {
          today?: boolean;
          week?: boolean;
          month?: boolean;
          project?: string;
        } = {};

        if (flags.today) filters.today = true;
        if (flags.week) filters.week = true;
        if (flags.month) filters.month = true;

        const project = (flags.p || flags.project) as string | undefined;
        if (project) filters.project = project;

        const entries = await punchLog(db, filters);
        console.log(formatLogTable(entries));
        break;
      }

      case "status":
      case "summary":
      case "cancel":
        console.log(`Command '${command}' coming soon`);
        break;

      default:
        console.error(`Error: Unknown command '${command}'`);
        console.log(HELP_TEXT);
        process.exit(1);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error(`Error: ${String(error)}`);
    }
    process.exit(1);
  }
}

await main();
