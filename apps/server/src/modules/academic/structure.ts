import { createId, isDefaultSectionName, sectionsForSchoolKind, type SchoolKind } from "@sms/shared";
import { eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { classes, levels, sections } from "../../db/schema.js";

export function ensureDefaultSections(db: Db, kind: SchoolKind, at: string): void {
  const wanted = sectionsForSchoolKind(kind);
  const wantedNames = new Set(wanted.map((section) => section.name));
  const existing = db.select().from(sections).all();

  wanted.forEach((section, sIndex) => {
    let row = existing.find((item) => item.name === section.name);
    if (!row) {
      const id = createId();
      db.insert(sections)
        .values({
          id,
          name: section.name,
          sortOrder: sIndex + 1,
          archivedAt: null,
          createdAt: at,
          updatedAt: at,
        })
        .run();
      row = {
        id,
        name: section.name,
        sortOrder: sIndex + 1,
        archivedAt: null,
        createdAt: at,
        updatedAt: at,
      };
      existing.push(row);
    } else if (row.archivedAt) {
      db.update(sections)
        .set({ archivedAt: null, updatedAt: at })
        .where(eq(sections.id, row.id))
        .run();
      row.archivedAt = null;
    }
    const existingLevels = db.select().from(levels).where(eq(levels.sectionId, row.id)).all();
    section.levels.forEach((levelName, lIndex) => {
      if (existingLevels.some((level) => level.name === levelName)) return;
      db.insert(levels)
        .values({
          id: createId(),
          sectionId: row.id,
          name: levelName,
          sortOrder: lIndex + 1,
          createdAt: at,
          updatedAt: at,
        })
        .run();
    });
  });

  const classRows = db.select().from(classes).all();
  const levelRows = db.select().from(levels).all();
  const levelsWithClasses = new Set(classRows.map((cls) => cls.levelId));
  for (const section of existing) {
    if (!isDefaultSectionName(section.name) || wantedNames.has(section.name)) continue;
    const hasClasses = levelRows
      .filter((level) => level.sectionId === section.id)
      .some((level) => levelsWithClasses.has(level.id));
    if (!hasClasses && !section.archivedAt) {
      db.update(sections)
        .set({ archivedAt: at, updatedAt: at })
        .where(eq(sections.id, section.id))
        .run();
    }
  }
}
