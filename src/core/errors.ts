import { Data } from "effect";

export class TaskAlreadyRunningError extends Data.TaggedError(
  "TaskAlreadyRunningError",
)<{
  readonly taskName: string;
  readonly startTime: Date;
}> {}
