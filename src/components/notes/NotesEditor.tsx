import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import type Quill from "quill";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Paintbrush,
  Save,
  Clock
} from "lucide-react";
import { DrawingCanvas } from "./DrawingCanvas";
import { api } from "@/lib/api";
import { toast } from "sonner";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: Date;
  tags: string[];
}

interface NotesEditorProps {
  note: Note;
  onChange: (content: string) => void;
  onTitleChange?: (title: string) => void;
  onTagsChange?: (tags: string[]) => void;
}

export function NotesEditor({ 
  note, 
  onChange, 
  onTitleChange, 
  onTagsChange 
}: NotesEditorProps) {
  console.log('NotesEditor received note:', note);
  
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [tags, setTags] = useState(note.tags);
  const [newTag, setNewTag] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const prevNoteIdRef = useRef(note.id);

  // Reset local state when note prop changes
  useEffect(() => {
    if (prevNoteIdRef.current !== note.id) {
      console.log('Note changed from', prevNoteIdRef.current, 'to', note.id);
      setTitle(note.title);
      setContent(note.content);
      setTags(note.tags);
      prevNoteIdRef.current = note.id;
    }
  }, [note.id, note.title, note.content, note.tags]);

  const handleContentChange = (newContent: string) => {
    console.log('Content changed:', newContent);
    setContent(newContent);
    onChange(newContent);
  };

  // Save note to backend
  const saveNote = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    const toastId = `save-${note.id}`;
    try {
      toast("Saving note…", { id: toastId });
      // Convert rich HTML to plain text
      const toPlainText = (html: string) => {
        const div = document.createElement("div");
        div.innerHTML = html || "";
        const text = (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
        return text;
      };
      const contentPlain = toPlainText(content);
      // Include any pending tag input if user typed but didn't press Add/Enter yet
      const pending = (newTag || "").trim();
      const baseTags = Array.isArray(tags) ? tags.map(String) : [];
      const combined = pending && !baseTags.some(t => t.toLowerCase() === pending.toLowerCase())
        ? [...baseTags, pending]
        : baseTags;
      // de-duplicate case-insensitively
      const seen = new Set<string>();
      const tagsOut = combined.filter(t => {
        const k = t.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      const tagsCsv = tagsOut.join(',');
      const payload = { id: note.id, title, content: contentPlain, tags: tagsOut, tagsCsv };
      // Debug: verify exact payload being sent
      console.debug("Saving note payload", payload);
      const res = await api.notes.save(
        payload,
        { path: "/notes/note_123" }
      );
      // If server returns updated fields, reflect them locally
      if (res && typeof res === 'object') {
        const r = res as Record<string, unknown>;
        if (typeof r.title === 'string' && r.title !== title) setTitle(r.title);
        if (typeof r.content === 'string') {
          // server returns plain text; keep our editor content as-is while reflecting save time
          // optionally, if you want to mirror server, uncomment next line
          // setContent(r.content as string);
        }
        if (Array.isArray(r.tags)) {
          setTags((r.tags as unknown[]).map(String));
        } else if (typeof r.tags === 'string') {
          setTags(r.tags.split(',').map(s => s.trim()).filter(Boolean));
        }
      }
      setLastSavedAt(new Date());
      toast.success("Note saved", { id: toastId });
    } catch (err) {
      console.error("Failed to save note", err);
      toast.error("Failed to save note", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, note.id, title, content, tags, newTag]);

  // Keyboard shortcut: Ctrl/Cmd+S to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = navigator.platform.toLowerCase().includes("mac") ? e.metaKey : e.ctrlKey;
      if (meta && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        saveNote();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveNote]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (onTitleChange) onTitleChange(newTitle);
  };

  const handleTagsChange = (newTags: string[]) => {
    setTags(newTags);
    if (onTagsChange) onTagsChange(newTags);
  };

  // Helpers to apply Quill formatting instead of inserting markdown characters
  const getQuill = (): Quill | undefined => quillRef.current?.getEditor?.();
  const applyInlineFormat = (name: string, value: boolean | number | string = true) => {
    const quill = getQuill();
    if (!quill) return;
    // Quill typings are permissive at runtime; limit casting locally
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (quill as any).format(name, value, "user");
    handleContentChange(quill.root.innerHTML);
  };
  const applyLineFormat = (name: string, value: boolean | number | string) => {
    const quill = getQuill();
    if (!quill) return;
    const sel = quill.getSelection();
    const index = sel?.index ?? quill.getLength();
    const length = sel?.length ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (quill as any).formatLine(index, length || 1, name, value, "user");
    handleContentChange(quill.root.innerHTML);
  };

  // Export current content to PDF via printable window
  const exportToPDF = () => {
    const html = content || getQuill()?.root.innerHTML || "";
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Popup blocked. Please allow popups to export PDF.");
      return;
    }
    const doc = win.document;
    doc.open();
    doc.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${title ? `${title} - Notes` : "Notes"}</title>
          <style>
            body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; margin: 24px; color: #111; }
            h1,h2,h3 { page-break-after: avoid; }
            img { max-width: 100%; height: auto; page-break-inside: avoid; }
            pre, code { white-space: pre-wrap; word-wrap: break-word; }
            @page { margin: 16mm; }
          </style>
        </head>
        <body>
          ${title ? `<h1>${title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h1>` : ""}
          <div>${html}</div>
          <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 250); };</script>
        </body>
      </html>`);
    doc.close();
  };

  const insertText = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const newContent = content.slice(0, start) + text + content.slice(end);
    handleContentChange(newContent);
    requestAnimationFrame(() => {
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
      ta.focus();
    });
  };

  const wrapSelection = (before: string, after: string, placeholder = "") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const selected = content.slice(start, end) || placeholder;
    const replacement = `${before}${selected}${after}`;
    const newContent = content.slice(0, start) + replacement + content.slice(end);
    handleContentChange(newContent);
    // reposition caret after inserted text
    requestAnimationFrame(() => {
      const pos = start + replacement.length;
      ta.setSelectionRange(pos, pos);
      ta.focus();
    });
  };

  const insertLinePrefix = (prefix: string, fallback = "") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    // Find start of current line
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = content.indexOf("\n", end);
    const actualLineEnd = lineEnd === -1 ? content.length : lineEnd;
    const line = content.slice(lineStart, actualLineEnd);
    const hasPrefix = line.trimStart().startsWith(prefix.trim());
    const insertText = hasPrefix ? "" : `${prefix}`;
    const toInsert = insertText || prefix; // keep for caret calc
    const newContent = content.slice(0, lineStart) + (hasPrefix ? line : insertText + (line || fallback)) + content.slice(actualLineEnd);
    handleContentChange(newContent);
    requestAnimationFrame(() => {
      const caretPos = lineStart + (insertText ? insertText.length : 0) + (start - lineStart);
      ta.setSelectionRange(caretPos, caretPos);
      ta.focus();
    });
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      const updatedTags = [...tags, newTag.trim()];
      setTags(updatedTags);
      setNewTag("");
      if (onTagsChange) onTagsChange(updatedTags);
    }
  };

  const removeTag = (tagToRemove: string) => {
    const updatedTags = tags.filter(tag => tag !== tagToRemove);
    setTags(updatedTags);
    if (onTagsChange) onTagsChange(updatedTags);
  };

  // Quill toolbar/modules
  const quillModules = useMemo(() => ({
    toolbar: {
      container: "#notes-quill-toolbar",
      handlers: {
        draw: function () {
          setIsDrawingMode((v) => !v);
        },
      },
    },
  }), []);

  const quillRef = useRef<ReactQuill | null>(null);

  // One-time cleanup: remove legacy placeholder like "# New Note Start writing..." from old markdown design
  useEffect(() => {
    const legacy = /^#?\s*New\s+Note(?:\s+Start\s+writing.*)?$/i;
    const stripLegacy = (html: string) => {
      const div = document.createElement("div");
      div.innerHTML = html || "";
      // If the first block is a paragraph that matches the legacy placeholder, remove it
      const first = div.firstElementChild as HTMLElement | null;
      if (first && first.tagName === "P") {
        const txt = (first.textContent || "").trim().replace(/\s+/g, " ");
        if (legacy.test(txt)) {
          first.remove();
        }
      }
      // Also handle case where the entire content equals the placeholder
      const allTxt = (div.textContent || "").trim().replace(/\s+/g, " ");
      if (legacy.test(allTxt)) return "";
      return div.innerHTML;
    };
    const cleaned = stripLegacy(content);
    if (cleaned !== content) handleContentChange(cleaned);
    // run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearTextKeepImages = () => {
    const quill = quillRef.current?.getEditor?.();
    const container = document.createElement("div");
    container.innerHTML = content || "";
    const imgs = Array.from(container.querySelectorAll("img"));
    const html = imgs.map((img) => `<p>${img.outerHTML}</p>`).join("");
    if (quill) {
      quill.clipboard.dangerouslyPasteHTML(html);
      handleContentChange(quill.root.innerHTML);
    } else {
      handleContentChange(html);
    }
    toast.success("Removed notes text. Kept drawings/images.");
  };

  return (
    <div className="flex flex-col h-full overflow-x-hidden">
      {/* Editor Header */}
      <div className="border-b border-border bg-surface p-4">
        <div className="space-y-4">
          <Input
            value={title}
            onChange={handleTitleChange}
            className="text-lg font-semibold border-none bg-transparent p-0 focus-visible:ring-0"
            placeholder="Note title..."
          />
          
          <div className="flex items-center gap-2 text-xs text-muted">
            <Clock className="w-3 h-3" />
            Last updated {note.updatedAt.toLocaleDateString()}
          </div>

          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge 
                key={tag} 
                variant="secondary" 
                className="cursor-pointer hover:bg-destructive hover:text-white"
                onClick={() => removeTag(tag)}
              >
                {tag} ×
              </Badge>
            ))}
            <div className="flex gap-1">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add tag..."
                className="w-20 h-6 text-xs"
              />
              <Button onClick={addTag} size="sm" className="h-6 px-2 text-xs">
                Add
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Top Controls */}
      <div className="border-b border-border bg-surface p-2 flex items-center gap-2 overflow-x-hidden">
        {/* Draw at left start */}
        <Button
          variant={isDrawingMode ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => setIsDrawingMode(v => !v)}
          aria-pressed={isDrawingMode}
        >
          <Paintbrush className="w-4 h-4" />
          Draw
        </Button>
        <div className="flex-1 text-xs text-muted">
          {lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString()}` : ""}
        </div>
        <Button
          variant="default"
          size="sm"
          className="gap-2"
          onClick={saveNote}
          disabled={isSaving}
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Saving…" : "Save"}
        </Button>
        
        <Button variant="outline" size="sm" className="gap-2 mr-2" onClick={clearTextKeepImages}>
          Clear Text
        </Button>
        <Button variant="outline" size="sm" className="gap-2 hidden sm:inline-flex" onClick={exportToPDF}>
          <Save className="w-4 h-4" />
          Export PDF
        </Button>
      </div>

      {/* Editor Content */}
      <div className="flex-1 flex flex-col md:flex-row min-h-[60vh] md:min-h-0 overflow-x-hidden">
        {/* Rich Text Editor (Quill) */}
        <div className={`${isDrawingMode ? "md:w-1/2 w-full" : "w-full"} flex flex-col overflow-x-hidden min-w-0`}>
          {/* Dark mode friendly placeholder color for Quill */}
          <style>{`
            .ql-editor.ql-blank::before { color: rgba(0,0,0,0.45); }
            .dark .ql-editor.ql-blank::before { color: rgba(255,255,255,0.6); }
            /* Prevent horizontal overflow */
            .ql-container, .ql-editor { max-width: 100%; overflow-x: hidden; }
            .ql-editor { word-break: break-word; overflow-wrap: anywhere; }
            .ql-editor img { max-width: 100%; height: auto; }
            .ql-editor pre { white-space: pre-wrap; word-break: break-word; }
            .ql-toolbar { overflow-x: auto; overscroll-behavior-x: contain; }
          `}</style>
          {/* Quill Toolbar (single, default panel) */}
          <div id="notes-quill-toolbar" className="border-b border-border p-2 flex items-center gap-1">
            <span className="ql-formats">
              <button className="ql-bold" />
              <button className="ql-italic" />
            </span>
            <span className="ql-formats">
              <button className="ql-header" value="1" />
              <button className="ql-header" value="2" />
            </span>
            <span className="ql-formats">
              <button className="ql-list" value="ordered" />
              <button className="ql-list" value="bullet" />
            </span>
            <span className="ql-formats">
              <button className="ql-code-block" />
              <button className="ql-image" />
              {/* Custom draw toggle button inside the same toolbar */}
              <button className="ql-draw" aria-label="Toggle drawing">
                <Paintbrush className="w-4 h-4" />
              </button>
            </span>
          </div>
          <div className="flex-1 min-h-[45vh] md:min-h-0 overflow-x-hidden min-w-0 p-3 md:p-0">
            <ReactQuill
              ref={quillRef}
              theme="snow"
              value={content}
              onChange={(val) => handleContentChange(val)}
              modules={quillModules}
              placeholder="Start writing your notes..."
              className="h-[45vh] md:h-full"
            />
          </div>

          
        </div>

        {/* Drawing Canvas */}
        {isDrawingMode && (
          <div className="md:w-1/2 w-full md:border-l border-border md:border-t-0 border-t overflow-x-hidden">
            <DrawingCanvas
              onInsert={async (dataUrl) => {
                const ta = textareaRef.current;
                // We'll prefer inserting via Quill; textarea fallback retained for safety
                const quill = quillRef.current?.getEditor?.();
                const selection = quill?.getSelection();
                try {
                  // Convert data URL to Blob using fetch for simplicity and reliability
                  const uploadingId = `upload-${Date.now()}`;
                  toast("Uploading drawing…", { id: uploadingId });
                  const blob = await (await fetch(dataUrl)).blob();
                  const fileName = `drawing-${Date.now()}.png`;
                  // Upload to server using correct field name via helper
                  const up = await api.upload.imageFile(new File([blob], fileName, { type: "image/png" }));
                  const url = up.image.url;
                  const imageId = up.image.id;
                  if (imageId) sessionStorage.setItem("lastImageId", imageId);

                  if (quill) {
                    // Insert image embed at current selection
                    const index = selection?.index ?? quill.getLength();
                    quill.insertEmbed(index, "image", url, "user");
                    quill.setSelection(index + 1, 0, "user");
                    // Sync content state with new HTML
                    handleContentChange(quill.root.innerHTML);
                  } else if (ta) {
                    // Fallback: insert an <img> tag into the plain string
                    const start = ta.selectionStart ?? content.length;
                    const end = ta.selectionEnd ?? content.length;
                    const before = content.slice(0, start);
                    const after = content.slice(end);
                    const imageHtml = `<p><img src="${url}" alt="drawing" /></p>`;
                    const newContent = before + imageHtml + after;
                    handleContentChange(newContent);
                    requestAnimationFrame(() => {
                      const pos = (before + imageHtml).length;
                      ta.setSelectionRange(pos, pos);
                      ta.focus();
                    });
                  }
                  toast.success("Drawing uploaded and inserted", { id: uploadingId });
                } catch (err: unknown) {
                  console.error("Upload failed", err);
                  toast.error("Failed to upload drawing. Inserting as embedded Base64.");
                  if (quill) {
                    const index = quill.getSelection()?.index ?? quill.getLength();
                    quill.insertEmbed(index, "image", dataUrl, "user");
                    quill.setSelection(index + 1, 0, "user");
                    handleContentChange(quill.root.innerHTML);
                  } else if (ta) {
                    const start = ta.selectionStart ?? content.length;
                    const end = ta.selectionEnd ?? content.length;
                    const before = content.slice(0, start);
                    const after = content.slice(end);
                    const imageHtml = `<p><img src="${dataUrl}" alt="drawing" /></p>`;
                    const newContent = before + imageHtml + after;
                    handleContentChange(newContent);
                    requestAnimationFrame(() => {
                      const pos = (before + imageHtml).length;
                      ta.setSelectionRange(pos, pos);
                      ta.focus();
                    });
                  }
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}