import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { roleLabel } from "@/components/shared/role-badges";
import { ROLES, type Role } from "@/lib/domain/types";

export const ROLE_HELP: Record<Role, string> = {
  admin: "Manage members, policy and treasury settings. Can cancel any proposal.",
  approver: "Approve payment proposals. Counts toward approval thresholds.",
  proposer: "Create payment proposals within the policy.",
};

export function RolePicker({ value, onChange }: { value: Role[]; onChange: (r: Role[]) => void }) {
  return (
    <FieldSet>
      <FieldLegend variant="label">On-chain roles</FieldLegend>
      <FieldDescription>No roles means view-only access.</FieldDescription>
      {ROLES.map((r) => (
        <Field key={r} orientation="horizontal">
          <Checkbox
            id={`role-${r}`}
            checked={value.includes(r)}
            onCheckedChange={(c) => onChange(c ? [...value, r] : value.filter((x) => x !== r))}
          />
          <div className="grid gap-0.5">
            <FieldLabel htmlFor={`role-${r}`}>{roleLabel(r)}</FieldLabel>
            <FieldDescription>{ROLE_HELP[r]}</FieldDescription>
          </div>
        </Field>
      ))}
    </FieldSet>
  );
}
