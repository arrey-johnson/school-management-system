export const SCHOOL_KINDS = ["primary", "secondary", "combined"] as const;
export type SchoolKind = (typeof SCHOOL_KINDS)[number];

export const NURSERY_PRIMARY_SECTION = {
  name: "Nursery",
  levels: ["Nursery 1", "Nursery 2"],
} as const;

export const PRIMARY_SECTION = {
  name: "Primary",
  levels: ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6"],
} as const;

export const SECONDARY_SECTION = {
  name: "Secondary",
  levels: ["Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Lower Sixth", "Upper Sixth"],
} as const;

export function sectionsForSchoolKind(kind: SchoolKind): { name: string; levels: string[] }[] {
  if (kind === "primary") {
    return [
      { name: NURSERY_PRIMARY_SECTION.name, levels: [...NURSERY_PRIMARY_SECTION.levels] },
      { name: PRIMARY_SECTION.name, levels: [...PRIMARY_SECTION.levels] },
    ];
  }
  if (kind === "secondary") {
    return [{ name: SECONDARY_SECTION.name, levels: [...SECONDARY_SECTION.levels] }];
  }
  return [
    { name: NURSERY_PRIMARY_SECTION.name, levels: [...NURSERY_PRIMARY_SECTION.levels] },
    { name: PRIMARY_SECTION.name, levels: [...PRIMARY_SECTION.levels] },
    { name: SECONDARY_SECTION.name, levels: [...SECONDARY_SECTION.levels] },
  ];
}
