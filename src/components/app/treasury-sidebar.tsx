"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  BookOpen,
  Check,
  ChevronsUpDown,
  FilePlus2,
  Inbox,
  LayoutDashboard,
  Plus,
  Scale,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { LogoMark } from "@/components/brand/logo";
import { RoleBadges } from "@/components/shared/role-badges";
import { useMe, useMyTreasuries, useNow, useProposals, useTreasuryMetadata, useTreasuryState } from "@/lib/query/hooks";
import { evaluateProposal } from "@/lib/domain/policy";
import { useMemo } from "react";

function TreasurySwitcher({ treasuryId }: { treasuryId: string }) {
  const router = useRouter();
  const meta = useTreasuryMetadata(treasuryId);
  const mine = useMyTreasuries();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent" aria-label="Switch treasury">
          <LogoMark className="size-8" />
          <span className="grid flex-1 text-left leading-tight">
            {meta.data ? (
              <span className="truncate font-semibold">{meta.data.name}</span>
            ) : (
              <Skeleton className="h-4 w-28" />
            )}
            <span className="text-muted-foreground truncate text-xs">Treasury</span>
          </span>
          <ChevronsUpDown className="ml-auto" aria-hidden />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-60" align="start">
        <DropdownMenuLabel className="text-muted-foreground text-xs">Your treasuries</DropdownMenuLabel>
        {mine.data?.length === 0 && <DropdownMenuItem disabled>No memberships yet</DropdownMenuItem>}
        {mine.data?.map((t) => (
          <DropdownMenuItem key={t.id} onSelect={() => router.push(`/t/${t.id}`)}>
            <span className="flex-1 truncate">{t.name}</span>
            {t.id === treasuryId && <Check aria-label="current" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/treasuries/new")}>
          <Plus aria-hidden /> Create treasury
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/treasuries/join")}>
          <UserPlus aria-hidden /> Join existing
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TreasurySidebar({ treasuryId }: { treasuryId: string }) {
  const pathname = usePathname();
  const base = `/t/${treasuryId}`;
  const { setOpenMobile } = useSidebar();
  const me = useMe(treasuryId);
  const state = useTreasuryState(treasuryId);
  const proposals = useProposals(treasuryId);
  const now = useNow();

  const actionable = useMemo(() => {
    if (!state.data || !proposals.data) return 0;
    return proposals.data.filter((p) => {
      const s = evaluateProposal(state.data, p, now).status;
      return s === "pending" || s === "ready";
    }).length;
  }, [state.data, proposals.data, now]);

  const nav = [
    { href: base, label: "Overview", icon: LayoutDashboard, exact: true },
    { href: `${base}/proposals`, label: "Approvals", icon: Inbox, badge: actionable || undefined },
    { href: `${base}/proposals/new`, label: "New payment", icon: FilePlus2, exact: true },
    { href: `${base}/transactions`, label: "Transactions", icon: ArrowLeftRight },
  ];
  const govern = [
    { href: `${base}/members`, label: "Members", icon: Users },
    { href: `${base}/policies`, label: "Spending policy", icon: Scale },
    { href: `${base}/activity`, label: "Audit log", icon: Activity },
    { href: `${base}/settings`, label: "Settings", icon: Settings },
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || (pathname.startsWith(`${href}/`) && !pathname.endsWith("/new"));

  const renderItems = (items: typeof nav) =>
    items.map((item) => (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton asChild isActive={isActive(item.href, item.exact)} tooltip={item.label}>
          <Link
            href={item.href}
            onClick={() => setOpenMobile(false)}
            aria-current={isActive(item.href, item.exact) ? "page" : undefined}
          >
            <item.icon aria-hidden />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
        {"badge" in item && item.badge ? (
          <SidebarMenuBadge aria-label={`${item.badge} open proposals`}>{item.badge}</SidebarMenuBadge>
        ) : null}
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <TreasurySwitcher treasuryId={treasuryId} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Payments</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(nav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Governance</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(govern)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Documentation">
                  <Link href="/docs">
                    <BookOpen aria-hidden />
                    <span>Documentation</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <div className="bg-background/60 rounded-lg border p-3 text-xs">
          <p className="text-muted-foreground mb-1.5">Your on-chain roles</p>
          {state.isLoading ? (
            <Skeleton className="h-5 w-24" />
          ) : me ? (
            <RoleBadges roles={me.roles} />
          ) : (
            <span>Not a member</span>
          )}
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
