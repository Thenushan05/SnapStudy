export type NoteColor = "yellow" | "blue" | "pink" | "green";

export interface StickyNote {
  id: string;
  title?: string;
  content: string;
  color: NoteColor;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  // optional board placement (for future board view)
  x?: number; y?: number; w?: number; h?: number;
  subject?: string;
  priority?: "high" | "medium" | "low";
  reminderAt?: string;
}

export interface StickyBoardState {
  notes: StickyNote[];
  version: number;
}

const KEY = "sticky.board.v1";

export function randomColor(): NoteColor {
  const colors: NoteColor[] = ["yellow", "blue", "pink", "green"];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function loadBoard(): StickyBoardState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { notes: [], version: 1 };
    const parsed = JSON.parse(raw) as StickyBoardState;
    if (!parsed.notes) return { notes: [], version: 1 };
    return parsed;
  } catch (err) {
    console.warn("Failed to load sticky board from localStorage", err);
    return { notes: [], version: 1 };
  }
}

export function saveBoard(state: StickyBoardState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Failed to save sticky board to localStorage", err);
  }
}

export function addStickyFromText(text: string, opts?: { color?: NoteColor; tags?: string[]; title?: string }) {
  const board = loadBoard();
  const now = new Date().toISOString();
  const note: StickyNote = {
    id: Math.random().toString(36).slice(2),
    title: opts?.title || undefined,
    content: text,
    color: opts?.color || randomColor(),
    tags: opts?.tags || [],
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
  board.notes.unshift(note);
  saveBoard(board);
  return note;
}

export function createSticky(init?: Partial<StickyNote>) {
  const now = new Date().toISOString();
  const note: StickyNote = {
    id: Math.random().toString(36).slice(2),
    title: init?.title,
    content: init?.content ?? "",
    color: init?.color ?? randomColor(),
    tags: init?.tags ?? [],
    pinned: init?.pinned ?? false,
    createdAt: now,
    updatedAt: now,
    x: init?.x, y: init?.y, w: init?.w, h: init?.h,
    subject: init?.subject,
    priority: init?.priority,
    reminderAt: init?.reminderAt,
  };
  const board = loadBoard();
  board.notes.unshift(note);
  saveBoard(board);
  return note;
}

export function updateSticky(id: string, patch: Partial<StickyNote>) {
  const board = loadBoard();
  let updated: StickyNote | undefined;
  board.notes = board.notes.map(n => {
    if (n.id !== id) return n;
    updated = { ...n, ...patch, updatedAt: new Date().toISOString() };
    return updated;
  });
  saveBoard(board);
  return updated;
}

export function deleteSticky(id: string) {
  const board = loadBoard();
  const before = board.notes.length;
  board.notes = board.notes.filter(n => n.id !== id);
  saveBoard(board);
  return before !== board.notes.length;
}

export function duplicateSticky(id: string) {
  const board = loadBoard();
  const src = board.notes.find(n => n.id === id);
  if (!src) return undefined;
  const now = new Date().toISOString();
  const copy: StickyNote = {
    ...src,
    id: Math.random().toString(36).slice(2),
    createdAt: now,
    updatedAt: now,
    x: (src.x ?? 0) + 24,
    y: (src.y ?? 0) + 24,
  };
  board.notes.unshift(copy);
  saveBoard(board);
  return copy;
}
