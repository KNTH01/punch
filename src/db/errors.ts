import { Data } from "effect";

export class DBError extends Data.TaggedError("DBError")<{
  path?: string;
  cause: unknown;
}> {}

export class DBUpdateFailedError extends Data.TaggedError(
  "DBUpdateFailedError",
)<{
  readonly id: string;
}> {}
