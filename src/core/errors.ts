export class TaskAlreadyRunningError {
  readonly _tag = "TaskAlreadyRunningError";
  constructor(
    readonly taskName: string,
    readonly startTime: Date,
  ) {}
}
