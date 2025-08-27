import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { loadBoard, saveBoard, StickyNote } from "@/lib/stickyStorage";
import { Trash2, Pin, PinOff, RefreshCw } from "lucide-react";

export default function StickyNotesPage() {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [query, setQuery] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    const board = loadBoard();
    setNotes(board.notes);
  }, []);

  useEffect(() => {
    saveBoard({ notes, version: 1 });
  }, [notes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(n => (n.title || "").toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
  }, [notes, query]);

  // Keep pinned first, but preserve each group's current order
  const pinned = filtered.filter(n => n.pinned);
  const unpinned = filtered.filter(n => !n.pinned);

  const togglePin = (id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned, updatedAt: new Date().toISOString() } : n));
  };
  const remove = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };
  const refreshFromStorage = () => {
    const board = loadBoard();
    setNotes(board.notes);
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
    setNotes(prev => {
      const srcIdx = prev.findIndex(n => n.id === draggingId);
      const dstIdx = prev.findIndex(n => n.id === overId);
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

  const colorClass = (c: string) => {
    switch (c) {
      case "yellow": return "bg-amber-200 dark:bg-amber-300/80 text-slate-900";
      case "blue": return "bg-sky-200 dark:bg-sky-300/80 text-slate-900";
      case "pink": return "bg-pink-200 dark:bg-pink-300/80 text-slate-900";
      case "green": return "bg-lime-200 dark:bg-lime-300/80 text-slate-900";
      default: return "bg-secondary";
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Sticky Notes</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <Input placeholder="Search notes..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-full sm:w-56" />
          <Button variant="outline" onClick={refreshFromStorage} className="gap-2 whitespace-nowrap"><RefreshCw className="w-4 h-4"/> Refresh</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-muted">No sticky notes yet. Add from chat using "Add to Sticky Notes".</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4" onDrop={onDrop}>
          {[...pinned, ...unpinned].map(note => (
            <Card
              key={note.id}
              className={`p-4 shadow-md ${colorClass(note.color)} transition-shadow`}
              draggable
              onDragStart={(e) => onDragStart(e, note.id)}
              onDragOver={(e) => onDragOver(e, note.id)}
              onDragEnd={onDragEnd}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="font-medium truncate">{note.title || 'Sticky Note'}</div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => togglePin(note.id)} aria-label="Toggle pin">
                    {note.pinned ? <Pin className="w-4 h-4" style={{ fill: 'currentColor' }} /> : <PinOff className="w-4 h-4"/>}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(note.id)} aria-label="Delete">
                    <Trash2 className="w-4 h-4"/>
                  </Button>
                </div>
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {note.content}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs opacity-70">
                <span>{new Date(note.updatedAt).toLocaleString()}</span>
                {note.pinned && <Badge variant="secondary">Pinned</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
