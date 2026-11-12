import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  Pencil,
  Search,
  Shield,
  Users,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";

// ─── Roles ──────────────────────────────────────────────────────────────
const ROLES = [
  "super_admin", "dejoiy_admin", "admin", "super_it", "it",
  "president", "director", "om", "tl", "client_admin", "user", "member",
] as const;

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  dejoiy_admin: "DEJOIY Admin",
  admin: "Administrator",
  super_it: "Super IT",
  it: "IT Team",
  president: "President",
  director: "Director",
  om: "Operations Mgr",
  tl: "Team Leader",
  client_admin: "Client Admin",
  user: "Employee",
  member: "Member",
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  super_admin: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  dejoiy_admin: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  admin: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  super_it: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  it: "bg-teal-500/15 text-teal-400 border-teal-500/30",
  president: "bg-gold/15 text-gold border-gold/30",
  director: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  om: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  tl: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  client_admin: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  user: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  member: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

const TABS = [
  { id: "users", label: "Users", icon: Users },
  { id: "roles", label: "Roles & Permissions", icon: Shield },
] as const;

// ─── Inline Edit Cell ──────────────────────────────────────────────────
function InlineEditCell({
  value,
  onSave,
  type = "text",
  options,
}: {
  value: string | boolean | number | null | undefined;
  onSave: (v: string | boolean | null) => void;
  type?: "text" | "select" | "toggle";
  options?: { value: string; label: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));

  const save = () => {
    setEditing(false);
    if (type === "toggle") {
      onSave(!value);
    } else if (draft !== String(value ?? "")) {
      onSave(draft === "true" ? true : draft === "false" ? false : draft || null);
    }
  };

  if (type === "toggle") {
    return (
      <button
        onClick={() => onSave(!value)}
        className={cn(
          "inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          value ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "size-4 rounded-full bg-white shadow-sm transition-transform",
            value ? "translate-x-5.5" : "translate-x-0.5"
          )}
        />
      </button>
    );
  }

  if (type === "select" && options) {
    return (
      <Select value={String(value ?? "")} onValueChange={(v) => onSave(v)}>
        <SelectTrigger className="h-7 w-full text-xs border-primary/30 bg-card" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <Input
          autoFocus
          value={draft}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          className="h-7 text-xs"
        />
        <button onClick={save} className="text-primary"><Check className="size-3" /></button>
        <button onClick={() => setEditing(false)} className="text-muted-foreground"><X className="size-3" /></button>
      </div>
    );
  }

  return (
    <span
      className="group/edit flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-accent"
      onClick={(e: React.MouseEvent) => { e.stopPropagation(); setDraft(String(value ?? "")); setEditing(true); }}
    >
      <span className="truncate">{String(value ?? "—")}</span>
      <Pencil className="size-2.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/edit:opacity-100" />
    </span>
  );
}

// ─── Users Tab (TanStack Table v9 compatible — plain table approach) ────
function UsersTab({ currentUserRole }: { currentUserRole?: string }) {
  const users = useQuery(api.admin.manageUsers);
  const updateField = useMutation(api.admin.adminUpdateUserField);
  const setRole = useMutation(api.admin.setUserRole);
  const toggleActive = useMutation(api.admin.toggleUserActive);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const canEdit = currentUserRole === "super_admin" || currentUserRole === "dejoiy_admin" || currentUserRole === "admin";

  const handleFieldUpdate = useCallback(
    async (userId: string, field: string, value: any) => {
      try {
        await updateField({ userId: userId as any, field, value });
        toast.success(`Updated ${field}`);
      } catch (e) {
        toast.error(e instanceof Error ? errorMessage(e) : "Update failed");
      }
    },
    [updateField]
  );

  const handleRoleChange = useCallback(
    async (userId: string, role: string) => {
      try {
        await setRole({ userId: userId as any, role: role as any });
        toast.success("Role updated");
      } catch (e) {
        toast.error(e instanceof Error ? errorMessage(e) : "Role change failed");
      }
    },
    [setRole]
  );

  const handleToggleActive = useCallback(
    async (userId: string) => {
      try {
        await toggleActive({ userId: userId as any });
        toast.success("Status toggled");
      } catch (e) {
        toast.error(e instanceof Error ? errorMessage(e) : "Toggle failed");
      }
    },
    [toggleActive]
  );

  const data = useMemo(() => {
    if (!users) return [];
    let rows = [...users];
    // global filter
    if (globalFilter) {
      const q = globalFilter.toLowerCase();
      rows = rows.filter((r: any) =>
        (r.name ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.role ?? "").toLowerCase().includes(q) ||
        (r.department ?? "").toLowerCase().includes(q) ||
        (r.designation ?? "").toLowerCase().includes(q) ||
        (r.company ?? "").toLowerCase().includes(q) ||
        (r.location ?? "").toLowerCase().includes(q)
      );
    }
    // sort
    rows.sort((a: any, b: any) => {
      const av = String(a[sortKey] ?? "").toLowerCase();
      const bv = String(b[sortKey] ?? "").toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [users, globalFilter, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  type SortHeaderProps = { field: string; label: string; width?: string };
  const SortHeader = ({ field, label, width }: SortHeaderProps) => (
    <th
      className="whitespace-nowrap border-b border-border/70 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none"
      style={{ width }}
      onClick={() => toggleSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortKey === field ? (
          sortDir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
        ) : (
          <ArrowUpDown className="size-3 opacity-30" />
        )}
      </span>
    </th>
  );

  if (users === undefined) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-2.5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGlobalFilter(e.target.value)}
            placeholder="Search users by name, email, role, department…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="size-3.5" />
          {data.length} user{data.length !== 1 ? "s" : ""}
          {globalFilter && ` (filtered from ${users.length})`}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => {
            const headers = ["Name", "Email", "Role", "Department", "Designation", "Active", "Company", "Location", "Phone"];
            const rows = data.map((r: any) => [
              r.name ?? "", r.email ?? "", ROLE_LABELS[r.role] ?? r.role ?? "",
              r.department ?? "", r.designation ?? "", r.isActive !== false ? "Yes" : "No",
              r.company ?? "", r.location ?? "", r.phone ?? "",
            ]);
            const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = "shine-users.csv"; a.click();
            URL.revokeObjectURL(url);
            toast.success("Exported users CSV");
          }}
        >
          <Download className="size-3" /> Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-sidebar">
            <tr>
              <SortHeader field="name" label="Name" width="180px" />
              <SortHeader field="email" label="Email" width="200px" />
              <SortHeader field="role" label="Role" width="140px" />
              <SortHeader field="department" label="Department" width="120px" />
              <SortHeader field="designation" label="Designation" width="120px" />
              <SortHeader field="isActive" label="Active" width="70px" />
              <SortHeader field="company" label="Company" width="120px" />
              <SortHeader field="location" label="Location" width="110px" />
              <SortHeader field="phone" label="Phone" width="110px" />
            </tr>
          </thead>
          <tbody>
            {data.map((user: any) => (
              <tr
                key={user._id}
                className="border-b border-border/40 transition-colors hover:bg-accent"
              >
                {/* Name */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 min-w-[140px]">
                    <div className="size-7 shrink-0 rounded-full bg-primary/15 grid place-items-center text-[10px] font-bold text-primary">
                      {(user.name ?? "U")[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      {canEdit ? (
                        <InlineEditCell
                          value={user.name}
                          onSave={(v) => handleFieldUpdate(user._id, "name", v)}
                        />
                      ) : (
                        <span className="truncate text-sm">{user.name ?? "—"}</span>
                      )}
                    </div>
                  </div>
                </td>
                {/* Email */}
                <td className="px-3 py-2">
                  <span className="truncate text-xs text-muted-foreground">{user.email ?? "—"}</span>
                </td>
                {/* Role */}
                <td className="px-3 py-2">
                  {canEdit ? (
                    <InlineEditCell
                      value={user.role ?? "user"}
                      type="select"
                      options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r }))}
                      onSave={(v) => handleRoleChange(user._id, String(v))}
                    />
                  ) : (
                    <Badge variant="outline" className={cn("text-[10px] font-medium", ROLE_BADGE_COLORS[user.role ?? "user"])}>
                      {ROLE_LABELS[user.role ?? "user"] ?? user.role}
                    </Badge>
                  )}
                </td>
                {/* Department */}
                <td className="px-3 py-2">
                  {canEdit ? (
                    <InlineEditCell value={user.department} onSave={(v) => handleFieldUpdate(user._id, "department", v)} />
                  ) : (
                    <span className="text-xs">{user.department ?? "—"}</span>
                  )}
                </td>
                {/* Designation */}
                <td className="px-3 py-2">
                  {canEdit ? (
                    <InlineEditCell value={user.designation} onSave={(v) => handleFieldUpdate(user._id, "designation", v)} />
                  ) : (
                    <span className="text-xs">{user.designation ?? "—"}</span>
                  )}
                </td>
                {/* Active */}
                <td className="px-3 py-2">
                  {canEdit ? (
                    <InlineEditCell
                      value={user.isActive !== false}
                      type="toggle"
                      onSave={() => handleToggleActive(user._id)}
                    />
                  ) : (
                    <Badge variant="outline" className={cn("text-[10px]", user.isActive !== false ? "text-emerald-400" : "text-red-400")}>
                      {user.isActive !== false ? "Yes" : "No"}
                    </Badge>
                  )}
                </td>
                {/* Company */}
                <td className="px-3 py-2">
                  {canEdit ? (
                    <InlineEditCell value={user.company} onSave={(v) => handleFieldUpdate(user._id, "company", v)} />
                  ) : (
                    <span className="text-xs">{user.company ?? "—"}</span>
                  )}
                </td>
                {/* Location */}
                <td className="px-3 py-2">
                  {canEdit ? (
                    <InlineEditCell value={user.location} onSave={(v) => handleFieldUpdate(user._id, "location", v)} />
                  ) : (
                    <span className="text-xs">{user.location ?? "—"}</span>
                  )}
                </td>
                {/* Phone */}
                <td className="px-3 py-2">
                  {canEdit ? (
                    <InlineEditCell value={user.phone} onSave={(v) => handleFieldUpdate(user._id, "phone", v)} />
                  ) : (
                    <span className="text-xs">{user.phone ?? "—"}</span>
                  )}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-muted-foreground">
                  {globalFilter ? "No users match your search." : "No users found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Roles & Permissions Tab ────────────────────────────────────────────
function RolesTab() {
  const permMatrix = useQuery(api.permissions.getPermissionMatrix);
  const [permSearch, setPermSearch] = useState("");

  if (permMatrix === undefined) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const perms = (permMatrix.permissions as any[]) ?? [];
  const matrix = (permMatrix.matrix ?? {}) as Record<string, { defaults: Record<string, any>; current: Record<string, any> }>;
  const roles = [...(permMatrix.roles as readonly string[])];

  const filteredPerms = permSearch
    ? perms.filter((p: any) =>
        (p.id ?? "").toLowerCase().includes(permSearch.toLowerCase()) ||
        (p.label ?? "").toLowerCase().includes(permSearch.toLowerCase())
      )
    : perms;

  const displayPerms = filteredPerms.slice(0, 30);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
        <span className="text-sm font-semibold">Role Permission Matrix</span>
        <Badge variant="outline" className="text-[10px] text-muted-foreground">
          {perms.length} permissions × {roles.length} roles
        </Badge>
        <div className="relative ml-auto max-w-[200px]">
          <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={permSearch}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPermSearch(e.target.value)}
            placeholder="Filter permissions…"
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-sidebar">
            <tr className="border-b border-border/70">
              <th className="sticky left-0 z-10 bg-sidebar px-3 py-2 text-left font-semibold min-w-[120px]">Role</th>
              {displayPerms.map((p: any) => (
                <th key={p.id} className="whitespace-nowrap px-2 py-2 text-center text-[9px] font-medium text-muted-foreground min-w-[60px]" title={p.label ?? p.id}>
                  {(p.label ?? p.id ?? "").replace(/_/g, " ").slice(0, 18)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((role: string) => {
              const roleMatrix = matrix[role]?.current ?? {};
              return (
                <tr key={role} className="border-b border-border/40 transition-colors hover:bg-accent">
                  <td className="sticky left-0 z-10 bg-card px-3 py-1.5">
                    <Badge variant="outline" className={cn("text-[10px] font-medium whitespace-nowrap", ROLE_BADGE_COLORS[role])}>
                      {ROLE_LABELS[role] ?? role}
                    </Badge>
                  </td>
                  {displayPerms.map((p: any) => {
                    const val = roleMatrix[p.id];
                    return (
                      <td key={p.id} className="px-2 py-1.5 text-center">
                        {val === true || val === "granted" ? (
                          <span className="inline-flex size-4 items-center justify-center rounded-full bg-emerald-500/15 text-[9px] text-emerald-400">✓</span>
                        ) : val === false || val === "denied" ? (
                          <span className="inline-flex size-4 items-center justify-center rounded-full bg-red-500/15 text-[9px] text-red-400">✗</span>
                        ) : typeof val === "string" ? (
                          <Badge variant="outline" className="text-[8px]">{val}</Badge>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {displayPerms.length < filteredPerms.length && (
          <div className="py-3 text-center text-xs text-muted-foreground">
            Showing {displayPerms.length} of {filteredPerms.length} permissions. Use search to narrow down.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ControlSheet ─────────────────────────────────────────────────
export function ControlSheet() {
  const user = useQuery(api.users.currentUser);
  const [activeTab, setActiveTab] = useState<string>("users");

  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = isSuperAdmin || user?.role === "dejoiy_admin" || user?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <Shield className="size-10 text-muted-foreground/40" />
        <div>
          <p className="text-sm font-semibold">Admin Access Required</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The Enterprise Control Sheet requires Administrator privileges.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border/70 px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors",
              activeTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5">
            <Shield className="size-2.5 text-primary" />
            {isSuperAdmin ? "God Mode" : "Admin"}
          </span>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex min-h-0 flex-1 flex-col">
        {activeTab === "users" && <UsersTab currentUserRole={user?.role} />}
        {activeTab === "roles" && <RolesTab />}
      </div>
    </div>
  );
}
