import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, Circle, Rect, PencilBrush } from "fabric";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Pen,
  Square,
  Circle as CircleIcon,
  Eraser,
  Undo,
  Trash2,
  Download,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

interface DrawingCanvasProps {
  onSave?: (dataUrl: string) => void;
  onInsert?: (dataUrl: string) => void;
}

export function DrawingCanvas({ onSave, onInsert }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeColor, setActiveColor] = useState("#000000");
  const [activeTool, setActiveTool] = useState<"draw" | "rectangle" | "circle" | "eraser">("draw");
  const [brushSize, setBrushSize] = useState(2);
  const AUTOSAVE_KEY = "drawing-canvas:v1";
  const autosaveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 400,
      height: 500,
      backgroundColor: "#ffffff",
    });

    // Explicitly set a PencilBrush for free drawing (Fabric v6 tree-shaking)
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.isDrawingMode = true;
    // Initialize with defaults; subsequent effect will sync from state
    canvas.freeDrawingBrush.color = "#000000";
    canvas.freeDrawingBrush.width = 2;

    setFabricCanvas(canvas);

    // Try loading from localStorage (autosave)
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        canvas.loadFromJSON(JSON.parse(saved), () => {
          canvas.renderAll();
          toast("Loaded autosaved drawing");
        });
      }
    } catch (err) {
      console.debug("No autosave to load", err);
    }

    return () => {
      canvas.dispose();
    };
  }, []);

  useEffect(() => {
    if (!fabricCanvas) return;

    fabricCanvas.isDrawingMode = activeTool === "draw" || activeTool === "eraser";

    if (fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = activeTool === "eraser" ? "#ffffff" : activeColor;
      fabricCanvas.freeDrawingBrush.width = activeTool === "eraser" ? brushSize * 3 : brushSize;
    }

    fabricCanvas.renderAll();
  }, [activeTool, activeColor, brushSize, fabricCanvas]);

  const handleToolClick = (tool: typeof activeTool) => {
    setActiveTool(tool);

    if (!fabricCanvas) return;

    if (tool === "rectangle") {
      const rect = new Rect({
        left: 50,
        top: 50,
        fill: "transparent",
        stroke: activeColor,
        strokeWidth: brushSize,
        width: 100,
        height: 80,
      });
      fabricCanvas.add(rect);
    } else if (tool === "circle") {
      const circle = new Circle({
        left: 50,
        top: 50,
        fill: "transparent",
        stroke: activeColor,
        strokeWidth: brushSize,
        radius: 40,
      });
      fabricCanvas.add(circle);
    }
  };

  const handleClear = () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = "#ffffff";
    fabricCanvas.renderAll();
    toast("Canvas cleared!");
  };

  const handleUndo = () => {
    if (!fabricCanvas) return;
    const objects = fabricCanvas.getObjects();
    if (objects.length > 0) {
      fabricCanvas.remove(objects[objects.length - 1]);
      fabricCanvas.renderAll();
    }
  };

  const handleSave = () => {
    if (!fabricCanvas) return;
    const dataUrl = fabricCanvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 1,
    });
    
    // Create download link
    const link = document.createElement("a");
    link.download = `drawing-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    
    onSave?.(dataUrl);
    toast("Drawing saved!");
  };

  const handleInsert = () => {
    if (!fabricCanvas) return;
    const dataUrl = fabricCanvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 1,
    });
    onInsert?.(dataUrl);
    toast("Inserted drawing into note");
  };

  // Autosave on changes with small debounce
  useEffect(() => {
    if (!fabricCanvas) return;
    const save = () => {
      if (autosaveTimeoutRef.current) window.clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = window.setTimeout(() => {
        try {
          const json = JSON.stringify(fabricCanvas.toJSON());
          localStorage.setItem(AUTOSAVE_KEY, json);
        } catch (err) {
          console.debug("Autosave failed (debounced)", err);
        }
      }, 400);
    };
    const onAdded = () => save();
    const onModified = () => save();
    const onRemoved = () => save();
    fabricCanvas.on("object:added", onAdded);
    fabricCanvas.on("object:modified", onModified);
    fabricCanvas.on("object:removed", onRemoved);
    return () => {
      fabricCanvas.off("object:added", onAdded);
      fabricCanvas.off("object:modified", onModified);
      fabricCanvas.off("object:removed", onRemoved);
    };
  }, [fabricCanvas]);

  const colors = [
    "#000000", "#ff0000", "#00ff00", "#0000ff", 
    "#ffff00", "#ff00ff", "#00ffff", "#ffa500"
  ];

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Drawing Toolbar */}
      <div className="border-b border-border p-2">
        <div className="flex items-center gap-1 mb-2">
          <Button
            variant={activeTool === "draw" ? "default" : "ghost"}
            size="icon"
            onClick={() => handleToolClick("draw")}
            className="w-8 h-8"
          >
            <Pen className="w-4 h-4" />
          </Button>
          
          <Button
            variant={activeTool === "rectangle" ? "default" : "ghost"}
            size="icon"
            onClick={() => handleToolClick("rectangle")}
            className="w-8 h-8"
          >
            <Square className="w-4 h-4" />
          </Button>
          
          <Button
            variant={activeTool === "circle" ? "default" : "ghost"}
            size="icon"
            onClick={() => handleToolClick("circle")}
            className="w-8 h-8"
          >
            <CircleIcon className="w-4 h-4" />
          </Button>
          
          <Button
            variant={activeTool === "eraser" ? "default" : "ghost"}
            size="icon"
            onClick={() => handleToolClick("eraser")}
            className="w-8 h-8"
          >
            <Eraser className="w-4 h-4" />
          </Button>
          
          <Separator orientation="vertical" className="h-6 mx-1" />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleUndo}
            className="w-8 h-8"
          >
            <Undo className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="w-8 h-8"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          
          <div className="flex-1" />
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Save PNG
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleInsert}
            className="gap-2 ml-2"
          >
            <Upload className="w-4 h-4 rotate-180" />
            Insert to Note
          </Button>
        </div>
        
        {/* Color Palette */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Color:</span>
          {colors.map((color) => (
            <button
              key={color}
              onClick={() => setActiveColor(color)}
              className={`w-6 h-6 rounded border-2 ${
                activeColor === color ? "border-ring" : "border-border"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
          
          <Separator orientation="vertical" className="h-6 mx-1" />
          
          <span className="text-xs text-muted">Size:</span>
          <input
            type="range"
            min="1"
            max="20"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-16"
          />
          <span className="text-xs text-muted w-6">{brushSize}</span>
        </div>
      </div>
      
      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="border border-border rounded-lg shadow-lg overflow-hidden bg-white">
          <canvas ref={canvasRef} className="max-w-full" />
        </div>
      </div>
    </div>
  );
}