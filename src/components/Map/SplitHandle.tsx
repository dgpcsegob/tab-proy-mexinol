import React, { useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./SplitHandle.css";

interface SplitHandleProps {
  position: number; // 0-100
  onChange: (pct: number) => void;
  isDark: boolean;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  leftLabel?: string;
  rightLabel?: string;
}

const CLAMP = (v: number) => Math.min(90, Math.max(10, v));

export const SplitHandle: React.FC<SplitHandleProps> = ({
  position,
  onChange,
  isDark,
  containerRef,
  leftLabel = "Mapa base",
  rightLabel = "Satélite",
}) => {
  const dragging = useRef(false);

  const toPercent = useCallback(
    (clientX: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return position;
      return CLAMP(((clientX - rect.left) / rect.width) * 100);
    },
    [containerRef, position],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    onChange(toPercent(e.clientX));
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === "ArrowLeft")  { onChange(CLAMP(position - step)); e.preventDefault(); }
    if (e.key === "ArrowRight") { onChange(CLAMP(position + step)); e.preventDefault(); }
    if (e.key === "Home")       { onChange(10); e.preventDefault(); }
    if (e.key === "End")        { onChange(90); e.preventDefault(); }
    if (e.key === " " || e.key === "Enter") { onChange(50); e.preventDefault(); }
  };

  return (
    <motion.div
      className={`sh-root${isDark ? " dark" : ""}`}
      style={{ left: `${position}%` }}
      initial={{ opacity: 0, scaleY: 0.6 }}
      animate={{ opacity: 1, scaleY: 1 }}
      exit={{ opacity: 0, scaleY: 0.6 }}
      transition={{ duration: 0.38, ease: [0.22, 0.85, 0.25, 1] }}
    >
      {/* Etiquetas flotantes */}
      <AnimatePresence>
        <motion.span
          key="lbl-left"
          className="sh-chip left"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.18, duration: 0.28 }}
        >
          {leftLabel}
        </motion.span>
        <motion.span
          key="lbl-right"
          className="sh-chip right"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.18, duration: 0.28 }}
        >
          {rightLabel}
        </motion.span>
      </AnimatePresence>

      {/* Línea vertical */}
      <div className="sh-line" />

      {/* Knob draggable */}
      <div
        className="sh-knob"
        role="slider"
        tabIndex={0}
        aria-label="Divisor de vista comparada"
        aria-valuenow={Math.round(position)}
        aria-valuemin={10}
        aria-valuemax={90}
        title="Arrastra · Doble clic para centrar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => onChange(50)}
        onKeyDown={onKeyDown}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 8l-5 4 5 4M17 8l5 4-5 4" />
        </svg>
      </div>
    </motion.div>
  );
};
