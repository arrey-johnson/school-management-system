export function admissionYearToken(academicYearName: string, startDate: string): string {
  const fromName = academicYearName.match(/(\d{4})/)?.[1];
  if (fromName) return fromName;
  return startDate.slice(0, 4);
}

export function admissionPrefix(yearToken: string): string {
  return `ABC-${yearToken}-`;
}
