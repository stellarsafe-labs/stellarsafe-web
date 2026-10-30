import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { roleLabel } from "@/components/shared/role-badges";
import { ROLES } from "@/lib/domain/types";
import type { SetupValues } from "./setup-schema";

interface Props {
  form: UseFormReturn<SetupValues>;
  /** The deploying wallet; its row can't be edited. */
  deployer: string;
}

export function MembersStep({ form, deployer }: Props) {
  const members = useFieldArray({ control: form.control, name: "members" });
  const values = useWatch({ control: form.control, name: "members" });
  const errors = form.formState.errors.members;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members & roles</CardTitle>
        <CardDescription>
          Roles are written to the contract. You can change them later, but every change is an on-chain transaction
          signed by an admin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {members.fields.map((f, i) => {
          const errs = errors?.[i];
          const roles = values?.[i]?.roles ?? [];
          return (
            <fieldset key={f.id} className="space-y-3 rounded-lg border p-4">
              <legend className="sr-only">Member {i + 1}</legend>
              <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
                <Field data-invalid={!!errs?.address || undefined}>
                  <FieldLabel htmlFor={`m-${i}-addr`}>Address</FieldLabel>
                  <Input
                    id={`m-${i}-addr`}
                    className="font-mono text-xs"
                    placeholder="G…"
                    spellCheck={false}
                    autoComplete="off"
                    readOnly={i === 0 && f.address === deployer}
                    {...form.register(`members.${i}.address`)}
                  />
                  <FieldError errors={[errs?.address]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`m-${i}-label`}>Label</FieldLabel>
                  <Input id={`m-${i}-label`} placeholder="Name · title" {...form.register(`members.${i}.label`)} />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="sm:mt-6"
                  disabled={members.fields.length === 1}
                  onClick={() => members.remove(i)}
                  aria-label={`Remove member ${i + 1}`}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="flex flex-wrap gap-4" role="group" aria-label="Roles">
                {ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={roles.includes(r)}
                      onCheckedChange={(c) =>
                        form.setValue(`members.${i}.roles`, c ? [...roles, r] : roles.filter((x) => x !== r), {
                          shouldValidate: true,
                        })
                      }
                    />
                    {roleLabel(r)}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
        <FieldError errors={[errors?.root, errors as { message?: string } | undefined]} />
        <Button
          type="button"
          variant="outline"
          onClick={() => members.append({ address: "", label: "", roles: ["approver"] })}
        >
          <Plus aria-hidden /> Add member
        </Button>
      </CardContent>
    </Card>
  );
}
