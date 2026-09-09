import { api } from "@/convex/api";
import { ChatView } from "@/components/chat/ChatView";
import { ConversationList } from "@/components/chat/ConversationList";
import { PolicyLinks } from "@/components/chat/PolicyLinks";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
import { ShineLogo } from "@/components/ShineLogo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@/convex/react";
import { MessageSquarePlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";

export function AppChats() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const conversations = useQuery(api.conversations.list);
  const presenceAll = useQuery(api.users.presenceAll);
  const [newOpen, setNewOpen] = useState(false);

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
    if (preselect) setSearchParams({});
  };

  const emptyState = (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="glass hairline grid size-20 place-items-center rounded-3xl">
        <ShineLogo size={44} showWordmark={false} />
      </div>
      <div>
        <h2 className="text-lg font-semibold">Your messages</h2>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
          Start a direct chat, gather a group, or spin up a team channel — everything updates in
          realtime.
        </p>
      </div>
      <Button
        className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={() => openNew()}
      >
        <MessageSquarePlus className="size-4" /> Start a conversation
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
      <PolicyLinks />

      <NewChatDialog
        open={newOpen}
        onOpenChange={closeNew}
        preselectUserId={preselect}
      />
    </div>
  );
}
