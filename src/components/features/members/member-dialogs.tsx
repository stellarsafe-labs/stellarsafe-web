"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { newMemberError, roleChangeError } from "@/lib/domain/membership";
import type { OnChainMember, OnChainTreasuryState, Role } from "@/lib/domain/types";
import { RolePicker } from "./role-picker";

interface DialogProps {
  /** Open stays controlled by the view so Radix can play the close animation. */
  open?: boolean;
  onClose: () => void;
}

/** The view remounts this per opening (fresh state) and controls open so Radix can animate close. */
export function AddMemberDialog({
  state,
  open = true,
  onClose,
  onSubmit,
}: DialogProps & {
  state: OnChainTreasuryState;
  onSubmit: (v: { address: string; label: string; roles: Role[] }) => void;
}) {
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [roles, setRoles] = useState<Role[]>(["approver"]);
  const error = newMemberError(state, address);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add member</DialogTitle>
          <DialogDescription>
            Membership is written to the treasury contract and requires your admin signature.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <Field data-invalid={!!error || undefined}>
            <FieldLabel htmlFor="member-address">Stellar address</FieldLabel>
            <Input
              id="member-address"
              className="font-mono"
              placeholder="G…"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              aria-invalid={!!error}
              spellCheck={false}
              autoComplete="off"
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor="member-label">
              Display label <span className="text-muted-foreground font-normal">(optional, off-chain)</span>
            </FieldLabel>
            <Input
              id="member-label"
              placeholder="e.g. Jordan · Finance"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={60}
            />
          </Field>
          <RolePicker value={roles} onChange={setRoles} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit({ address: address.trim(), label: label.trim(), roles })}
            disabled={!address.trim() || !!error}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RolesDialog({
  state,
  open = true,
  member,
  memberLabel,
  onClose,
  onSubmit,
}: DialogProps & {
  state: OnChainTreasuryState;
  member: OnChainMember;
  memberLabel: string;
  onSubmit: (roles: Role[]) => void;
}) {
  const [roles, setRoles] = useState<Role[]>(member.roles);
  const error = roleChangeError(state, member, roles);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change roles</DialogTitle>
          <DialogDescription>{memberLabel}</DialogDescription>
        </DialogHeader>
        <RolePicker value={roles} onChange={setRoles} />
        {error && <FieldError>{error}</FieldError>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(roles)} disabled={!!error}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LabelDialog({
  initial,
  open = true,
  onClose,
  onSave,
}: DialogProps & { initial: string; onSave: (label: string) => Promise<void> }) {
  const [label, setLabel] = useState(initial);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(label.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit display label</DialogTitle>
          <DialogDescription>
            Labels are stored by the StellarSafe API and shown next to the address. They have no on-chain effect.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="edit-label">Label</FieldLabel>
          <Input id="edit-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            Save label
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
