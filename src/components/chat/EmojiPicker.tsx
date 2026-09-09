import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EMOJI_CATEGORIES, QUICK_REACTIONS, searchEmojis } from "@/lib/emoji";
import { cn } from "@/lib/utils";
import { Smile } from "lucide-react";
import { useMemo, useState } from "react";

export function EmojiPicker({
  onPick,
  size = "md",
  title = "Emoji",
}: {
  onPick: (emoji: string) => void;
  size?: "sm" | "md";
  title?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    if (q.trim()) {
      const hits = searchEmojis(q);
      return hits.length ? [{ name: "Results", emojis: hits }] : [];
    }
    return EMOJI_CATEGORIES;
  }, [q]);

  const pick = (e: string) => {
    onPick(e);
    setQ("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "text-muted-foreground hover:text-foreground",
            size === "sm" ? "size-7" : "size-9",
          )}
          title={title}
        >
          <Smile className={size === "sm" ? "size-4" : "size-[18px]"} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-80 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search emoji…"
            className="h-8 text-sm"
          />
        </div>
        <div className="mb-2 flex gap-1 border-b border-border pb-2">
          {QUICK_REACTIONS.map((e) => (
            <button
              key={e}
              onClick={() => pick(e)}
              className="rounded-lg p-1 text-lg transition-transform hover:scale-125 hover:bg-accent"
            >
              {e}
            </button>
          ))}
        </div>
        <div className="max-h-56 overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">No emojis found</p>
          )}
          {filtered.map((cat) => (
            <div key={cat.name} className="mb-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {cat.name}
              </div>
              <div className="grid grid-cols-8 gap-0.5">
                {cat.emojis.map((e) => (
                  <button
                    key={e}
                    onClick={() => pick(e)}
                    className="rounded-lg p-1 text-lg transition-transform hover:scale-125 hover:bg-accent"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
