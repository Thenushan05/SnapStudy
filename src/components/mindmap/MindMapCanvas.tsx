import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";

export interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  level: number;
  children: string[];
  parent?: string;
}

interface MindMapCanvasProps {
  onNodeSelect: (nodeId: string | null) => void;
  nodes?: Node[];
  editable?: boolean;
  onNodesChange?: (nodes: Node[]) => void;
  options?: {
    autoLayout?: boolean;
    spacingX?: number; // horizontal spacing between siblings
    spacingY?: number; // vertical spacing between levels
    maxNodeWidth?: number;
    nodePaddingX?: number;
    nodePaddingY?: number;
    fontFamily?: string;
    palette?: {
      rootBg: string;
      rootBorder: string;
      nodeBg: string;
      nodeBorder: string;
      selectedBg: string;
      selectedBorder: string;
      text: string;
      textInverse: string;
      edge: string;
    };
  };
}

// Mock mind map data
const mockNodes: Node[] = [
  { id: "1", label: "Quadratic Equations", x: 400, y: 300, level: 0, children: ["2", "3", "4"] },
  { id: "2", label: "Standard Form", x: 200, y: 200, level: 1, children: ["5"], parent: "1" },
  { id: "3", label: "Factoring", x: 400, y: 150, level: 1, children: ["6"], parent: "1" },
  { id: "4", label: "Quadratic Formula", x: 600, y: 200, level: 1, children: ["7"], parent: "1" },
  { id: "5", label: "ax² + bx + c = 0", x: 200, y: 100, level: 2, children: [], parent: "2" },
  { id: "6", label: "(x - a)(x - b)", x: 400, y: 50, level: 2, children: [], parent: "3" },
  { id: "7", label: "x = (-b ± √(b²-4ac))/2a", x: 600, y: 100, level: 2, children: [], parent: "4" },
];

export type MindMapCanvasHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  fullscreen: () => void;
  exportImage: () => void;
};

export const MindMapCanvas = forwardRef<MindMapCanvasHandle, MindMapCanvasProps>(function MindMapCanvas({ onNodeSelect, nodes: externalNodes, editable, onNodesChange, options }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const baseNodes: Node[] = externalNodes && externalNodes.length ? externalNodes : mockNodes;
  const latestNodesRef = useRef<Node[]>(baseNodes);
  useEffect(() => {
    latestNodesRef.current = baseNodes;
  }, [baseNodes]);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const draggingRef = useRef<{ dragging: boolean; x: number; y: number } | null>(null);
  const didFitRef = useRef(false);
  const boxMapRef = useRef<Map<string, { x: number; y: number; w: number; h: number }>>(new Map());

  const cfg = useMemo(() => ({
    autoLayout: options?.autoLayout ?? true,
    spacingX: options?.spacingX ?? 220,
    spacingY: options?.spacingY ?? 160,
    maxNodeWidth: options?.maxNodeWidth ?? 200,
    nodePaddingX: options?.nodePaddingX ?? 14,
    nodePaddingY: options?.nodePaddingY ?? 10,
    fontFamily: options?.fontFamily ?? 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    palette: {
      rootBg: options?.palette?.rootBg ?? '#3b82f6',
      rootBorder: options?.palette?.rootBorder ?? '#1d4ed8',
      nodeBg: options?.palette?.nodeBg ?? '#ffffff',
      nodeBorder: options?.palette?.nodeBorder ?? '#cbd5e1',
      selectedBg: options?.palette?.selectedBg ?? '#06b6d4',
      selectedBorder: options?.palette?.selectedBorder ?? '#0891b2',
      text: options?.palette?.text ?? '#0f172a',
      textInverse: options?.palette?.textInverse ?? '#ffffff',
      edge: options?.palette?.edge ?? '#e2e8f0',
    },
  }), [options]);

  // Auto layout by level if requested
  const nodes: Node[] = useMemo(() => {
    if (!cfg.autoLayout) return baseNodes;
    const byLevel = new Map<number, Node[]>();
    for (const n of baseNodes) {
      const lvl = typeof n.level === 'number' ? n.level : 0;
      const arr = byLevel.get(lvl) || [];
      arr.push({ ...n });
      byLevel.set(lvl, arr);
    }
    // Sort levels
    const levels = Array.from(byLevel.keys()).sort((a, b) => a - b);
    let maxCount = 0;
    for (const l of levels) maxCount = Math.max(maxCount, byLevel.get(l)!.length);
    // Centered grid layout
    const laid: Node[] = [];
    levels.forEach((lvl, levelIndex) => {
      const row = byLevel.get(lvl)!;
      const totalWidth = (row.length - 1) * cfg.spacingX;
      const startX = -totalWidth / 2;
      row.forEach((n, i) => {
        const x = startX + i * cfg.spacingX;
        const y = levelIndex * cfg.spacingY;
        laid.push({ ...n, x, y, level: levelIndex });
      });
    });
    return laid;
  }, [baseNodes, cfg]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

    // Background grid (dotted) for visual guidance
    ctx.save();
    ctx.globalAlpha = 0.35;
    const gridSize = 24;
    ctx.fillStyle = '#e2e8f0'; // slate-200 dots
    for (let gx = 0; gx < canvas.offsetWidth; gx += gridSize) {
      for (let gy = 0; gy < canvas.offsetHeight; gy += gridSize) {
        ctx.beginPath();
        ctx.arc(gx + 0.5, gy + 0.5, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Soft radial vignette
    ctx.save();
    const rad = ctx.createRadialGradient(
      canvas.offsetWidth / 2,
      canvas.offsetHeight / 2,
      0,
      canvas.offsetWidth / 2,
      canvas.offsetHeight / 2,
      Math.max(canvas.offsetWidth, canvas.offsetHeight) / 1.2
    );
    rad.addColorStop(0, 'rgba(59,130,246,0.06)'); // blue-500 tint
    rad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    ctx.restore();

    // Apply transformations
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Reset box map for hit-testing
    boxMapRef.current.clear();

    // Draw connections first
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.9;
    nodes.forEach(node => {
      node.children.forEach(childId => {
        const child = nodes.find(n => n.id === childId);
        if (child) {
          const mx = (node.x + child.x) / 2;
          // smooth curve
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.quadraticCurveTo(mx, node.y, child.x, child.y);
          // gradient edge color for visual appeal
          const grad = ctx.createLinearGradient(node.x, node.y, child.x, child.y);
          grad.addColorStop(0, '#60a5fa'); // blue-400
          grad.addColorStop(1, '#22d3ee'); // cyan-400
          ctx.strokeStyle = grad;
          ctx.stroke();
          // arrowhead at child
          const angle = Math.atan2(child.y - node.y, child.x - node.x);
          const ah = 8; // arrow size
          ctx.beginPath();
          ctx.moveTo(child.x, child.y);
          ctx.lineTo(child.x - ah * Math.cos(angle - Math.PI / 6), child.y - ah * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(child.x, child.y);
          ctx.lineTo(child.x - ah * Math.cos(angle + Math.PI / 6), child.y - ah * Math.sin(angle + Math.PI / 6));
          ctx.strokeStyle = '#22d3ee';
          ctx.stroke();
        }
      });
    });
    ctx.globalAlpha = 1;

    // Draw nodes as rounded cards with icons
    ctx.font = `12px ${cfg.fontFamily}`;
    nodes.forEach(node => {
      const isSelected = selectedNode === node.id;
      const isRoot = node.level === 0;
      // level-based accent emojis already used; tweak palette per level for students
      const levelColors = ['#3b82f6', '#22c55e', '#f59e0b', '#a78bfa'];
      const levelBorders = ['#1d4ed8', '#16a34a', '#d97706', '#7c3aed'];
      const icon = isRoot ? '🧠' : node.level === 1 ? '🗂️' : '📄';
      const iconSize = 14;
      const iconGap = 6;

      const lines = wrapLines(ctx, node.label, cfg.maxNodeWidth - 2 * cfg.nodePaddingX);
      const lineHeight = 14;
      const textWidth = Math.min(
        cfg.maxNodeWidth - 2 * cfg.nodePaddingX,
        Math.max(...lines.map((t) => ctx.measureText(t).width), 40)
      );
      const boxW = textWidth + 2 * cfg.nodePaddingX;
      const boxH = lines.length * lineHeight + 2 * cfg.nodePaddingY + iconSize + iconGap;
      const x = node.x - boxW / 2;
      const y = node.y - boxH / 2;
      const r = 10;

      // card styles
      // Gradient for root/selected, solid for normal
      let fill: string | CanvasGradient = isRoot ? cfg.palette.rootBg : isSelected ? cfg.palette.selectedBg : cfg.palette.nodeBg;
      if (isRoot || isSelected) {
        const grad = ctx.createLinearGradient(x, y, x, y + boxH);
        const base = isRoot ? cfg.palette.rootBg : cfg.palette.selectedBg;
        grad.addColorStop(0, base);
        grad.addColorStop(1, 'rgba(255,255,255,0.1)');
        fill = grad;
      }
      const stroke = isRoot ? cfg.palette.rootBorder : isSelected ? cfg.palette.selectedBorder : (levelBorders[node.level % levelBorders.length] ?? cfg.palette.nodeBorder);

      // shadow
      ctx.save();
      ctx.shadowColor = isSelected ? 'rgba(34, 211, 238, 0.5)' : 'rgba(2, 6, 23, 0.08)';
      ctx.shadowBlur = isSelected ? 20 : 12;
      ctx.shadowOffsetY = 4;
      roundRect(ctx, x, y, boxW, boxH, r);
      ctx.fillStyle = fill as string | CanvasGradient;
      ctx.fill();
      ctx.restore();

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = stroke;
      roundRect(ctx, x, y, boxW, boxH, r);
      ctx.stroke();

      // icon
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = (isRoot || isSelected) ? cfg.palette.textInverse : cfg.palette.text;
      ctx.font = `16px ${cfg.fontFamily}`;
      const iy = y + cfg.nodePaddingY + iconSize / 2 + 1;
      ctx.fillText(icon, node.x, iy);

      // text
      ctx.font = `12px ${cfg.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((t, i) => {
        const ty = y + cfg.nodePaddingY + iconSize + iconGap + i * lineHeight + lineHeight / 2;
        ctx.fillText(t, node.x, ty);
      });

      // store layout info for hit test
      boxMapRef.current.set(node.id, { x, y, w: boxW, h: boxH });
    });

    ctx.restore();
  }, [nodes, selectedNode, scale, offset, cfg]);

  // Fit-to-screen when nodes change
  const fitToNodes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!nodes.length) return;
    const pad = 80;
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = maxX - minX + pad * 2;
    const height = maxY - minY + pad * 2;
    const sX = canvas.offsetWidth / width;
    const sY = canvas.offsetHeight / height;
    const fit = Math.max(0.4, Math.min(1.2, Math.min(sX, sY)));
    setScale(fit);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setOffset({ x: canvas.offsetWidth / 2 - cx * fit, y: canvas.offsetHeight / 2 - cy * fit });
  }, [nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (didFitRef.current) return;
    if (!nodes.length) return;
    fitToNodes();
    didFitRef.current = true;
  }, [nodes, fitToNodes]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - offset.x) / scale;
    const y = (event.clientY - rect.top - offset.y) / scale;

    // Find clicked node (use card boxes)
    const clickedNode = nodes.find(node => {
      const box = boxMapRef.current.get(node.id);
      if (!box) return false;
      return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
    });

    if (clickedNode) {
      setSelectedNode(clickedNode.id);
      onNodeSelect(clickedNode.id);
    } else {
      setSelectedNode(null);
      onNodeSelect(null);
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.max(0.4, Math.min(2.5, prev * delta)));
  };

  const dragNodeRef = useRef<{ id: string; lastX: number; lastY: number } | null>(null);

  const getWorldCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - offset.x) / scale;
    const y = (clientY - rect.top - offset.y) / scale;
    return { x, y };
  };

  const onMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getWorldCoords(event.clientX, event.clientY);
    let hitNode: string | null = null;
    for (const node of nodes) {
      const box = boxMapRef.current.get(node.id);
      if (!box) continue;
      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
        hitNode = node.id;
        break;
      }
    }
    if (editable && hitNode) {
      dragNodeRef.current = { id: hitNode, lastX: x, lastY: y };
    } else {
      draggingRef.current = { dragging: true, x: event.clientX, y: event.clientY };
    }
  };
  const onMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (editable && dragNodeRef.current) {
      const { x, y } = getWorldCoords(event.clientX, event.clientY);
      const dx = x - dragNodeRef.current.lastX;
      const dy = y - dragNodeRef.current.lastY;
      dragNodeRef.current.lastX = x;
      dragNodeRef.current.lastY = y;
      // Update the node position and notify parent
      const updated = latestNodesRef.current.map(n => n.id === dragNodeRef.current!.id ? { ...n, x: n.x + dx, y: n.y + dy } : n);
      onNodesChange?.(updated);
      return;
    }
    if (!draggingRef.current?.dragging) return;
    const dxp = event.clientX - draggingRef.current.x;
    const dyp = event.clientY - draggingRef.current.y;
    draggingRef.current.x = event.clientX;
    draggingRef.current.y = event.clientY;
    setOffset(prev => ({ x: prev.x + dxp, y: prev.y + dyp }));
  };
  const onMouseUp = () => {
    if (draggingRef.current) draggingRef.current.dragging = false;
    if (dragNodeRef.current) dragNodeRef.current = null;
  };

  // Imperative API for toolbar
  useImperativeHandle(ref, () => ({
    zoomIn: () => setScale((s) => Math.min(2.5, s * 1.1)),
    zoomOut: () => setScale((s) => Math.max(0.4, s / 1.1)),
    resetView: () => {
      didFitRef.current = true;
      fitToNodes();
    },
    fullscreen: () => {
      const el = containerRef.current;
      if (el && el.requestFullscreen) el.requestFullscreen();
    },
    exportImage: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `mindmap-${Date.now()}.png`;
      a.click();
    }
  }), [fitToNodes]);

  return (
    <div ref={containerRef} className="w-full h-full bg-surface border border-border rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        onClick={handleCanvasClick}
        onDoubleClick={(e) => {
          if (!editable) return;
          const { x, y } = (function() {
            const rect = canvasRef.current!.getBoundingClientRect();
            const wx = (e.clientX - rect.left - offset.x) / scale;
            const wy = (e.clientY - rect.top - offset.y) / scale;
            return { x: wx, y: wy };
          })();
          let hit: string | null = null;
          for (const node of nodes) {
            const box = boxMapRef.current.get(node.id);
            if (!box) continue;
            if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
              hit = node.id;
              break;
            }
          }
          if (hit) {
            const current = latestNodesRef.current.find(n => n.id === hit);
            const nextLabel = window.prompt("Rename node", current?.label ?? "");
            if (nextLabel && nextLabel.trim()) {
              const updated = latestNodesRef.current.map(n => n.id === hit ? { ...n, label: nextLabel.trim() } : n);
              onNodesChange?.(updated);
            }
          }
        }}
        onWheel={handleWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
});

// Helpers
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = String(text).split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}