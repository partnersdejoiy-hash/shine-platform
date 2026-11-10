import { api } from "@/convex/_generated/api";
import { ChatView } from "@/components/chat/ChatView";
import { ConversationList } from "@/components/chat/ConversationList";
import { PolicyLinks } from "@/components/chat/PolicyLinks";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
import { ShineMark } from "@/components/ShineLogo";
import { isEmbedded } from "@/lib/embed";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "convex/react";
import { MessageSquarePlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";

export function AppChats() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const conversations = useQuery(api.conversations.list);
  const presenceAll = useQuery(api.users.presenceAll);
  // "New chat" in the sidebar: ?compose=1 when it brings you here, an event when you're already here
  const [newOpen, setNewOpen] = useState(() => searchParams.get("compose") === "1");
  useEffect(() => {
    const open = () => setNewOpen(true);
    window.addEventListener("shine:new-chat", open);
    return () => window.removeEventListener("shine:new-chat", open);
  }, []);

  const preselect = searchParams.get("new");
  const selectedId = id ?? null;

  const presenceMap = useMemo(() => {
    const map: Record<string, NonNullable<typeof presenceAll>[number]> = {};
    for (const p of presenceAll ?? []) map[p.userId] = p;
    return map;
  }, [presenceAll]);

  const typingMap: Record<string, { _id: string; name?: string | null }[]> = {};

  const openNew = (userId?: string) => {
    if (userId) {
      setSearchParams({ new: userId });
    }
    setNewOpen(true);
  };

  const closeNew = () => {
    setNewOpen(false);
    if (preselect || searchParams.get("compose")) setSearchParams({});
  };

  const emptyState = (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <ShineMark size={88} className="drop-shadow-[5px_5px_0_var(--sticker-shadow)]" />
      <div>
        <h2 className="text-3xl font-extrabold tracking-[-0.04em]">Pick a chat</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          Or start a new one: one person, a few people, or your whole team.
        </p>
      </div>
      <Button size="lg" onClick={() => openNew()}>
        <MessageSquarePlus className="size-4" /> Start a chat
      </Button>
    </div>
  );

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex min-h-0 flex-1">
        {/* list (hidden on mobile when a chat is open) */}
        <div
          className={
            selectedId
              ? "hidden w-80 shrink-0 border-r border-border/70 bg-background/30 lg:flex lg:flex-col"
              : "flex w-full shrink-0 flex-col border-r border-border/70 bg-background/30 lg:w-80"
          }
        >
          <ConversationList
            items={conversations as any}
            selectedId={selectedId}
            myId={user?._id}
            presenceMap={presenceMap}
            typingMap={typingMap}
            loading={conversations === undefined}
            onSelect={(cid) => navigate(`/app/chats/${cid}`)}
            onNewChat={() => openNew()}
          />
        </div>

        {/* thread — on mobile/tablet hide empty state, only show when a chat is selected */}
        <div className="min-w-0 flex-1">
          {selectedId ? (
            <ChatView
              conversationId={selectedId}
              onBack={() => navigate("/app/chats")}
            />
          ) : (
            <div className="hidden h-full flex-1 flex-col items-center justify-center lg:flex">{emptyState}</div>
          )}
        </div>
      </div>

      {/* enterprise policy links — bottom of the messaging app */}
      {/* inside Dejoiy Mail's chat panel there is no room for the footer */}
      {!isEmbedded() && <PolicyLinks />}

      <NewChatDialog
        open={newOpen}
        onOpenChange={closeNew}
        preselectUserId={preselect}
      />
    </div>
  );
}
