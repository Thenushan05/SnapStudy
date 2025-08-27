import { useEffect, useRef, useState } from "react";
import { MindMapCanvas, type Node as MindMapNode, type MindMapCanvasHandle } from "@/components/mindmap/MindMapCanvas";
import { MindMapToolbar } from "@/components/mindmap/MindMapToolbar";
import { getMindMap } from "@/lib/api";

export default function MindMapPage() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<MindMapNode[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<MindMapCanvasHandle | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getMindMap(ac.signal);
        setNodes(data);
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
    <div className="h-full flex flex-col">
      <MindMapToolbar 
        selectedNodeId={selectedNodeId}
        onAction={(action) => {
          const api = canvasRef.current;
          switch (action) {
            case "zoom-in":
              api?.zoomIn();
              break;
            case "zoom-out":
              api?.zoomOut();
              break;
            case "reset-view":
              api?.resetView();
              break;
            case "fullscreen":
              api?.fullscreen();
              break;
            case "export":
              api?.exportImage();
              break;
            case "add-node": {
              setNodes((prev) => {
                const list = prev ?? [];
                const id = `${Date.now()}`;
                // Find anchor position
                const anchor = selectedNodeId ? list.find(n => n.id === selectedNodeId) : undefined;
                const x = anchor ? anchor.x + 180 : 0;
                const y = anchor ? anchor.y + 60 : 0;
                const level = anchor ? (anchor.level + 1) : 0;
                const newNode: MindMapNode = { id, label: "New Topic", x, y, level, children: [], parent: anchor?.id };
                // Update parent children
                const updated = anchor ? list.map(n => n.id === anchor.id ? { ...n, children: [...n.children, id] } : n) : list;
                return [...updated, newNode];
              });
              break;
            }
            default:
              console.log("Mind map action:", action);
          }
        }}
      />
      
      <div className="flex-1 relative">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center text-muted text-sm">Loading mind map…</div>
        ) : error ? (
          <div className="w-full h-full flex items-center justify-center text-destructive text-sm">{error}</div>
        ) : (
          <MindMapCanvas 
            ref={canvasRef}
            onNodeSelect={setSelectedNodeId}
            nodes={nodes ?? []}
            editable
            onNodesChange={(next) => setNodes(next)}
            options={{ autoLayout: false }}
          />
        )}
      </div>
    </div>
  );
}