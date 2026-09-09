import { api } from "@/convex/_generated/api";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useAuth } from "@/hooks/use-auth";
import { displayName, formatTime } from "@/lib/format";
import { presenceDotClass } from "@/lib/presence";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  Building2,
  FileText,
  Hash,
  MessageSquare,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();
  const results = useQuery(api.messages.globalSearch, q.trim().length >= 2 ? { query: q } : "skip");

  useEffect(() => {
    if (open) setQ("");
  }, [open]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command className="rounded-2xl">
        <CommandInput
          placeholder="Search messages, people, files, meetings, channels…"
          value={q}
          onValueChange={setQ}
          className="h-12"
        />
        <CommandList>
          <CommandEmpty className="py-8 text-sm text-muted-foreground">
            No results for "{q}"
          </CommandEmpty>

          {results && (
            <>
              {results.users.length > 0 && (
                <>
                  <CommandGroup heading="People">
                    {results.users.slice(0, 5).map((u) => (
                      <CommandItem
                        key={u._id}
                        value={`user-${u._id}`}
                        onSelect={() => go(`/app/chats?new=${u._id}`)}
                        className="flex items-center gap-3"
                      >
                        <UserAvatar user={u} presence={u.presence} size="sm" showStatus />
                        <span className="flex-1 truncate">{displayName(u)}</span>
                        {u.designation && (
                          <span className="text-xs text-muted-foreground">{u.designation}</span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {results.conversations.length > 0 && (
                <>
                  <CommandGroup heading="Channels & chats">
                    {results.conversations.slice(0, 5).map((c) => (
                      <CommandItem
                        key={c._id}
                        value={`conv-${c._id}`}
                        onSelect={() => go(`/app/chats/${c._id}`)}
                        className="flex items-center gap-3"
                      >
                        {c.kind === "channel" ? (
                          <Hash className="size-4 text-primary" />
                        ) : (
                          <MessageSquare className="size-4 text-muted-foreground" />
                        )}
                        <span className="flex-1 truncate">
                          {c.kind === "channel" ? `#${c.name}` : c.name}
                        </span>
                        <span className="text-xs text-muted-foreground">{c.memberCount} members</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {results.messages.length > 0 && (
                <>
                  <CommandGroup heading="Messages">
                    {results.messages.slice(0, 6).map((m) => (
                      <CommandItem
                        key={m._id}
                        value={`msg-${m._id}`}
                        onSelect={() => go(`/app/chats/${m.conversationId}`)}
                        className="flex items-center gap-3"
                      >
                        <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">
                              {m.sender ? displayName(m.sender) : "Unknown"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              in {m.conversation?.kind === "channel" ? `#${m.conversation.name}` : (m.conversation?.name || "chat")}
                            </span>
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{m.body}</p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {results.meetings.length > 0 && (
                <>
                  <CommandGroup heading="Meetings">
                    {results.meetings.slice(0, 4).map((m) => (
                      <CommandItem
                        key={m._id}
                        value={`meeting-${m._id}`}
                        onSelect={() => go(`/app/meetings`)}
                        className="flex items-center gap-3"
                      >
                        <Video className="size-4 text-primary" />
                        <span className="flex-1 truncate">{m.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {m.status === "live" ? (
                            <Badge className="bg-emerald-400/15 text-emerald-400 hover:bg-emerald-400/20">LIVE</Badge>
                          ) : (
                            formatTime(m.startTime)
                          )}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {results.files.length > 0 && (
                <>
                  <CommandGroup heading="Files">
                    {results.files.slice(0, 4).map((f) => (
                      <CommandItem
                        key={f._id}
                        value={`file-${f._id}`}
                        onSelect={() => go(`/app/files`)}
                        className="flex items-center gap-3"
                      >
                        <FileText className="size-4 text-muted-foreground" />
                        <span className="flex-1 truncate">{f.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {results.organizations.length > 0 && (
                <CommandGroup heading="Organizations">
                  {results.organizations.slice(0, 4).map((o) => (
                    <CommandItem
                      key={o._id}
                      value={`org-${o._id}`}
                      onSelect={() => go(`/app/organizations`)}
                      className="flex items-center gap-3"
                    >
                      <Building2 className="size-4 text-primary" />
                      <span className="flex-1 truncate">{o.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}

          {!results && q.trim().length < 2 && (
            <CommandGroup heading="Quick actions">
              <CommandItem value="qa-newchat" onSelect={() => go("/app/chats?new=1")}>
                <Users className="size-4" /> Start a new chat
              </CommandItem>
              <CommandItem value="qa-meeting" onSelect={() => go("/app/meetings?new=1")}>
                <Video className="size-4" /> Schedule a meeting
              </CommandItem>
              <CommandItem value="qa-upload" onSelect={() => go("/app/files")}>
                <FileText className="size-4" /> Upload a file
              </CommandItem>
              <CommandItem value="qa-contact" onSelect={() => go("/app/contacts")}>
                <Users className="size-4" /> Find contacts
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="flex items-center gap-1 rounded border border-border px-1 py-0.5 font-mono">↑↓</span>
            navigate
            <span className="ml-1 flex items-center gap-1 rounded border border-border px-1 py-0.5 font-mono">↵</span>
            open
          </span>
          {user && <span className={cn("flex items-center gap-1.5", presenceDotClass({ status: "online" }))} />}
        </div>
      </Command>
    </CommandDialog>
  );
}
