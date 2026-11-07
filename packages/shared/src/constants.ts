export const APP_NAME = "Promptstack School Management";
export const APP_VERSION = "0.8.0";
export const IMAGE_NAME = "promptstack-sms";
export const RESTORE_CONFIRMATION = "RESTORE SCHOOL DATA";
export const BACKUP_STALE_MS = 48 * 60 * 60 * 1000;
export const IDEMPOTENCY_HEADER = "idempotency-key";
export const DEFAULT_PORT = 3847;
export const DEFAULT_TIMEZONE = "Africa/Douala";
export const SESSION_COOKIE = "sms.sid";
export const CSRF_COOKIE = "sms.csrf";
export const CSRF_HEADER = "x-csrf-token";

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000;
export const LOCKOUT_FAILURES = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

export const PAGE_SIZE_DEFAULT = 50;
export const PAGE_SIZE_MAX = 200;

export const DEFAULT_DISCOUNT_APPROVAL_THRESHOLD_FCFA = 10_000;
export const DEFAULT_ADMISSION_PREFIX = "ABC";
export const DEFAULT_RECEIPT_PREFIX = "RC";

export const ROLE_SLUGS = [
  "super_admin",
  "proprietor",
  "headteacher",
  "bursar",
  "secretary",
  "teacher",
  "hr",
] as const;

export type RoleSlug = (typeof ROLE_SLUGS)[number];
