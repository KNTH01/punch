import { test, expect, beforeEach, describe } from "bun:test";
import { Cause, Effect } from "effect";
import { createTestDb } from "../db/test-db";
import { punchIn } from "./punch-in";
import { TaskAlreadyRunningError } from "./errors";

describe("punchIn (Effect)", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  test("creates entry when no active task", async () => {
    const program = punchIn(db, "coding");
    const exit = await Effect.runPromiseExit(program);

    expect(exit._tag).toBe("Success");
    if (exit._tag === "Success") {
      expect(exit.value.taskName).toBe("coding");
      expect(exit.value.startTime).toBeInstanceOf(Date);
      expect(exit.value.endTime).toBeNull();
    }
  });

  test("fails with TaskAlreadyRunningError when task is active", async () => {
    // First punch in succeeds
    await Effect.runPromise(punchIn(db, "existing-task"));

    // Second punch in should fail
    const program = punchIn(db, "new-task");
    const exit = await Effect.runPromiseExit(program);

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const error = Cause.failureOption(exit.cause);
      expect(error._tag).toBe("Some");
      if (error._tag === "Some") {
        expect(error.value).toBeInstanceOf(TaskAlreadyRunningError);
        expect(error.value.taskName).toBe("existing-task");
      }
    }
  });

  test("creates entry with project when provided", async () => {
    const program = punchIn(db, "coding", { project: "acme-app" });
    const exit = await Effect.runPromiseExit(program);

    expect(exit._tag).toBe("Success");
    if (exit._tag === "Success") {
      expect(exit.value.project).toBe("acme-app");
    }
  });
});
