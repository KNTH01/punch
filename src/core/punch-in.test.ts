import { test, expect, beforeEach, describe } from "bun:test";
import { Cause, Effect } from "effect";
import { DBTest } from "~/db/test-db";
import { punchIn } from "./punch-in";
import { TaskAlreadyRunningError } from "./errors";
import { DB } from "~/db";

describe("punchIn (Effect)", () => {
  const runTest = async <A, E>(program: Effect.Effect<A, E, DB>) =>
    Effect.runPromiseExit(program.pipe(Effect.provide(DBTest)));

  // beforeEach(() => {
  //   db = createTestDb();
  // });

  test("creates entry when no active task", async () => {
    const program = punchIn("coding");
    const exit = await runTest(program);

    expect(exit._tag).toBe("Success");
    if (exit._tag === "Success") {
      expect(exit.value.taskName).toBe("coding");
      expect(exit.value.startTime).toBeInstanceOf(Date);
      expect(exit.value.endTime).toBeNull();
    }
  });

  test("fails with TaskAlreadyRunningError when task is active", async () => {
    const exit = await runTest(
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
    const program = punchIn("coding", { project: "acme-app" });
    const exit = await runTest(program);

    expect(exit._tag).toBe("Success");
    if (exit._tag === "Success") {
      expect(exit.value.project).toBe("acme-app");
    }
  });
});
