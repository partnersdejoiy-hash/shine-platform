import { api } from "@/convex/_generated/api";
import { ChatView } from "@/components/chat/ChatView";
import { ConversationList } from "@/components/chat/ConversationList";
import { PolicyLinks } from "@/components/chat/PolicyLinks";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
import { ShineMark } from "@/components/ShineLogo";
import { isEmbedded } from "@/lib/embed";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "convex/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
  const people = useQuery(api.users.directory);
  const openDirect = useMutation(api.conversations.openDirectChat);
  const startDirect = async (userId: string) => {
    try {
      const convId = await openDirect({ userId: userId as never });
      navigate(`/app/chats/${convId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not start the chat");
    }
  };
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
              ? "hidden w-80 shrink-0 border-r border-border/70 bg-card lg:flex lg:flex-col"
              : "flex w-full shrink-0 flex-col border-r border-border/70 bg-card lg:w-80"
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
            people={people as never}
            onStartDirect={startDirect}
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
      {/* the footer only on big screens, never inside Dejoiy Mail's chat panel */}
      {!isEmbedded() && (
        <div className="hidden lg:block">
          <PolicyLinks />
        </div>
      )}

      {/* phones: a round New chat button over the list, like WhatsApp and Zoho Cliq */}
      {!selectedId && (
        <Button
          size="icon"
          onClick={() => openNew()}
          aria-label="New chat"
          title="New chat"
          className={cn(
            "fixed right-4 z-40 size-14 rounded-2xl lg:hidden",
            isEmbedded() ? "bottom-4" : "bottom-[calc(5.25rem+env(safe-area-inset-bottom))]",
          )}
        >
          <MessageSquarePlus className="size-6" />
        </Button>
      )}

      <NewChatDialog
        open={newOpen}
        onOpenChange={closeNew}
        preselectUserId={preselect}
      />
    </div>
  );
}
