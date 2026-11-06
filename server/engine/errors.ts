/** Expected engine failure. Actions map it to `fail(code, message)`. */
export class EngineError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "EngineError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export function isEngineError(err: unknown): err is EngineError {
  return err instanceof EngineError;
}
