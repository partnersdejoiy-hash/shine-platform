import { api } from "@/convex/_generated/api";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { displayName, timeAgo } from "@/lib/format";
import { isOnline, presenceLabel } from "@/lib/presence";
import { uploadBlob } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  Check,
  CheckCheck,
  Clock,
  Eye,
  ImagePlus,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Star,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type StatusRow = {
  status: {
    _id: string;
    userId: string;
    kind: string;
    text?: string | null;
    mediaUrl?: string | null;
    mimeType?: string | null;
    visibility: string;
    viewCount?: number;
    viewers?: { userId: string; at: number }[];
    createdAt: number;
    expiresAt: number;
  };
  user: { _id: string; name?: string | null; image?: string | null; email?: string | null } | null;
};

export function AppContacts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const contacts = useQuery(api.contacts.myContacts);
  const colleagues = useQuery(api.users.directory);
  // plus supervisors at other companies on Shine you're allowed to reach
  const supervisors = useQuery(api.reach.supervisors);
  const directory = useMemo(
    () => (colleagues ? [...colleagues, ...((supervisors ?? []) as unknown as typeof colleagues)] : colleagues),
    [colleagues, supervisors],
  );
  const presenceRows = useQuery(api.users.presenceAll);
  const openDirect = useMutation(api.conversations.openDirectChat);
  const addContact = useMutation(api.contacts.add);
  const toggleFavorite = useMutation(api.contacts.toggleFavorite);
  const toggleBlock = useMutation(api.contacts.toggleBlock);
  const createGroup = useMutation(api.conversations.createGroupChat);

  const [q, setQ] = useState("");
  const [selMode, setSelMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");

  const searching = q.trim().length > 0;

  const filtered = useMemo(() => {
    const query = q.toLowerCase().trim();
    if (!query) return contacts ?? [];
    return (contacts ?? []).filter(
      (c) =>
        (c.user.name ?? "").toLowerCase().includes(query) ||
        (c.user.email ?? "").toLowerCase().includes(query),
    );
  }, [contacts, q]);

  // Employees are discoverable ONLY through search — never surfaced proactively.
  const everyone = useMemo(() => {
    const query = q.toLowerCase().trim();
    if (!query) return [];
    return (directory ?? [])
      .filter((u) => u._id !== user?._id && !u.isAnonymous && u.isActive !== false)
      .filter(
        (u) =>
          (u.name ?? "").toLowerCase().includes(query) ||
          (u.email ?? "").toLowerCase().includes(query) ||
          (u.designation ?? "").toLowerCase().includes(query) ||
          (u.department ?? "").toLowerCase().includes(query),
      )
      .slice(0, 30);
  }, [directory, q, user?._id]);

  const known = useMemo(
    () => new Set((contacts ?? []).map((c) => c.contact.contactId)),
    [contacts],
  );

  const presenceByUser = useMemo(() => {
    const map: Record<string, { status?: string; updatedAt?: number }> = {};
    for (const row of presenceRows ?? []) map[row.userId] = row;
    return map;
  }, [presenceRows]);

  const chat = async (userId: string) => {
    const convId = await openDirect({ userId: userId as any });
    navigate(`/app/chats/${convId}`);
  };

  const favorites = (contacts ?? []).filter((c) => c.contact?.isFavorite);
  const blocked = (contacts ?? []).filter((c) => c.contact?.isBlocked);
  const recent = [...(contacts ?? [])].filter((c) => !c.contact?.isBlocked).slice(0, 8);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startGroupFromSelection = async () => {
    if (selected.size === 0) return;
    const name = groupName.trim() || `Group (${selected.size + 1})`;
    try {
      const convId = await createGroup({
        name,
        memberIds: [...selected] as any,
      });
      toast.success("Group created");
      setSelMode(false);
      setSelected(new Set());
      setGroupName("");
      navigate(`/app/chats/${convId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create group");
    }
  };

  const favoriteSelected = async () => {
    for (const id of selected) await toggleFavorite({ contactId: id as any }).catch(() => {});
    toast.success("Selection updated");
    setSelected(new Set());
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Contacts</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {(contacts ?? []).length} contacts · search to find teammates
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search people…"
                className="h-10 pl-9"
              />
            </div>
            <Button
              type="button"
              variant={selMode ? "secondary" : "outline"}
              size="sm"
              className={cn("h-10 shrink-0 gap-1.5", selMode && "border-primary/40 text-primary")}
              onClick={() => {
                setSelMode((v) => !v);
                setSelected(new Set());
              }}
            >
              {selMode ? <X className="size-4" /> : <CheckCheck className="size-4" />}
              {selMode ? "Done" : "Select"}
            </Button>
          </div>
        </div>

        {/* multi-select action bar */}
        {selMode && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 p-3">
            <span className="text-xs font-medium text-primary">
              {selected.size} selected
            </span>
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name (optional)"
              className="h-8 w-48 text-xs"
            />
            <Button
              size="sm"
              className="h-8 gap-1.5"
              disabled={selected.size === 0}
              onClick={startGroupFromSelection}
            >
              <Users className="size-3.5" /> Create group
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              disabled={selected.size === 0}
              onClick={favoriteSelected}
            >
              <Star className="size-3.5" /> Favorite
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-muted-foreground"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        )}

        <Tabs defaultValue="all" className="mt-6">
          <TabsList>
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="favorites">
              Favorites {favorites.length > 0 && <span className="ml-1 text-[10px] text-primary">{favorites.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="recent">Recent</TabsTrigger>
            <TabsTrigger value="blocked">
              Blocked {blocked.length > 0 && <span className="ml-1 text-[10px] text-primary">{blocked.length}</span>}
            </TabsTrigger>
          </TabsList>

          <StatusTab onOpenChat={chat} />

          <TabsContent value="all" className="mt-4">
            {searching ? (
              <>
                <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Search className="size-3.5" />
                  {everyone.length > 0
                    ? `${everyone.length} employee${everyone.length === 1 ? "" : "s"} found for “${q.trim()}”`
                    : `No employees match “${q.trim()}”`}
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {everyone.map((u, i) => {
                    const isContact = known.has(u._id);
                    return (
                      <PersonCard
                        key={u._id}
                        user={u}
                        presence={presenceByUser[u._id] ?? null}
                        sub={u.designation || u.department || u.email}
                        delay={i * 0.03}
                        selectable={selMode}
                        selected={selected.has(u._id)}
                        onToggle={() => toggleSelect(u._id)}
                        actions={
                          <>
                            {!isContact && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Add contact"
                                onClick={() =>
                                  addContact({ contactId: u._id as any })
                                    .then(() => toast("Contact added"))
                                    .catch(() => {})
                                }
                              >
                                <UserPlus className="size-4 text-primary" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon-sm" onClick={() => chat(u._id)} title="Message">
                              <MessageSquare className="size-4" />
                            </Button>
                          </>
                        }
                      />
                    );
                  })}
                  {everyone.length === 0 && (
                    <div className="col-span-full py-14 text-center text-sm text-muted-foreground">
                      Nobody found — try a name, email, department or designation.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((c, i) => (
                  <PersonCard
                    key={c.contact.contactId}
                    user={c.user}
                    presence={c.presence}
                    sub={c.user.designation || c.user.department || c.user.email}
                    selectable={selMode}
                    selected={selected.has(c.contact.contactId)}
                    onToggle={() => toggleSelect(c.contact.contactId)}
                    actions={
                      <>
                        <Button variant="ghost" size="icon-sm" onClick={() => chat(c.contact.contactId)} title="Message">
                          <MessageSquare className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            toggleFavorite({ contactId: c.contact.contactId as any }).catch(() => {})
                          }
                          title="Favorite"
                        >
                          <Star className={cn("size-4", c.contact?.isFavorite && "fill-primary text-primary")} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground"
                          onClick={() => toggleBlock({ contactId: c.contact.contactId as any }).then(() => toast("Blocked"))}
                          title="Block"
                        >
                          <Users className="size-4" />
                        </Button>
                      </>
                    }
                    delay={i * 0.03}
                  />
                ))}
                {filtered.length === 0 && (
                  <div className="col-span-full py-14 text-center text-sm text-muted-foreground">
                    You don't have any contacts yet — search above to find teammates and add them here.
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="favorites" className="mt-4">
            <Grid>
              {favorites.map((c) => (
                <PersonCard
                  key={c.contact.contactId}
                  user={c.user}
                  presence={c.presence}
                  sub={c.user.designation || c.user.email}
                  actions={<Button variant="ghost" size="icon-sm" onClick={() => chat(c.contact.contactId)}><MessageSquare className="size-4" /></Button>}
                />
              ))}
              {favorites.length === 0 && (
                <Empty text="Star contacts to pin them here." />
              )}
            </Grid>
          </TabsContent>

          <TabsContent value="recent" className="mt-4">
            <Grid>
              {recent.map((c) => (
                <PersonCard
                  key={c.contact.contactId}
                  user={c.user}
                  presence={c.presence}
                  sub={c.lastActive ? `Active ${timeAgo(c.lastActive)}` : c.user.email}
                  actions={<Button variant="ghost" size="icon-sm" onClick={() => chat(c.contact.contactId)}><MessageSquare className="size-4" /></Button>}
                />
              ))}
              {recent.length === 0 && <Empty text="Chat with people to see them here." />}
            </Grid>
          </TabsContent>

          <TabsContent value="blocked" className="mt-4">
            <Grid>
              {blocked.map((c) => (
                <PersonCard
                  key={c.contact.contactId}
                  user={c.user}
                  presence={null}
                  sub="Blocked"
                  actions={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => toggleBlock({ contactId: c.contact.contactId as any }).then(() => toast("Unblocked"))}
                    >
                      Unblock
                    </Button>
                  }
                />
              ))}
              {blocked.length === 0 && <Empty text="Nobody is blocked." />}
            </Grid>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status — WhatsApp-style 24-hour posts                               */
/* ------------------------------------------------------------------ */

function StatusTab({ onOpenChat }: { onOpenChat: (userId: string) => void }) {
  const { user } = useAuth();
  const myStatuses = useQuery(api.statuses.myStatuses);
  const feed = useQuery(api.statuses.feed);
  const createStatus = useMutation(api.statuses.create);
  const viewStatus = useMutation(api.statuses.view);
  const removeStatus = useMutation(api.statuses.remove);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState("contacts");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string; storageId?: string; type: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const post = async () => {
    if (busy) return;
    if (!text.trim() && !preview) {
      toast.error("Add some text or a photo first");
      return;
    }
    setBusy(true);
    try {
      await createStatus({
        kind: preview ? (preview.type.startsWith("video") ? "video" : "photo") : "text",
        text: text.trim() || undefined,
        mediaUrl: preview?.url,
        mediaStorageId: preview?.storageId,
        mimeType: preview?.type,
        visibility: visibility as any,
      });
      toast.success("Status posted — visible for 24 hours");
      setText("");
      setPreview(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post status");
    } finally {
      setBusy(false);
    }
  };

  const pickMedia = async (file: File) => {
    try {
      const up = await uploadBlob(file, file.name, file.type, generateUploadUrl);
      setPreview({ url: up.url ?? "", storageId: up.storageId, type: file.type });
    } catch {
      toast.error("Upload failed");
    }
  };

  const mine = (myStatuses ?? []).slice(0, 4);
  const rows: StatusRow[] = feed ?? [];

  return (
    <TabsContent value="status" className="mt-4 space-y-5">
      {/* composer */}
      <div className="glass hairline rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Share a status</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            <Clock className="size-3" /> expires in 24h
          </span>
        </div>
        <div className="mt-3 grid gap-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind? Text, link or emoji…"
            className="min-h-20 resize-none"
            maxLength={500}
          />
          {preview && (
            <div className="relative w-fit overflow-hidden rounded-xl border border-border/60">
              {preview.type.startsWith("video") ? (
                <video src={preview.url} className="h-32 w-48 object-cover" controls />
              ) : (
                <img src={preview.url} alt="status preview" className="h-32 w-48 object-cover" />
              )}
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/70 text-white hover:bg-black/90"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickMedia(f);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="size-4" /> Photo / video
            </Button>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contacts">My contacts</SelectItem>
                <SelectItem value="org">My organization</SelectItem>
                <SelectItem value="everyone">Everyone</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="ml-auto gap-1.5" onClick={post} disabled={busy || (!text.trim() && !preview)}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              Post
            </Button>
          </div>
        </div>
      </div>

      {/* my statuses */}
      {mine.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            My status · {mine.length}
          </h3>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {mine.map((s: any) => (
              <div key={s._id} className="glass hairline relative overflow-hidden rounded-2xl p-3.5">
                {s.mediaUrl ? (
                  s.mimeType?.startsWith("video") ? (
                    <video src={s.mediaUrl} className="h-20 w-full rounded-lg object-cover" muted />
                  ) : (
                    <img src={s.mediaUrl} alt="" className="h-20 w-full rounded-lg object-cover" />
                  )
                ) : (
                  <div className="grid h-20 w-full place-items-center rounded-lg bg-primary/10 text-primary">
                    <span className="px-2 text-center text-sm font-medium">{s.text}</span>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Eye className="size-3.5" />
                    {s.viewCount ?? 0} view{(s.viewCount ?? 0) === 1 ? "" : "s"}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6 text-muted-foreground hover:text-destructive"
                    title="Delete"
                    onClick={() => removeStatus({ statusId: s._id }).then(() => toast("Status deleted"))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* feed */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Recent statuses
        </h3>
        {rows.length === 0 ? (
          <div className="glass hairline rounded-2xl py-10 text-center text-sm text-muted-foreground">
            No statuses yet — be the first to share something.
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map(({ status, user: su }) => (
              <StatusCard
                key={status._id}
                status={status}
                user={su}
                onView={() => viewStatus({ statusId: status._id as any }).catch(() => {})}
                onMessage={su ? () => onOpenChat(su._id) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </TabsContent>
  );
}

function StatusCard({
  status,
  user,
  onView,
  onMessage,
}: {
  status: StatusRow["status"];
  user: StatusRow["user"];
  onView: () => void;
  onMessage?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass hairline flex items-center gap-3 rounded-2xl p-3.5"
    >
      <UserAvatar user={user ?? { _id: status.userId }} size="lg" showStatus={false} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{user ? displayName(user) : "Someone"}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="size-3" />
          {timeAgo(status.createdAt)} · expires in{" "}
          {Math.max(1, Math.round((status.expiresAt - Date.now()) / 36e5))}h
        </div>
        {status.text && <div className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{status.text}</div>}
      </div>
      <Button variant="ghost" size="icon-sm" title="View" onClick={onView}>
        <Eye className="size-4" />
      </Button>
      {onMessage && (
        <Button variant="ghost" size="icon-sm" title="Message" onClick={onMessage}>
          <MessageSquare className="size-4" />
        </Button>
      )}
    </motion.div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="col-span-full py-14 text-center text-sm text-muted-foreground">{text}</div>;
}

function PersonCard({
  user,
  presence,
  sub,
  actions,
  delay,
  selectable,
  selected,
  onToggle,
}: {
  user: { _id: string; name?: string | null; image?: string | null; email?: string | null; designation?: string | null; department?: string | null };
  presence: { status?: string; updatedAt?: number } | null;
  sub?: string;
  actions: React.ReactNode;
  delay?: number;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay ?? 0 }}
      onClick={selectable ? onToggle : undefined}
      className={cn(
        "glass hairline flex items-center gap-3 rounded-2xl p-3.5 transition-colors",
        selectable && "cursor-pointer hover:border-primary/40",
        selected && "border-primary/50 bg-primary/5",
      )}
    >
      <UserAvatar user={user} presence={presence as any} size="lg" showStatus />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{displayName(user)}</span>
          {isOnline(presence as any) && (
            <Badge className="bg-emerald-400/15 text-emerald-400 hover:bg-emerald-400/20">
              {presenceLabel(presence as any)}
            </Badge>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</div>
      </div>
      {selectable ? (
        <div
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
          )}
        >
          {selected && <Check className="size-3.5" />}
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-0.5">{actions}</div>
      )}
    </motion.div>
  );
}
