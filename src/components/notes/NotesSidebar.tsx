import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  Search, 
  FileText, 
  Clock,
  Tag,
  SortAsc,
  Filter
} from "lucide-react";

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: Date;
  tags: string[];
}

interface NotesSidebarProps {
  notes: Note[];
  selectedNoteId: string | null;
  onNoteSelect: (noteId: string) => void;
  onNoteCreate: () => void;
}

export function NotesSidebar({ 
  notes, 
  selectedNoteId, 
  onNoteSelect, 
  onNoteCreate 
}: NotesSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Get all unique tags
  const allTags = Array.from(
    new Set(notes.flatMap(note => note.tags))
  ).sort();

  // Filter notes based on search and tag
  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         note.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = !selectedTag || note.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const getPreviewText = (content: string) => {
    // Remove markdown syntax and get first 100 characters
    const plainText = content
      .replace(/^#+ /gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`(.*?)`/g, "$1")
      .replace(/\n+/g, " ")
      .trim();
    
    return plainText.length > 100 
      ? plainText.substring(0, 100) + "..."
      : plainText;
  };

  return (
    <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-border bg-surface flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text">Notes</h2>
          <Button onClick={onNoteCreate} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            New
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted w-4 h-4" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tags Filter */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Tag className="w-3 h-3" />
            Tags
          </div>
          <div className="flex flex-wrap gap-1">
            <Button
              variant={selectedTag === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTag(null)}
              className="h-6 px-2 text-xs"
            >
              All
            </Button>
            {allTags.map((tag) => (
              <Button
                key={tag}
                variant={selectedTag === tag ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className="h-6 px-2 text-xs"
              >
                {tag}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Notes List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">
                {searchQuery || selectedTag ? "No notes match your filters" : "No notes yet"}
              </p>
              <p className="text-xs">
                {!searchQuery && !selectedTag && "Create your first note to get started"}
              </p>
            </div>
          ) : (
            filteredNotes.map((note) => (
              <Card
                key={note.id}
                className={`
                  cursor-pointer transition-all duration-200 hover:shadow-medium
                  ${selectedNoteId === note.id 
                    ? "border-accent bg-accent/5" 
                    : "border-border hover:border-accent/50"
                  }
                `}
                onClick={() => onNoteSelect(note.id)}
              >
                <CardContent className="p-3">
                  <div className="space-y-2">
                    <h3 className="font-medium text-text text-sm leading-tight">
                      {note.title}
                    </h3>
                    
                    <p className="text-xs text-muted leading-relaxed">
                      {getPreviewText(note.content)}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-muted">
                        <Clock className="w-3 h-3" />
                        {formatDate(note.updatedAt)}
                      </div>
                      
                      {note.tags.length > 0 && (
                        <Badge variant="secondary" className="text-xs h-4 px-1">
                          {note.tags.length} tag{note.tags.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                    
                    {note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {note.tags.slice(0, 3).map((tag) => (
                          <Badge 
                            key={tag} 
                            variant="outline" 
                            className="text-xs h-4 px-1"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {note.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs h-4 px-1">
                            +{note.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}