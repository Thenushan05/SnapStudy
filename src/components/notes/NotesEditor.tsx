import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Heading1, 
  Heading2,
  Image,
  Code,
  Paintbrush,
  Save,
  Clock
} from "lucide-react";
import { DrawingCanvas } from "./DrawingCanvas";

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
}

export function NotesEditor({ note, onChange }: NotesEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [tags, setTags] = useState(note.tags);
  const [newTag, setNewTag] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    onChange(newContent);
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
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Editor Header */}
      <div className="border-b border-border bg-surface p-4">
        <div className="space-y-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
                onKeyPress={(e) => e.key === "Enter" && addTag()}
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

      {/* Toolbar */}
      <div className="border-b border-border bg-surface p-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => wrapSelection("**", "**", "bold")}
            className="w-8 h-8"
          >
            <Bold className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => wrapSelection("*", "*", "italic")}
            className="w-8 h-8"
          >
            <Italic className="w-4 h-4" />
          </Button>
          
          <Separator orientation="vertical" className="h-6 mx-1" />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => insertLinePrefix("# ", "heading")}
            className="w-8 h-8"
          >
            <Heading1 className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => insertLinePrefix("## ", "heading")}
            className="w-8 h-8"
          >
            <Heading2 className="w-4 h-4" />
          </Button>
          
          <Separator orientation="vertical" className="h-6 mx-1" />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => insertLinePrefix("- ", "list item")}
            className="w-8 h-8"
          >
            <List className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => insertLinePrefix("1. ", "list item")}
            className="w-8 h-8"
          >
            <ListOrdered className="w-4 h-4" />
          </Button>
          
          <Separator orientation="vertical" className="h-6 mx-1" />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => wrapSelection("`", "`", "code")}
            className="w-8 h-8"
          >
            <Code className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => insertText("![alt text](image-url)")}
            className="w-8 h-8"
          >
            <Image className="w-4 h-4" />
          </Button>
          
          <Separator orientation="vertical" className="h-6 mx-1" />
          
          <Button
            variant={isDrawingMode ? "default" : "ghost"}
            size="icon"
            onClick={() => setIsDrawingMode(!isDrawingMode)}
            className="w-8 h-8"
          >
            <Paintbrush className="w-4 h-4" />
          </Button>
          
          <div className="flex-1" />
          
          <Button variant="outline" size="sm" className="gap-2">
            <Save className="w-4 h-4" />
            Save
          </Button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 flex">
        {/* Markdown Editor */}
        <div className={`${isDrawingMode ? "w-1/2" : "w-full"} flex flex-col`}>
          <Textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            ref={textareaRef}
            placeholder="Start writing your notes in Markdown..."
            className="flex-1 resize-none border-none rounded-none font-mono text-sm leading-relaxed focus-visible:ring-0"
          />
        </div>

        {/* Drawing Canvas */}
        {isDrawingMode && (
          <div className="w-1/2 border-l border-border">
            <DrawingCanvas
              onInsert={(dataUrl) => {
                const ta = textareaRef.current;
                if (!ta) return;
                const start = ta.selectionStart ?? content.length;
                const end = ta.selectionEnd ?? content.length;
                const imageMd = `\n\n![drawing](${dataUrl})\n`;
                const newContent = content.slice(0, start) + imageMd + content.slice(end);
                handleContentChange(newContent);
                requestAnimationFrame(() => {
                  const pos = start + imageMd.length;
                  ta.setSelectionRange(pos, pos);
                  ta.focus();
                });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}