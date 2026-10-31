export type ErrorCode =
  | "VALIDATION_ERROR"
  | "PROJECT_NOT_FOUND"
  | "PROJECT_SLUG_TAKEN"
  | "PROJECT_HAS_CONTENT"
  | "PROVIDER_NOT_FOUND"
  | "PROVIDER_DISABLED"
  | "PREFERENCE_NOT_FOUND"
  | "INTERNAL_ERROR";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  PROJECT_NOT_FOUND: 404,
  PROJECT_SLUG_TAKEN: 409,
  PROJECT_HAS_CONTENT: 409,
  PROVIDER_NOT_FOUND: 404,
  PROVIDER_DISABLED: 409,
  PREFERENCE_NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
};

export class HttpError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }

  get statusCode(): number {
    return STATUS[this.code];
  }
}

export function errorBody(code: ErrorCode, message: string, details?: unknown): object {
  return details === undefined
    ? { error: { code, message } }
    : { error: { code, message, details } };
}
