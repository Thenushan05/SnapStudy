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
  onNodeSelect?: (id: string | null) => void;
  nodes?: Node[];
  editable?: boolean;
  onNodesChange?: (nodes: Node[]) => void;
  onRequestRename?: (id: string) => void;
  options?: {
    autoLayout?: boolean;
    layout?: 'layered' | 'radial';
    spacingX?: number; // horizontal spacing between siblings
    spacingY?: number; // vertical spacing between levels
    maxNodeWidth?: number;
    nodePaddingX?: number;
    nodePaddingY?: number;
    fontFamily?: string;
    fullBleed?: boolean;
    canvasMinWidth?: number; // px
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

// Note: No mock data. The component renders only the provided nodes.

export type MindMapCanvasHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  fullscreen: () => void;
  exportImage: () => void;
};

export const MindMapCanvas = forwardRef<MindMapCanvasHandle, MindMapCanvasProps>(function MindMapCanvas({ onNodeSelect, nodes: externalNodes, editable, onNodesChange, onRequestRename, options }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const baseNodes: Node[] = useMemo(() => (Array.isArray(externalNodes) ? externalNodes : []), [externalNodes]);
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
    autoLayout: options?.autoLayout ?? false,
    layout: options?.layout ?? 'layered',
    spacingX: options?.spacingX ?? 240,
    spacingY: options?.spacingY ?? 110,
    maxNodeWidth: options?.maxNodeWidth ?? 260,
    nodePaddingX: options?.nodePaddingX ?? 14,
    nodePaddingY: options?.nodePaddingY ?? 10,
    fontFamily: options?.fontFamily ?? 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    fullBleed: options?.fullBleed ?? false,
    canvasMinWidth: options?.canvasMinWidth ?? 960,
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

  // Auto layout: layered (default) or radial
  const nodes: Node[] = useMemo(() => {
    if (!cfg.autoLayout) return baseNodes;
    if (!baseNodes.length) return baseNodes;

    // Layered layout: x by level, y stacked centered
    if (cfg.layout === 'layered') {
      const map = new Map<string, Node>();
      baseNodes.forEach(n => map.set(n.id, { ...n }));
      const groups = new Map<number, Node[]>();
      for (const n of map.values()) {
        const lvl = n.level ?? 0;
        const arr = groups.get(lvl) ?? [];
        arr.push(n);
        groups.set(lvl, arr);
      }
      const out: Node[] = [];
      const levels = Array.from(groups.keys()).sort((a, b) => a - b);
      for (const lvl of levels) {
        const list = groups.get(lvl)!;
        list.forEach((n, idx) => {
          const x = lvl * cfg.spacingX;
          const offsetIdx = idx - (list.length - 1) / 2;
          const y = offsetIdx * cfg.spacingY;
          out.push({ ...n, x, y, level: lvl });
        });
      }
      // Center root at 0,0 by shifting all x,y so that root is at 0,0
      const root = out.find(n => n.level === 0) ?? out[0];
      const dx = root.x;
      const dy = root.y;
      return out.map(n => ({ ...n, x: n.x - dx, y: n.y - dy }));
    }

    // Radial fallback (arbitrary depth)
    const map = new Map<string, Node>();
    baseNodes.forEach(n => map.set(n.id, { ...n }));
    const explicitRoot = baseNodes.find(n => !n.parent)
      ?? baseNodes.find(n => n.level === 0)
      ?? baseNodes[0];
    const childrenOf = (id: string) => {
      const node = map.get(id);
      const viaChildren = node ? baseNodes.filter(n => (node.children || []).includes(n.id)) : [];
      const viaParent = baseNodes.filter(n => n.parent === id);
      const seen = new Set<string>();
      const out: Node[] = [];
      for (const a of [...viaChildren, ...viaParent]) {
        if (seen.has(a.id)) continue; seen.add(a.id); out.push(a);
      }
      return out;
    };
    const placed = new Set<string>();
    map.set(explicitRoot.id, { ...map.get(explicitRoot.id)!, x: 0, y: 0, level: 0 });
    placed.add(explicitRoot.id);
    const layoutChildren = (parentId: string, depth: number, baseAngle: number, totalSpread: number) => {
      const kids = childrenOf(parentId);
      if (!kids.length) return;
      const radius = depth * (cfg.spacingX + 40);
      const step = kids.length === 1 ? 0 : totalSpread / (kids.length - 1);
      kids.forEach((child, idx) => {
        const angle = kids.length === 1 ? baseAngle : (baseAngle - totalSpread / 2 + idx * step);
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        const prev = map.get(child.id) || child;
        map.set(child.id, { ...prev, x, y, level: depth, parent: prev.parent ?? parentId });
        placed.add(child.id);
        layoutChildren(child.id, depth + 1, angle, Math.max(Math.PI / 4, totalSpread * 0.6));
      });
    };
    layoutChildren(explicitRoot.id, 1, -Math.PI / 2, Math.PI * 2);
    const orphans = baseNodes.filter(n => !placed.has(n.id));
    if (orphans.length) {
      const depth = 2;
      const radius = (depth + 2) * (cfg.spacingX + 40);
      const step = (Math.PI * 2) / orphans.length;
      orphans.forEach((n, i) => {
        const angle = -Math.PI / 2 + i * step;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        const prev = map.get(n.id) || n;
        map.set(n.id, { ...prev, x, y, level: prev.level ?? depth });
      });
    }
    return Array.from(map.values());
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

    // Draw connections as clean spokes with rounded caps
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#94a3b8'; // slate-400
    ctx.globalAlpha = 0.9;
    nodes.forEach(node => {
      node.children.forEach(childId => {
        const child = nodes.find(n => n.id === childId);
        if (!child) return;
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(child.x, child.y);
        ctx.stroke();
      });
    });
    ctx.globalAlpha = 1;

    // Draw nodes in three styles: root circle, L1 colored pill, L2 white rounded cards
    ctx.font = `12px ${cfg.fontFamily}`;
    const pillColors = ['#0ea5e9', '#ef4444', '#f59e0b', '#10b981', '#84cc16', '#a855f7', '#f97316'];
    nodes.forEach(node => {
      const isSelected = selectedNode === node.id;
      const isRoot = node.level === 0;

      const maxWidth = cfg.maxNodeWidth;
      const lines = wrapLines(ctx, node.label, maxWidth - 2 * cfg.nodePaddingX);
      const lineHeight = 14;

      if (isRoot) {
        // Central black circle
        const radius = 64;
        const x = node.x;
        const y = node.y;
        // shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 6;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#0b0b0b';
        ctx.fill();
        ctx.restore();

        // selection ring
        if (isSelected) {
          ctx.save();
          ctx.lineWidth = 4;
          ctx.strokeStyle = cfg.palette.selectedBg;
          ctx.beginPath();
          ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold 14px ${cfg.fontFamily}`;
        const rootLines = wrapLines(ctx, node.label, radius * 1.8);
        rootLines.forEach((t, i) => {
          const ty = y - ((rootLines.length - 1) * lineHeight) / 2 + i * lineHeight;
          ctx.fillText(t, x, ty);
        });

        boxMapRef.current.set(node.id, { x: x - radius, y: y - radius, w: radius * 2, h: radius * 2 });
        return;
      }

      if (node.level === 1) {
        // Colored rounded pill
        const textWidth = Math.max(...lines.map(t => ctx.measureText(t).width));
        const boxW = Math.min(maxWidth, textWidth + 2 * cfg.nodePaddingX + 20);
        const boxH = lines.length * lineHeight + 2 * cfg.nodePaddingY;
        const x = node.x - boxW / 2;
        const y = node.y - boxH / 2;
        const r = boxH / 2;
        const fill = pillColors[(nodes.indexOf(node)) % pillColors.length];

        // shadow
        ctx.save();
        ctx.shadowColor = 'rgba(2,6,23,0.18)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 4;
        roundRect(ctx, x, y, boxW, boxH, r);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.restore();

        // border (darker tone)
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        roundRect(ctx, x, y, boxW, boxH, r);
        ctx.stroke();

        // selection outline
        if (isSelected) {
          ctx.save();
          ctx.lineWidth = 3;
          ctx.strokeStyle = cfg.palette.selectedBg;
          roundRect(ctx, x - 4, y - 4, boxW + 8, boxH + 8, r + 4);
          ctx.stroke();
          ctx.restore();
        }

        // text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        lines.forEach((t, i) => {
          const ty = y + cfg.nodePaddingY + i * lineHeight + lineHeight / 2 - (lines.length * lineHeight) / 2 + lineHeight / 2;
          ctx.fillText(t, node.x, ty);
        });

        boxMapRef.current.set(node.id, { x, y, w: boxW, h: boxH });
        return;
      }

      // Level >= 2: white card with border
      const textWidth = Math.max(...lines.map(t => ctx.measureText(t).width));
      const boxW = Math.min(maxWidth + 40, Math.max(160, textWidth + 2 * cfg.nodePaddingX + 20));
      const boxH = lines.length * lineHeight + 2 * cfg.nodePaddingY + 8;
      const x = node.x - boxW / 2;
      const y = node.y - boxH / 2;
      const r = 16;

      // shadow
      ctx.save();
      ctx.shadowColor = 'rgba(2,6,23,0.12)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      roundRect(ctx, x, y, boxW, boxH, r);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      // border
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#94a3b8';
      roundRect(ctx, x, y, boxW, boxH, r);
      ctx.stroke();

      // selection outline
      if (isSelected) {
        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeStyle = cfg.palette.selectedBg;
        roundRect(ctx, x - 4, y - 4, boxW + 8, boxH + 8, r + 4);
        ctx.stroke();
        ctx.restore();
      }

      // text
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((t, i) => {
        const ty = y + cfg.nodePaddingY + i * lineHeight + lineHeight / 2 - (lines.length * lineHeight) / 2 + lineHeight / 2;
        ctx.fillText(t, node.x, ty);
      });

      boxMapRef.current.set(node.id, { x, y, w: boxW, h: boxH });
    });

    ctx.restore();
  }, [nodes, selectedNode, scale, offset, cfg]);

  // Fit-to-screen when nodes change
  const fitToNodes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!nodes.length) return;
    const pad = 120;
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

  // Refit on window resize to keep layout visible
  useEffect(() => {
    const onResize = () => {
      if (!nodes.length) return;
      fitToNodes();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
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
      // add small padding to ease selection on touch
      const pad = 6;
      return x >= box.x - pad && x <= box.x + box.w + pad && y >= box.y - pad && y <= box.y + box.h + pad;
    });

    if (clickedNode) {
      setSelectedNode(clickedNode.id);
      onNodeSelect?.(clickedNode.id);
    } else {
      setSelectedNode(null);
      onNodeSelect?.(null);
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
      const pad = 6;
      if (x >= box.x - pad && x <= box.x + box.w + pad && y >= box.y - pad && y <= box.y + box.h + pad) {
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
      // cursor while dragging
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
      return;
    }
    if (!draggingRef.current?.dragging) {
      // hover feedback: show grab when over a node
      const { x, y } = getWorldCoords(event.clientX, event.clientY);
      let over = false;
      for (const node of nodes) {
        const box = boxMapRef.current.get(node.id);
        if (!box) continue;
        if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) { over = true; break; }
      }
      if (canvasRef.current) canvasRef.current.style.cursor = over ? 'grab' : 'default';
      return;
    }
    const dxp = event.clientX - draggingRef.current.x;
    const dyp = event.clientY - draggingRef.current.y;
    draggingRef.current.x = event.clientX;
    draggingRef.current.y = event.clientY;
    setOffset(prev => ({ x: prev.x + dxp, y: prev.y + dyp }));
  };
  const onMouseUp = () => {
    if (draggingRef.current) draggingRef.current.dragging = false;
    if (dragNodeRef.current) dragNodeRef.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'default';
  };

  // End drag if mouseup happens outside canvas
  useEffect(() => {
    const up = () => onMouseUp();
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // --- Touch support (mobile) ---
  const touchState = useRef<{ id: number | null; lastX: number; lastY: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return; // simple one-finger drag
    e.preventDefault();
    const t = e.touches[0];
    const { x, y } = getWorldCoords(t.clientX, t.clientY);
    let hitNode: string | null = null;
    for (const node of nodes) {
      const box = boxMapRef.current.get(node.id);
      if (!box) continue;
      const pad = 8;
      if (x >= box.x - pad && x <= box.x + box.w + pad && y >= box.y - pad && y <= box.y + box.h + pad) { hitNode = node.id; break; }
    }
    touchState.current = { id: t.identifier, lastX: t.clientX, lastY: t.clientY };
    if (editable && hitNode) {
      dragNodeRef.current = { id: hitNode, lastX: x, lastY: y };
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
    } else {
      draggingRef.current = { dragging: true, x: t.clientX, y: t.clientY };
    }
  };
  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!touchState.current) return;
    e.preventDefault();
    const t = e.touches[0];
    if (!t) return;
    if (editable && dragNodeRef.current) {
      const { x, y } = getWorldCoords(t.clientX, t.clientY);
      const dx = x - dragNodeRef.current.lastX;
      const dy = y - dragNodeRef.current.lastY;
      dragNodeRef.current.lastX = x;
      dragNodeRef.current.lastY = y;
      const updated = latestNodesRef.current.map(n => n.id === dragNodeRef.current!.id ? { ...n, x: n.x + dx, y: n.y + dy } : n);
      onNodesChange?.(updated);
      return;
    }
    if (draggingRef.current?.dragging) {
      const dxp = t.clientX - draggingRef.current.x;
      const dyp = t.clientY - draggingRef.current.y;
      draggingRef.current.x = t.clientX;
      draggingRef.current.y = t.clientY;
      setOffset(prev => ({ x: prev.x + dxp, y: prev.y + dyp }));
    }
  };
  const onTouchEnd = () => {
    touchState.current = null;
    if (draggingRef.current) draggingRef.current.dragging = false;
    if (dragNodeRef.current) dragNodeRef.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'default';
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
    <div
      ref={containerRef}
      className={cfg.fullBleed ? "w-full bg-surface min-h-screen" : "w-full bg-surface border border-border rounded-lg min-h-screen"}
      style={{ height: 'auto', overflow: 'auto' }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        style={{ width: '100%', height: '100%', minHeight: '100vh', minWidth: `${cfg.canvasMinWidth}px`, touchAction: 'none' }}
        onClick={handleCanvasClick}
        onDoubleClick={(e) => {
          if (!editable) return;
          const rect = canvasRef.current!.getBoundingClientRect();
          const wx = (e.clientX - rect.left - offset.x) / scale;
          const wy = (e.clientY - rect.top - offset.y) / scale;
          let hit: string | null = null;
          for (const node of nodes) {
            const box = boxMapRef.current.get(node.id);
            if (!box) continue;
            if (wx >= box.x && wx <= box.x + box.w && wy >= box.y && wy <= box.y + box.h) {
              hit = node.id;
              break;
            }
          }
          if (hit) onRequestRename?.(hit);
        }}
        onWheel={handleWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
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