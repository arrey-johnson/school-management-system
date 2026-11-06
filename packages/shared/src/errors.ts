export const ERROR_CODES = [
  "VALIDATION",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "LOCKED",
  "SETUP_REQUIRED",
  "SETUP_COMPLETE",
  "PASSWORD_CHANGE_REQUIRED",
  "PERIOD_LOCKED",
  "IDEMPOTENT_REPLAY",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type FieldError = { path: string; message: string };

export type ApiErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    fields?: FieldError[];
  };
};

export function apiError(
  code: ErrorCode,
  message: string,
  fields?: FieldError[],
): ApiErrorBody {
  return { error: { code, message, ...(fields ? { fields } : {}) } };
}
