import { Data } from "effect";

export class TaskAlreadyRunningError extends Data.TaggedError(
  "TaskAlreadyRunningError",
)<{
  readonly taskName: string;
  readonly startTime: Date;
}> {}

export class NoActiveTask extends Data.TaggedError("NoActiveTask") {}

export class InvalidEndTimeError extends Data.TaggedError(
  "InvalidEndTimeError",
)<{
  readonly startTime: Date;
  readonly endTime: Date;
}> {}
