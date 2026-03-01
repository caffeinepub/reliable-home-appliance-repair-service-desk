import { useRef, useState, useCallback, useEffect } from 'react';

interface UseSignaturePadReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  clear: () => void;
  getSignatureBytes: () => Promise<Uint8Array | null>;
  isEmpty: boolean;
}

export function useSignaturePad(): UseSignaturePadReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  // Track whether we've already applied the DPR scale to the context
  const scaledRef = useRef(false);

  /**
   * Initialize (or re-initialize) the canvas backing store to match its
   * CSS layout size × devicePixelRatio.  Calling this clears the canvas,
   * so we only do it once on mount (and on genuine resize events).
   */
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const newW = Math.round(rect.width * dpr);
    const newH = Math.round(rect.height * dpr);

    // Only reset if the physical pixel dimensions actually changed
    if (canvas.width === newW && canvas.height === newH && scaledRef.current) return;

    canvas.width = newW;
    canvas.height = newH;
    scaledRef.current = true;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Scale once so all drawing commands use CSS-pixel coordinates
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a2e1a';
    ctx.lineWidth = 2.5;
  }, []);

  /**
   * Convert a mouse or touch event to canvas-relative CSS-pixel coordinates.
   * We use getBoundingClientRect() so the result is already in CSS pixels,
   * which matches the scaled context (no extra DPR division needed).
   */
  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    if ('changedTouches' in e && (e as TouchEvent).changedTouches.length > 0) {
      return {
        x: (e as TouchEvent).changedTouches[0].clientX - rect.left,
        y: (e as TouchEvent).changedTouches[0].clientY - rect.top,
      };
    }
    const me = e as MouseEvent;
    return {
      x: me.clientX - rect.left,
      y: me.clientY - rect.top,
    };
  };

  const startDrawing = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e, canvas);
  }, []);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getPos(e, canvas);
    const from = lastPos.current ?? pos;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1a2e1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastPos.current = pos;
    setIsEmpty(false);
  }, []);

  const stopDrawing = useCallback((e?: MouseEvent | TouchEvent) => {
    if (e) e.preventDefault();
    isDrawing.current = false;
    lastPos.current = null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Give the browser one frame to lay out the canvas before measuring
    const rafId = requestAnimationFrame(() => {
      initCanvas();
    });

    // ResizeObserver: re-init when the canvas CSS size changes.
    // This clears the canvas — acceptable since a resize means the user
    // likely rotated the device or resized the window.
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (!isDrawing.current) {
          scaledRef.current = false; // force re-init
          initCanvas();
          setIsEmpty(true);
        }
      });
      ro.observe(canvas);
    }

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    // Touch events — MUST be { passive: false } so preventDefault() works on iOS
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing, { passive: false });
    canvas.addEventListener('touchcancel', stopDrawing, { passive: false });

    return () => {
      cancelAnimationFrame(rafId);
      ro?.disconnect();
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseleave', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
      canvas.removeEventListener('touchcancel', stopDrawing);
    };
  }, [startDrawing, draw, stopDrawing, initCanvas]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // clearRect in CSS-pixel space (context is already scaled by DPR)
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setIsEmpty(true);
  }, []);

  const getSignatureBytes = useCallback(async (): Promise<Uint8Array | null> => {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) return null;
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
        },
        'image/png'
      );
    });
  }, [isEmpty]);

  return { canvasRef, clear, getSignatureBytes, isEmpty };
}
