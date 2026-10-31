export type GatewayErrorCode =
  | "ADAPTER_UNAVAILABLE"
  | "NO_PROVIDER_CONFIGURED"
  | "PROVIDER_MISCONFIGURED"
  | "UNAUTHORIZED"
  | "INVALID_MODEL"
  | "QUOTA_EXCEEDED"
  | "RATE_LIMITED"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_NETWORK"
  | "UPSTREAM_ERROR"
  | "MALFORMED_STREAM"
  | "UNSAFE_REDIRECT"
  | "REMOTE_BLOCKED"
  | "RESPONSE_TOO_LARGE";

export class GatewayError extends Error {
  readonly code: GatewayErrorCode;

  constructor(code: GatewayErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function gatewayHttpStatus(code: GatewayErrorCode): number {
  switch (code) {
    case "NO_PROVIDER_CONFIGURED":
    case "PROVIDER_MISCONFIGURED":
      return 400;
    case "ADAPTER_UNAVAILABLE":
      return 501;
    case "RATE_LIMITED":
      return 429;
    default:
      return 502;
  }
}
