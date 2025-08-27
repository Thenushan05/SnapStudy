import { useRef, useMemo } from "react";

export interface UseTapOrClickOptions {
  thresholdPx?: number; // distance to treat as scroll
  disableClickOnTouch?: boolean; // if true, suppress synthesized click after touch
}

export interface TapHandlers {
  onClick: (e: React.MouseEvent<HTMLElement>) => void;
  onTouchStart: (e: React.TouchEvent<HTMLElement>) => void;
  onTouchMove: (e: React.TouchEvent<HTMLElement>) => void;
  onTouchEnd: (e: React.TouchEvent<HTMLElement>) => void;
  onTouchCancel: (e: React.TouchEvent<HTMLElement>) => void;
}

/**
 * Distinguish tap vs scroll on touch devices while keeping desktop clicks intact.
 * - If finger moves more than thresholdPx, treat as scroll and do NOT trigger tap.
 * - If it's a simple tap, invoke the provided handler and optionally suppress the synthesized click.
 */
export function useTapOrClick(
  onTap: (event: { source: "touch" | "mouse"; originalEvent: Event }) => void,
  options?: UseTapOrClickOptions
): TapHandlers {
  const thresholdPx = options?.thresholdPx ?? 10;
  const disableClickOnTouch = options?.disableClickOnTouch ?? true;

  const startX = useRef(0);
  const startY = useRef(0);
  const moved = useRef(false);
  const lastTouchTime = useRef(0);

  return useMemo<TapHandlers>(() => ({
    onTouchStart: (e) => {
      if (!e.touches || e.touches.length === 0) return;
      const t = e.touches[0];
      startX.current = t.clientX;
      startY.current = t.clientY;
      moved.current = false;
    },
    onTouchMove: (e) => {
      if (!e.touches || e.touches.length === 0) return;
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - startX.current);
      const dy = Math.abs(t.clientY - startY.current);
      if (dx > thresholdPx || dy > thresholdPx) {
        moved.current = true;
      }
    },
    onTouchEnd: (e) => {
      lastTouchTime.current = Date.now();
      // If moved beyond threshold, treat as scroll: do nothing (don't call onTap)
      if (moved.current) return;
      // It's a tap
      if (disableClickOnTouch) {
        // prevent the following synthesized click
        e.preventDefault();
        e.stopPropagation();
      }
      onTap({ source: "touch", originalEvent: e.nativeEvent });
    },
    onTouchCancel: () => {
      moved.current = false;
    },
    onClick: (e) => {
      // If a touch happened very recently and was marked as moved (scroll), suppress click
      const sinceTouch = Date.now() - lastTouchTime.current;
      if (sinceTouch < 500 && moved.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      onTap({ source: "mouse", originalEvent: e.nativeEvent });
    },
  }), [thresholdPx, disableClickOnTouch, onTap]);
}
