import { test, expect, describe } from "bun:test";
import { Cause, Effect } from "effect";
import { DBTest } from "~/db/test-db";
import { punchIn } from "./punch-in";
import { TaskAlreadyRunningError } from "./errors";
import { DB } from "~/db";

describe("punchIn (Effect)", () => {
  const runTest = <A, E>(program: Effect.Effect<A, E, DB>) =>
    Effect.runPromise(program.pipe(Effect.provide(DBTest)));

  const runTestExit = <A, E>(program: Effect.Effect<A, E, DB>) =>
    Effect.runPromiseExit(program.pipe(Effect.provide(DBTest)));

  test("creates entry when no active task", async () => {
    const entry = await runTest(punchIn("coding"));

    expect(entry.taskName).toBe("coding");
    expect(entry.startTime).toBeInstanceOf(Date);
    expect(entry.endTime).toBeNull();
  });

  test("fails with TaskAlreadyRunningError when task is active", async () => {
    const exit = await runTestExit(
      punchIn("task1").pipe(Effect.andThen(() => punchIn("task2"))),
    );

    expect(exit._tag).toBe("Failure");

    if (exit._tag === "Failure") {
      const error = Cause.failureOption(exit.cause);

      expect(error._tag).toBe("Some");

      if (error._tag === "Some") {
        expect(error.value).toBeInstanceOf(TaskAlreadyRunningError);
        expect(error.value.taskName).toBe("task1");
      }
    }
  });

  test("creates entry with project when provided", async () => {
    const entry = await runTest(punchIn("coding", { project: "acme-app" }));

    expect(entry.project).toBe("acme-app");
  });
});
