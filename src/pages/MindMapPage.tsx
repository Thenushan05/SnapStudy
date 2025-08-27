import { useEffect, useState } from "react";
import { MindMapCanvas, type Node as MindMapNode } from "@/components/mindmap/MindMapCanvas";
import { MindMapToolbar } from "@/components/mindmap/MindMapToolbar";
import { getMindMap } from "@/lib/api";

export default function MindMapPage() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<MindMapNode[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
          console.log("Mind map action:", action);
        }}
      />
      
      <div className="flex-1 relative">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center text-muted text-sm">Loading mind map…</div>
        ) : error ? (
          <div className="w-full h-full flex items-center justify-center text-destructive text-sm">{error}</div>
        ) : (
          <MindMapCanvas 
            onNodeSelect={setSelectedNodeId}
            nodes={nodes ?? []}
          />
        )}
      </div>
    </div>
  );
}