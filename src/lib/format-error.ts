import { Cause } from "effect";
import { formatTime } from "./format";

type ExitCode = 1 | 2;
type CliError = [message: string, code: ExitCode];

const MAX_AMBIGUOUS_IDS = 5;

/**
 * Format an Effect Cause into a user-friendly CLI error message.
 * Returns [message, exitCode] tuple.
 *
 * Exit codes:
 * - 1: User error (bad input, business logic failure)
 * - 2: System error (DB failure, unexpected errors)
 */
export function formatCliError(cause: Cause.Cause<unknown>): CliError {
  // Try to extract the primary failure
  const failure = Cause.failureOption(cause);

  if (failure._tag === "Some") {
    return formatKnownError(failure.value);
  }

  // Handle defects (Die) - unexpected errors
  const defects = Array.from(Cause.defects(cause));
  if (defects.length > 0) {
    return [`Unexpected error: ${String(defects[0])}`, 2];
  }

  // Fallback for interrupts or complex causes
  return [`Operation failed: ${Cause.pretty(cause)}`, 2];
}

function formatKnownError(error: unknown): CliError {
  // Type guard for tagged errors
  if (typeof error === "object" && error !== null && "_tag" in error) {
    const tagged = error as Record<string, unknown>;
    const tag = tagged._tag as string;

    switch (tag) {
      // Core errors
      case "TaskAlreadyRunningError": {
        const taskName = tagged.taskName as string;
        const startTime = tagged.startTime as Date;
        return [
          `Task already running: "${taskName}" started at ${formatTime(startTime)}`,
          1,
        ];
      }

      case "NoActiveTask": {
        return ["No active task to stop", 1];
      }

      case "InvalidEndTimeError": {
        const startTime = tagged.startTime as Date;
        return [
          `End time must be after start time (started at ${formatTime(startTime)})`,
          1,
        ];
      }

      // Edit errors
      case "EntryNotFoundError": {
        const identifier = tagged.identifier as string;
        return [`Entry not found: ${identifier}`, 1];
      }

      case "AmbiguousIdPrefixError": {
        const prefix = tagged.prefix as string;
        const matches = tagged.matches as string[];
        const truncated = matches.slice(0, MAX_AMBIGUOUS_IDS);
        const remaining = matches.length - truncated.length;

        let idList = truncated.map((id) => `  ${id.slice(0, 12)}...`).join("\n");
        if (remaining > 0) {
          idList += `\n  ... and ${remaining} more`;
        }

        return [
          `Ambiguous ID '${prefix}' matches ${matches.length} entries:\n${idList}\n\nUse a longer prefix`,
          1,
        ];
      }

      case "NoEntriesToEditError": {
        return ["No entries to edit", 1];
      }

      // Log errors
      case "LogOptionsValidationError": {
        const filters = tagged.filters as string[];
        return [`Only one time filter allowed (got: ${filters.join(", ")})`, 1];
      }

      // DB errors
      case "DBError": {
        const cause = tagged.cause;
        return [`Database error: ${String(cause)}`, 2];
      }

      case "DBUpdateFailedError": {
        const id = tagged.id as string;
        return [`Database update failed for entry: ${id}`, 2];
      }

      // Unknown tagged error
      default: {
        return [`${tag}: ${JSON.stringify(tagged)}`, 2];
      }
    }
  }

  // Untagged error
  if (error instanceof Error) {
    return [error.message, 2];
  }

  return [`Unexpected error: ${String(error)}`, 2];
}
