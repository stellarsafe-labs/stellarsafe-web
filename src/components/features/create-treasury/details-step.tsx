import { Controller, type UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import type { SetupValues } from "./setup-schema";

export function DetailsStep({ form }: { form: UseFormReturn<SetupValues> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Treasury details</CardTitle>
        <CardDescription>Shown to members in the dashboard. Stored off-chain.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  placeholder="e.g. Acme Operating Treasury"
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="description"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="description">
                  Description <span className="text-muted-foreground font-normal">(optional)</span>
                </FieldLabel>
                <Textarea id="description" rows={3} {...field} />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Field>
            <FieldLabel>Managed asset</FieldLabel>
            <p className="text-sm">USDC</p>
            <FieldDescription>
              Thresholds and budgets are denominated in the managed asset. v1 supports one managed asset per treasury.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
