import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const schoolProfile = sqliteTable("school_profile", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  motto: text("motto"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
});

export const academicYears = sqliteTable("academic_years", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
});

export const terms = sqliteTable("terms", {
  id: text("id").primaryKey(),
  academicYearId: text("academic_year_id")
    .notNull()
    .references(() => academicYears.id),
  sequence: integer("sequence").notNull(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const sections = sqliteTable("sections", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const levels = sqliteTable("levels", {
  id: text("id").primaryKey(),
  sectionId: text("section_id")
    .notNull()
    .references(() => sections.id),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(true),
});

export const permissions = sqliteTable("permissions", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").notNull(),
});

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permissions.id),
  },
  (t) => ({
    pk: uniqueIndex("role_permissions_pk").on(t.roleId, t.permissionId),
  }),
);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  roleId: text("role_id")
    .notNull()
    .references(() => roles.id),
  locale: text("locale").notNull().default("en"),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
  disabledAt: text("disabled_at"),
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  lockedUntil: text("locked_until"),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  revokedAt: text("revoked_at"),
});

export const loginAttempts = sqliteTable("login_attempts", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  success: integer("success", { mode: "boolean" }).notNull(),
  ip: text("ip"),
  createdAt: text("created_at").notNull(),
});

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  at: text("at").notNull(),
  actorUserId: text("actor_user_id"),
  ip: text("ip"),
  workstation: text("workstation"),
  module: text("module").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  reason: text("reason"),
  prevHash: text("prev_hash").notNull(),
  rowHash: text("row_hash").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by"),
});

export const numberSequences = sqliteTable("number_sequences", {
  name: text("name").primaryKey(),
  prefix: text("prefix").notNull(),
  nextValue: integer("next_value").notNull(),
  padding: integer("padding").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const classes = sqliteTable("classes", {
  id: text("id").primaryKey(),
  academicYearId: text("academic_year_id")
    .notNull()
    .references(() => academicYears.id),
  levelId: text("level_id")
    .notNull()
    .references(() => levels.id),
  stream: text("stream"),
  capacity: integer("capacity").notNull().default(40),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
});

export const subjects = sqliteTable("subjects", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const classSubjects = sqliteTable("class_subjects", {
  id: text("id").primaryKey(),
  classId: text("class_id")
    .notNull()
    .references(() => classes.id),
  subjectId: text("subject_id")
    .notNull()
    .references(() => subjects.id),
  coefficient: integer("coefficient").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

export const gradingScales = sqliteTable("grading_scales", {
  id: text("id").primaryKey(),
  sectionId: text("section_id")
    .notNull()
    .references(() => sections.id),
  scoreOutOf: integer("score_out_of").notNull(),
  passMark: integer("pass_mark").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const gradingScaleBands = sqliteTable("grading_scale_bands", {
  id: text("id").primaryKey(),
  scaleId: text("scale_id")
    .notNull()
    .references(() => gradingScales.id),
  minScore: integer("min_score").notNull(),
  maxScore: integer("max_score").notNull(),
  letter: text("letter").notNull(),
  remark: text("remark").notNull(),
});

export const applications = sqliteTable("applications", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  givenName: text("given_name").notNull(),
  familyName: text("family_name").notNull(),
  sex: text("sex").notNull(),
  dob: text("dob").notNull(),
  placeOfBirth: text("place_of_birth"),
  nationality: text("nationality"),
  previousSchool: text("previous_school"),
  levelId: text("level_id")
    .notNull()
    .references(() => levels.id),
  notes: text("notes"),
  guardianGivenName: text("guardian_given_name").notNull(),
  guardianFamilyName: text("guardian_family_name").notNull(),
  guardianPhone: text("guardian_phone").notNull(),
  guardianEmail: text("guardian_email"),
  guardianRelationship: text("guardian_relationship").notNull(),
  pupilId: text("pupil_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
});

export const pupils = sqliteTable("pupils", {
  id: text("id").primaryKey(),
  admissionNumber: text("admission_number").notNull().unique(),
  givenName: text("given_name").notNull(),
  familyName: text("family_name").notNull(),
  sex: text("sex").notNull(),
  dob: text("dob").notNull(),
  placeOfBirth: text("place_of_birth"),
  nationality: text("nationality"),
  address: text("address"),
  medicalNotes: text("medical_notes"),
  previousSchool: text("previous_school"),
  applicationId: text("application_id"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
});

export const pupilStatusHistory = sqliteTable("pupil_status_history", {
  id: text("id").primaryKey(),
  pupilId: text("pupil_id")
    .notNull()
    .references(() => pupils.id),
  status: text("status").notNull(),
  reason: text("reason"),
  at: text("at").notNull(),
  actorUserId: text("actor_user_id"),
});

export const guardians = sqliteTable("guardians", {
  id: text("id").primaryKey(),
  givenName: text("given_name").notNull(),
  familyName: text("family_name").notNull(),
  phone: text("phone").notNull(),
  phone2: text("phone2"),
  email: text("email"),
  occupation: text("occupation"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const pupilGuardians = sqliteTable("pupil_guardians", {
  pupilId: text("pupil_id")
    .notNull()
    .references(() => pupils.id),
  guardianId: text("guardian_id")
    .notNull()
    .references(() => guardians.id),
  relationship: text("relationship").notNull(),
  primaryContact: integer("primary_contact", { mode: "boolean" }).notNull().default(false),
  feePayer: integer("fee_payer", { mode: "boolean" }).notNull().default(false),
});

export const promotionBatches = sqliteTable("promotion_batches", {
  id: text("id").primaryKey(),
  sourceClassId: text("source_class_id").notNull(),
  targetClassId: text("target_class_id").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by"),
  undoneAt: text("undone_at"),
});

export const enrolments = sqliteTable("enrolments", {
  id: text("id").primaryKey(),
  pupilId: text("pupil_id")
    .notNull()
    .references(() => pupils.id),
  academicYearId: text("academic_year_id")
    .notNull()
    .references(() => academicYears.id),
  classId: text("class_id")
    .notNull()
    .references(() => classes.id),
  placementType: text("placement_type").notNull(),
  promotionBatchId: text("promotion_batch_id"),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by"),
});

export const disciplineNotes = sqliteTable("discipline_notes", {
  id: text("id").primaryKey(),
  pupilId: text("pupil_id")
    .notNull()
    .references(() => pupils.id),
  note: text("note").notNull(),
  at: text("at").notNull(),
  createdBy: text("created_by"),
});

export const feeItems = sqliteTable("fee_items", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  amountFcfa: integer("amount_fcfa").notNull(),
  mandatory: integer("mandatory", { mode: "boolean" }).notNull().default(true),
  scope: text("scope").notNull(),
  academicYearId: text("academic_year_id").notNull(),
  termId: text("term_id"),
  sectionId: text("section_id"),
  levelId: text("level_id"),
  classId: text("class_id"),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
});

export const pupilInvoices = sqliteTable("pupil_invoices", {
  id: text("id").primaryKey(),
  pupilId: text("pupil_id").notNull(),
  academicYearId: text("academic_year_id").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by"),
});

export const invoiceLines = sqliteTable("invoice_lines", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull(),
  feeItemId: text("fee_item_id"),
  description: text("description").notNull(),
  amountFcfa: integer("amount_fcfa").notNull(),
  createdAt: text("created_at").notNull(),
});

export const adjustments = sqliteTable("adjustments", {
  id: text("id").primaryKey(),
  invoiceLineId: text("invoice_line_id").notNull(),
  type: text("type").notNull(),
  amountFcfa: integer("amount_fcfa").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull(),
  approvalId: text("approval_id"),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by"),
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  pupilId: text("pupil_id").notNull(),
  invoiceId: text("invoice_id").notNull(),
  amountFcfa: integer("amount_fcfa").notNull(),
  unallocatedFcfa: integer("unallocated_fcfa").notNull().default(0),
  kind: text("kind").notNull(),
  channel: text("channel").notNull(),
  reference: text("reference"),
  payerName: text("payer_name").notNull(),
  notes: text("notes"),
  entryDate: text("entry_date").notNull(),
  recordedBy: text("recorded_by").notNull(),
  idempotencyKey: text("idempotency_key").unique(),
  originalPaymentId: text("original_payment_id"),
  createdAt: text("created_at").notNull(),
});

export const paymentAllocations = sqliteTable("payment_allocations", {
  id: text("id").primaryKey(),
  paymentId: text("payment_id").notNull(),
  invoiceLineId: text("invoice_line_id").notNull(),
  amountFcfa: integer("amount_fcfa").notNull(),
});

export const receipts = sqliteTable("receipts", {
  id: text("id").primaryKey(),
  paymentId: text("payment_id").notNull().unique(),
  number: text("number").notNull().unique(),
  verificationCode: text("verification_code").notNull(),
  status: text("status").notNull(),
  reprintCount: integer("reprint_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const reversals = sqliteTable("reversals", {
  id: text("id").primaryKey(),
  originalPaymentId: text("original_payment_id").notNull(),
  reversalPaymentId: text("reversal_payment_id"),
  approvalId: text("approval_id"),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by"),
});

export const approvalRequests = sqliteTable("approval_requests", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  entityId: text("entity_id").notNull(),
  payloadJson: text("payload_json"),
  requestedBy: text("requested_by").notNull(),
  decidedBy: text("decided_by"),
  status: text("status").notNull(),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
  decidedAt: text("decided_at"),
});

export const cashUps = sqliteTable("cash_ups", {
  id: text("id").primaryKey(),
  cashierUserId: text("cashier_user_id").notNull(),
  day: text("day").notNull(),
  totalsJson: text("totals_json").notNull(),
  countedCashFcfa: integer("counted_cash_fcfa").notNull(),
  notes: text("notes"),
  lockedAt: text("locked_at").notNull(),
  lockedBy: text("locked_by").notNull(),
  reopenApprovalId: text("reopen_approval_id"),
});

export const periodLocks = sqliteTable("period_locks", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  key: text("key").notNull(),
  lockedAt: text("locked_at").notNull(),
  lockedBy: text("locked_by").notNull(),
});

export const idempotencyKeys = sqliteTable("idempotency_keys", {
  key: text("key").primaryKey(),
  requestHash: text("request_hash").notNull(),
  responseJson: text("response_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const staff = sqliteTable("staff", {
  id: text("id").primaryKey(),
  givenName: text("given_name").notNull(),
  familyName: text("family_name").notNull(),
  sex: text("sex").notNull(),
  dob: text("dob"),
  nationalId: text("national_id"),
  phone: text("phone").notNull(),
  email: text("email"),
  address: text("address"),
  department: text("department"),
  position: text("position").notNull(),
  employmentType: text("employment_type").notNull(),
  hireDate: text("hire_date").notNull(),
  emergencyContact: text("emergency_contact"),
  userId: text("user_id"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
});

export const staffStatusHistory = sqliteTable("staff_status_history", {
  id: text("id").primaryKey(),
  staffId: text("staff_id").notNull(),
  status: text("status").notNull(),
  reason: text("reason"),
  at: text("at").notNull(),
  actorUserId: text("actor_user_id"),
});

export const staffAssignments = sqliteTable("staff_assignments", {
  id: text("id").primaryKey(),
  staffId: text("staff_id").notNull(),
  academicYearId: text("academic_year_id").notNull(),
  role: text("role").notNull(),
  classId: text("class_id"),
  classSubjectId: text("class_subject_id"),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by"),
});

export const leaves = sqliteTable("leaves", {
  id: text("id").primaryKey(),
  staffId: text("staff_id").notNull(),
  type: text("type").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  reason: text("reason"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by"),
});

export const staffAttendance = sqliteTable("staff_attendance", {
  id: text("id").primaryKey(),
  staffId: text("staff_id").notNull(),
  day: text("day").notNull(),
  mark: text("mark").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by"),
});

export const salaryComponentTypes = sqliteTable("salary_component_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  mode: text("mode").notNull(),
  statutory: integer("statutory", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const salaryStructures = sqliteTable("salary_structures", {
  id: text("id").primaryKey(),
  staffId: text("staff_id").notNull(),
  baseFcfa: integer("base_fcfa").notNull(),
  effectiveFrom: text("effective_from").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by"),
});

export const salaryStructureLines = sqliteTable("salary_structure_lines", {
  id: text("id").primaryKey(),
  structureId: text("structure_id").notNull(),
  componentTypeId: text("component_type_id").notNull(),
  value: integer("value").notNull(),
});

export const advancesLoans = sqliteTable("advances_loans", {
  id: text("id").primaryKey(),
  staffId: text("staff_id").notNull(),
  principalFcfa: integer("principal_fcfa").notNull(),
  remainingFcfa: integer("remaining_fcfa").notNull(),
  installmentFcfa: integer("installment_fcfa").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by"),
});

export const payrollRuns = sqliteTable("payroll_runs", {
  id: text("id").primaryKey(),
  yearMonth: text("year_month").notNull().unique(),
  status: text("status").notNull(),
  preparedBy: text("prepared_by"),
  approvedBy: text("approved_by"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const payrollLines = sqliteTable("payroll_lines", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  staffId: text("staff_id").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  grossFcfa: integer("gross_fcfa").notNull(),
  deductionsFcfa: integer("deductions_fcfa").notNull(),
  netFcfa: integer("net_fcfa").notNull(),
});

export const payslips = sqliteTable("payslips", {
  id: text("id").primaryKey(),
  payrollLineId: text("payroll_line_id").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

export const expenseCategories = sqliteTable("expense_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  categoryId: text("category_id").notNull(),
  entryDate: text("entry_date").notNull(),
  amountFcfa: integer("amount_fcfa").notNull(),
  description: text("description").notNull(),
  vendor: text("vendor"),
  method: text("method").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by"),
  decidedBy: text("decided_by"),
});

export const budgets = sqliteTable("budgets", {
  id: text("id").primaryKey(),
  categoryId: text("category_id").notNull(),
  academicYearId: text("academic_year_id").notNull(),
  amountFcfa: integer("amount_fcfa").notNull(),
  createdAt: text("created_at").notNull(),
});

export const assessmentTypes = sqliteTable("assessment_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  termId: text("term_id").notNull(),
  weight: integer("weight").notNull(),
  maxScore: integer("max_score").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by"),
});

export const assessments = sqliteTable("assessments", {
  id: text("id").primaryKey(),
  typeId: text("type_id").notNull(),
  classSubjectId: text("class_subject_id").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  submittedAt: text("submitted_at"),
  submittedBy: text("submitted_by"),
});

export const marks = sqliteTable("marks", {
  id: text("id").primaryKey(),
  assessmentId: text("assessment_id").notNull(),
  pupilId: text("pupil_id").notNull(),
  score: real("score"),
  status: text("status").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by"),
});

export const termResults = sqliteTable("term_results", {
  id: text("id").primaryKey(),
  classId: text("class_id").notNull(),
  termId: text("term_id").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  computedAt: text("computed_at").notNull(),
  computedBy: text("computed_by"),
});

export const reportCards = sqliteTable("report_cards", {
  id: text("id").primaryKey(),
  pupilId: text("pupil_id").notNull(),
  termId: text("term_id").notNull(),
  withheld: integer("withheld", { mode: "boolean" }).notNull().default(false),
  verificationCode: text("verification_code").notNull(),
  createdAt: text("created_at").notNull(),
});

export const pupilAttendance = sqliteTable("pupil_attendance", {
  id: text("id").primaryKey(),
  classId: text("class_id").notNull(),
  pupilId: text("pupil_id").notNull(),
  day: text("day").notNull(),
  mark: text("mark").notNull(),
  reason: text("reason"),
  submitted: integer("submitted", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by"),
});

export const inventoryItems = sqliteTable("inventory_items", {
  id: text("id").primaryKey(),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  location: text("location").notNull(),
  condition: text("condition").notNull(),
  acquiredOn: text("acquired_on").notNull(),
  costFcfa: integer("cost_fcfa").notNull(),
  minQty: integer("min_qty").notNull().default(1),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by"),
});

export const stockMovements = sqliteTable("stock_movements", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull(),
  qty: integer("qty").notNull(),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by"),
});

export const calendarEvents = sqliteTable("calendar_events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by"),
});

export const announcements = sqliteTable("announcements", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  audience: text("audience").notNull(),
  expiresOn: text("expires_on"),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by"),
});

export const documentTemplates = sqliteTable("document_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  createdBy: text("created_by"),
});

export const backups = sqliteTable("backups", {
  id: text("id").primaryKey(),
  filename: text("filename").notNull(),
  checksum: text("checksum").notNull(),
  bytes: integer("bytes").notNull(),
  countsJson: text("counts_json").notNull(),
  integrity: text("integrity").notNull(),
  driveStatus: text("drive_status").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by"),
  kind: text("kind").notNull(),
});

export const driveQueue = sqliteTable("drive_queue", {
  id: text("id").primaryKey(),
  backupId: text("backup_id").notNull(),
  status: text("status").notNull(),
  lastError: text("last_error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
