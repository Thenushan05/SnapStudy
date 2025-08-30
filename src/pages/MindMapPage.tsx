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
  // Explain with AI popup state
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explainText, setExplainText] = useState<string>("");
  const [explainNodeId, setExplainNodeId] = useState<string | null>(null);

  // Highlight the selected node id inside the explanation
  const highlightedExplain = useMemo(() => {
    if (!explainText) return null;
    if (!explainNodeId) return explainText;
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escapeRegExp(explainNodeId), "gi");
    const parts = explainText.split(re);
    const matches = explainText.match(re) || [];
    const nodes: (string | JSX.Element)[] = [];
    parts.forEach((part, i) => {
      nodes.push(part);
      if (i < matches.length) {
        nodes.push(
          <mark key={`hl-${i}`} className="bg-indigo-200 text-indigo-900 px-1 rounded">
            {matches[i]}
          </mark>
        );
      }
    });
    return nodes;
  }, [explainText, explainNodeId]);

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
              (async () => {
                const nodeId = data || selectedNodeId;
                if (!nodeId) return;
                if (!currentImageId) {
                  setExplainError("No image in context to explain");
                  setExplainText("");
                  setExplainOpen(true);
                  return;
                }
                try {
                  setExplainLoading(true);
                  setExplainError(null);
                  setExplainText("");
                  setExplainNodeId(nodeId);
                  setExplainOpen(true);
                  const res = await api.mindmap.explain(currentImageId, nodeId);
                  setExplainText(res.text || "");
                } catch (e) {
                  setExplainError(e instanceof Error ? e.message : "Failed to get explanation");
                } finally {
                  setExplainLoading(false);
                }
              })();
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
      {/* Global Explain with AI button */
      
      }
      <div className="px-4 pt-2 flex justify-end">
        <Button
          variant="default"
          onClick={async () => {
            if (!currentImageId) {
              setExplainError("No image in context to explain");
              setExplainText("");
              setExplainOpen(true);
              return;
            }
            const targetId = selectedNodeId ?? currentImageId; // node id if selected, else mindmap/image id
            try {
              setExplainLoading(true);
              setExplainError(null);
              setExplainText("");
              setExplainNodeId(targetId);
              setExplainOpen(true);
              const res = await api.mindmap.explain(currentImageId, targetId);
              setExplainText(res.text || "");
            } catch (e) {
              setExplainError(e instanceof Error ? e.message : "Failed to get explanation");
            } finally {
              setExplainLoading(false);
            }
          }}
        >
          <span className="inline-flex items-center gap-2">
            {/* Sparkle/Magic icon */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M5 3a1 1 0 0 1 1 1v1h1a1 1 0 1 1 0 2H6v1a1 1 0 1 1-2 0V7H3a1 1 0 1 1 0-2h1V4a1 1 0 0 1 1-1Zm10 1a1 1 0 0 1 .894.553L16.764 6h1.736a1 1 0 0 1 .894 1.447l-.868 1.737.868 1.736A1 1 0 0 1 18.5 12h-1.736l-.87 1.447A1 1 0 0 1 14 13.894V12.5l-1.447-.868A1 1 0 0 1 12.5 10.5l1.447-.868V7.894A1 1 0 0 1 15 7l.868-1.447A1 1 0 0 1 15 4Z"/>
              <path d="M10.586 17.414a2 2 0 0 1 0-2.828l4-4a2 2 0 1 1 2.828 2.828l-4 4a2 2 0 0 1-2.828 0Z"/>
            </svg>
            Explain with AI
          </span>
        </Button>
      </div>
      
      <div className="flex-1 relative" style={{ minHeight: '70vh' }}>
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
            options={{ autoLayout: true, layout: 'layered', spacingX: 320, spacingY: 180, maxNodeWidth: 280, fullBleed: true, canvasMinWidth: 1200 }}
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

      {/* Explain with AI Dialog */}
      <Dialog open={explainOpen} onOpenChange={setExplainOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-indigo-600 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M5 3a1 1 0 0 1 1 1v1h1a1 1 0 1 1 0 2H6v1a1 1 0 1 1-2 0V7H3a1 1 0 1 1 0-2h1V4a1 1 0 0 1 1-1Zm10 1a1 1 0 0 1 .894.553L16.764 6h1.736a1 1 0 0 1 .894 1.447l-.868 1.737.868 1.736A1 1 0 0 1 18.5 12h-1.736l-.87 1.447A1 1 0 0 1 14 13.894V12.5l-1.447-.868A1 1 0 0 1 12.5 10.5l1.447-.868V7.894A1 1 0 0 1 15 7l.868-1.447A1 1 0 0 1 15 4Z"/>
                <path d="M10.586 17.414a2 2 0 0 1 0-2.828l4-4a2 2 0 1 1 2.828 2.828l-4 4a2 2 0 0 1-2.828 0Z"/>
              </svg>
              AI Explanation
            </DialogTitle>
            <DialogDescription>
              Generated explanation for the selected topic.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 max-h-[60vh] overflow-auto whitespace-pre-wrap text-sm">
            {explainLoading ? (
              <span className="text-muted">Thinking…</span>
            ) : explainError ? (
              <span className="text-destructive">{explainError}</span>
            ) : (
              (highlightedExplain ?? explainText) || "No explanation available."
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setExplainOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}