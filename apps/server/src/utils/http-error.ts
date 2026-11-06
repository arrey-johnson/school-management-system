import { apiError, type ErrorCode, type FieldError } from "@sms/shared";

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: ErrorCode,
    message: string,
    public fields?: FieldError[],
  ) {
    super(message);
  }

  toBody() {
    return apiError(this.code, this.message, this.fields);
  }
}

export function httpError(status: number, code: ErrorCode, message: string, fields?: FieldError[]): HttpError {
  return new HttpError(status, code, message, fields);
}
