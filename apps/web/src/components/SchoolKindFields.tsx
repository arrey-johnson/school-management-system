import type { SchoolKind } from "@sms/shared";

const OPTIONS: { value: SchoolKind; title: string; hint: string }[] = [
  { value: "primary", title: "Primary school", hint: "Nursery 1–2 and Class 1–6" },
  { value: "secondary", title: "Secondary school", hint: "Form 1–5, Lower Sixth, Upper Sixth" },
  {
    value: "combined",
    title: "Nursery, primary and secondary",
    hint: "All sections (for schools like ALL BRIGHT CHILDREN)",
  },
];

export function SchoolKindFields({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: SchoolKind | "";
  onChange: (kind: SchoolKind) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <fieldset className={compact ? "min-w-0" : "space-y-2"} disabled={disabled}>
      {compact ? <legend className="sr-only">School type</legend> : (
        <>
          <legend className="text-sm font-medium text-deep">What kind of school is this?</legend>
          <p className="text-sm text-muted">
            Structure shows only the matching classes. You can change this later. Extra levels can still be added
            by hand.
          </p>
        </>
      )}
      <div className={compact ? "flex flex-wrap gap-x-4 gap-y-1" : "space-y-2"}>
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={
              compact
                ? "flex cursor-pointer items-center gap-1.5 text-sm"
                : "flex cursor-pointer items-start gap-2 rounded-lg border border-line p-3"
            }
          >
            <input
              className={compact ? "" : "mt-1"}
              type="radio"
              name="schoolKind"
              required
              disabled={disabled}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {compact ? (
              <span>{option.title}</span>
            ) : (
              <span>
                <span className="font-medium">{option.title}</span>
                <span className="block text-sm text-muted">{option.hint}</span>
              </span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
