import type { GatewayErrorCode } from "../ai/errors.js";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "PROJECT_NOT_FOUND"
  | "PROJECT_SLUG_TAKEN"
  | "PROJECT_HAS_CONTENT"
  | "PROVIDER_NOT_FOUND"
  | "PROVIDER_DISABLED"
  | "PREFERENCE_NOT_FOUND"
  | "CONVERSATION_NOT_FOUND"
  | "NEED_APPROVED_BASELINE"
  | "TEMPLATE_NOT_FOUND"
  | "TEMPLATE_TARGET_EXISTS"
  | "INVALID_BACKUP"
  | "PAYLOAD_TOO_LARGE"
  | "DOCUMENT_NOT_FOUND"
  | "DOCUMENT_TYPE_TAKEN"
  | "APPROVED_LOCKED"
  | "INVALID_STATE"
  | "EXPORT_NOT_FOUND"
  | "INTERNAL_ERROR";

export type ApiErrorCode = ErrorCode | GatewayErrorCode;

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  PROJECT_NOT_FOUND: 404,
  PROJECT_SLUG_TAKEN: 409,
  PROJECT_HAS_CONTENT: 409,
  PROVIDER_NOT_FOUND: 404,
  PROVIDER_DISABLED: 409,
  PREFERENCE_NOT_FOUND: 404,
  CONVERSATION_NOT_FOUND: 404,
  NEED_APPROVED_BASELINE: 400,
  TEMPLATE_NOT_FOUND: 404,
  TEMPLATE_TARGET_EXISTS: 409,
  INVALID_BACKUP: 422,
  PAYLOAD_TOO_LARGE: 413,
  DOCUMENT_NOT_FOUND: 404,
  DOCUMENT_TYPE_TAKEN: 409,
  APPROVED_LOCKED: 409,
  INVALID_STATE: 409,
  EXPORT_NOT_FOUND: 404,
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

export function errorBody(code: ApiErrorCode, message: string, details?: unknown): object {
  return details === undefined
    ? { error: { code, message } }
    : { error: { code, message, details } };
}
