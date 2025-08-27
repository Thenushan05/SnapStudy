import { useState } from "react";
import { NotesEditor } from "@/components/notes/NotesEditor";
import { NotesSidebar } from "@/components/notes/NotesSidebar";

export default function NotesPage() {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [notes, setNotes] = useState([
    {
      id: "1",
      title: "Math Notes - Chapter 5",
      content: "# Quadratic Equations\n\nA quadratic equation is a polynomial equation of degree 2...",
      updatedAt: new Date(),
      tags: ["Mathematics", "Algebra"]
    },
    {
      id: "2", 
      title: "Biology Study Guide",
      content: "# Cell Biology\n\n## Cellular Respiration\n\nThe process by which cells break down glucose...",
      updatedAt: new Date(),
      tags: ["Biology", "Cell Biology"]
    }
  ]);

  const selectedNote = notes.find(note => note.id === selectedNoteId);

  return (
    <div className="h-full flex">
      <NotesSidebar 
        notes={notes}
        selectedNoteId={selectedNoteId}
        onNoteSelect={setSelectedNoteId}
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
                note.id === selectedNote.id 
                  ? { ...note, content, updatedAt: new Date() }
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