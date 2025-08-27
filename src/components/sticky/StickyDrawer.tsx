import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  loadBoard,
  saveBoard,
  StickyNote,
  createSticky,
  updateSticky,
  deleteSticky,
  duplicateSticky,
} from "@/lib/stickyStorage";
import { Plus, X, Pin, PinOff, Copy, Trash2, Palette, RefreshCw } from "lucide-react";

export interface StickyDrawerProps {
  open: boolean;
  onClose: () => void;
}

const COLORS: StickyNote["color"][] = ["yellow", "blue", "pink", "green"];

function colorClasses(color: StickyNote["color"]) {
  switch (color) {
    case "yellow":
      return "bg-amber-200 dark:bg-amber-300/80 text-slate-900";
    case "blue":
      return "bg-sky-200 dark:bg-sky-300/80 text-slate-900";
    case "pink":
      return "bg-pink-200 dark:bg-pink-300/80 text-slate-900";
    case "green":
      return "bg-lime-200 dark:bg-lime-300/80 text-slate-900";
    default:
      return "bg-secondary";
  }
}

export function StickyDrawer({ open, onClose }: StickyDrawerProps) {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [query, setQuery] = useState("");
  const [colorCycleIdx, setColorCycleIdx] = useState(0);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const board = loadBoard();
      setNotes(board.notes);
    }
  }, [open]);

  useEffect(() => {
    saveBoard({ notes, version: 1 });
  }, [notes]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) =>
      (n.title || "").toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }, [notes, query]);

  const addNote = () => {
    const color = COLORS[colorCycleIdx % COLORS.length];
    setColorCycleIdx((i) => i + 1);
    const n = createSticky({ title: "", content: "", color });
    setNotes((prev) => [n, ...prev]);
  };

  const refresh = () => {
    const board = loadBoard();
    setNotes(board.notes);
  };

  const handleUpdate = (id: string, patch: Partial<StickyNote>) => {
    const n = updateSticky(id, patch);
    if (!n) return;
    setNotes((prev) => prev.map((x) => (x.id === id ? n : x)));
  };

  const handleDelete = (id: string) => {
    deleteSticky(id);
    setNotes((prev) => prev.filter((x) => x.id !== id));
  };

  const handleDuplicate = (id: string) => {
    const c = duplicateSticky(id);
    if (c) setNotes((prev) => [c, ...prev]);
  };

  // Drag to reorder handlers
  const onDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };
  const onDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    if (!draggingId || draggingId === overId) return;
    setNotes((prev) => {
      const srcIdx = prev.findIndex((n) => n.id === draggingId);
      const dstIdx = prev.findIndex((n) => n.id === overId);
      if (srcIdx === -1 || dstIdx === -1 || srcIdx === dstIdx) return prev;
      const next = prev.slice();
      const [moved] = next.splice(srcIdx, 1);
      next.splice(dstIdx, 0, moved);
      return next;
    });
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingId(null);
  };
  const onDragEnd = () => setDraggingId(null);

  const DrawerContent = (
    <div
      className={cn(
        "fixed inset-y-0 right-0 w-full sm:w-[420px] bg-surface border-l border-border shadow-xl transition-transform duration-300 z-50",
        open ? "translate-x-0" : "translate-x-full"
      )}
      role="dialog"
      aria-modal="true"
    >
      <div className="h-16 px-4 border-b border-border flex items-center justify-between">
        <div className="font-semibold">Sticky Notes</div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search notes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-40"
          />
          <Button size="sm" variant="outline" onClick={refresh} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={addNote} className="gap-2">
            <Plus className="w-4 h-4" />
            Create New
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-3 overflow-auto h-[calc(100vh-4rem)] thin-scroll" onDrop={onDrop}>
        {filtered.length === 0 && (
          <div className="text-sm text-muted">No notes yet. Click Add or use chat → Add to Sticky Notes.</div>
        )}
        {(() => {
          const pinned = filtered.filter((n) => n.pinned);
          const unpinned = filtered.filter((n) => !n.pinned);
          return [...pinned, ...unpinned];
        })().map((n) => (
            <Card
              key={n.id}
              className={cn("p-3", colorClasses(n.color))}
              draggable
              onDragStart={(e) => onDragStart(e, n.id)}
              onDragOver={(e) => onDragOver(e, n.id)}
              onDragEnd={onDragEnd}
            >
              <div className="flex items-center justify-between gap-2">
                <Input
                  value={n.title ?? ""}
                  onChange={(e) => handleUpdate(n.id, { title: e.target.value })}
                  placeholder="Title"
                  className="h-8 bg-transparent border-none shadow-none px-0 focus-visible:ring-0"
                  onPointerDown={(e) => e.stopPropagation()}
                />
                <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleUpdate(n.id, { pinned: !n.pinned })}
                    aria-label="Pin"
                  >
                    {n.pinned ? (
                      <Pin className="w-4 h-4 text-accent" style={{ fill: "currentColor" }} />
                    ) : (
                      <PinOff className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDuplicate(n.id)}
                    aria-label="Duplicate"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(n.id)}
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={n.content}
                onChange={(e) => handleUpdate(n.id, { content: e.target.value })}
                placeholder="Write your note..."
                className="mt-2 bg-transparent border-none shadow-none resize-y min-h-[80px] focus-visible:ring-0"
                onPointerDown={(e) => e.stopPropagation()}
              />

              <div className="mt-2 flex items-center justify-between text-xs opacity-80">
                <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                  <Palette className="w-3 h-3" />
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => handleUpdate(n.id, { color: c })}
                      className={cn(
                        "w-4 h-4 rounded-sm border border-black/10 dark:border-white/20",
                        c === "yellow" && "bg-amber-300",
                        c === "blue" && "bg-sky-300",
                        c === "pink" && "bg-pink-300",
                        c === "green" && "bg-lime-300",
                        n.color === c && "ring-2 ring-black/30 dark:ring-white/40"
                      )}
                      aria-label={`Set color ${c}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary">{new Date(n.updatedAt).toLocaleString()}</Badge>
                </div>
              </div>
            </Card>
          ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        className={cn(
          "fixed inset-0 bg-black/30 transition-opacity duration-300 z-40",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />
      {DrawerContent}
    </>
  );
}
