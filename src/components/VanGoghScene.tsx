import React, { useEffect, useRef } from "react";
import { playGoldChime } from "../utils/audio";

interface VanGoghSceneProps {
  onOpenLetters?: () => void;
}

export const VanGoghScene: React.FC<VanGoghSceneProps> = ({ onOpenLetters }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beamRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const boatRef = useRef<HTMLDivElement>(null);
  const bheartRef = useRef<HTMLDivElement>(null);
  const halfLRef = useRef<SVGSVGElement>(null);
  const halfRRef = useRef<SVGSVGElement>(null);
  const lampHeartRef = useRef<SVGElement>(null);
  const lampGRef = useRef<SVGGElement>(null);
  const sailHeartRef = useRef<SVGElement>(null);
  const hnamesRef = useRef<HTMLDivElement>(null);
  const quoteRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // 1. Split Quote Words
    if (quoteRef.current) {
      const q = quoteRef.current;
      const originalText = "You broke my heart like that.";
      q.textContent = "";
      const words = originalText.trim().split(" ");
      words.forEach((w, i) => {
        const s = document.createElement("span");
        s.className = "w";
        s.setAttribute("aria-hidden", "true");
        s.textContent = w;
        s.style.animationDelay = `${0.95 + i * 0.15}s`;
        q.appendChild(s);
        if (i < words.length - 1) {
          q.appendChild(document.createTextNode(" "));
        }
      });
    }

    // 2. Measure geometry & top spacing
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const HZR = 0.62;
    let geo = {
      W: 0,
      H: 0,
      hz: 0,
      lx: 0,
      ly: 0,
      dockTop: 0,
    };

    const layoutTop = () => {
      const topEl = document.getElementById("top");
      if (topEl) {
        const h =
          topEl.offsetHeight -
          parseFloat(getComputedStyle(topEl).paddingTop) +
          12;
        document.documentElement.style.setProperty("--top-h", `${h}px`);
      }
    };

    const measure = () => {
      if (!stageRef.current || !lampHeartRef.current) return;
      const sr = stageRef.current.getBoundingClientRect();
      const lr = lampHeartRef.current.getBoundingClientRect();
      const dockEl = document.querySelector(".dock");
      const dockTop = dockEl ? dockEl.getBoundingClientRect().top : sr.height;

      geo = {
        W: sr.width,
        H: sr.height,
        hz: sr.height * HZR,
        lx: lr.left - sr.left + lr.width / 2,
        ly: lr.top - sr.top + lr.height / 2,
        dockTop,
      };

      if (beamRef.current) {
        beamRef.current.style.width = `${geo.lx + 80}px`;
        beamRef.current.style.left = "-80px";
        beamRef.current.style.top = `${geo.ly - 85}px`;
      }
      if (glowRef.current) {
        glowRef.current.style.left = `${geo.lx}px`;
        glowRef.current.style.top = `${geo.ly}px`;
      }
    };

    layoutTop();
    measure();

    let lit = false;
    const lightUp = () => {
      lit = true;
      lampHeartRef.current?.classList.add("lit");
      lampGRef.current?.classList.add("lit");
      sailHeartRef.current?.classList.add("on");
      glowRef.current?.classList.add("on");
      beamRef.current?.classList.add("on");
      boatRef.current?.classList.add("on");
    };

    // Heartbreak animation: one half lights the lamp, the other sails away
    let flightTimeout: NodeJS.Timeout | null = null;
    const fly = () => {
      measure();
      playGoldChime();
      hnamesRef.current?.classList.add("gone");
      boatRef.current?.classList.add("on");

      if (!halfLRef.current || !halfRRef.current || !lampHeartRef.current || !sailHeartRef.current) {
        lightUp();
        return;
      }

      let done = 0;
      const targets: [SVGSVGElement, SVGElement, number][] = [
        [halfLRef.current, lampHeartRef.current, -1],
        [halfRRef.current, sailHeartRef.current, 1],
      ];

      targets.forEach(([el, target, dir]) => {
        const a = el.getBoundingClientRect();
        const b = target.getBoundingClientRect();
        const dx = b.left + b.width / 2 - (a.left + a.width / 2);
        const dy = b.top + b.height / 2 - (a.top + a.height / 2);
        const s = b.width / a.width;

        const an = el.animate(
          [
            { transform: "translate(0,0) rotate(0) scale(1)" },
            {
              transform: `translate(${dir * 14}px,6px) rotate(${dir * 9}deg) scale(1)`,
              offset: 0.22,
            },
            {
              transform: `translate(${dir * 18}px,0) rotate(${dir * 11}deg) scale(.95)`,
              offset: 0.38,
            },
            {
              transform: `translate(${dx}px,${dy}px) rotate(0) scale(${s})`,
            },
          ],
          {
            duration: 2600,
            easing: "cubic-bezier(.45,0,.2,1)",
            fill: "forwards",
          }
        );

        an.onfinish = () => {
          el.style.transition = "opacity .5s";
          el.style.opacity = "0";
          done++;
          if (done === 2) {
            lightUp();
          }
        };
      });
    };

    if (reduce) {
      if (bheartRef.current) bheartRef.current.style.display = "none";
      lightUp();
    } else {
      flightTimeout = setTimeout(fly, 3700);
    }

    // 3. Beam sweep loop & heart reflections
    const heartCols = ["#B8304A", "#D9566C", "#F2C230", "#FCF9F0"];
    let lastSpawn = 0;
    let beamAnimId: number;

    const spawnHeart = (x: number, y: number) => {
      if (!stageRef.current) return;
      const h = document.createElement("span");
      h.className = "wheart";
      const sz = 8 + Math.random() * 10;
      h.style.cssText = `left:${x - sz / 2}px;top:${y}px;width:${sz}px;height:${sz * 0.9}px`;
      h.innerHTML = `<svg viewBox="0 0 200 180"><use href="#hp" fill="${heartCols[Math.floor(Math.random() * 4)]}"/></svg>`;
      stageRef.current.appendChild(h);
      setTimeout(() => h.remove(), 2500);
    };

    const beamLoop = (ts: number) => {
      const t = ts / 1000;
      const a = -5 + 11 * Math.sin(t * 0.55);
      if (beamRef.current) {
        beamRef.current.style.transform = `rotate(${a}deg) scaleY(${0.85 + 0.25 * Math.sin(t * 1.1)})`;
      }

      if (lit && a < -3 && ts - lastSpawn > 130 && geo.W) {
        lastSpawn = ts;
        const th = (a + (Math.random() - 0.5) * 5) * (Math.PI / 180);
        const dx = -Math.cos(th);
        const dy = -Math.sin(th);
        const maxY = Math.min(geo.H, geo.dockTop || geo.H) - 14;
        const y = geo.hz + 10 + Math.random() * Math.max(10, maxY - geo.hz - 10);
        const k = (y - geo.ly) / dy;
        const x = geo.lx + k * dx;

        if (dy > 0 && x > 8 && x < geo.lx - 40) {
          spawnHeart(x, y);
        }
      }
      beamAnimId = requestAnimationFrame(beamLoop);
    };

    if (!reduce) {
      beamAnimId = requestAnimationFrame(beamLoop);
    } else if (beamRef.current) {
      beamRef.current.style.transform = "rotate(-6deg)";
    }

    // 4. Painted Sky + Sea with impasto brush
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let HZ = 0;
    let parts: any[] = [];
    let canvasTime = 0;
    let canvasAnimId: number;

    const skyCols = ["#D8EAE8", "#FCF9F0", "#B7CBE8", "#9DB8E0", "#F2C230", "#E9F1EE"];
    const seaCols = ["#8FD0CB", "#3E86A8", "#B9E3DF", "#FCF9F0", "#5FAFC0", "#22418A"];
    const touchCols = ["#F2C230", "#D9566C", "#3F64B8", "#C9892B"];

    const spawnPart = () => {
      const isSea = Math.random() < 0.5;
      const y = isSea ? HZ + Math.random() * (H - HZ) : Math.random() * HZ;
      const r = Math.random();
      const pal = isSea ? seaCols : skyCols;
      const idx = isSea
        ? r < 0.35 ? 0 : r < 0.55 ? 1 : r < 0.72 ? 2 : r < 0.86 ? 3 : r < 0.96 ? 4 : 5
        : r < 0.32 ? 0 : r < 0.55 ? 1 : r < 0.72 ? 2 : r < 0.85 ? 3 : r < 0.93 ? 4 : 5;

      return {
        x: Math.random() * W,
        y,
        sea: isSea,
        life: 50 + Math.random() * 150,
        col: pal[idx],
        lw: isSea ? 1.6 + Math.random() * 3 : 1.2 + Math.random() * 2.6,
      };
    };

    const paintBg = (alpha: number) => {
      ctx.globalAlpha = alpha;
      const g = ctx.createLinearGradient(0, 0, 0, HZ);
      g.addColorStop(0, "#E4EFF1");
      g.addColorStop(1, "#F6F3E4");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, HZ);

      const s = ctx.createLinearGradient(0, HZ, 0, H);
      s.addColorStop(0, "#BFE5E0");
      s.addColorStop(1, "#7FC2C4");
      ctx.fillStyle = s;
      ctx.fillRect(0, HZ, W, H - HZ);
      ctx.globalAlpha = 1;
    };

    const sizeCanvas = () => {
      if (!stageRef.current || !c) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = stageRef.current.clientWidth;
      H = stageRef.current.clientHeight;
      HZ = H * HZR;
      c.width = W * dpr;
      c.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      paintBg(1);
      parts = Array.from({ length: Math.round(Math.min(520, (W * H) / 1300)) }, spawnPart);
    };

    const angle = (p: any) => {
      if (p.sea) {
        const depth = (p.y - HZ) / (H - HZ);
        return Math.sin(p.x * 0.012 + canvasTime * 1.2 + p.y * 0.05) * (0.25 + depth * 0.35) + Math.sin(canvasTime * 0.4) * 0.05;
      }
      let a = Math.sin(p.x * 0.0042 + canvasTime * 0.25) * Math.cos(p.y * 0.005 - canvasTime * 0.18) * Math.PI * 1.1;
      const vortices = [
        [W * 0.06, H * 0.3, Math.min(W, H) * 0.22],
        [W * 0.6, H * 0.26, Math.min(W, H) * 0.3],
      ];
      for (const [cx, cy, r] of vortices) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const w = Math.exp(-(dx * dx + dy * dy) / (2 * r * r));
        a = a * (1 - w) + (Math.atan2(dy, dx) + Math.PI / 2 + 0.2) * w;
      }
      return a;
    };

    const canvasFrame = () => {
      canvasTime += 0.006;
      paintBg(0.04);
      ctx.lineCap = "round";

      for (const p of parts) {
        const a = angle(p);
        const sp = p.touch ? 2 : p.sea ? 1.5 : 1.2;
        const nx = p.x + Math.cos(a) * sp;
        const ny = p.y + Math.sin(a) * sp;

        ctx.globalAlpha = p.touch ? 0.7 : p.sea ? 0.5 : 0.4;
        ctx.strokeStyle = p.col;
        ctx.lineWidth = p.lw;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        p.x = nx;
        p.y = ny;

        const crossed = !p.touch && (p.sea ? p.y < HZ + 2 : p.y > HZ - 2);
        if (--p.life < 0 || p.x < -5 || p.x > W + 5 || p.y < -5 || p.y > H + 5 || crossed) {
          if (p.touch) {
            p.dead = true;
          } else {
            Object.assign(p, spawnPart());
          }
        }
      }

      parts = parts.filter((p) => !p.dead);

      // Foam horizon line
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = "#FCF9F0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, HZ);
      for (let x = 0; x <= W; x += 12) {
        ctx.lineTo(x, HZ + Math.sin(x * 0.05 + canvasTime * 3) * 1.2);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (!reduce) {
        canvasAnimId = requestAnimationFrame(canvasFrame);
      }
    };

    let lastAdd = 0;
    const handlePointerMove = (e: PointerEvent) => {
      if (reduce) return;
      const n = performance.now();
      if (n - lastAdd < 16) return;
      lastAdd = n;

      for (let i = 0; i < 3; i++) {
        const isSea = e.clientY > HZ;
        parts.push({
          x: e.clientX + (Math.random() - 0.5) * 14,
          y: e.clientY + (Math.random() - 0.5) * 14,
          sea: isSea,
          life: 40 + Math.random() * 40,
          col: touchCols[Math.floor(Math.random() * 4)],
          lw: 2 + Math.random() * 3,
          touch: true,
        });
      }
      if (parts.length > 900) {
        parts.splice(0, parts.length - 900);
      }
    };

    c.addEventListener("pointermove", handlePointerMove, { passive: true });
    sizeCanvas();

    if (reduce) {
      for (let i = 0; i < 220; i++) canvasFrame();
    } else {
      canvasAnimId = requestAnimationFrame(canvasFrame);
    }

    const handleResize = () => {
      layoutTop();
      measure();
      sizeCanvas();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      if (flightTimeout) clearTimeout(flightTimeout);
      cancelAnimationFrame(beamAnimId);
      cancelAnimationFrame(canvasAnimId);
      c.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <>
      {/* SVG Global Definitions */}
      <svg className="defs" aria-hidden="true">
        <defs>
          <pattern id="strokes" width="22" height="22" patternUnits="userSpaceOnUse">
            <rect width="22" height="22" fill="#B8304A" />
            <path
              d="M2 6 C7 2 12 9 18 4"
              stroke="#D9566C"
              strokeWidth="2.6"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M4 16 C9 12 14 19 20 14"
              stroke="#8E1F37"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
              opacity=".7"
            />
            <circle cx="16" cy="10" r="1.2" fill="#F2C230" opacity=".85" />
            <animateTransform
              attributeName="patternTransform"
              type="rotate"
              from="0 100 90"
              to="360 100 90"
              dur="60s"
              repeatCount="indefinite"
            />
          </pattern>
          <clipPath id="clL">
            <path d="M-20 -20 L100 -20 L100 36 L92 62 L108 84 L94 106 L106 128 L98 150 L100 175 L-20 200Z" />
          </clipPath>
          <clipPath id="clR">
            <path d="M220 -20 L100 -20 L100 36 L92 62 L108 84 L94 106 L106 128 L98 150 L100 175 L220 200Z" />
          </clipPath>
          <path
            id="hp"
            d="M100 170 C40 125 6 92 6 56 C6 28 28 8 54 8 C74 8 90 20 100 36 C110 20 126 8 146 8 C172 8 194 28 194 56 C194 92 160 125 100 170Z"
          />
          {/* Liquid Gold Kintsugi Gradient */}
          <linearGradient id="goldKintsugi" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF4B8" />
            <stop offset="25%" stopColor="#F59E0B" />
            <stop offset="50%" stopColor="#D4AF37" />
            <stop offset="75%" stopColor="#FFE066" />
            <stop offset="100%" stopColor="#C9892B" />
          </linearGradient>
          <filter id="goldKintsugiGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0.95  0 0.7 0 0 0.6  0 0 0.2 0 0.1  0 0 0 1 0"
              result="coloredBlur"
            />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Main Full-Screen Animated Van Gogh Stage */}
      <div className="stage" id="stage" ref={stageRef}>
        <canvas id="paint" ref={canvasRef} aria-hidden="true" />

        {/* Golden Sun with rotating celestial rings */}
        <svg className="sun" viewBox="0 0 150 150" aria-hidden="true">
          <g className="ring r2">
            <circle
              cx="75"
              cy="75"
              r="68"
              fill="none"
              stroke="#C9892B"
              strokeWidth="3"
              strokeDasharray="20 8 5 8"
              strokeLinecap="round"
              opacity=".5"
            />
          </g>
          <g className="ring">
            <circle
              cx="75"
              cy="75"
              r="52"
              fill="none"
              stroke="#F2C230"
              strokeWidth="5"
              strokeDasharray="28 7"
              strokeLinecap="round"
              opacity=".8"
            />
          </g>
          <circle cx="75" cy="75" r="36" fill="#F2C230" opacity=".9" />
        </svg>

        {/* Gliding Seagulls */}
        <div className="gull" style={{ top: "32%", animationDuration: "38s", animationDelay: "-6s" }}>
          <svg viewBox="0 0 22 10">
            <path d="M1 8 Q6 1 11 7 Q16 1 21 8" fill="none" stroke="#5A6788" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <div className="gull" style={{ top: "40%", width: "16px", animationDuration: "46s", animationDelay: "-20s" }}>
          <svg viewBox="0 0 22 10">
            <path d="M1 8 Q6 1 11 7 Q16 1 21 8" fill="none" stroke="#5A6788" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <div className="gull" style={{ top: "28%", width: "13px", animationDuration: "54s", animationDelay: "-34s" }}>
          <svg viewBox="0 0 22 10">
            <path d="M1 8 Q6 1 11 7 Q16 1 21 8" fill="none" stroke="#5A6788" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>

        {/* Poetic Typography Copy */}
        <div
          className="copy cursor-pointer group"
          onClick={onOpenLetters}
          title="Click to read the unsent note (101 paragraphs)"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              onOpenLetters?.();
            }
          }}
        >
          <p className="since">since the 3rd of August, 2022</p>
          <h1 className="quote" id="quote" ref={quoteRef} aria-label="You broke my heart like that.">
            You broke my heart like that.
          </h1>
          <svg className="stroke" viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true">
            <path d="M4 13 C60 4 120 19 180 9 S270 6 296 11" />
          </svg>
          <p className="promise">I keep the light on, in case you ever find your way back.</p>
          <div className="flex items-center gap-3 mt-2 pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenLetters?.();
              }}
              className="px-3 py-1.5 bg-[#FAF7EE]/95 hover:bg-[#FFFFFF] border-2 border-[#22418A] shadow-[2px_2px_0px_#22418A] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] text-xs font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[#22418A] flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>✉ Read Letter • 101 Paragraphs</span>
            </button>
          </div>
        </div>

        {/* Lighthouse Light Beam & Glow */}
        <div className="beam" id="beam" ref={beamRef} aria-hidden="true" />
        <div className="glow" id="glow" ref={glowRef} aria-hidden="true" />

        {/* Sailing Boat with Right Heart Half */}
        <div className="boat" id="boat" ref={boatRef} aria-hidden="true">
          <svg viewBox="0 0 42 42" width="40" height="40" overflow="visible">
            <line x1="21" y1="6" x2="21" y2="31" stroke="#5A6788" strokeWidth="1.6" />
            <svg id="sailHeart" ref={sailHeartRef as any} x="5" y="6" width="32" height="26" viewBox="0 0 200 180">
              <g clipPath="url(#clR)">
                <use href="#hp" fill="url(#strokes)" />
                <use href="#hp" fill="none" stroke="url(#goldKintsugi)" strokeWidth="2.5" />
              </g>
            </svg>
            <path d="M4 31 Q21 39 38 31 L35 35 Q21 42 7 35Z" fill="#22418A" />
            <path d="M6 37 Q14 35 21 37 T36 37" stroke="#FCF9F0" strokeWidth="1.4" fill="none" opacity=".8" />
          </svg>
        </div>

        {/* Broken Heart with Kintsugi Gold Cracks & Shards */}
        <div
          className="bheart cursor-pointer"
          id="bheart"
          ref={bheartRef}
          aria-hidden="true"
          onClick={onOpenLetters}
          title="Kintsugi Heart: Repaired with Gold"
        >
          <div className="inner">
            <svg id="halfL" ref={halfLRef} viewBox="0 0 200 180">
              <g clipPath="url(#clL)">
                <use href="#hp" fill="url(#strokes)" />
                <use href="#hp" fill="none" stroke="#8E1F37" strokeWidth="3" opacity=".5" />
                <use href="#hp" fill="none" stroke="url(#goldKintsugi)" strokeWidth="2" opacity=".9" />
              </g>
            </svg>
            <svg id="halfR" ref={halfRRef} viewBox="0 0 200 180">
              <g clipPath="url(#clR)">
                <use href="#hp" fill="url(#strokes)" />
                <use href="#hp" fill="none" stroke="#8E1F37" strokeWidth="3" opacity=".5" />
                <use href="#hp" fill="none" stroke="url(#goldKintsugi)" strokeWidth="2" opacity=".9" />
              </g>
            </svg>
            <svg viewBox="0 0 200 180">
              {/* Glowing Liquid Gold Kintsugi Crack */}
              <path
                className="crack"
                d="M100 36 L92 62 L108 84 L94 106 L106 128 L98 150 L100 170"
                stroke="url(#goldKintsugi)"
                strokeWidth="4"
                strokeLinecap="round"
                filter="url(#goldKintsugiGlow)"
              />
              {/* Branching gold lacquer veins */}
              <path
                d="M92 62 L82 70 M108 84 L122 78 M94 106 L84 114 M106 128 L120 134"
                stroke="url(#goldKintsugi)"
                strokeWidth="2"
                strokeLinecap="round"
                opacity=".9"
              />
              <path className="shard s1" d="M96 60 l10 5 l-8 8z" fill="url(#goldKintsugi)" />
              <path className="shard s2" d="M104 82 l9 -4 l-3 10z" fill="url(#goldKintsugi)" />
              <path className="shard s3" d="M95 108 l8 3 l-7 6z" fill="url(#goldKintsugi)" />
              <path className="shard s4" d="M104 128 l6 6 l-9 1z" fill="url(#goldKintsugi)" />
            </svg>
            <div className="hnames" id="hnames" ref={hnamesRef}>
              <span>kunal</span>
              <span>sanjana</span>
            </div>
          </div>
        </div>

        {/* Seashore Coast & Lighthouse Silhouette */}
        <svg className="coast" viewBox="0 0 240 420" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
          <path d="M0 420 C20 360 30 320 60 300 C100 270 170 262 240 250 L240 420Z" fill="#EADFC4" />
          <g fill="none" strokeLinecap="round" opacity=".55">
            <path d="M30 380 C60 360 90 370 120 350" stroke="#C9892B" strokeWidth="3" />
            <path d="M60 330 C100 310 140 318 180 300" stroke="#C9892B" strokeWidth="2.5" />
            <path d="M90 400 C130 380 170 390 220 360" stroke="#D8C49A" strokeWidth="4" />
            <path d="M150 290 C180 282 210 286 236 276" stroke="#FCF9F0" strokeWidth="3" />
          </g>
          <g className="cyp">
            <path d="M212 300 C202 270 198 230 212 170 C226 230 222 270 212 300Z" fill="#2E5A45" />
            <path d="M212 190 C208 220 216 240 211 280" stroke="#D8EAE8" strokeWidth="1.6" fill="none" opacity=".4" />
          </g>
          <g className="tower">
            <path d="M150 276 L158 92 L178 92 L186 276Z" fill="#FCF9F0" />
            <path d="M152.6 216 L155.2 156 L180.8 156 L183.4 216Z" fill="#B8304A" />
            <path d="M156.4 128 L157.4 104 L178.6 104 L179.6 128Z" fill="#B8304A" />
            <path d="M150 276 L152 236 L184 236 L186 276Z" fill="#B8304A" />
            <path d="M160 100 C162 150 158 200 162 270" stroke="#D8C49A" strokeWidth="1.5" fill="none" opacity=".7" />
            <rect x="164" y="248" width="8" height="18" rx="4" fill="#22418A" />
            <rect x="152" y="86" width="32" height="6" rx="2" fill="#22418A" />
            <rect x="157" y="60" width="22" height="26" fill="#FFF8E2" stroke="#22418A" strokeWidth="2" />
            <g id="lampG" ref={lampGRef}>
              <svg id="lampHeart" ref={lampHeartRef as any} x="160" y="64" width="16" height="15" viewBox="0 0 200 180">
                <g clipPath="url(#clL)">
                  <use href="#hp" fill="url(#strokes)" />
                </g>
                <use href="#hp" fill="none" stroke="#F2C230" strokeWidth="10" opacity=".6" />
              </svg>
            </g>
            <path d="M154 60 Q168 40 182 60Z" fill="#22418A" />
            <circle cx="168" cy="43" r="2.4" fill="#22418A" />
            <g stroke="#C9892B" strokeWidth="1.4" opacity=".85">
              <line x1="142" y1="276" x2="146" y2="176" />
              <line x1="194" y1="276" x2="190" y2="176" />
              <line x1="143" y1="246" x2="193" y2="246" />
              <line x1="144" y1="214" x2="192" y2="214" />
              <line x1="145" y1="182" x2="191" y2="182" />
              <line x1="143" y1="246" x2="192" y2="214" />
              <line x1="144" y1="214" x2="191" y2="182" />
            </g>
            <rect x="186" y="204" width="7" height="9" rx="1" fill="#22418A" />
          </g>
        </svg>

        <div className="grain" aria-hidden="true" />
      </div>
    </>
  );
};
