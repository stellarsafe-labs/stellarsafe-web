import { Badge } from "@/components/ui/badge";
import type { Role } from "@/lib/domain/types";

const LABEL: Record<Role, string> = { admin: "Admin", approver: "Approver", proposer: "Proposer" };

export function RoleBadges({ roles }: { roles: Role[] }) {
  if (roles.length === 0) return <Badge variant="outline">Viewer</Badge>;
  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
          {LABEL[r]}
        </Badge>
      ))}
    </span>
  );
}

export const roleLabel = (r: Role) => LABEL[r];
