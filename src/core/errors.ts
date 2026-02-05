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

// Edit errors
export class InvalidPositionFormatError extends Data.TaggedError(
  "InvalidPositionFormatError",
)<{
  readonly position: string;
}> {}

export class EntryNotFoundError extends Data.TaggedError("EntryNotFoundError")<{
  readonly identifier: string;
}> {}

export class AmbiguousIdPrefixError extends Data.TaggedError(
  "AmbiguousIdPrefixError",
)<{
  readonly prefix: string;
  readonly matches: string[];
}> {}

export class NoEntriesToEditError extends Data.TaggedError(
  "NoEntriesToEditError",
)<{}> {}
