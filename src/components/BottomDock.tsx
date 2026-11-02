import React, { useEffect, useState } from "react";

interface BottomDockProps {
  onOpenLetters: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({ onOpenLetters }) => {
  const [percent, setPercent] = useState<number>(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPercent(34);
      return;
    }

    const timer = setTimeout(() => {
      const t0 = performance.now();
      const duration = 2200;

      const animate = (n: number) => {
        const p = Math.min(1, (n - t0) / duration);
        const ease = 1 - Math.pow(1 - p, 3);
        setPercent(Math.round(34 * ease));
        if (p < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <aside
      className="dock"
      role="note"
      aria-label="Website under construction"
      title="The keeper is repainting the lighthouse. Click to read letters."
      onClick={onOpenLetters}
    >
      <div className="ico" aria-hidden="true">
        <svg viewBox="0 0 48 48">
          <path d="M30 4 L44 18 L24 30 L18 24Z" fill="#C9892B" />
          <path d="M18 24 L24 30 L20 34 L14 28Z" fill="#5A6788" />
          <path d="M14 28 L20 34 C16 42 8 44 4 44 C4 40 6 32 14 28Z" fill="#22418A" />
        </svg>
      </div>

      <div className="txt">
        <div className="t1">
          <b>Website under construction</b>
          <span>{percent}%</span>
        </div>
        <div className="t2">The keeper is repainting the lighthouse. Letters next.</div>
        <div className="bar">
          <i style={{ transform: `scaleX(${percent / 100})` }} />
        </div>
      </div>
    </aside>
  );
};
