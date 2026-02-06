import { test, expect, describe } from "bun:test";
import { Cause, Effect } from "effect";
import { DBTest, withDB } from "~/db/test-db";
import { DB } from "~/db";
import { punchIn } from "~/core/punch-in";
import { punchOut } from "~/core/punch-out";
import { entries } from "~/db/schema";
import { InvalidEndTimeError, NoActiveTask } from "~/core/errors";

describe("punchOut", () => {
  const runTest = <A, E>(program: Effect.Effect<A, E, DB>) =>
    Effect.runPromise(program.pipe(Effect.provide(DBTest)));

  const runTestExit = <A, E>(program: Effect.Effect<A, E, DB>) =>
    Effect.runPromiseExit(program.pipe(Effect.provide(DBTest)));

  test("sets end time on active task", async () => {
    const entry = await runTest(
      punchIn("Fix bug").pipe(
        Effect.andThen(() => Bun.sleep(1)),
        Effect.andThen(() => punchOut()),
      ),
    );

    expect(entry.endTime).toBeInstanceOf(Date);
    expect(entry.endTime!.getTime()).toBeGreaterThan(entry.startTime.getTime());
  });

  test("fails with NoActiveTask if no active task", async () => {
    const exit = await runTestExit(punchOut());

    expect(exit._tag).toBe("Failure");

    if (exit._tag === "Failure") {
      const error = Cause.failureOption(exit.cause);

      expect(error._tag).toBe("Some");

      if (error._tag === "Some") {
        expect(error.value).toBeInstanceOf(NoActiveTask);
      }
    }
  });

  test("accepts custom end time with --at option", async () => {
    // Use a full datetime that's definitely in the future
    const futureTime = new Date();
    futureTime.setMinutes(futureTime.getMinutes() + 5);
    const atTime = `${futureTime.getFullYear()}-${String(futureTime.getMonth() + 1).padStart(2, "0")}-${String(futureTime.getDate()).padStart(2, "0")} ${String(futureTime.getHours()).padStart(2, "0")}:${String(futureTime.getMinutes()).padStart(2, "0")}`;

    const entry = await runTest(
      punchIn("Fix bug").pipe(Effect.andThen(() => punchOut({ at: atTime }))),
    );

    expect(entry.endTime?.getHours()).toBe(futureTime.getHours());
    expect(entry.endTime?.getMinutes()).toBe(futureTime.getMinutes());
  });

  test("fails with InvalidEndTimeError when end time before start time", async () => {
    // Set up: startTime in future (hour + 2), try to end at hour + 1 (before start)
    const now = new Date();
    const futureHour = now.getHours() + 2;
    const earlierHour = now.getHours() + 1;
    const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), futureHour, 0, 0);

    const program = withDB((db) => {
      db.insert(entries).values({
        taskName: "Fix bug",
        startTime,
        endTime: null,
      }).run();
    }).pipe(Effect.andThen(() => punchOut({ at: `${earlierHour}:00` })));

    const exit = await runTestExit(program);

    expect(exit._tag).toBe("Failure");

    if (exit._tag === "Failure") {
      const error = Cause.failureOption(exit.cause);

      expect(error._tag).toBe("Some");

      if (error._tag === "Some") {
        expect(error.value).toBeInstanceOf(InvalidEndTimeError);
      }
    }
  });
});
