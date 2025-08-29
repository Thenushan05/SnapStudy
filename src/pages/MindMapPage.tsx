import { useEffect, useMemo, useRef, useState } from "react";
import { MindMapCanvas, type Node as MindMapNode, type MindMapCanvasHandle } from "@/components/mindmap/MindMapCanvas";
import { MindMapToolbar } from "@/components/mindmap/MindMapToolbar";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function MindMapPage() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<MindMapNode[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<MindMapCanvasHandle | null>(null);

  // Polished popups state
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  // When adding a node, store the computed position/parent until user confirms name
  const [pendingAdd, setPendingAdd] = useState<{
    parentId?: string;
    x: number;
    y: number;
    level: number;
  } | null>(null);
  const [currentImageId, setCurrentImageId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Auto-fit after data loads the first time
  const didAutoFitRef = useRef(false);
  useEffect(() => {
    if (didAutoFitRef.current) return;
    if ((nodes?.length ?? 0) > 0 && canvasRef.current) {
      didAutoFitRef.current = true;
      // Small delay to ensure canvas DOM has dimensions
      requestAnimationFrame(() => canvasRef.current?.resetView());
    }
  }, [nodes]);

  // Keep renameValue in sync when editing an existing node
  useEffect(() => {
    if (!renameOpen) return;
    if (!renameTargetId || renameTargetId === "__new__") return;
    const current = (nodes ?? []).find(n => n.id === renameTargetId);
    if (current) setRenameValue(current.label);
  }, [renameOpen, renameTargetId, nodes]);

  // Delete helper: remove a node and all its descendants, update parent's children
  const deleteNodeAndDescendants = (list: MindMapNode[], id: string): MindMapNode[] => {
    const toDelete = new Set<string>();
    const byId = new Map(list.map(n => [n.id, n] as const));
    const visit = (nid: string) => {
      if (toDelete.has(nid)) return;
      toDelete.add(nid);
      const n = byId.get(nid);
      if (!n) return;
      for (const c of n.children) visit(c);
    };
    visit(id);
    // filter nodes
    const kept = list.filter(n => !toDelete.has(n.id));
    // update parents' children arrays
    return kept.map(n => ({ ...n, children: n.children.filter(c => !toDelete.has(c)) }));
  };

  // Keyboard shortcut: Delete/Backspace to open delete dialog
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedNodeId) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        setDeleteTargetId(selectedNodeId);
        setDeleteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNodeId]);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // Resolve imageId from sessionStorage (prefer lastImageId, then imageId)
        const keys = ["lastImageId", "imageId"] as const;
        let imageId: string | null = null;
        for (const k of keys) {
          const v = sessionStorage.getItem(k);
          if (v && v.trim()) { imageId = v; break; }
        }
        if (!imageId) throw new Error("No imageId found in session — upload content first.");
        setCurrentImageId(imageId);
        // Call backend to generate+fetch the mind map for this image
        const data = await api.mindmap.byImage(imageId, ac.signal);
        // Debug: log parsed nodes length
        console.log("[MindMap] parsed nodes", Array.isArray(data) ? data.length : "?", data);
        setNodes(data as unknown as MindMapNode[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load mind map");
        setNodes(null);
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <MindMapToolbar 
        selectedNodeId={selectedNodeId}
        onAction={(action, data) => {
          const canvas = canvasRef.current;
          switch (action) {
            case "zoom-in":
              canvas?.zoomIn();
              break;
            case "zoom-out":
              canvas?.zoomOut();
              break;
            case "reset-view":
              canvas?.resetView();
              break;
            case "fullscreen":
              canvas?.fullscreen();
              break;
            case "export":
              canvas?.exportImage();
              break;
            case "add-node":
              {
                const list = nodes ?? [];
                if (list.length === 0) break;
                // Prefer selected as parent, else try root (level 0), else first node
                const parent = (selectedNodeId ? list.find(n => n.id === selectedNodeId) : null)
                  ?? list.find(n => n.level === 0)
                  ?? list[0];
                const spacingX =  Math.max(160,  (280));
                const spacingY =  Math.max(80,   (140 / 2));
                const siblingCount = parent.children?.length ?? 0;
                const nx = parent.x + spacingX; // to the right of parent
                const ny = parent.y + (siblingCount - Math.floor(siblingCount / 2)) * spacingY * 0.6;
                setPendingAdd({ parentId: parent.id, x: nx, y: ny, level: (parent.level ?? 0) + 1 });
                setRenameTargetId("__new__");
                setRenameValue("");
                setRenameOpen(true);
              }
              break;
            case "delete-node":
              if (data) {
                setDeleteTargetId(data);
                setDeleteOpen(true);
              }
              break;
            case "save":
              (async () => {
                if (!currentImageId) {
                  setSaveMessage("No image in context to save");
                  setTimeout(() => setSaveMessage(null), 2500);
                  return;
                }
                try {
                  setSaving(true);
                  const res = await api.mindmap.save(currentImageId, nodes ?? []);
                  setSaveMessage(res.message ?? "Saved");
                } catch (e) {
                  setSaveMessage(e instanceof Error ? e.message : "Save failed");
                } finally {
                  setSaving(false);
                  setTimeout(() => setSaveMessage(null), 2500);
                }
              })();
              break;
            case "expand-with-ai":
              if (data) {
                console.log("Mind map action:", action, data);
              }
              break;
            case "create-quiz":
              if (data) {
                console.log("Mind map action:", action, data);
              }
              break;
            default:
              console.log("Mind map action:", action);
          }
        }}
      />
      
      <div className="flex-1 relative" style={{ minHeight: 'calc(100vh - 112px)' }}>
        {loading ? (
          <div className="w-full h-full flex items-center justify-center text-muted text-sm">Loading mind map…</div>
        ) : error ? (
          <div className="w-full h-full flex items-center justify-center text-destructive text-sm">{error}</div>
        ) : ((nodes?.length ?? 0) === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-muted text-sm">
            No topics found in mind map.
          </div>
        ) : (
          <MindMapCanvas 
            ref={canvasRef}
            onNodeSelect={setSelectedNodeId}
            nodes={nodes ?? []}
            editable
            onNodesChange={(next) => setNodes(next)}
            onRequestRename={(id) => {
              setRenameTargetId(id);
              const current = (nodes ?? []).find(n => n.id === id);
              setRenameValue(current?.label ?? "");
              setRenameOpen(true);
              setSelectedNodeId(id);
            }}
            options={{ autoLayout: false, layout: 'layered', spacingX: 280, spacingY: 140, maxNodeWidth: 260, fullBleed: true, canvasMinWidth: 1200 }}
          />
        ))}
        {saveMessage && (
          <div className="absolute top-3 right-3 rounded bg-surface border border-border px-3 py-1 text-sm shadow">
            {saving ? "Saving… " : null}{saveMessage}
          </div>
        )}
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename topic</DialogTitle>
            <DialogDescription>Give this node a clear, concise title.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Enter topic title"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const name = renameValue.trim();
                if (!name) return setRenameOpen(false);
                // Creating a new node
                if (renameTargetId === "__new__" && pendingAdd) {
                  const add = pendingAdd; // freeze
                  const newId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
                  setNodes(prev => {
                    const list = prev ?? [];
                    const newNode: MindMapNode = { id: newId, label: name, x: add.x, y: add.y, level: add.level, children: [], parent: add.parentId };
                    const updated = add.parentId ? list.map(n => n.id === add.parentId ? { ...n, children: [...n.children, newId] } : n) : list;
                    return [...updated, newNode];
                  });
                  setSelectedNodeId(newId);
                  setPendingAdd(null);
                  setRenameTargetId(null);
                  setRenameOpen(false);
                  return;
                }
                // Renaming an existing node
                if (renameTargetId) {
                  setNodes(prev => (prev ?? []).map(n => n.id === renameTargetId ? { ...n, label: name } : n));
                }
                setRenameOpen(false);
              }}
            >Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected topic?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the topic and all its subtopics. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const target = deleteTargetId || selectedNodeId;
                if (!target) return setDeleteOpen(false);
                setNodes(prev => prev ? deleteNodeAndDescendants(prev, target) : prev);
                if (selectedNodeId === target) setSelectedNodeId(null);
                setDeleteTargetId(null);
                setDeleteOpen(false);
              }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}