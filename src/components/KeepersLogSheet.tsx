import React, { useEffect, useRef } from "react";
import { X, Clock, Eye, Radio, Sparkles, Key, Compass, ShieldCheck } from "lucide-react";

interface KeepersLogSheetProps {
  isOpen: boolean;
  onClose: () => void;
  elapsed: {
    y: number;
    m: number;
    d: number;
    h: string;
    mi: string;
    s: string;
    total: number;
  };
  lastSeenRelative: string;
  lastSeenExact: string;
  visits: number | string;
  lastVisitorIp: string;
  currentVisitorIp: string;
  isOwnerIp?: boolean;
  onOpenAdmin: () => void;
  onTrackLogActivity?: (action: string, scrollPct?: number) => void;
}

export const KeepersLogSheet: React.FC<KeepersLogSheetProps> = ({
  isOpen,
  onClose,
  elapsed,
  lastSeenRelative,
  lastSeenExact,
  visits,
  lastVisitorIp,
  currentVisitorIp,
  isOwnerIp = false,
  onOpenAdmin,
  onTrackLogActivity,
}) => {
  const sheetRef = useRef<HTMLElement>(null);
  const startY = useRef<number | null>(null);
  const deltaY = useRef<number>(0);
  const maxLogScrollRef = useRef<number>(0);

  useEffect(() => {
    if (isOpen && onTrackLogActivity) {
      onTrackLogActivity("Opened The Keeper's Log Sheet");
    }
  }, [isOpen, onTrackLogActivity]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    startY.current = e.clientY;
    deltaY.current = 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (sheetRef.current) {
      sheetRef.current.style.transition = "none";
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (startY.current === null || !sheetRef.current) return;
    deltaY.current = Math.max(0, e.clientY - startY.current);
    sheetRef.current.style.transform = `translateY(${deltaY.current}px)`;
  };

  const handlePointerUp = () => {
    if (startY.current === null || !sheetRef.current) return;
    sheetRef.current.style.transition = "transform 0.2s ease-out";
    const moved = deltaY.current;
    startY.current = null;
    deltaY.current = 0;
    if (moved > 85) {
      onClose();
    } else {
      sheetRef.current.style.transform = "";
    }
  };

  const handleLogScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!onTrackLogActivity) return;
    const el = e.currentTarget;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) return;
    const pct = Math.min(100, Math.max(0, Math.round((el.scrollTop / maxScroll) * 100)));
    if (pct >= maxLogScrollRef.current + 15 || (pct === 100 && maxLogScrollRef.current < 100)) {
      maxLogScrollRef.current = pct;
      onTrackLogActivity(`Scrolled Keeper's Log Sheet to ${pct}%`, pct);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[150] bg-[#1B2A4A]/35 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      <section
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        className="fixed bottom-0 left-0 right-0 z-[160] max-w-xl mx-auto bg-[#FCFAF2]/96 text-[#1B2A4A] backdrop-blur-2xl rounded-t-[28px] border-t border-x border-white/80 shadow-[0_-20px_60px_-15px_rgba(27,42,74,0.35)] max-h-[86dvh] flex flex-col p-5 sm:p-7 animate-in slide-in-from-bottom duration-300 font-['Outfit','Plus_Jakarta_Sans',sans-serif]"
      >
        {/* Drag Handle */}
        <div
          className="w-full pb-3 flex justify-center cursor-grab active:cursor-grabbing touch-none shrink-0"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label="Drag handle"
        >
          <div className="w-12 h-1.5 rounded-full bg-[#1B2A4A]/20" />
        </div>

        {/* Fixed Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#22418A]/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FFF6D6] to-[#FCEFC4] border border-[#C9892B]/25 flex items-center justify-center shadow-2xs">
              <Compass className="w-5 h-5 text-[#C9892B]" />
            </div>
            <div>
              <h2 className="font-['Bodoni_Moda',serif] font-black text-2xl sm:text-[26px] text-[#1B2A4A] tracking-tight leading-none">
                The Keeper’s Log
              </h2>
              <p className="font-['Homemade_Apple',cursive] text-xs text-[#C9892B] mt-1.5">
                the light has stayed on since 3 August 2022
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#22418A]/8 hover:bg-[#22418A]/15 flex items-center justify-center text-[#1B2A4A] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Smooth Scrollable Body */}
        <div
          onScroll={handleLogScroll}
          className="flex-1 overflow-y-auto overscroll-contain py-4 pr-1 space-y-4 scroll-smooth"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            <div className="p-3 bg-white rounded-2xl border border-[#22418A]/10 text-center shadow-2xs">
              <span className="block text-2xl sm:text-[26px] font-['Bodoni_Moda',serif] font-black text-[#22418A] tabular-nums leading-tight">
                {elapsed.y}
              </span>
              <span className="text-[10.5px] font-bold tracking-wider text-[#5A6788] uppercase block mt-0.5">
                Years
              </span>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-[#22418A]/10 text-center shadow-2xs">
              <span className="block text-2xl sm:text-[26px] font-['Bodoni_Moda',serif] font-black text-[#22418A] tabular-nums leading-tight">
                {elapsed.m}
              </span>
              <span className="text-[10.5px] font-bold tracking-wider text-[#5A6788] uppercase block mt-0.5">
                Months
              </span>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-[#22418A]/10 text-center shadow-2xs">
              <span className="block text-2xl sm:text-[26px] font-['Bodoni_Moda',serif] font-black text-[#22418A] tabular-nums leading-tight">
                {elapsed.d}
              </span>
              <span className="text-[10.5px] font-bold tracking-wider text-[#5A6788] uppercase block mt-0.5">
                Days
              </span>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-[#22418A]/10 text-center shadow-2xs">
              <span className="block text-2xl sm:text-[26px] font-mono font-bold text-[#1B2A4A] tabular-nums leading-tight">
                {elapsed.h}
              </span>
              <span className="text-[10.5px] font-bold tracking-wider text-[#5A6788] uppercase block mt-0.5">
                Hours
              </span>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-[#22418A]/10 text-center shadow-2xs">
              <span className="block text-2xl sm:text-[26px] font-mono font-bold text-[#1B2A4A] tabular-nums leading-tight">
                {elapsed.mi}
              </span>
              <span className="text-[10.5px] font-bold tracking-wider text-[#5A6788] uppercase block mt-0.5">
                Mins
              </span>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-[#22418A]/10 text-center shadow-2xs">
              <span className="block text-2xl sm:text-[26px] font-mono font-bold text-[#C9892B] tabular-nums leading-tight">
                {elapsed.s}
              </span>
              <span className="text-[10.5px] font-bold tracking-wider text-[#5A6788] uppercase block mt-0.5">
                Secs
              </span>
            </div>
          </div>

          <div className="p-4 bg-gradient-to-r from-[#FFF6D6] to-[#FCEFC4] border border-[#C9892B]/20 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/80 border border-[#C9892B]/25 flex items-center justify-center text-[#C9892B]">
                <Sparkles className="w-5 h-5 text-[#C9892B]" />
              </div>
              <div>
                <span className="font-extrabold text-sm text-[#1B2A4A] block">
                  Nights the light stayed on
                </span>
                <span className="font-['Homemade_Apple',cursive] text-[11px] text-[#C9892B] block mt-0.5">
                  unbroken watch from the shore
                </span>
              </div>
            </div>
            <span className="text-2xl sm:text-3xl font-['Bodoni_Moda',serif] font-black text-[#22418A] tabular-nums">
              {elapsed.total.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-[#22418A]/10 overflow-hidden divide-y divide-[#22418A]/10">
            <div className="p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#D8EAE8] text-[#3E86A8] flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-extrabold text-sm text-[#1B2A4A] block">Last seen</span>
                  <span className="font-['Homemade_Apple',cursive] text-[11px] text-[#C9892B] block">
                    when the previous visitor was here
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="font-extrabold text-sm text-[#1B2A4A] block tabular-nums">
                  {lastSeenRelative}
                </span>
                {lastSeenExact && (
                  <span className="text-[11px] text-[#5A6788] block mt-0.5">{lastSeenExact}</span>
                )}
              </div>
            </div>

            <div className="p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#E8F3F1] text-[#22418A] flex items-center justify-center shrink-0">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-extrabold text-sm text-[#1B2A4A] block">Last Visit IP</span>
                  <span className="font-['Homemade_Apple',cursive] text-[11px] text-[#C9892B] block">
                    previous ship before this visit
                  </span>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-[#1B2A4A] px-2.5 py-1 rounded-lg bg-[#FAF7EE] border border-[#22418A]/10">
                {lastVisitorIp}
              </span>
            </div>

            <div className="p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#FFF4D1] text-[#C9892B] flex items-center justify-center shrink-0">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-extrabold text-sm text-[#1B2A4A] block">Total Visits</span>
                  <span className="font-['Homemade_Apple',cursive] text-[11px] text-[#C9892B] block">
                    verified human ships that passed by
                  </span>
                </div>
              </div>
              <span className="text-xl font-['Bodoni_Moda',serif] font-black text-[#22418A] tabular-nums">
                {typeof visits === "number" ? visits.toLocaleString("en-IN") : visits}
              </span>
            </div>

            <div className="p-3 flex items-center justify-between gap-3 bg-[#FAF7EE]/60">
              <div className="flex items-center gap-2 text-xs text-[#5A6788]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#22418A]" />
                <span>Your Current Connection:</span>
              </div>
              <span className="font-mono text-[11px] font-bold text-[#22418A]">
                {currentVisitorIp} {isOwnerIp ? "• Keeper Recognized" : ""}
              </span>
            </div>
          </div>

          {/* Personal Space & Anti-Stalker Disclaimer Note */}
          <div className="p-3.5 bg-[#FFF6D6] border-2 border-[#C9892B] rounded-2xl text-xs text-[#1B2A4A] space-y-1 shadow-[3px_3px_0px_rgba(201,137,43,0.22)]">
            <span className="text-[10.5px] font-mono font-extrabold uppercase tracking-wider text-[#B8304A] block">
              ⚠ Personal Space Disclaimer
            </span>
            <p className="font-semibold leading-relaxed text-[#1B2A4A]">
              To any stalkers who are not relating to me and her: <strong>go get a life.</strong> Remember, this is my
              personal space — if anyone stalks in between, just remember{" "}
              <span className="text-[#B8304A] font-extrabold underline decoration-[#B8304A]">
                I can see your life more than this.
              </span>
            </p>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="pt-3 border-t border-[#22418A]/10 shrink-0 flex flex-col items-center gap-1.5">
          <button
            onClick={() => {
              onClose();
              onOpenAdmin();
            }}
            className="w-full py-3 px-4 bg-[#22418A] hover:bg-[#1B2A4A] text-white rounded-xl font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(34,65,138,0.25)] transition-all cursor-pointer"
          >
            <Key className="w-4 h-4 text-[#F2C230]" />
            <span>Open Keeper Terminal</span>
          </button>
          <span className="text-[11px] text-[#5A6788] font-medium">
            {isOwnerIp
              ? "✓ Recognized Keeper IP (122.177.241.64 / 2401:4900:88f7:eec7::)"
              : "Access restricted to registered Keeper IP & authorization key"}
          </span>
        </div>
      </section>
    </>
  );
};
