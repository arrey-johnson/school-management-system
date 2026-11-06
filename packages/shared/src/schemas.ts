import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-zA-Z0-9._-]+$/, "Username may contain letters, numbers, dot, underscore, hyphen");

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128);

export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const bootstrapSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(120),
});

export const schoolProfileSchema = z.object({
  name: z.string().trim().min(2).max(200),
  motto: z.string().trim().max(300).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
});

export const academicYearSetupSchema = z.object({
  name: z.string().trim().min(4).max(40),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  terms: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .length(3),
});

export const createUserSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(120),
  roleSlug: z.string().min(1),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const APPLICATION_STATUSES = [
  "applied",
  "under_review",
  "accepted",
  "enrolled",
  "rejected",
  "waitlisted",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const PUPIL_STATUSES = [
  "active",
  "suspended",
  "transferred",
  "withdrawn",
  "graduated",
] as const;
export type PupilStatus = (typeof PUPIL_STATUSES)[number];

export const classCreateSchema = z.object({
  academicYearId: z.string().min(1),
  levelId: z.string().min(1),
  stream: z.string().trim().max(20).optional().or(z.literal("")),
  capacity: z.number().int().min(1).max(200).default(40),
});

export const subjectCreateSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
});

export const classSubjectSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  coefficient: z.number().int().min(1).max(20).default(1),
});

export const guardianInputSchema = z.object({
  givenName: z.string().trim().min(1).max(80),
  familyName: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(40),
  phone2: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  occupation: z.string().trim().max(80).optional().or(z.literal("")),
  relationship: z.string().trim().min(1).max(40),
  primaryContact: z.boolean().default(true),
  feePayer: z.boolean().default(true),
});

export const applicationCreateSchema = z.object({
  givenName: z.string().trim().min(1).max(80),
  familyName: z.string().trim().min(1).max(80),
  sex: z.enum(["F", "M"]),
  dob: isoDateSchema,
  placeOfBirth: z.string().trim().max(120).optional().or(z.literal("")),
  nationality: z.string().trim().max(80).optional().or(z.literal("")),
  previousSchool: z.string().trim().max(160).optional().or(z.literal("")),
  levelId: z.string().min(1),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  guardian: guardianInputSchema,
});

export const applicationStatusSchema = z.object({
  status: z.enum(["under_review", "accepted", "rejected", "waitlisted"]),
  reason: z.string().trim().max(400).optional().or(z.literal("")),
});

export const pupilCreateSchema = z.object({
  givenName: z.string().trim().min(1).max(80),
  familyName: z.string().trim().min(1).max(80),
  sex: z.enum(["F", "M"]),
  dob: isoDateSchema,
  placeOfBirth: z.string().trim().max(120).optional().or(z.literal("")),
  nationality: z.string().trim().max(80).optional().or(z.literal("")),
  address: z.string().trim().max(400).optional().or(z.literal("")),
  previousSchool: z.string().trim().max(160).optional().or(z.literal("")),
  medicalNotes: z.string().trim().max(2000).optional().or(z.literal("")),
  classId: z.string().min(1),
  confirmDuplicate: z.boolean().optional(),
  guardian: guardianInputSchema,
});

export const pupilStatusSchema = z.object({
  status: z.enum(PUPIL_STATUSES),
  reason: z.string().trim().min(1).max(400),
});

export const enrolSchema = z.object({
  pupilId: z.string().min(1),
  classId: z.string().min(1),
  placementType: z.enum(["new", "promote", "repeat", "transfer"]).default("new"),
});

export const bulkPromoteSchema = z.object({
  sourceClassId: z.string().min(1),
  targetClassId: z.string().min(1),
  pupilIds: z.array(z.string().min(1)).min(1),
});

export const importPupilRowSchema = z.object({
  givenName: z.string().trim().min(1),
  familyName: z.string().trim().min(1),
  sex: z.enum(["F", "M"]),
  dob: isoDateSchema,
  classStream: z.string().trim().min(1),
  guardianGivenName: z.string().trim().min(1),
  guardianFamilyName: z.string().trim().min(1),
  guardianPhone: z.string().trim().min(6),
  relationship: z.string().trim().min(1).default("Parent"),
});

export const importPupilsSchema = z.object({
  dryRun: z.boolean().default(true),
  rows: z.array(importPupilRowSchema).min(1).max(2000),
});

export const PAYMENT_CHANNELS = [
  "cash",
  "mtn_momo",
  "orange_money",
  "bank",
  "cheque",
  "other",
] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

export const ADJUSTMENT_TYPES = ["discount", "waiver", "scholarship", "late_fee"] as const;

export const feeItemCreateSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  amountFcfa: z.number().int().positive(),
  mandatory: z.boolean().default(true),
  scope: z.enum(["year", "term"]).default("year"),
  academicYearId: z.string().min(1),
  termId: z.string().min(1).optional(),
  sectionId: z.string().min(1).optional(),
  levelId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
});

export const paymentCreateSchema = z.object({
  pupilId: z.string().min(1),
  amountFcfa: z.number().int().positive(),
  channel: z.enum(PAYMENT_CHANNELS),
  entryDate: isoDateSchema,
  payerName: z.string().trim().min(1).max(120),
  reference: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(400).optional().or(z.literal("")),
  confirmDuplicate: z.boolean().optional(),
  lineIds: z.array(z.string().min(1)).optional(),
});

export const adjustmentCreateSchema = z.object({
  invoiceLineId: z.string().min(1),
  type: z.enum(ADJUSTMENT_TYPES),
  amountFcfa: z.number().int().positive(),
  reason: z.string().trim().min(3).max(400),
});

export const reversalRequestSchema = z.object({
  reason: z.string().trim().min(3).max(400),
});

export const approvalDecideSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().max(400).optional().or(z.literal("")),
});

export const cashUpCloseSchema = z.object({
  day: isoDateSchema,
  countedCashFcfa: z.number().int().min(0),
  notes: z.string().trim().max(400).optional().or(z.literal("")),
});

export const periodLockSchema = z.object({
  kind: z.enum(["month", "term"]),
  key: z.string().trim().min(1).max(40),
});

export const optionalFeeLineSchema = z.object({
  feeItemId: z.string().min(1),
});

export const STAFF_STATUSES = ["active", "on_leave", "resigned", "terminated"] as const;
export const STAFF_ATTENDANCE_MARKS = ["present", "late", "absent", "leave"] as const;
export const EXPENSE_STATUSES = ["draft", "submitted", "approved", "paid"] as const;
export const PAYROLL_STATUSES = ["draft", "calculated", "reviewed", "approved", "paid", "locked"] as const;

export const staffCreateSchema = z.object({
  givenName: z.string().trim().min(1).max(80),
  familyName: z.string().trim().min(1).max(80),
  sex: z.enum(["F", "M"]),
  dob: isoDateSchema.optional(),
  nationalId: z.string().trim().max(40).optional().or(z.literal("")),
  phone: z.string().trim().min(6).max(40),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  address: z.string().trim().max(400).optional().or(z.literal("")),
  department: z.string().trim().max(80).optional().or(z.literal("")),
  position: z.string().trim().min(1).max(80),
  employmentType: z.enum(["full_time", "part_time", "contract"]).default("full_time"),
  hireDate: isoDateSchema,
  emergencyContact: z.string().trim().max(160).optional().or(z.literal("")),
  userId: z.string().min(1).optional(),
});

export const staffStatusSchema = z.object({
  status: z.enum(STAFF_STATUSES),
  reason: z.string().trim().min(1).max(400),
});

export const staffAssignmentSchema = z.object({
  staffId: z.string().min(1),
  academicYearId: z.string().min(1),
  role: z.enum(["class_teacher", "subject_teacher"]),
  classId: z.string().min(1).optional(),
  classSubjectId: z.string().min(1).optional(),
});

export const leaveCreateSchema = z.object({
  staffId: z.string().min(1),
  type: z.string().trim().min(1).max(40),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  reason: z.string().trim().max(400).optional().or(z.literal("")),
});

export const staffAttendanceSchema = z.object({
  staffId: z.string().min(1),
  day: isoDateSchema,
  mark: z.enum(STAFF_ATTENDANCE_MARKS),
});

export const salaryComponentTypeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["allowance", "deduction"]),
  mode: z.enum(["fixed", "percent"]),
  statutory: z.boolean().default(false),
});

export const salaryStructureSchema = z.object({
  staffId: z.string().min(1),
  baseFcfa: z.number().int().positive(),
  effectiveFrom: isoDateSchema,
  lines: z
    .array(
      z.object({
        componentTypeId: z.string().min(1),
        value: z.number().int().min(0),
      }),
    )
    .default([]),
});

export const payrollRunCreateSchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  bonusFcfaByStaffId: z.record(z.string(), z.number().int().min(0)).optional(),
});

export const expenseCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const expenseCreateSchema = z.object({
  categoryId: z.string().min(1),
  entryDate: isoDateSchema,
  amountFcfa: z.number().int().positive(),
  description: z.string().trim().min(1).max(400),
  vendor: z.string().trim().max(120).optional().or(z.literal("")),
  method: z.enum(PAYMENT_CHANNELS).default("cash"),
});

export const budgetCreateSchema = z.object({
  categoryId: z.string().min(1),
  academicYearId: z.string().min(1),
  amountFcfa: z.number().int().positive(),
});
