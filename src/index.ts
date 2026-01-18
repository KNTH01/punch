import { db } from "./db";
import { punchIn } from "./commands/in";
import { punchLog } from "./commands/log";
import { punchOut } from "./commands/out";
import { formatLogTable } from "./lib/format";

const HELP_TEXT = `
Usage: punch <command> [options]

Commands:
  in, start <task>         Start tracking time
    -p, --project <name>   Project name

  out, stop                Stop tracking
    -a, --at <HH:MM>       Custom end time

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
        const result = await punchIn(db, taskName, { project });
        if (!result) throw new Error("Failed to start task");

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

        const result = await punchOut(db, { at });
        if (!result) throw new Error("Failed to stop task");

        // Calculate duration in minutes
        const durationMs = result.endTime!.getTime() - result.startTime.getTime();
        const durationMinutes = Math.floor(durationMs / 1000 / 60);
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

        console.log(`✓ Stopped '${result.taskName}' - worked ${durationStr}`);
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
