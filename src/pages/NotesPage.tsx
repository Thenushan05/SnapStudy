import { useEffect, useState } from "react";
import { NotesEditor } from "@/components/notes/NotesEditor";
import { NotesSidebar } from "@/components/notes/NotesSidebar";
import { api } from "@/lib/api";

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: Date;
  tags: string[];
}

export default function NotesPage() {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);

  // Load the canonical note from /notes/note_123
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const data = await api.notes.get({ path: "/notes/note_123" });
        if (aborted) return;
        const o = (data && typeof data === 'object') ? (data as Record<string, unknown>) : {};
        const id = typeof o.id === 'string' ? o.id : 'note_123';
        const title = typeof o.title === 'string' ? o.title : 'Untitled Note';
        const content = typeof o.content === 'string' ? o.content : '# New Note\n\nStart writing...';
        const tags = Array.isArray(o.tags) ? (o.tags as unknown[]).map(String) : [];
        const updatedAtStr = (typeof o.updatedAt === 'string' ? o.updatedAt : undefined) || new Date().toISOString();
        const note: Note = { id, title, content, tags, updatedAt: new Date(updatedAtStr) };
        setNotes([note]);
        setSelectedNoteId(id);
      } catch (err) {
        console.warn('Failed to load /notes/note_123, using local fallback', err);
        const fallback: Note = {
          id: 'note_123',
          title: 'Untitled Note',
          content: '# New Note\n\nStart writing...',
          tags: [],
          updatedAt: new Date(),
        };
        setNotes([fallback]);
        setSelectedNoteId('note_123');
      }
    })();
    return () => { aborted = true; };
  }, []);

  const selectedNote = notes.find(note => note.id === selectedNoteId);

  const handleNoteSelect = (noteId: string) => {
    console.log('Selected note ID:', noteId);
    setSelectedNoteId(noteId);
  };

  console.log('Current selectedNoteId:', selectedNoteId);
  console.log('Current notes:', notes);

  return (
    <div className="h-full flex flex-col md:flex-row overflow-x-hidden">
      <NotesSidebar 
        notes={notes}
        selectedNoteId={selectedNoteId}
        onNoteSelect={handleNoteSelect}
        onNoteCreate={() => {
          const newNote = {
            id: Date.now().toString(),
            title: "Untitled Note",
            content: "# New Note\n\nStart writing...",
            updatedAt: new Date(),
            tags: []
          };
          setNotes(prev => [newNote, ...prev]);
          setSelectedNoteId(newNote.id);
        }}
      />
      
      <div className="flex-1">
        {selectedNote ? (
          <NotesEditor 
            note={selectedNote}
            onChange={(content) => {
              setNotes(prev => prev.map(note => 
                note.id === selectedNoteId 
                  ? { ...note, content, updatedAt: new Date() } 
                  : note
              ));
            }}
            onTitleChange={(title) => {
              setNotes(prev => prev.map(note => 
                note.id === selectedNoteId 
                  ? { ...note, title, updatedAt: new Date() } 
                  : note
              ));
            }}
            onTagsChange={(tags) => {
              setNotes(prev => prev.map(note => 
                note.id === selectedNoteId 
                  ? { ...note, tags, updatedAt: new Date() } 
                  : note
              ));
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-muted">
              <p className="text-lg">Select a note to start editing</p>
              <p className="text-sm">or create a new one from the sidebar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}