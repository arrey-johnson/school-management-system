import { createId, mergeTemplate } from "@sms/shared";
import { eq } from "drizzle-orm";
import type { AuthUser } from "../../auth/session.js";
import type { DatabaseBundle } from "../../db/client.js";
import { announcements, calendarEvents, documentTemplates, pupils, schoolProfile } from "../../db/schema.js";
import { todayIso } from "../../utils/dates.js";
import { httpError } from "../../utils/http-error.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function createEvent(
  bundle: DatabaseBundle,
  input: { title: string; kind: string; startDate: string; endDate: string; notes?: string },
  actorUserId: string,
): { id: string } {
  if (input.endDate < input.startDate) throw httpError(400, "VALIDATION", "End date must be on or after start date");
  const id = createId();
  bundle.db
    .insert(calendarEvents)
    .values({
      id,
      title: input.title,
      kind: input.kind,
      startDate: input.startDate,
      endDate: input.endDate,
      notes: input.notes || null,
      createdAt: nowIso(),
      createdBy: actorUserId,
    })
    .run();
  return { id };
}

export function createAnnouncement(
  bundle: DatabaseBundle,
  input: { title: string; body: string; audience: string; expiresOn?: string },
  actorUserId: string,
): { id: string } {
  const id = createId();
  bundle.db
    .insert(announcements)
    .values({
      id,
      title: input.title,
      body: input.body,
      audience: input.audience,
      expiresOn: input.expiresOn || null,
      createdAt: nowIso(),
      createdBy: actorUserId,
    })
    .run();
  return { id };
}

export function visibleAnnouncements(bundle: DatabaseBundle, user: AuthUser) {
  const today = todayIso();
  return bundle.db
    .select()
    .from(announcements)
    .all()
    .filter((row) => {
      if (row.expiresOn && row.expiresOn < today) return false;
      if (row.audience === "all") return true;
      if (row.audience === user.roleSlug) return true;
      return false;
    });
}

export function saveTemplate(
  bundle: DatabaseBundle,
  input: { name: string; body: string },
  actorUserId: string,
): { id: string } {
  const id = createId();
  const at = nowIso();
  bundle.db
    .insert(documentTemplates)
    .values({
      id,
      name: input.name,
      body: input.body,
      createdAt: at,
      updatedAt: at,
      createdBy: actorUserId,
    })
    .run();
  return { id };
}

export function renderTemplate(bundle: DatabaseBundle, templateId: string, pupilId?: string): { text: string } {
  const template = bundle.db.select().from(documentTemplates).where(eq(documentTemplates.id, templateId)).get();
  if (!template) throw httpError(404, "NOT_FOUND", "Template not found");
  const school = bundle.db.select().from(schoolProfile).get();
  const pupil = pupilId ? bundle.db.select().from(pupils).where(eq(pupils.id, pupilId)).get() : undefined;
  if (pupilId && !pupil) throw httpError(400, "VALIDATION", "Unknown pupil");
  return {
    text: mergeTemplate(template.body, {
      "school.name": school?.name ?? "",
      "school.motto": school?.motto ?? "",
      today: todayIso(),
      "pupil.givenName": pupil?.givenName ?? "",
      "pupil.familyName": pupil?.familyName ?? "",
      "pupil.admissionNumber": pupil?.admissionNumber ?? "",
    }),
  };
}
