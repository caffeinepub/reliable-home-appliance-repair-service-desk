import { useCallback, useEffect, useRef, useState } from "react";

export function useSignaturePad() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const initialized = useRef(false);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }, []);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || initialized.current) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    initialized.current = true;
  }, []);

  const getPos = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const startDraw = useCallback(
    (x: number, y: number) => {
      if (!initialized.current) initCanvas();
      const ctx = getCtx();
      if (!ctx) return;
      isDrawing.current = true;
      ctx.beginPath();
      ctx.moveTo(x, y);
    },
    [getCtx, initCanvas],
  );

  const draw = useCallback(
    (x: number, y: number) => {
      if (!isDrawing.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      ctx.lineTo(x, y);
      ctx.stroke();
      setIsEmpty(false);
    },
    [getCtx],
  );

  const endDraw = useCallback(() => {
    isDrawing.current = false;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize after a short delay to ensure layout is complete
    const rafId = requestAnimationFrame(() => {
      initCanvas();
    });

    // Mouse handlers
    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      const { x, y } = getPos(e.clientX, e.clientY);
      startDraw(x, y);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDrawing.current) return;
      e.preventDefault();
      const { x, y } = getPos(e.clientX, e.clientY);
      draw(x, y);
    };
    const onMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      endDraw();
    };
    const onMouseLeave = () => {
      endDraw();
    };

    // Touch handlers - registered with { passive: false } to allow preventDefault
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const touch = e.touches[0];
      if (!touch) return;
      const { x, y } = getPos(touch.clientX, touch.clientY);
      startDraw(x, y);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const touch = e.touches[0];
      if (!touch) return;
      const { x, y } = getPos(touch.clientX, touch.clientY);
      draw(x, y);
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      endDraw();
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [initCanvas, getPos, startDraw, draw, endDraw]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  }, []);

  const getSignatureBytes = useCallback((): Uint8Array => {
    const canvas = canvasRef.current;
    if (!canvas) return new Uint8Array(0);
    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }, []);

  return { canvasRef, clear, getSignatureBytes, isEmpty };
}
