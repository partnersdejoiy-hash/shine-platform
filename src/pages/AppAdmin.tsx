import { errorMessage } from "@/lib/errors";
import { ReachSettings } from "@/components/admin/ReachSettings";
import { api } from "@/convex/_generated/api";
import { TicketCard as AdminTicketCard } from "@/components/admin/TicketCard";
import { StorageHealthTile } from "@/components/admin/StorageHealthTile";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ControlSheet } from "@/components/admin/ControlSheet";
import { useAuth } from "@/hooks/use-auth";
import { displayName, formatBytes, meetingUrl, timeAgo } from "@/lib/format";
import { meetingSiteBase } from "@/pages/MeetHome";
import { PERM_SCOPE_LABEL, ROLE_HIERARCHY, ROLE_META, type PermValue } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { getFriendlyError } from "@/lib/errors";
import { useMutation, useQuery } from "convex/react";
import {
  Activity,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Crown,
  Download,
  FileSpreadsheet,
  FileStack,
  FolderKanban,
  Gauge,
  GitBranch,
  IdCard,
  KeyRound,
  Landmark,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  MessageSquarePlus,
  Phone,
  PhoneOff,
  Plus,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Ticket,
  TicketCheck,
  Trash2,
  UploadCloud,
  Users,
  Video,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// What each admin role can do — rendered as capability chips on the landing.
const CAPABILITY_CHIPS: { roles: string[]; label: string; icon: React.ElementType }[] = [
  { roles: ["super_admin", "dejoiy_admin", "admin"], label: "User management", icon: Users },
  { roles: ["super_admin", "dejoiy_admin", "admin"], label: "Roles & permission matrix", icon: ShieldCheck },
  { roles: ["super_admin", "dejoiy_admin", "admin"], label: "Move users between orgs", icon: Building2 },
  { roles: ["super_admin", "dejoiy_admin", "admin", "super_it", "it"], label: "Permission requests", icon: KeyRound },
  { roles: ["super_admin", "dejoiy_admin", "admin"], label: "Access tickets (DJT)", icon: Ticket },
  { roles: ["super_admin", "dejoiy_admin", "admin"], label: "End any live meeting", icon: Video },
  { roles: ["super_admin", "dejoiy_admin", "admin", "super_it", "it"], label: "Audit & compliance", icon: FileStack },
  { roles: ["super_admin", "dejoiy_admin"], label: "Role hierarchy", icon: GitBranch },
  { roles: ["super_admin"], label: "Add / delete organizations", icon: Landmark },
  { roles: ["super_admin"], label: "Excel import / export", icon: FileSpreadsheet },
  { roles: ["super_admin"], label: "System health", icon: Gauge },
];

type ImportRow = {
  email: string;
  name: string;
  employeeId?: string;
  role?: string;
  department?: string;
  designation?: string;
  company?: string;
  phone?: string;
  password?: string;
  error?: string;
  _row?: number;
};

export function AppAdmin() {
  const { user } = useAuth();
  const stats = useQuery(api.admin.stats);
  const manageUsers = useQuery(api.admin.manageUsers);
  const breakdown = useQuery(api.admin.adminBreakdown);
  const logs = useQuery(api.admin.auditLogs);
  const ping = useQuery(api.admin.ping);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const setUserRole = useMutation(api.admin.setUserRole);
  const toggleActive = useMutation(api.admin.toggleUserActive);
  const liveMeetings = useQuery(api.meetings.adminLiveMeetings);
  const endLiveMeeting = useMutation(api.meetings.adminEndMeeting);
  const permissionRequests = useQuery(api.admin.allPermissionRequests);
  const reviewPermissionRequest = useMutation(api.admin.reviewPermissionRequest);
  const permMatrix = useQuery(api.permissions.getPermissionMatrix);
  const setRolePermission = useMutation(api.permissions.setRolePermission);
  const resetRolePermissions = useMutation(api.permissions.resetRolePermissions);
  const setUserPermission = useMutation(api.admin.setUserPermission);
  const allOrgs = useQuery(api.admin.allOrgs);
  const setUserOrg = useMutation(api.admin.setUserOrg);
  const createOrganization = useMutation(api.admin.createOrganization);
  const deleteOrganization = useMutation(api.admin.deleteOrganization);
  const roleHierarchy = useQuery(api.admin.roleHierarchy);
  const ensureAllEmployeeIds = useMutation(api.admin.ensureAllEmployeeIds);
  const canViewAllTickets =
    !!user && ["super_admin", "dejoiy_admin", "admin"].includes(user.role as string);
  const tickets = useQuery((canViewAllTickets ? api.tickets.allTickets : "skip") as any);
  const approvalQueue = useQuery(api.tickets.approvalQueue);
  const decideTicket = useMutation(api.tickets.decideTicket);
  const addTicketNote = useMutation(api.tickets.addTicketNote);
  const pickupTicket2 = useMutation(api.tickets.pickupTicket);
  const pickupTicket = useMutation(api.tickets.pickupTicket);
  const sendTempPasswordForTicket = useMutation(api.tickets.sendTempPasswordForTicket);
  const adminDeleteTicket = useMutation(api.tickets.adminDeleteTicket);

  const [permTarget, setPermTarget] = useState<{ id: string; name: string } | null>(null);
  const [orgDialog, setOrgDialog] = useState<"create" | "delete" | null>(null);
  const [orgForm, setOrgForm] = useState({ name: "", description: "", plan: "enterprise", ownerUserId: "" });
  const [orgDeleteTarget, setOrgDeleteTarget] = useState<any | null>(null);
  const [orgBusy, setOrgBusy] = useState(false);

  const [latency, setLatency] = useState<number | null>(null);
  const [bootAt] = useState(() => Date.now());

  // ---- Excel / CSV bulk workflows ----
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [bulkRole, setBulkRole] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  const importUsers = useMutation(api.imports.importUsers);
  const bulkAction = useMutation(api.imports.bulkUserAction);
  const adminSetPassword = useMutation(api.passwords.adminSetUserPassword);
  const provisionPassword = useMutation(api.passwords.adminProvisionPassword);
  // Privileged roles manage their own credentials — no temp password for them.
  const privilegedRoles = ["super_admin", "dejoiy_admin", "admin", "super_it", "it"];
  const exportData = useQuery(api.imports.exportUsers);

  const [pwTarget, setPwTarget] = useState<{ id: string; name: string } | null>(null);
  const [newPw, setNewPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const allSelected =
    (manageUsers?.length ?? 0) > 0 && (manageUsers ?? []).every((u) => selected.has(u._id));

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(
      allSelected ? new Set() : new Set((manageUsers ?? []).map((u) => String(u._id))),
    );

  async function exportSheet(format: "xlsx" | "csv") {
    if (!exportData) return;
    const XLSX = await import("xlsx");
    const rows = exportData.map((u) => ({
      Email: u.email,
      Name: u.name,
      "Employee ID": u.employeeId,
      Role: u.role,
      Department: u.department,
      Designation: u.designation,
      Company: u.company,
      Phone: u.phone,
      Status: u.isActive ? "active" : "inactive",
      "Last seen": u.lastSeen ? new Date(u.lastSeen).toISOString() : "",
      Created: new Date(u.createdAt).toISOString(),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, format === "csv" ? "shine-users-export.csv" : "shine-users-export.xlsx", {
      bookType: format,
    });
    toast.success(`Exported ${rows.length} users`);
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("No sheet found in the file");
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const roleSet = new Set(["super_admin", "dejoiy_admin", "admin", "super_it", "it", "president", "director", "om", "tl", "client_admin", "user", "member"]);
      const seen = new Set<string>();
      const rows: ImportRow[] = raw.map((r, i) => {
        const get = (key: string) => {
          const norm = key.toLowerCase().replace(/[^a-z0-9]/g, "");
          const hit = Object.keys(r).find(
            (c) => c.toLowerCase().replace(/[^a-z0-9]/g, "") === norm,
          );
          return hit ? String(r[hit]).trim() : "";
        };
        const email = get("Email").toLowerCase();
        const name = get("Name");
        const employeeId = get("Employee ID");
        const role = get("Role").toLowerCase() || "user";
        const password = get("Password");
        let error = "";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error = "Invalid or missing email";
        else if (!name) error = "Missing name";
        else if (!roleSet.has(role)) error = `Invalid role "${role}"`;
        else if (password && password.length < 8) error = "Password must be 8+ characters";
        else if (seen.has(email)) error = "Duplicate email in file";
        else seen.add(email);
        return {
          email,
          name,
          employeeId,
          role,
          department: get("Department"),
          designation: get("Designation"),
          company: get("Company"),
          phone: get("Phone"),
          password,
          error,
          _row: i + 2,
        };
      });
      setImportRows(rows);
      const valid = rows.filter((r) => !r.error).length;
      toast.info(`Parsed ${rows.length} rows — ${valid} valid, ${rows.length - valid} with errors`);
    } catch (err) {
      toast.error(getFriendlyError(err) || "Could not parse file");
    }
  }

  async function runImport() {
    if (!importRows) return;
    const valid = importRows.filter((r) => !r.error && r.email);
    const payload = valid.map(({ email, name, employeeId, role, department, designation, company, phone, password }) => ({
      email,
      name,
      employeeId,
      role,
      department,
      designation,
      company,
      phone,
      password: password || undefined,
    }));
    setImportBusy(true);
    try {
      const res = await importUsers({ rows: payload });
      toast.success(`Imported ${res.created} users`);
      if (res.errors.length > 0) toast.error(`${res.errors.length} rows rejected on the server`);
      setImportRows(null);
    } catch (err) {
      toast.error(getFriendlyError(err) || "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  async function runBulk(action: "activate" | "deactivate") {
    const ids = [...selected] as any;
    if (ids.length === 0) return;
    try {
      const res = await bulkAction({ userIds: ids, action });
      toast.success(`Updated ${res.updated} users`);
      setSelected(new Set());
    } catch (err) {
      toast.error(getFriendlyError(err) || "Bulk action failed");
    }
  }

  async function applyBulkRole() {
    const ids = [...selected] as any;
    if (ids.length === 0 || !bulkRole) return;
    try {
      const res = await bulkAction({ userIds: ids, action: "set_role", role: bulkRole });
      toast.success(`Updated ${res.updated} users`);
      setSelected(new Set());
      setBulkRole("");
    } catch (err) {
      toast.error(getFriendlyError(err) || "Bulk action failed");
    }
  }

  async function savePw() {
    if (!pwTarget) return;
    setPwBusy(true);
    try {
      await adminSetPassword({ userId: pwTarget.id as any, newPassword: newPw });
      toast.success("Password set — the user can now sign in with email + password");
      setPwTarget(null);
      setNewPw("");
    } catch (err) {
      toast.error(getFriendlyError(err) || "Failed to set password");
    } finally {
      setPwBusy(false);
    }
  }

  useEffect(() => {
    if (!ping) return;
    setLatency(Date.now() - ping.serverTime);
  }, [ping]);

  const uptime = useMemo(() => {
    const sec = Math.floor((Date.now() - bootAt) / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  }, [bootAt, stats]);

  const isAdmin =
    user?.role === "admin" ||
    user?.role === "dejoiy_admin" ||
    user?.role === "super_admin" ||
    user?.role === "it" ||
    user?.role === "super_it";
  const isSuper = user?.role === "super_admin";
  const isDejoiyAdmin = isSuper || user?.role === "dejoiy_admin";
  const canManagePolicies =
    user?.role === "super_admin" ||
    user?.role === "dejoiy_admin" ||
    user?.role === "admin";

  // ---- Policy management (versioned policies + acknowledgement tracking) ----
  const policyStats = useQuery((canManagePolicies ? api.policies.policyStats : "skip") as any);
  const seedPolicies = useMutation(api.policies.seedDefaultPolicies);
  const publishPolicy = useMutation(api.policies.publishPolicy);
  const createPolicy = useMutation(api.policies.createPolicy);
  const [policyDialog, setPolicyDialog] = useState(false);
  const [newPolicy, setNewPolicy] = useState({ title: "", category: "Governance", summary: "", content: "", mandatory: true });
  const [policyBusy, setPolicyBusy] = useState<string | null>(null);

  // map an org's display name (user.company) back to its id for the mover dropdown
  const orgIdOf = (company?: string | null) => {
    if (!company) return "";
    const hit = allOrgs?.find((o) => o.name === company);
    return hit ? hit._id : "";
  };

  if (user && !isAdmin) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="glass hairline max-w-md rounded-2xl p-10 text-center">
          <ShieldCheck className="mx-auto mb-3 size-9 text-primary" />
          <h2 className="text-lg font-semibold">Admin access required</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The admin console is restricted to workspace administrators and the
            <span className="font-medium text-foreground"> super admin</span>.
          </p>
        </div>
      </div>
    );
  }

  if (!stats || !isAdmin) {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cards = [
    { icon: Users, label: "Total users", value: String(stats.users), sub: `${stats.activeUsers} active accounts` },
    { icon: Activity, label: "DAU", value: String(stats.dau), sub: "last 24 hours" },
    { icon: Activity, label: "MAU", value: String(stats.mau), sub: "last 30 days" },
    { icon: MessageSquare, label: "Messages", value: String(stats.messages), sub: "all time" },
    { icon: Phone, label: "Calls", value: String(stats.calls), sub: `${stats.totalCallMinutes} min total` },
    { icon: CalendarClock, label: "Meetings", value: String(stats.meetings), sub: "scheduled + live + ended" },
    { icon: FolderKanban, label: "Tasks", value: String(stats.tasks), sub: "across orgs" },
    { icon: Building2, label: "Organizations", value: String(stats.orgs), sub: "workspaces" },
    { icon: FileStack, label: "Files", value: String(stats.files), sub: formatBytes(stats.storageBytes) },
  ];

  const renderDetail = () => {
    if (!breakdown) {
      return (
        <div className="space-y-2 p-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      );
    }
    type Row = { key: string; icon: React.ReactNode; title: string; sub: string; badge?: string; tone: string };
    let rows: Row[] = [];
    switch (openCard) {
      case "Total users":
        rows = (manageUsers ?? []).map((u) => ({
          key: u._id,
          icon: <Users className="size-4" />,
          title: displayName(u),
          sub: `${u.email ?? "no email"} · ${u.role ?? "user"} · ${u.deviceCount} device${u.deviceCount === 1 ? "" : "s"}`,
          badge: u.isActive === false ? "deactivated" : (u.presence?.status ?? "offline"),
          tone: u.isActive === false ? "red" : "green",
        }));
        break;
      case "DAU":
        rows = breakdown.activeNow.map((p) => ({
          key: p.userId,
          icon: <Activity className="size-4" />,
          title: p.name,
          sub: `last seen ${timeAgo(p.updatedAt)}`,
          badge: p.status,
          tone: p.online ? "green" : "amber",
        }));
        break;
      case "MAU":
        rows = breakdown.mauUsers.map((u) => ({
          key: u._id,
          icon: <Activity className="size-4" />,
          title: u.name,
          sub: `${u.email ?? ""} · last active ${timeAgo(u.lastSeen)}`,
          badge: u.role,
          tone: "gold",
        }));
        break;
      case "Messages":
        rows = breakdown.messages.map((m) => ({
          key: m._id,
          icon: <MessageSquare className="size-4" />,
          title: m.sender,
          sub: m.body || "(attachment)",
          badge: m.kind,
          tone: "gold",
        }));
        break;
      case "Calls":
        rows = breakdown.calls.map((c) => ({
          key: c._id,
          icon: <Phone className="size-4" />,
          title: `${c.from} → ${c.to}`,
          sub: `${c.kind} · ${timeAgo(c.startedAt)}${c.durationSec !== null ? ` · ${c.durationSec}s` : " · ongoing"}`,
          badge: c.status,
          tone: c.status === "ended" ? "green" : c.status === "active" ? "sky" : c.status === "missed" ? "red" : "amber",
        }));
        break;
      case "Meetings":
        rows = breakdown.meetings.map((m) => ({
          key: m._id,
          icon: <CalendarClock className="size-4" />,
          title: m.title,
          sub: `${m.code} · hosted by ${m.host} · ${timeAgo(m.startTime)}`,
          badge: m.status,
          tone: m.status === "live" ? "green" : m.status === "scheduled" ? "sky" : m.status === "ended" ? "amber" : "red",
        }));
        break;
      case "Tasks":
        rows = breakdown.tasks.map((t) => ({
          key: t._id,
          icon: <FolderKanban className="size-4" />,
          title: t.title,
          sub: `${t.priority} · assigned to ${t.assignee} · ${timeAgo(t.createdAt)}`,
          badge: t.status,
          tone: t.status === "done" ? "green" : t.status === "in_progress" ? "sky" : "amber",
        }));
        break;
      case "Organizations":
        rows = breakdown.orgs.map((o) => ({
          key: o._id,
          icon: <Building2 className="size-4" />,
          title: o.name,
          sub: `${o.plan} plan · owner ${o.owner} · ${timeAgo(o.createdAt)}`,
          badge: o.plan,
          tone: "gold",
        }));
        break;
      case "Files":
        rows = breakdown.files.map((f) => ({
          key: f._id,
          icon: <FileStack className="size-4" />,
          title: f.name,
          sub: `${formatBytes(f.size)} · ${f.owner} · ${timeAgo(f.createdAt)}`,
          badge: f.kind,
          tone: "gold",
        }));
        break;
    }
    if (rows.length === 0) {
      return <p className="p-8 text-center text-sm text-muted-foreground">No records yet.</p>;
    }
    return (
      <div className="divide-y divide-border/50">
        {rows.map((r) => (
          <DetailRow key={r.key} icon={r.icon} title={r.title} sub={r.sub} badge={r.badge} tone={r.tone} />
        ))}
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-6">          <div className="mx-auto max-w-6xl min-w-0">            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Admin console</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Platform analytics, user management, permission requests and compliance.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-400" /> All systems operational
            </span>
            <span className="flex items-center gap-1.5">
              <Gauge className="size-3.5 text-primary" /> {latency !== null ? `${latency}ms API latency` : "measuring…"}
            </span>
          </div>
        </div>

        {/* Role landing — the Super Admin sees the full God Console; other
            admin roles get capability chips for their selective powers. */}            <div className="mt-5 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-background/40 to-background/20 min-w-0">            <div className="flex flex-col gap-4 p-3 sm:p-5 sm:flex-row sm:items-center sm:justify-between min-w-0">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "grid size-12 shrink-0 place-items-center rounded-2xl border border-primary/25",
                  isSuper
                    ? "bg-primary/20 text-primary"
                    : "bg-accent text-foreground",
                )}
              >
                <Crown className="size-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold tracking-tight">
                    {isSuper ? "Super Admin console" : "Admin Console"}
                  </h2>
                  {isSuper && (
                    <Badge className="gap-1 bg-primary/20 text-primary hover:bg-primary/25">
                      <Sparkles className="size-3" /> Full app powers
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isSuper
                    ? "Unrestricted control over every user, organization, meeting and permission in SHINE."
                    : "Your role has selective powers — the tabs below reflect what you can manage."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CAPABILITY_CHIPS.filter((c) => c.roles.includes(user?.role as string)).map((c) => (
                <span
                  key={c.label}
                  className="flex items-center gap-1 rounded-full border border-white/10 bg-card px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
                >
                  <c.icon className="size-3 text-primary" /> {c.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* stat cards — click a tile to expand its live records */}            <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-5 min-w-0">
          {cards.map((c) => {
            const open = openCard === c.label;
            return (
              <button
                key={c.label}
                onClick={() => setOpenCard(open ? null : c.label)}
                title={`Show ${c.label} records`}
                className={cn(
                  "glass hairline card-hover group rounded-2xl p-4 text-left transition-all",
                  open && "ring-2 ring-primary/40",
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="grid size-9 place-items-center rounded-lg bg-primary/12 text-primary">
                    <c.icon className="size-4" />
                  </div>
                  {open ? (
                    <ChevronUp className="size-4 text-primary" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                  )}
                </div>
                <div className="mt-3 text-xl font-bold tabular-nums">{c.value}</div>
                <div className="text-xs font-medium">{c.label}</div>
                <div className="text-[10px] text-muted-foreground">{c.sub}</div>
              </button>
            );
          })}
        </div>

        {/* expanded tile detail */}
        {openCard && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-border/70 bg-card">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
              <span className="text-sm font-semibold">
                {openCard}{" "}
                <span className="font-normal text-muted-foreground">· live records</span>
              </span>
              <Button variant="ghost" size="icon-sm" onClick={() => setOpenCard(null)}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="max-h-96 overflow-y-auto p-2">{renderDetail()}</div>
          </div>
        )}

        <Tabs defaultValue="analytics" className="mt-6">
          <TabsList className="flex overflow-x-auto no-scrollbar gap-1">
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="audit">Audit log</TabsTrigger>
            <TabsTrigger value="meetings">Live meetings</TabsTrigger>
            <TabsTrigger value="tickets">Access tickets</TabsTrigger>
            {canManagePolicies && <TabsTrigger value="policies">Policies</TabsTrigger>}
            {isDejoiyAdmin && <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>}
            {isSuper && <TabsTrigger value="organizations">Organizations</TabsTrigger>}
            {(isAdmin || user?.role === "client_admin") && <TabsTrigger value="reach">Contact access</TabsTrigger>}
            <TabsTrigger value="health">System health</TabsTrigger>
            {isSuper && <TabsTrigger value="excel">Excel import / export</TabsTrigger>}
            {(isSuper || isAdmin) && <TabsTrigger value="control-sheet">Control Sheet</TabsTrigger>}
          </TabsList>

          <TabsContent value="analytics" className="mt-4">
            <Card className="border-border/70 shadow-none">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Messages per day · last 14 days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.messagesPerDay}>
                      <defs>
                        <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="var(--gold)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "#8A8F98" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: string) => v.slice(5)}
                      />
                      <YAxis tick={{ fontSize: 10, fill: "#8A8F98" }} axisLine={false} tickLine={false} width={32} />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(20,20,20,0.95)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "var(--gold)" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="var(--gold)"
                        strokeWidth={2}
                        fill="url(#goldFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="meetings" className="mt-4">
            <Card className="border-border/70 shadow-none">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    Live meetings · {liveMeetings?.length ?? "…"} now
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Admins can end any ongoing meeting. Private meetings (not open to
                    everyone) can be ended here but cannot be joined by admins.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {liveMeetings === undefined ? (
                  <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Loading live meetings…
                  </div>
                ) : liveMeetings.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Video className="size-6" />
                    <span>No meetings are live right now.</span>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {liveMeetings.map((m) => (
                      <div
                        key={String(m._id)}
                        className="flex flex-wrap items-center gap-3 px-4 py-3"
                      >
                        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                          <Video className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{m.title}</span>
                            {m.openToEveryone ? (
                              <Badge variant="outline" className="shrink-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                                Open
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="shrink-0 border-amber-500/30 bg-amber-500/10 text-amber-400">
                                Private
                              </Badge>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            Host: {m.hostName} · {m.participantCount} participant{m.participantCount === 1 ? "" : "s"} · Room{" "}
                            <span className="font-mono">{m.roomCode}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() =>
                              navigator.clipboard
                                .writeText(meetingUrl(meetingSiteBase(), m))
                                .catch(() => {})
                            }
                          >
                            <ClipboardCopy className="size-3.5" /> Copy link
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 gap-1.5 bg-rose-600/90 text-xs text-white hover:bg-rose-600"
                            onClick={() =>
                              endLiveMeeting({ meetingId: m._id as any })
                                .then(() => toast.success(`Ended “${m.title}”`))
                                .catch((e) => toast(e.message))
                            }
                          >
                            <PhoneOff className="size-3.5" /> End meeting
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <Card className="border-border/70 shadow-none">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">
                  User management · {manageUsers?.length ?? "…"} users
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* bulk actions toolbar */}
                <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2.5">
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={toggleAll}>
                    {allSelected ? "Clear all" : "Select all"}
                  </Button>
                  {selected.size > 0 && (
                    <>
                      <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                      <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => runBulk("activate")}>
                        <Check className="size-3.5" /> Activate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs text-muted-foreground"
                        onClick={() => runBulk("deactivate")}
                      >
                        Deactivate
                      </Button>
                      <Select value={bulkRole} onValueChange={setBulkRole}>
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue placeholder="Set role…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dejoiy_admin">DEJOIY Admin</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="super_it">Super IT</SelectItem>
                          <SelectItem value="it">IT team</SelectItem>
                          <SelectItem value="president">President</SelectItem>
                          <SelectItem value="director">Director</SelectItem>
                          <SelectItem value="om">Operations manager</SelectItem>
                          <SelectItem value="tl">Team leader</SelectItem>
                          <SelectItem value="client_admin">Client admin</SelectItem>
                          <SelectItem value="user">Employee</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" className="h-8 gap-1 text-xs" disabled={!bulkRole} onClick={applyBulkRole}>
                        <Users className="size-3.5" /> Apply role
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    title="Give every user a dedicated SHINE ID (DSU001, DAD007 …)"
                    onClick={() =>
                      ensureAllEmployeeIds()
                        .then((r) => toast.success(`Employee IDs synced (${r.assigned} assigned)`))
                        .catch((e) => toast.error(getFriendlyError(e) || "Sync failed"))
                    }
                  >
                    <IdCard className="size-3.5 text-primary" /> Sync employee IDs
                  </Button>
                </div>
                <div className="divide-y divide-border/60">
                  {(manageUsers ?? []).map((u) => (
                    <div key={u._id} className="flex items-center gap-3 p-3.5">
                      <input
                        type="checkbox"
                        checked={selected.has(u._id)}
                        onChange={() => toggleSelected(u._id)}
                        disabled={u.role === "super_admin"}
                        className="size-4 shrink-0 cursor-pointer accent-[var(--gold)]"
                      />
                      <UserAvatar user={u} presence={u.presence} size="md" showStatus />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{displayName(u)}</span>
                          {u.role === "super_admin" && (
                            <Badge className="bg-primary/15 text-primary hover:bg-primary/20">Super admin</Badge>
                          )}
                          {u.role === "dejoiy_admin" && (
                            <Badge className="bg-amber-400/15 text-amber-300 hover:bg-amber-400/20">DEJOIY Admin</Badge>
                          )}
                          {u.role === "super_it" && (
                            <Badge className="bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/20">Super IT</Badge>
                          )}
                          {u.role === "it" && (
                            <Badge className="bg-sky-500/15 text-sky-400 hover:bg-sky-500/20">IT team</Badge>
                          )}
                          {u.role === "president" && (
                            <Badge className="bg-violet-500/15 text-violet-400 hover:bg-violet-500/20">President</Badge>
                          )}
                          {u.role === "director" && (
                            <Badge className="bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/20">Director</Badge>
                          )}
                          {u.role === "om" && (
                            <Badge className="bg-teal-500/15 text-teal-400 hover:bg-teal-500/20">Operations manager</Badge>
                          )}
                          {u.role === "tl" && (
                            <Badge className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20">Team leader</Badge>
                          )}
                          {u.role === "client_admin" && (
                            <Badge className="bg-fuchsia-500/15 text-fuchsia-400 hover:bg-fuchsia-500/20">Client admin</Badge>
                          )}
                          {u.isActive === false && (
                            <Badge className="bg-rose-500/15 text-rose-400 hover:bg-rose-500/15">Deactivated</Badge>
                          )}
                          {u.isAnonymous && <Badge className="bg-accent text-muted-foreground">Guest</Badge>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{u.email ?? "no email"} · {u.deviceCount} device{u.deviceCount === 1 ? "" : "s"}</span>
                          {u.employeeId && (
                            <button
                              title={`SHINE employee ID ${u.employeeId} — click to copy`}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(u.employeeId).catch(() => {});
                                toast(`Copied ${u.employeeId}`);
                              }}
                              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary transition-colors hover:bg-primary/20"
                            >
                              <IdCard className="size-3" /> {u.employeeId}
                            </button>
                          )}
                        </div>
                      </div>
                      <Select
                        value={u.role ?? "user"}
                        disabled={u.role === "super_admin"}
                        onValueChange={(v) =>
                          setUserRole({ userId: u._id as any, role: v as any })
                            .then(() => toast.success("Role updated"))
                            .catch((e) => toast.error(getFriendlyError(e) || "Failed to update role"))
                        }
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="super_admin">Super admin</SelectItem>
                          <SelectItem value="dejoiy_admin">DEJOIY Admin</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="super_it">Super IT</SelectItem>
                          <SelectItem value="it">IT team</SelectItem>
                          <SelectItem value="president">President</SelectItem>
                          <SelectItem value="director">Director</SelectItem>
                          <SelectItem value="om">Operations manager</SelectItem>
                          <SelectItem value="tl">Team leader</SelectItem>
                          <SelectItem value="client_admin">Client admin</SelectItem>
                          <SelectItem value="user">Employee</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={orgIdOf(u.company)}
                        disabled={u.role === "super_admin"}
                        onValueChange={(v) =>
                          setUserOrg({ userId: u._id as any, orgId: v ? (v as any) : undefined })
                            .then(() => toast.success("Organization updated"))
                            .catch((e) => toast.error(getFriendlyError(e) || "Failed to move user"))
                        }
                      >
                        <SelectTrigger className="h-8 w-36 text-xs" title="Change this user's organization">
                          <SelectValue placeholder="Org…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No organization</SelectItem>
                          {allOrgs?.map((o) => (
                            <SelectItem key={o._id} value={o._id}>
                              {o.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant={u.isActive === false ? "outline" : "ghost"}
                        size="sm"
                        className={cn("h-8 text-xs", u.isActive !== false && "text-muted-foreground")}
                        disabled={u.role === "super_admin"}
                        onClick={() =>
                          toggleActive({ userId: u._id as any })
                            .then(() => toast.success(u.isActive === false ? "User reactivated" : "User deactivated"))
                            .catch((e) => toast.error(getFriendlyError(e) || "Failed to update user"))
                        }
                      >
                        {u.isActive === false ? "Reactivate" : "Deactivate"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-xs text-muted-foreground"
                        onClick={() =>
                          setPermTarget({ id: u._id, name: displayName(u) })
                        }
                        title="Grant or revoke individual permissions for this user"
                      >
                        <ShieldCheck className="size-3.5" /> Permissions
                        {(u.approvedPermissions?.length ?? 0) > 0 && (
                          <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                            {u.approvedPermissions.length}
                          </span>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-xs text-muted-foreground"
                        disabled={u.role === "super_admin" && user?.role !== "super_admin"}
                        onClick={() => {
                          setPwTarget({ id: u._id, name: displayName(u) });
                          setNewPw("");
                        }}
                        title="Set or reset this user's password"
                      >
                        <KeyRound className="size-3.5" /> Password
                      </Button>
                      {!privilegedRoles.includes(u.role) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-xs text-muted-foreground"
                          disabled={u.role === "super_admin" && user?.role !== "super_admin"}
                          onClick={async () => {
                            try {
                              const res = await provisionPassword({ userId: u._id });
                              toast.success(
                                res.emailSent
                                  ? `Temp password emailed to ${u.email ?? "user"} — they must change it on first login`
                                  : `Temp password: ${res.tempPassword} (email delivery failed — share out of band)`,
                              );
                            } catch (e) {
                              toast.error(getFriendlyError(e) || "Failed to provision password");
                            }
                          }}
                          title="Email a temporary password — the user must set their own on first login"
                        >
                          <Mail className="size-3.5" /> Temp
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {!manageUsers && (
                  <div className="space-y-3 p-4">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions" className="mt-4 space-y-4">
            <PermissionMatrix
              data={permMatrix}
              setRolePermission={setRolePermission}
              resetRole={resetRolePermissions}
            />

            <Card className="border-border/70 shadow-none">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">
                  Permission requests ·{" "}
                  {(permissionRequests ?? []).filter((r) => r.status === "pending").length} pending
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/60">
                  {(permissionRequests ?? []).map((r) => (
                    <div key={r._id} className="flex items-center gap-3 p-3.5">
                      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <KeyRound className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">
                            {r.requester ? displayName(r.requester as any) : "Unknown user"}
                          </span>
                          <Badge className="bg-accent font-mono text-[10px] text-muted-foreground">
                            {r.permission}
                          </Badge>
                          <Badge
                            className={cn(
                              r.status === "pending" && "bg-amber-500/15 text-amber-400",
                              r.status === "approved" && "bg-emerald-500/15 text-emerald-400",
                              r.status === "rejected" && "bg-rose-500/15 text-rose-400",
                            )}
                          >
                            {r.status}
                          </Badge>
                        </div>
                        {r.reason && (
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">"{r.reason}"</div>
                        )}
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {timeAgo(r.createdAt)}
                          {r.expiresAt && ` · expires ${new Date(r.expiresAt).toLocaleDateString()}`}
                          {r.reviewer && ` · reviewed by ${displayName(r.reviewer as any)}`}
                        </div>
                      </div>
                      {r.status === "pending" && (
                        <div className="flex shrink-0 gap-1.5">
                          <Button
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() =>
                              reviewPermissionRequest({ requestId: r._id, approve: true })
                                .then(() => toast.success("Permission granted"))
                                .catch((e) => toast.error(getFriendlyError(e) || "Failed"))
                            }
                          >
                            <Check className="size-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-xs text-muted-foreground"
                            onClick={() =>
                              reviewPermissionRequest({ requestId: r._id, approve: false })
                                .then(() => toast.success("Request rejected"))
                                .catch((e) => toast.error(getFriendlyError(e) || "Failed"))
                            }
                          >
                            <X className="size-3.5" /> Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {permissionRequests && permissionRequests.length === 0 && (
                    <p className="p-8 text-center text-sm text-muted-foreground">
                      No permission requests yet. Employees request access from Settings → Security.
                    </p>
                  )}
                  {!permissionRequests && (
                    <div className="space-y-3 p-4">
                      {[0, 1].map((i) => (
                        <Skeleton key={i} className="h-14 w-full" />
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card className="border-border/70 shadow-none">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Audit log · last 100 events</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[480px] divide-y divide-border/60 overflow-y-auto">
                  {(logs ?? []).map((l) => (
                    <div key={l._id} className="flex items-center gap-3 p-3 text-xs">
                      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <ShieldCheck className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{l.action}</span>
                        {l.targetType && (
                          <span className="text-muted-foreground"> · {l.targetType}</span>
                        )}
                        {l.details && (
                          <span className="text-muted-foreground"> · {l.details}</span>
                        )}
                        <div className="text-[10px] text-muted-foreground">
                          by {l.actor ? displayName(l.actor as any) : "unknown"}
                        </div>
                      </div>
                      <span className="shrink-0 text-muted-foreground">{timeAgo(l.createdAt)}</span>
                    </div>
                  ))}
                  {(logs ?? []).length === 0 && (
                    <p className="p-8 text-center text-sm text-muted-foreground">No audit events yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Access-request tickets (enterprise DJT workflow) */}
          <TabsContent value="tickets" className="mt-4 space-y-4">
            <Card className="border-border/70 shadow-none">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Ticket className="size-4 text-primary" /> Needs your decision ·{" "}
                    {approvalQueue?.length ?? "…"}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tickets are forwarded up the role hierarchy — every level above the requester
                    approves in order, and the final approval always rests with the Super Admin.
                  </p>
                </div>
                <a href="/app/tickets" className="inline-flex h-8 items-center gap-1 text-xs text-primary hover:underline">
                  Open ticket console <ArrowUpRight className="size-3.5" />
                </a>
              </CardHeader>
              <CardContent className="p-0">
                {approvalQueue === undefined ? (
                  <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Loading…
                  </div>
                ) : approvalQueue.length === 0 ? (
                  <p className="p-8 text-center text-sm text-muted-foreground">
                    Nothing is waiting on your approval right now.
                  </p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {approvalQueue.map((t) => {
                      const isReviewer = ["super_admin", "dejoiy_admin", "admin"].includes(user?.role as string);
                      const isOpen = t.status === "pending" || t.status === "in_progress";
                      const canDecide =
                        isOpen &&
                        (String((t.approverChain ?? [])[t.currentLevel ?? 0]) === String(user?._id) || isReviewer);
                      return (
                        <AdminTicketCard
                          key={t._id}
                          t={t}
                          myId={user?._id as string}
                          canDecide={canDecide}
                          isSuper={isSuper}
                          onDecide={async (approve, comment) => {
                            try {
                              const res = await decideTicket({ ticketId: t._id as any, approve, comment: comment || undefined });
                              toast.success(res.status === "approved" ? `Ticket ${t.ticketNumber} fully approved` : res.status === "rejected" ? "Ticket rejected" : `Forwarded up the chain (${(res.level ?? 0) + 1} of ${(t.approverChain ?? []).length})`);
                            } catch (e) {
                              toast.error(getFriendlyError(e) || "Failed");
                            }
                          }}
                          onAddNote={async (text) => {
                            try {
                              await addTicketNote({ ticketId: t._id as any, text });
                              toast.success("Note added");
                            } catch (e) {
                              toast.error(getFriendlyError(e) || "Failed");
                            }
                          }}
                          onPickup={async () => {
                            try {
                              await pickupTicket({ ticketId: t._id as any });
                              toast.success(`Ticket ${t.ticketNumber} picked up`);
                            } catch (e) {
                              toast.error(getFriendlyError(e) || "Failed");
                            }
                          }}
                          onSendTemp={async () => {
                            try {
                              await sendTempPasswordForTicket({ ticketId: t._id as any });
                              toast.success(`Temp password emailed — ticket resolved`);
                            } catch (e) {
                              toast.error(getFriendlyError(e) || "Failed");
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {canViewAllTickets && (
              <Card className="border-border/70 shadow-none">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">All tickets · {tickets?.length ?? "…"}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {tickets === undefined ? (
                    <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                      <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
                    </div>
                  ) : tickets.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">
                      No tickets yet. Employees raise access requests from the Ticket console.
                    </p>
                  ) : (
                    <div className="divide-y divide-border/60">
                      {tickets.map((t: any) => {
                        const isReviewer = ["super_admin", "dejoiy_admin", "admin"].includes(user?.role as string);
                        const isOpen = t.status === "pending" || t.status === "in_progress";
                        const canDecide =
                          isOpen &&
                          (String((t.approverChain ?? [])[t.currentLevel ?? 0]) === String(user?._id) || isReviewer);
                        return (
                          <AdminTicketCard
                            key={t._id}
                            t={t}
                            myId={user?._id as string}
                            compact
                            isSuper={isSuper}
                            canDecide={canDecide}
                            onDecide={async (approve, comment) => {
                              try {
                                const res = await decideTicket({ ticketId: t._id as any, approve, comment: comment || undefined });
                                toast.success(res.status === "approved" ? `Ticket ${t.ticketNumber} fully approved` : res.status === "rejected" ? "Ticket rejected" : `Forwarded up the chain (${(res.level ?? 0) + 1} of ${(t.approverChain ?? []).length})`);
                              } catch (e) {
                                toast.error(getFriendlyError(e) || "Failed");
                              }
                            }}
                            onAddNote={async (text) => {
                              try {
                                await addTicketNote({ ticketId: t._id as any, text });
                                toast.success("Note added");
                              } catch (e) {
                                toast.error(getFriendlyError(e) || "Failed");
                              }
                            }}
                            onPickup={async () => {
                              try {
                                await pickupTicket({ ticketId: t._id as any });
                                toast.success(`Ticket ${t.ticketNumber} picked up`);
                              } catch (e) {
                                toast.error(getFriendlyError(e) || "Failed");
                              }
                            }}
                            onSendTemp={async () => {
                              try {
                                await sendTempPasswordForTicket({ ticketId: t._id as any });
                                toast.success(`Temp password emailed — ticket resolved`);
                              } catch (e) {
                                toast.error(getFriendlyError(e) || "Failed");
                              }
                            }}
                            onDelete={async () => {
                              try {
                                await adminDeleteTicket({ ticketId: t._id as any });
                                toast.success(`Ticket ${t.ticketNumber} deleted`);
                              } catch (e) {
                                toast.error(getFriendlyError(e) || "Failed");
                              }
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Compliance policies — versioned + acknowledgement tracking */}
          {canManagePolicies && (
            <TabsContent value="policies" className="mt-4">
              <Card className="border-border/70 shadow-none">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
                  <div>
                    <CardTitle className="text-sm font-semibold">Policies &amp; acknowledgements</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {policyStats ? `${policyStats.policies.length} policies · ${policyStats.totalUsers} users` : "Loading…"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!policyStats || policyStats.policies.length > 0 || policyBusy === "seed"}
                      onClick={async () => {
                        setPolicyBusy("seed");
                        try {
                          const res = await seedPolicies();
                          toast.success(`Seeded ${res.created} default policies (published v1)`);
                        } catch (e) {
                          toast.error(e instanceof Error ? errorMessage(e) : "Failed");
                        } finally {
                          setPolicyBusy(null);
                        }
                      }}
                    >
                      {policyBusy === "seed" ? <Loader2 className="size-3.5 animate-spin" /> : <FileStack className="size-3.5" />}
                      Seed defaults
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={() => setPolicyDialog(true)}>
                      <Plus className="size-3.5" /> New policy
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {!policyStats ? (
                    <div className="grid gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
                  ) : policyStats.policies.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">
                      No policies yet — click “Seed defaults” to publish the ten required enterprise policies (v1).
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {policyStats.policies.map((p: any) => {
                        const progress = policyStats.totalUsers > 0 ? Math.round((p.acked / policyStats.totalUsers) * 100) : 0;
                        return (
                          <div key={p._id} className="rounded-xl border border-border/70 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-sm font-semibold">{p.title}</span>
                                  <Badge variant={p.status === "published" ? "default" : "outline"} className="h-5 px-1.5 text-[10px]">
                                    {p.status}
                                  </Badge>
                                  {p.mandatory && (
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Mandatory</Badge>
                                  )}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                                  <span>v{p.currentVersion}</span>
                                  <span>acked {p.acked}/{policyStats.totalUsers} ({progress}%)</span>
                                  <span className="text-amber-300/80">{p.pending} pending</span>
                                </div>
                              </div>
                              {p.status === "published" ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs"
                                  disabled={policyBusy === String(p._id)}
                                  onClick={async () => {
                                    setPolicyBusy(String(p._id));
                                    try {
                                      await publishPolicy({ policyId: p._id });
                                      toast.success(`"${p.title}" published as v${p.currentVersion + 1} — users must re-acknowledge`);
                                    } catch (e) {
                                      toast.error(getFriendlyError(e) || "Failed");
                                    } finally {
                                      setPolicyBusy(null);
                                    }
                                  }}
                                >
                                  {policyBusy === String(p._id) ? <Loader2 className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}
                                  Publish v{p.currentVersion + 1}
                                </Button>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">draft — publish to enforce</span>
                              )}
                            </div>
                            {p.versions?.length > 1 && (
                              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/50 pt-2">
                                {p.versions.map((v: any) => (
                                  <span key={v.version} className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                                    v{v.version} · {new Date(v.createdAt).toLocaleDateString()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Dialog open={policyDialog} onOpenChange={setPolicyDialog}>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create policy (draft v1)</DialogTitle>
                    <DialogDescription>Fill in the policy. It stays a draft until published — publishing creates version 2+.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3">
                    <Input
                      placeholder="Policy title"
                      value={newPolicy.title}
                      onChange={(e) => setNewPolicy({ ...newPolicy, title: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        placeholder="Category (e.g. Security)"
                        value={newPolicy.category}
                        onChange={(e) => setNewPolicy({ ...newPolicy, category: e.target.value })}
                      />
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Switch
                          checked={newPolicy.mandatory}
                          onCheckedChange={(v) => setNewPolicy({ ...newPolicy, mandatory: v })}
                        />
                        Mandatory acknowledgement
                      </label>
                    </div>
                    <textarea
                      placeholder="Summary (shown at the top)"
                      rows={2}
                      value={newPolicy.summary}
                      onChange={(e) => setNewPolicy({ ...newPolicy, summary: e.target.value })}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none"
                    />
                    <textarea
                      placeholder="Full content — separate paragraphs with a blank line"
                      rows={6}
                      value={newPolicy.content}
                      onChange={(e) => setNewPolicy({ ...newPolicy, content: e.target.value })}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" size="sm" onClick={() => setPolicyDialog(false)}>Cancel</Button>
                    <Button
                      size="sm"
                      disabled={policyBusy === "create" || !newPolicy.title.trim()}
                      onClick={async () => {
                        setPolicyBusy("create");
                        try {
                          await createPolicy({ ...newPolicy, title: newPolicy.title.trim(), category: newPolicy.category.trim() });
                          toast.success("Policy created (draft v1)");
                          setPolicyDialog(false);
                          setNewPolicy({ title: "", category: "Governance", summary: "", content: "", mandatory: true });
                        } catch (e) {
                          toast.error(e instanceof Error ? errorMessage(e) : "Failed");
                        } finally {
                          setPolicyBusy(null);
                        }
                      }}
                    >
                      {policyBusy === "create" ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                      Create draft
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>
          )}

          {/* Role hierarchy — who sits above whom */}
          {isDejoiyAdmin && (
            <TabsContent value="hierarchy" className="mt-4">
              <Card className="border-border/70 shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <GitBranch className="size-4 text-primary" /> SHINE role hierarchy
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Approvals flow upward — a ticket climbs this ladder until the Super Admin has the
                    final word. Employee IDs follow the prefix on the right (DSU001, DAD007 …).
                  </p>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="mx-auto flex max-w-md flex-col items-center">
                    {ROLE_HIERARCHY.map((h, i) => {
                      const count = roleHierarchy?.counts?.[h.role] ?? 0;
                      const samples = roleHierarchy?.samples?.[h.role] ?? [];
                      const isTop = h.role === "super_admin";
                      return (
                        <div key={h.role} className="flex w-full flex-col items-center">
                          <div
                            className={cn(
                              "flex w-full items-center justify-between rounded-xl border px-4 py-2.5 transition-colors",
                              isTop
                                ? "border-primary/40 bg-primary/10"
                                : "border-border/70 bg-card hover:border-primary/30",
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={cn(
                                  "grid size-8 place-items-center rounded-lg text-[10px] font-bold",
                                  isTop ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground",
                                )}
                              >
                                {h.employeeIdPrefix}
                              </span>
                              <div>
                                <div className="text-sm font-semibold">{h.label}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {samples.length > 0 ? samples.join(", ") : "No members yet"}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] text-muted-foreground">{h.employeeIdPrefix}###</span>
                              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                                {count} user{count === 1 ? "" : "s"}
                              </span>
                            </div>
                          </div>
                          {i < ROLE_HIERARCHY.length - 1 && (
                            <div className="flex h-5 flex-col items-center">
                              <div className="h-3 w-px bg-primary/30" />
                              <ChevronDown className="-mt-1 size-3.5 text-primary/50" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Super admin · organization god powers */}
          {isSuper && (
            <TabsContent value="organizations" className="mt-4">
              <Card className="border-border/70 shadow-none">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <Landmark className="size-4 text-primary" /> Organizations ·{" "}
                      {allOrgs?.length ?? "…"} workspaces
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      God powers: create and delete organizations. Deleting cascades to members,
                      teams, tasks and meeting links. The DEJOIY home org is protected.
                    </p>
                  </div>
                  <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => setOrgDialog("create")}>
                    <Plus className="size-3.5" /> Create organization
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/60">
                    {(allOrgs ?? []).map((o) => {
                      const owner = (manageUsers ?? []).find((u) => String(u._id) === String(o.ownerId));
                      return (
                        <div key={o._id} className="flex flex-wrap items-center gap-3 p-3.5">
                          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
                            <Landmark className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold">{o.name}</span>
                              <Badge className="bg-accent text-muted-foreground">{o.plan ?? "free"}</Badge>
                              {(o.slug === "dejoiy" || o.name.toLowerCase() === "dejoiy") && (
                                <Badge className="bg-primary/15 text-primary hover:bg-primary/20">Protected</Badge>
                              )}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              Owner: {owner ? displayName(owner as any) : "—"} · {timeAgo(o.createdAt)}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                            disabled={o.slug === "dejoiy" || o.name.toLowerCase() === "dejoiy"}
                            onClick={() => setOrgDeleteTarget(o)}
                          >
                            <Trash2 className="size-3.5" /> Delete
                          </Button>
                        </div>
                      );
                    })}
                    {(allOrgs ?? []).length === 0 && (
                      <p className="p-8 text-center text-sm text-muted-foreground">No organizations yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="reach" className="mt-4">
            <ReachSettings />
          </TabsContent>

          <TabsContent value="health" className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <HealthTile label="API round-trip" value={latency !== null ? `${latency}ms` : "…"} ok={latency !== null && latency < 1000} />
              <HealthTile label="This session uptime" value={uptime} ok />
              <HealthTile label="Realtime engine" value="Connected" ok />
              <HealthTile label="Search index" value="Healthy" ok />
              <StorageHealthTile bytes={stats.storageBytes} />
              <HealthTile label="Media relay (WebRTC)" value="STUN active" ok />
            </div>
          </TabsContent>

          <TabsContent value="excel" className="mt-4 space-y-4">
            {/* downloads */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="glass hairline rounded-2xl p-4">
                <FileSpreadsheet className="mb-2 size-5 text-primary" />
                <div className="text-sm font-semibold">Import template</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Empty sheet with the correct columns — fill it in and upload below.
                  The optional Password column provisions email + password login.
                </p>
                <a
                  href="/templates/shine-user-import-template.xlsx"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
                >
                  <Download className="size-3.5" /> Download .xlsx
                </a>
              </div>
              <div className="glass hairline rounded-2xl p-4">
                <FileSpreadsheet className="mb-2 size-5 text-primary" />
                <div className="text-sm font-semibold">Export users (.xlsx)</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Current directory — edit offline, then re-upload to take action.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 h-8 gap-1 text-xs"
                  onClick={() => exportSheet("xlsx")}
                  disabled={!exportData}
                >
                  <Download className="size-3.5" /> Export {exportData ? `(${exportData.length})` : "…"}
                </Button>
              </div>
              <div className="glass hairline rounded-2xl p-4">
                <FileSpreadsheet className="mb-2 size-5 text-primary" />
                <div className="text-sm font-semibold">Export users (.csv)</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Same data as comma-separated values for spreadsheets & tools.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 h-8 gap-1 text-xs"
                  onClick={() => exportSheet("csv")}
                  disabled={!exportData}
                >
                  <Download className="size-3.5" /> Export CSV
                </Button>
              </div>
            </div>

            {/* upload + preview */}
            <div className="glass hairline rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Bulk import users</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Upload .xlsx, .xls or .csv — every row is validated and previewed before
                    anything is created. Duplicates, bad emails and invalid roles are flagged.
                  </p>
                </div>
                <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onImportFile} />
                <Button size="sm" className="h-9 gap-1 text-xs" onClick={() => importInputRef.current?.click()}>
                  <UploadCloud className="size-4" /> Choose sheet
                </Button>
              </div>

              {importRows && (
                <div className="mt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-emerald-400">{importRows.filter((r) => !r.error).length} ready</span>
                      {" · "}
                      <span className="font-medium text-rose-400">{importRows.filter((r) => r.error).length} with errors</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setImportRows(null)}>
                        <X className="size-3.5" /> Clear
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 gap-1 text-xs"
                        disabled={importBusy || importRows.filter((r) => !r.error).length === 0}
                        onClick={runImport}
                      >
                        {importBusy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Check className="size-3.5" />
                        )}
                        Import {importRows.filter((r) => !r.error).length} users
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-border/70">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-card">
                        <tr className="border-b border-border/70 text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Row</th>
                          <th className="px-3 py-2 font-medium">Email</th>
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Role</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {importRows.map((r, i) => (
                          <tr key={i} className={r.error ? "bg-rose-500/5" : "bg-emerald-500/5"}>
                            <td className="px-3 py-1.5 tabular-nums">{r._row}</td>
                            <td className="max-w-[220px] truncate px-3 py-1.5">{r.email || "—"}</td>
                            <td className="max-w-[160px] truncate px-3 py-1.5">{r.name || "—"}</td>
                            <td className="px-3 py-1.5">{r.role}</td>
                            <td className="px-3 py-1.5">
                              {r.error ? (
                                <span className="text-rose-400">{r.error}</span>
                              ) : (
                                <span className="flex items-center gap-1 text-emerald-400">
                                  <Check className="size-3" /> Ready
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="control-sheet" className="mt-4">
            <Card className="border-border/70 shadow-none overflow-hidden">
              <CardContent className="p-0 h-[600px]">
                <ControlSheet />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Grant / revoke individual permissions for a user */}
        <UserPermissionsDialog
          userId={permTarget?.id ?? null}
          userName={permTarget?.name ?? null}
          permissions={permMatrix?.permissions}
          setUserPermission={setUserPermission}
          onClose={() => setPermTarget(null)}
        />

        {/* Create organization — Super Admin god power */}
        <Dialog open={orgDialog === "create"} onOpenChange={(open) => !open && setOrgDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create organization</DialogTitle>
              <DialogDescription>
                Super Admin god power — spin up a new workspace with its own teams, channels and
                member directory.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Organization name</span>
                <Input
                  value={orgForm.name}
                  onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                  placeholder="e.g. ACME Corp"
                  className="h-10"
                />
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Description</span>
                <Input
                  value={orgForm.description}
                  onChange={(e) => setOrgForm({ ...orgForm, description: e.target.value })}
                  placeholder="What does this company do?"
                  className="h-10"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Plan</span>
                  <Select value={orgForm.plan} onValueChange={(v) => setOrgForm({ ...orgForm, plan: v })}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Owner</span>
                  <Select
                    value={orgForm.ownerUserId}
                    onValueChange={(v) => setOrgForm({ ...orgForm, ownerUserId: v })}
                  >
                    <SelectTrigger className="h-10"><SelectValue placeholder="You (Super Admin)" /></SelectTrigger>
                    <SelectContent>
                      {(manageUsers ?? []).map((u) => (
                        <SelectItem key={u._id} value={u._id}>
                          {displayName(u)} {u.employeeId ? `· ${u.employeeId}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOrgDialog(null)} disabled={orgBusy}>
                Cancel
              </Button>
              <Button
                className="gap-1.5 bg-primary text-primary-foreground"
                disabled={!orgForm.name.trim() || orgBusy}
                onClick={async () => {
                  setOrgBusy(true);
                  try {
                    await createOrganization({
                      name: orgForm.name.trim(),
                      description: orgForm.description.trim() || undefined,
                      plan: orgForm.plan,
                      ownerUserId: orgForm.ownerUserId ? (orgForm.ownerUserId as any) : undefined,
                    });
                    toast.success(`Organization “${orgForm.name.trim()}” created`);
                    setOrgDialog(null);
                    setOrgForm({ name: "", description: "", plan: "enterprise", ownerUserId: "" });
                  } catch (e) {
                    toast.error(e instanceof Error ? errorMessage(e) : "Failed to create organization");
                  } finally {
                    setOrgBusy(false);
                  }
                }}
              >
                {orgBusy ? <Loader2 className="size-4 animate-spin" /> : <Landmark className="size-4" />}
                Create organization
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete organization — Super Admin god power */}
        <Dialog open={!!orgDeleteTarget} onOpenChange={(open) => !open && !orgBusy && setOrgDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete “{orgDeleteTarget?.name}”?</DialogTitle>
              <DialogDescription>
                This permanently deletes the organization, its member records, teams, tasks and
                meeting links. Users keep their accounts but lose their membership. This cannot
                be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOrgDeleteTarget(null)} disabled={orgBusy}>
                Cancel
              </Button>
              <Button
                className="gap-1.5 bg-rose-600 text-white hover:bg-rose-600/90"
                disabled={orgBusy}
                onClick={async () => {
                  if (!orgDeleteTarget) return;
                  setOrgBusy(true);
                  try {
                    await deleteOrganization({ orgId: orgDeleteTarget._id as any });
                    toast.success(`Organization “${orgDeleteTarget.name}” deleted`);
                    setOrgDeleteTarget(null);
                  } catch (e) {
                    toast.error(e instanceof Error ? errorMessage(e) : "Failed to delete organization");
                  } finally {
                    setOrgBusy(false);
                  }
                }}
              >
                {orgBusy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Delete permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Set / reset a user's password */}
        <Dialog open={!!pwTarget} onOpenChange={(open) => !open && setPwTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Set password</DialogTitle>
              <DialogDescription>
                {pwTarget
                  ? `Set a new password for ${pwTarget.name}. They can sign in with their email and this password right away.`
                  : "Set a new password for this user."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <div className="text-sm font-medium">New password</div>
              <Input
                type="password"
                autoComplete="new-password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="At least 8 characters"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newPw.length >= 8 && !pwBusy) savePw();
                }}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 8 characters. Shared with the employee out of band — they can change it
                anytime from Settings → Security.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPwTarget(null)} disabled={pwBusy}>
                Cancel
              </Button>
              <Button disabled={newPw.length < 8 || pwBusy} onClick={savePw}>
                {pwBusy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                Set password
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Permission matrix — Admin console → Permissions                      */
/* ------------------------------------------------------------------ */

const SCOPE_OPTIONS: PermValue[] = ["limited", "team", "department"];

interface PermissionDef {
  id: string;
  label: string;
  category: string;
  description: string;
  scoped?: boolean;
}

interface MatrixData {
  permissions: PermissionDef[];
  matrix: Record<string, { defaults: Record<string, PermValue>; current: Record<string, PermValue> }>;
  roles: readonly string[];
}

function PermissionMatrix({
  data,
  setRolePermission,
  resetRole,
}: {
  data: MatrixData | undefined;
  setRolePermission: (args: {
    role: string;
    permission: string;
    value?: PermValue;
  }) => Promise<unknown>;
  resetRole: (args: { role: string }) => Promise<unknown>;
}) {
  // Local working copy so edits feel instant; synced from the server query.
  const [working, setWorking] = useState<Record<string, Record<string, PermValue>> | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!data) return;
    const next: Record<string, Record<string, PermValue>> = {};
    for (const [role, m] of Object.entries(data.matrix)) {
      next[role] = { ...m.current };
    }
    setWorking(next);
  }, [data]);

  const matrix: Record<string, Record<string, PermValue>> | null =
    working ?? (data ? Object.fromEntries(Object.entries(data.matrix).map(([r, m]) => [r, m.current])) : null);

  async function apply(role: string, permission: string, value: PermValue | undefined) {
    if (!working) return;
    setWorking((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [role]: { ...prev[role] } };
      if (value === undefined) delete next[role][permission];
      else next[role][permission] = value;
      return next;
    });
    setSaving((s) => ({ ...s, [`${role}:${permission}`]: true }));
    try {
      await setRolePermission({ role, permission, value });
      toast.success(
        `${ROLE_META.find((r) => r.value === role)?.label ?? role} permission updated`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? errorMessage(err) : "Failed to update permission");
    } finally {
      setSaving((s) => {
        const next = { ...s };
        delete next[`${role}:${permission}`];
        return next;
      });
    }
  }

  async function reset(role: string) {
    setSaving((s) => ({ ...s, [`reset:${role}`]: true }));
    try {
      await resetRole({ role });
      if (data?.matrix[role]) {
        setWorking((prev) => ({
          ...(prev ?? {}),
          [role]: { ...data.matrix[role].defaults },
        }));
      }
      toast.success(
        `${ROLE_META.find((r) => r.value === role)?.label ?? role} reset to defaults`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? errorMessage(err) : "Failed to reset role");
    } finally {
      setSaving((s) => {
        const next = { ...s };
        delete next[`reset:${role}`];
        return next;
      });
    }
  }

  if (!data || !matrix) {
    return (
      <div className="glass hairline rounded-2xl p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <span className="text-sm font-semibold">Role permission matrix</span>
        </div>
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const roleCols = data.roles;
  const categories = Array.from(new Set(data.permissions.map((p) => p.category)));

  return (
    <div className="glass hairline overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-2 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-primary" />
            Role permission matrix
          </div>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Tap a cell to allow (✓) or deny (✕). Scoped permissions can be set to{" "}
            <span className="text-amber-400">Limited</span> / <span className="text-teal-400">Team</span>{" "}
            / <span className="text-indigo-400">Department</span>. Super Admin is locked to full
            access.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Check className="size-3 text-emerald-400" /> Allowed
          </span>
          <span className="flex items-center gap-1">
            <X className="size-3 text-rose-400" /> Denied
          </span>
          <span className="flex items-center gap-1">
            <Lock className="size-3 text-primary" /> Locked
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-xs">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border/70">
              <th className="w-56 px-3 py-2.5 font-medium text-muted-foreground">Permission</th>
              {roleCols.map((role) => {
                const meta = ROLE_META.find((r) => r.value === role);
                const locked = role === "super_admin";
                return (
                  <th key={role} className="px-2 py-2.5 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          meta?.badgeClass ?? "bg-accent text-muted-foreground",
                        )}
                      >
                        {meta?.short ?? role.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="max-w-[72px] truncate text-[10px] text-muted-foreground">
                        {meta?.label ?? role}
                      </span>
                      {locked && <Lock className="size-2.5 text-primary" />}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {categories.map((cat) => {
              const perms = data.permissions.filter((p) => p.category === cat);
              return (
                <Fragment key={cat}>
                  <tr className="bg-accent">
                    <td
                      colSpan={roleCols.length + 1}
                      className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {cat}
                    </td>
                  </tr>
                  {perms.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-accent">
                      <td className="px-3 py-2">
                        <div className="font-medium">{p.label}</div>
                        <div className="mt-0.5 max-w-[240px] text-[10px] leading-4 text-muted-foreground">
                          {p.description}
                        </div>
                      </td>
                      {roleCols.map((role) => {
                        const value = matrix[role]?.[p.id];
                        const locked = role === "super_admin";
                        const isDefault = data.matrix[role]?.defaults[p.id] === value;
                        return (
                          <td key={role} className="px-2 py-2 text-center">
                            <MatrixCell
                              role={role}
                              permission={p.id}
                              scoped={!!p.scoped}
                              value={locked ? true : value ?? false}
                              locked={locked}
                              isDefault={isDefault}
                              saving={!!saving[`${role}:${p.id}`]}
                              onChange={(v) => apply(role, p.id, v)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            <tr className="border-t border-border/70 bg-accent">
              <td className="px-3 py-2 font-medium text-muted-foreground">
                Reset role to defaults
              </td>
              {roleCols.map((role) => (
                <td key={role} className="px-2 py-2 text-center">
                  {role === "super_admin" ? (
                    <Lock className="mx-auto size-3.5 text-primary/60" />
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      disabled={!!saving[`reset:${role}`]}
                      onClick={() => reset(role)}
                      title={`Reset ${role} to system defaults`}
                    >
                      {saving[`reset:${role}`] ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3.5" />
                      )}
                    </Button>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatrixCell({
  role,
  permission,
  scoped,
  value,
  locked,
  isDefault,
  saving,
  onChange,
}: {
  role: string;
  permission: string;
  scoped: boolean;
  value: PermValue;
  locked: boolean;
  isDefault: boolean;
  saving: boolean;
  onChange: (v: PermValue | undefined) => void;
}) {
  const allowed = permValueAllowed(value);
  const scopedVal = typeof value === "string" ? value : undefined;

  if (locked) {
    return (
      <div className="mx-auto grid size-7 place-items-center rounded-md bg-emerald-500/10">
        <Lock className="size-3.5 text-primary" />
      </div>
    );
  }

  if (scoped) {
    return (
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => onChange(allowed ? undefined : true)}
          className={cn(
            "grid size-7 place-items-center rounded-md border transition-all",
            allowed
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
              : "border-rose-500/25 bg-rose-500/5 text-rose-400/70 hover:bg-rose-500/10",
            saving && "opacity-60",
          )}
          title={allowed ? "Allowed — click to deny" : "Denied — click to allow"}
        >
          {allowed ? <Check className="size-3.5" /> : <X className="size-3.5" />}
        </button>
        {allowed && scopedVal && (
          <button
            type="button"
            onClick={() => {
              const idx = SCOPE_OPTIONS.indexOf(scopedVal);
              const next = SCOPE_OPTIONS[(idx + 1) % SCOPE_OPTIONS.length];
              onChange(next);
            }}
            className={cn(
              "rounded-full border px-1.5 py-0.5 text-[9px] font-medium transition-colors hover:bg-accent",
              scopedVal === "limited" && "border-amber-500/30 bg-amber-500/10 text-amber-400",
              scopedVal === "team" && "border-teal-500/30 bg-teal-500/10 text-teal-400",
              scopedVal === "department" && "border-indigo-500/30 bg-indigo-500/10 text-indigo-400",
            )}
            title={`Scope: ${PERM_SCOPE_LABEL[scopedVal]} — click to change`}
          >
            {PERM_SCOPE_LABEL[scopedVal]}
          </button>
        )}
        {!isDefault && allowed && (
          <span className="size-1.5 rounded-full bg-primary" title="Overridden from default" />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onChange(allowed ? false : true)}
        className={cn(
          "grid size-7 place-items-center rounded-md border transition-all",
          allowed
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
            : "border-rose-500/25 bg-rose-500/5 text-rose-400/70 hover:bg-rose-500/10",
          saving && "opacity-60",
        )}
        title={`${role}: ${allowed ? "Allowed — click to deny" : "Denied — click to allow"}`}
      >
        {allowed ? <Check className="size-3.5" /> : <X className="size-3.5" />}
      </button>
      {!isDefault && allowed && (
        <span className="size-1.5 rounded-full bg-primary" title="Overridden from default" />
      )}
    </div>
  );
}

function permValueAllowed(value: PermValue): boolean {
  return value === true || (typeof value === "string" && value.length > 0);
}

function DetailRow({
  icon,
  title,
  sub,
  badge,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  badge?: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-accent">
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{title}</div>
        <div className="truncate text-[11px] text-muted-foreground">{sub}</div>
      </div>
      {badge && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", toneClasses(tone))}>{badge}</span>}
    </div>
  );
}

function toneClasses(tone: string): string {
  switch (tone) {
    case "gold":
      return "bg-primary/15 text-primary";
    case "green":
      return "bg-emerald-500/15 text-emerald-400";
    case "red":
      return "bg-rose-500/15 text-rose-400";
    case "sky":
      return "bg-sky-500/15 text-sky-400";
    case "violet":
      return "bg-violet-500/15 text-violet-400";
    case "amber":
      return "bg-amber-500/15 text-amber-400";
    default:
      return "bg-accent text-muted-foreground";
  }
}

/* ------------------------------------------------------------------ */
/* Per-user permission grants — Admin console → Users → Permissions     */
/* ------------------------------------------------------------------ */

function UserPermissionsDialog({
  userId,
  userName,
  permissions,
  setUserPermission,
  onClose,
}: {
  userId: string | null;
  userName: string | null;
  permissions?: { id: string; label: string; category: string; description: string }[];
  setUserPermission: (args: { userId: any; permission: string; grant: boolean }) => Promise<unknown>;
  onClose: () => void;
}) {
  const manageUsers = useQuery(api.admin.manageUsers);
  const target = manageUsers?.find((u) => String(u._id) === userId);
  const approved = new Set(target?.approvedPermissions ?? []);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(permission: string, grant: boolean) {
    if (!userId) return;
    setBusy(permission);
    try {
      await setUserPermission({ userId, permission, grant });
      toast.success(grant ? `Granted "${permission}"` : `Revoked "${permission}"`);
    } catch (err) {
      toast.error(err instanceof Error ? errorMessage(err) : "Failed to update permission");
    } finally {
      setBusy(null);
    }
  }

  const categories = Array.from(new Set((permissions ?? []).map((p) => p.category)));

  return (
    <Dialog open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            Individual permissions
          </DialogTitle>
          <DialogDescription>
            {userName ? (
              <>
                Grant or revoke specific permissions for{" "}
                <span className="font-medium text-foreground">{userName}</span>. These override
                their role — grants are enforced server-side, not just in the UI.
              </>
            ) : (
              "Choose which permissions this user can use, on top of their role."
            )}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-4">
            {categories.map((cat) => (
              <div key={cat}>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {cat}
                </div>
                <div className="overflow-hidden rounded-xl border border-border/70">
                  {(permissions ?? [])
                    .filter((p) => p.category === cat)
                    .map((p, i, arr) => (
                      <div
                        key={p.id}
                        className={cn(
                          "flex items-center justify-between gap-3 bg-card px-3 py-2.5 transition-colors hover:bg-accent",
                          i < arr.length - 1 && "border-b border-border/50",
                        )}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium">{p.label}</div>
                          <div className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                            {p.description}
                          </div>
                        </div>
                        {target?.role === "super_admin" ? (
                          <Lock className="size-3.5 shrink-0 text-primary/60" aria-label="Super admin always has full access" />
                        ) : (
                          <Switch
                            checked={approved.has(p.id)}
                            disabled={busy === p.id}
                            onCheckedChange={(checked) => toggle(p.id, checked)}
                          />
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
            {!permissions && (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HealthTile({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="glass hairline rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("size-2 rounded-full", ok ? "bg-emerald-400" : "bg-amber-400")} />
      </div>
      <div className="mt-2 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}
