"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Tag, UserMinus, UserPlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { Address } from "@/components/shared/address";
import { RoleBadges, roleLabel } from "@/components/shared/role-badges";
import { ChainBadge } from "@/components/shared/chain-badge";
import { ROLE_HELP } from "@/components/features/members/role-picker";
import { AddMemberDialog, LabelDialog, RolesDialog } from "@/components/features/members/member-dialogs";
import { useTx } from "@/components/tx/tx-provider";
import { getDataSource } from "@/lib/data";
import { can } from "@/lib/domain/policy";
import { removalError } from "@/lib/domain/membership";
import { ROLES, type OnChainMember, type Role } from "@/lib/domain/types";
import { fmtDate } from "@/lib/format";
import { qk, useAddressLabel, useMe, useTreasuryId, useTreasuryMetadata, useTreasuryState } from "@/lib/query/hooks";
import { useWallet } from "@/lib/wallet/wallet-provider";

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
  // The last opened dialog stays mounted after close so Radix can run its exit animation.
  const [shown, setShown] = useState<Exclude<DialogState, null> | null>(null);
  const [opening, setOpening] = useState(0);

  const isAdmin = can(me, "manage_members");
  const ds = getDataSource();

  if (!state) return <Skeleton className="h-96" />;

  const approverCount = state.members.filter((m) => m.roles.includes("approver")).length;
  const maxRequired = Math.max(...state.policy.approvalTiers.map((t) => t.requiredApprovals));

  const submitAdd = ({ address: addr, label: name, roles }: { address: string; label: string; roles: Role[] }) => {
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

  const submitRoles = (member: OnChainMember, roles: Role[]) => {
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

  const saveLabel = async (member: OnChainMember, text: string) => {
    if (!address) return;
    try {
      await ensureApiSession();
      await ds.updateTreasuryMetadata(id, { memberLabels: { [member.address]: text } }, address);
      await queryClient.invalidateQueries({ queryKey: qk.metadata(id) });
      toast.success("Label saved");
      setDialog(null);
    } catch (e) {
      toast.error("Couldn't save label", { description: e instanceof Error ? e.message : undefined });
    }
  };

  const openDialog = (next: Exclude<DialogState, null>) => {
    setShown(next);
    setDialog(next);
    setOpening((n) => n + 1);
  };

  const close = () => setDialog(null);

  return (
    <>
      <PageHeader
        title="Members & permissions"
        description="Membership and roles live in the treasury contract. Labels are optional, off-chain, and only for display."
        actions={
          isAdmin && (
            <Button onClick={() => openDialog({ kind: "add" })}>
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
                          <DropdownMenuItem onSelect={() => openDialog({ kind: "roles", member: m })}>
                            <Pencil aria-hidden /> Change roles
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openDialog({ kind: "label", member: m })}>
                            <Tag aria-hidden /> Edit label
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={!!removalError(state, m)}
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

      {shown?.kind === "add" && (
        <AddMemberDialog
          key={`add-${opening}`}
          open={dialog?.kind === "add"}
          state={state}
          onClose={close}
          onSubmit={submitAdd}
        />
      )}
      {shown?.kind === "roles" && (
        <RolesDialog
          key={`roles-${opening}`}
          open={dialog?.kind === "roles"}
          state={state}
          member={shown.member}
          memberLabel={label(shown.member.address)}
          onClose={close}
          onSubmit={(roles) => submitRoles(shown.member, roles)}
        />
      )}
      {shown?.kind === "label" && (
        <LabelDialog
          key={`label-${opening}`}
          open={dialog?.kind === "label"}
          initial={meta.data?.memberLabels[shown.member.address] ?? ""}
          onClose={close}
          onSave={(text) => saveLabel(shown.member, text)}
        />
      )}
    </>
  );
}
