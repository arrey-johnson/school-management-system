export type ActivityInput = {
  at: string;
  module: string;
  action: string;
  entity?: string | null;
  actorName?: string | null;
};

export type ActivityStory = {
  at: string;
  module: string;
  action: string;
  title: string;
  summary: string;
  when: string;
};

const MODULE_LABEL: Record<string, string> = {
  fees: "school fees",
  payments: "school fees",
  pupils: "a pupil record",
  admissions: "an admission application",
  backup: "school backups",
  setup: "first-time setup",
  academics: "class marks",
  attendance: "class attendance",
  staff: "a staff record",
  payroll: "payroll",
  expenses: "a school expense",
  inventory: "the school store",
  admin: "school notices",
  users: "a user account",
  audit: "the activity log",
  academic: "classes and years",
  reports: "a report",
  search: "search",
  auth: "sign-in",
};

const TITLE: Record<string, string> = {
  "fees.payment": "School fees collected",
  "fees.create": "School fees collected",
  "fees.reverse": "A fee payment was reversed",
  "fees.approve": "A fee change was approved",
  "backup.create": "School records were backed up",
  "backup.restore": "School records were restored",
  "setup.bootstrap": "The first administrator was created",
  "setup.complete": "School setup was finished",
  "setup.school_profile": "School details were saved",
  "setup.academic_year": "The school year was created",
  "admissions.create": "A new admission was started",
  "admissions.status": "An admission was updated",
  "pupils.create": "A pupil was added",
  "pupils.import": "Pupils were imported",
  "pupils.promote": "Pupils were moved to a new class",
  "pupils.bulk_promote": "Pupils were moved to a new class",
  "pupils.status": "A pupil’s status was changed",
  "admissions.enrol": "A pupil was enrolled",
  "attendance.submit": "Attendance was taken",
  "academics.save_marks": "Class marks were saved",
  "academics.submit": "Class marks were submitted",
  "academics.compute": "Report card results were calculated",
  "fees.adjustment": "A fee discount or extra charge was added",
  "fees.approval": "A fee change was approved",
  "fees.cash_up": "The cash drawer was closed",
  "auth.login": "Someone signed in",
  "academics.lock": "Marks were locked",
  "academics.unlock": "Marks were unlocked",
  "payroll.finalize": "Payroll was completed",
  "expenses.pay": "An expense was paid",
};

function who(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "A staff member";
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Douala",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function fallbackSummary(input: ActivityInput, actor: string): string {
  const thing = MODULE_LABEL[input.module] ?? input.module.replace(/_/g, " ");
  const act = input.action.replace(/_/g, " ");
  if (act === "create") return `${actor} added ${thing}.`;
  if (act === "update") return `${actor} changed ${thing}.`;
  if (act === "delete") return `${actor} removed ${thing}.`;
  return `${actor} completed this: ${thing} — ${act}.`;
}

export function describeActivity(input: ActivityInput): ActivityStory {
  const actor = who(input.actorName);
  const key = `${input.module}.${input.action}`;
  const when = formatWhen(input.at);
  const sentences: Record<string, string> = {
    "fees.payment": `${actor} recorded money received for school fees.`,
    "fees.create": `${actor} recorded money received for school fees.`,
    "fees.reverse": `${actor} reversed a fee payment. The original receipt stays on file.`,
    "fees.approve": `${actor} approved a fee change that needed a second person.`,
    "backup.create": `${actor} saved a backup copy of the school records.`,
    "backup.restore": `${actor} restored the school records from a backup.`,
    "setup.bootstrap": `${actor} created the first administrator for this school.`,
    "setup.complete": `${actor} finished first-time setup. The school can start using the system.`,
    "setup.school_profile": `${actor} saved the school name and contact details.`,
    "setup.academic_year": `${actor} created the academic year and terms.`,
    "admissions.create": `${actor} started a new admission application.`,
    "admissions.status": `${actor} moved an admission application to the next step.`,
    "pupils.create": `${actor} added a pupil to the school register.`,
    "pupils.import": `${actor} imported several pupils from a list.`,
    "pupils.promote": `${actor} moved pupils into their next class.`,
    "pupils.bulk_promote": `${actor} moved pupils into their next class.`,
    "pupils.status": `${actor} changed a pupil’s status (for example left, suspended, or active).`,
    "admissions.enrol": `${actor} enrolled an accepted applicant as a pupil.`,
    "academics.save_marks": `${actor} saved class marks.`,
    "academics.submit": `${actor} submitted class marks. They are now locked.`,
    "academics.compute": `${actor} calculated report card results for the term.`,
    "fees.adjustment": `${actor} added a fee discount or extra charge.`,
    "fees.approval": `${actor} approved a fee change that needed a second person.`,
    "fees.cash_up": `${actor} closed the cash drawer for the day.`,
    "fees.create_item": `${actor} added a type of school fee.`,
    "auth.login": `${actor} signed in to the school system.`,
    "auth.change_password": `${actor} changed their password.`,
    "inventory.stock_move": `${actor} recorded items in or out of the school store.`,
    "admin.announce": `${actor} posted a notice for staff.`,
    "attendance.submit": `${actor} submitted class attendance for the day.`,
    "academics.lock": `${actor} locked class marks so they cannot be changed.`,
    "academics.unlock": `${actor} unlocked class marks so they can be corrected.`,
    "payroll.finalize": `${actor} finished a payroll run for staff salaries.`,
    "expenses.pay": `${actor} marked a school expense as paid.`,
    "users.create": `${actor} created a new user account so someone can sign in.`,
    "inventory.in": `${actor} added items into the school store.`,
    "inventory.out": `${actor} took items out of the school store.`,
  };
  const summary = sentences[key] ?? fallbackSummary(input, actor);
  const title = TITLE[key] ?? summary.replace(/\.$/, "");
  return {
    at: input.at,
    module: input.module,
    action: input.action,
    title,
    summary: `${summary} (${when})`,
    when,
  };
}
