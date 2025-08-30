import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Download, 
  Plus, 
  Brain, 
  FileQuestion,
  Maximize,
  Trash,
  Save
} from "lucide-react";

type MindMapAction =
  | "zoom-in"
  | "zoom-out"
  | "reset-view"
  | "fullscreen"
  | "export"
  | "save"
  | "add-node"
  | "expand-with-ai"
  | "create-quiz"
  | "delete-node";

interface MindMapToolbarProps {
  selectedNodeId: string | null;
  onAction: (action: MindMapAction, data?: string) => void;
}

export function MindMapToolbar({ selectedNodeId, onAction }: MindMapToolbarProps) {
  return (
    <div className="border-b border-border bg-surface p-3 sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-text">Mind Map</h2>
          {selectedNodeId && (
            <span className="text-sm text-muted">
              Node selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onAction("zoom-in")}
              className="w-8 h-8"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onAction("zoom-out")}
              className="w-8 h-8"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onAction("reset-view")}
              className="w-8 h-8"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onAction("fullscreen")}
              className="w-8 h-8"
            >
              <Maximize className="w-4 h-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Node Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAction("add-node")}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Node
            </Button>
            
            {selectedNodeId && (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onAction("delete-node", selectedNodeId)}
                  className="gap-2"
                >
                  <Trash className="w-4 h-4" />
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAction("expand-with-ai", selectedNodeId)}
                  className="gap-2"
                >
                  <Brain className="w-4 h-4" />
                  Expand with AI
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAction("create-quiz", selectedNodeId)}
                  className="gap-2"
                >
                  <FileQuestion className="w-4 h-4" />
                  Create Quiz
                </Button>
                
                {/* Removed Add to Notes */}
              </>
            )}
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Export */}
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => onAction("save")}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction("export")}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}