"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Tag, UserMinus, UserPlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { PageHeader } from "@/components/shared/page-header";
import { Address } from "@/components/shared/address";
import { RoleBadges, roleLabel } from "@/components/shared/role-badges";
import { ChainBadge } from "@/components/shared/chain-badge";
import { useTx } from "@/components/tx/tx-provider";
import { getDataSource } from "@/lib/data";
import { can, validatePolicy } from "@/lib/domain/policy";
import { ROLES, type OnChainMember, type Role } from "@/lib/domain/types";
import { isAccountAddress, isContractAddress } from "@/lib/stellar/address";
import { fmtDate } from "@/lib/format";
import { qk, useAddressLabel, useMe, useTreasuryId, useTreasuryMetadata, useTreasuryState } from "@/lib/query/hooks";
import { useWallet } from "@/lib/wallet/wallet-provider";

const ROLE_HELP: Record<Role, string> = {
  admin: "Manage members, policy and treasury settings. Can cancel any proposal.",
  approver: "Approve payment proposals. Counts toward approval thresholds.",
  proposer: "Create payment proposals within the policy.",
};

function RolePicker({ value, onChange }: { value: Role[]; onChange: (r: Role[]) => void }) {
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

type DialogState =
  { kind: "add" } | { kind: "roles"; member: OnChainMember } | { kind: "label"; member: OnChainMember } | null;

export function MembersView() {
  const id = useTreasuryId();
  const run = useTx();
  const queryClient = useQueryClient();
  const { address, ensureApiSession } = useWallet();
  const me = useMe(id);
  const label = useAddressLabel(id);
  const { data: state } = useTreasuryState(id);
  const meta = useTreasuryMetadata(id);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [newAddr, setNewAddr] = useState("");
  const [roles, setRoles] = useState<Role[]>(["approver"]);
  const [labelText, setLabelText] = useState("");
  const [savingLabel, setSavingLabel] = useState(false);

  const isAdmin = can(me, "manage_members");
  const ds = getDataSource();

  if (!state) return <Skeleton className="h-96" />;

  const approverCount = state.members.filter((m) => m.roles.includes("approver")).length;
  const maxRequired = Math.max(...state.policy.approvalTiers.map((t) => t.requiredApprovals));

  const addrError =
    newAddr && !(isAccountAddress(newAddr.trim()) || isContractAddress(newAddr.trim()))
      ? "Enter a valid Stellar address (G… or C…)"
      : state.members.some((m) => m.address === newAddr.trim())
        ? "This address is already a member"
        : null;

  const policyErrorFor = (next: OnChainMember[]) => validatePolicy(state.policy, next)[0] ?? null;

  const openAdd = () => {
    setNewAddr("");
    setRoles(["approver"]);
    setLabelText("");
    setDialog({ kind: "add" });
  };

  const submitAdd = () => {
    const addr = newAddr.trim();
    const name = labelText.trim();
    setDialog(null);
    run({
      title: "Add member",
      summary: (
        <div className="space-y-2 rounded-lg border p-3 text-sm">
          <Address address={addr} label={name || undefined} avatar copy={false} link={false} />
          <RoleBadges roles={roles} />
        </div>
      ),
      confirmLabel: "Sign & add member",
      treasuryId: id,
      successMessage: "Member added",
      action: async (ctx) => {
        const res = await ds.addMember(id, { address: addr, roles }, ctx);
        if (name) {
          await ensureApiSession()
            .then(() => ds.updateTreasuryMetadata(id, { memberLabels: { [addr]: name } }, ctx.source))
            .catch(() => undefined);
        }
        return res;
      },
    });
  };

  const submitRoles = (member: OnChainMember) => {
    setDialog(null);
    run({
      title: "Change roles",
      description: "Approvals this member already gave stop counting if you remove their approver role.",
      summary: (
        <div className="space-y-2 rounded-lg border p-3 text-sm">
          <Address address={member.address} label={label(member.address)} avatar copy={false} link={false} />
          <p className="flex flex-wrap items-center gap-2">
            <RoleBadges roles={member.roles} /> → <RoleBadges roles={roles} />
          </p>
        </div>
      ),
      confirmLabel: "Sign & update roles",
      treasuryId: id,
      successMessage: "Roles updated",
      action: (ctx) => ds.updateMemberRoles(id, member.address, roles, ctx),
    });
  };

  const remove = (member: OnChainMember) =>
    run({
      title: "Remove member",
      description:
        "They lose all on-chain permissions immediately, and approvals they gave on pending proposals stop counting.",
      summary: (
        <div className="rounded-lg border p-3 text-sm">
          <Address address={member.address} label={label(member.address)} avatar copy={false} link={false} />
        </div>
      ),
      confirmLabel: "Sign & remove",
      destructive: true,
      treasuryId: id,
      successMessage: "Member removed",
      action: (ctx) => ds.removeMember(id, member.address, ctx),
    });

  const saveLabel = async (member: OnChainMember) => {
    if (!address) return;
    setSavingLabel(true);
    try {
      await ensureApiSession();
      await ds.updateTreasuryMetadata(id, { memberLabels: { [member.address]: labelText.trim() } }, address);
      await queryClient.invalidateQueries({ queryKey: qk.metadata(id) });
      toast.success("Label saved");
      setDialog(null);
    } catch (e) {
      toast.error("Couldn't save label", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSavingLabel(false);
    }
  };

  const rolesDialogMember = dialog?.kind === "roles" ? dialog.member : null;
  const rolesChangeError = rolesDialogMember
    ? (() => {
        const admins = state.members.filter((m) => m.roles.includes("admin"));
        if (rolesDialogMember.roles.includes("admin") && !roles.includes("admin") && admins.length === 1) {
          return "A treasury must keep at least one admin.";
        }
        return policyErrorFor(
          state.members.map((m) => (m.address === rolesDialogMember.address ? { ...m, roles } : m)),
        );
      })()
    : null;

  return (
    <>
      <PageHeader
        title="Members & permissions"
        description="Membership and roles live in the treasury contract. Labels are optional, off-chain, and only for display."
        actions={
          isAdmin && (
            <Button onClick={openAdd}>
              <UserPlus aria-hidden /> Add member
            </Button>
          )
        }
      >
        <div className="pt-1">
          <ChainBadge ledger={state.ledger} readAt={state.readAt} />
        </div>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {ROLES.map((r) => (
          <Card key={r} className="gap-1 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-base">
                {roleLabel(r)}s · {state.members.filter((m) => m.roles.includes(r)).length}
              </CardTitle>
              <CardDescription>{ROLE_HELP[r]}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {approverCount <= maxRequired && (
        <p className="border-warning/40 bg-warning/5 mb-4 rounded-lg border px-3 py-2 text-sm" role="note">
          Your highest approval tier needs {maxRequired} approvers and you have {approverCount}. If one approver is
          unavailable, large payments can&apos;t execute. Consider adding a backup approver.
        </p>
      )}

      <Card className="py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Member</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="hidden md:table-cell">Added</TableHead>
                <TableHead className="w-12 pr-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.members.map((m) => (
                <TableRow key={m.address}>
                  <TableCell className="pl-4">
                    <Address address={m.address} label={label(m.address)} avatar />
                    {m.address === address && <span className="text-primary ml-9 text-xs">You</span>}
                  </TableCell>
                  <TableCell>
                    <RoleBadges roles={m.roles} />
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">{fmtDate(m.addedAt)}</TableCell>
                  <TableCell className="pr-4">
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${label(m.address)}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setRoles(m.roles);
                              setDialog({ kind: "roles", member: m });
                            }}
                          >
                            <Pencil aria-hidden /> Change roles
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              setLabelText(meta.data?.memberLabels[m.address] ?? "");
                              setDialog({ kind: "label", member: m });
                            }}
                          >
                            <Tag aria-hidden /> Edit label
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={
                              !!policyErrorFor(state.members.filter((x) => x.address !== m.address)) ||
                              (m.roles.includes("admin") &&
                                state.members.filter((x) => x.roles.includes("admin")).length === 1)
                            }
                            onSelect={() => remove(m)}
                          >
                            <UserMinus aria-hidden /> Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialog?.kind === "add"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
            <DialogDescription>
              Membership is written to the treasury contract and requires your admin signature.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <Field data-invalid={!!addrError || undefined}>
              <FieldLabel htmlFor="member-address">Stellar address</FieldLabel>
              <Input
                id="member-address"
                className="font-mono"
                placeholder="G…"
                value={newAddr}
                onChange={(e) => setNewAddr(e.target.value)}
                aria-invalid={!!addrError}
                spellCheck={false}
                autoComplete="off"
              />
              {addrError && <FieldError>{addrError}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="member-label">
                Display label <span className="text-muted-foreground font-normal">(optional, off-chain)</span>
              </FieldLabel>
              <Input
                id="member-label"
                placeholder="e.g. Jordan · Finance"
                value={labelText}
                onChange={(e) => setLabelText(e.target.value)}
                maxLength={60}
              />
            </Field>
            <RolePicker value={roles} onChange={setRoles} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onClick={submitAdd} disabled={!newAddr || !!addrError}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.kind === "roles"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change roles</DialogTitle>
            <DialogDescription>{rolesDialogMember && label(rolesDialogMember.address)}</DialogDescription>
          </DialogHeader>
          <RolePicker value={roles} onChange={setRoles} />
          {rolesChangeError && <FieldError>{rolesChangeError}</FieldError>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onClick={() => rolesDialogMember && submitRoles(rolesDialogMember)} disabled={!!rolesChangeError}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.kind === "label"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit display label</DialogTitle>
            <DialogDescription>
              Labels are stored by the StellarSafe API and shown next to the address. They have no on-chain effect.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="edit-label">Label</FieldLabel>
            <Input id="edit-label" value={labelText} onChange={(e) => setLabelText(e.target.value)} maxLength={60} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onClick={() => dialog?.kind === "label" && saveLabel(dialog.member)} disabled={savingLabel}>
              Save label
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
