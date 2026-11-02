import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen,
  X,
  Heart,
  Clock,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  Type,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Typography } from "./neopop/Typography";
import { FontVariant } from "./neopop/primitives";
import { NeoButton } from "./neopop/NeoButton";
import { playTypewriterClick } from "../utils/audio";

export interface LettersActivityPayload {
  action: string;
  sectionOpened?: string;
  letterRead?: number;
  deepestLetterScrolled?: number;
  maxScrollPercent?: number;
  likedLetter?: number;
}

interface UnsentLettersModalProps {
  isOpen: boolean;
  onClose: () => void;
  paragraphs: string[];
  totalDays: number;
  onTrackActivity?: (payload: LettersActivityPayload) => void;
}

type FontTheme = "lora" | "playfair" | "sans" | "typewriter";

export const UnsentLettersModal: React.FC<UnsentLettersModalProps> = ({
  isOpen,
  onClose,
  paragraphs,
  totalDays,
  onTrackActivity,
}) => {
  const [viewMode, setViewMode] = useState<"typewriter" | "all">("typewriter");
  const [fontTheme, setFontTheme] = useState<FontTheme>("lora");
  const [fontSizeOffset, setFontSizeOffset] = useState<number>(0); // -1, 0, +1
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealedWordCount, setRevealedWordCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1); // 1 = 60ms, 2 = 30ms
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [likedMap, setLikedMap] = useState<Record<number, boolean>>({});

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const highestScrollLoggedRef = useRef<number>(0);

  const currentParagraph = paragraphs[currentIndex] || "";
  const words = currentParagraph.trim().split(/\s+/).filter(Boolean);
  const isComplete = revealedWordCount >= words.length;

  // Font family selector
  const getFontFamilyClass = () => {
    switch (fontTheme) {
      case "lora":
        return "font-['Lora',serif]";
      case "playfair":
        return "font-['Playfair_Display',serif]";
      case "typewriter":
        return "font-['Special_Elite',monospace]";
      case "sans":
      default:
        return "font-['Plus_Jakarta_Sans',sans-serif]";
    }
  };

  // Font size responsive classes
  const getFontSizeClass = () => {
    if (fontSizeOffset === -1) return "text-sm sm:text-base leading-relaxed sm:leading-loose";
    if (fontSizeOffset === 1) return "text-lg sm:text-2xl leading-relaxed sm:leading-[2.2]";
    return "text-base sm:text-xl leading-relaxed sm:leading-[2.1]";
  };

  // Track when modal opens and when current letter changes
  useEffect(() => {
    if (!isOpen) return;
    if (onTrackActivity) {
      onTrackActivity({
        action: `Viewing Letter #${currentIndex + 1}`,
        sectionOpened: "101 Unsent Letters (Reveal Mode)",
        letterRead: currentIndex + 1,
      });
    }
  }, [isOpen, currentIndex, onTrackActivity]);

  // Track view mode switch ("typewriter" vs "all")
  useEffect(() => {
    if (!isOpen || !onTrackActivity) return;
    if (viewMode === "all") {
      onTrackActivity({
        action: "Switched to All 101 Letters Continuous Scroll View",
        sectionOpened: "101 Unsent Letters (All 101 View)",
      });
    }
  }, [isOpen, viewMode, onTrackActivity]);

  // Reset words when switching letter index
  useEffect(() => {
    setRevealedWordCount(0);
    setIsPlaying(true);
    // Smooth scroll back to top of the letter on mobile
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [currentIndex]);

  // Word-by-word typing interval
  useEffect(() => {
    if (viewMode !== "typewriter" || !isPlaying || isComplete) return;

    const intervalTime = speed === 1 ? 55 : 28;
    const timer = setInterval(() => {
      setRevealedWordCount((prev) => {
        const next = prev + 1;
        if (soundEnabled && next <= words.length) {
          playTypewriterClick();
        }
        if (next >= words.length) {
          setIsPlaying(false);
          return words.length;
        }
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [viewMode, isPlaying, isComplete, speed, soundEnabled, words.length]);

  const handleNext = () => {
    if (currentIndex < paragraphs.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleRevealAll = () => {
    setRevealedWordCount(words.length);
    setIsPlaying(false);
    if (onTrackActivity) {
      onTrackActivity({
        action: `Clicked "Full Reveal" on Letter #${currentIndex + 1}`,
        letterRead: currentIndex + 1,
      });
    }
  };

  const handleRestart = () => {
    setRevealedWordCount(0);
    setIsPlaying(true);
  };

  const toggleLiked = (index: number) => {
    const nextLiked = !likedMap[index];
    setLikedMap((prev) => ({ ...prev, [index]: nextLiked }));
    if (nextLiked && onTrackActivity) {
      onTrackActivity({
        action: `Bookmarked / Liked Letter #${index + 1}`,
        likedLetter: index + 1,
        letterRead: index + 1,
      });
    }
  };

  // Silent scroll depth & letter index tracker for All 101 mode & Typewriter mode
  const handleScrollTracking = (e: React.UIEvent<HTMLDivElement>, isAllMode: boolean) => {
    if (!onTrackActivity) return;
    const el = e.currentTarget;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) return;

    const pct = Math.min(100, Math.max(0, Math.round((el.scrollTop / maxScroll) * 100)));
    if (pct >= highestScrollLoggedRef.current + 8 || (pct === 100 && highestScrollLoggedRef.current < 100)) {
      highestScrollLoggedRef.current = pct;
      const estimatedLetter = isAllMode
        ? Math.min(paragraphs.length, Math.max(1, Math.ceil((pct / 100) * paragraphs.length)))
        : currentIndex + 1;

      onTrackActivity({
        action: isAllMode
          ? `Scrolled All Letters to ${pct}% (up to Letter #${estimatedLetter})`
          : `Scrolled Letter #${currentIndex + 1} to ${pct}%`,
        maxScrollPercent: pct,
        deepestLetterScrolled: estimatedLetter,
        letterRead: estimatedLetter,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-[#0A0D14]/30 backdrop-blur-[3px] overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-[84vw] sm:w-[80vw] max-w-2xl h-[80dvh] max-h-[80dvh] bg-[#FCF9F0]/95 backdrop-blur-2xl text-[#1B2A4A] rounded-[24px] border border-white/85 shadow-[0_24px_60px_-14px_rgba(27,42,74,0.38)] flex flex-col overflow-hidden font-['Outfit','Plus_Jakarta_Sans',sans-serif]"
      >
        {/* French Airmail Border Ribbon */}
        <div
          className="h-1.5 w-full flex-none opacity-85"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, #B8304A 0, #B8304A 14px, #FFFFFF 14px, #FFFFFF 22px, #22418A 22px, #22418A 36px, #FFFFFF 36px, #FFFFFF 44px)",
          }}
        />

        {/* Modal Top Header */}
        <div className="sticky top-0 z-20 px-3 sm:px-5 py-2 sm:py-3 bg-white/80 backdrop-blur-md border-b border-[#22418A]/10 flex items-center justify-between gap-2 shrink-0">
          {/* Brand & Letter count */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#FFF6D6] to-[#F7E3A0] text-[#B8304A] border border-[#C9892B]/25 flex items-center justify-center shrink-0 shadow-2xs">
              <BookOpen className="w-3.5 h-3.5 text-[#B8304A]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="font-['Cinzel',serif] font-bold text-[13px] sm:text-base text-[#1B2A4A] leading-none truncate">
                  Unsent Letters
                </span>
                <span className="text-[10px] font-mono font-bold text-[#5A6788] shrink-0">
                  #{currentIndex + 1}/{paragraphs.length}
                </span>
              </div>
              <p className="text-[9.5px] text-[#C9892B] font-medium leading-tight mt-0.5 hidden sm:block">
                06 June 2026 · Lighthouse Station Archive
              </p>
            </div>
          </div>

          {/* Controls: Mode Switcher, Font Theme, and Close */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Mode Switcher */}
            <div className="flex items-center border border-[#22418A]/15 bg-[#FAF7EE] rounded-full p-0.5">
              <button
                onClick={() => setViewMode("typewriter")}
                className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold transition-all cursor-pointer ${
                  viewMode === "typewriter"
                    ? "bg-[#22418A] text-white"
                    : "text-[#5A6788] hover:text-[#1B2A4A]"
                }`}
              >
                Reveal
              </button>
              <button
                onClick={() => setViewMode("all")}
                className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold transition-all cursor-pointer ${
                  viewMode === "all"
                    ? "bg-[#22418A] text-white"
                    : "text-[#5A6788] hover:text-[#1B2A4A]"
                }`}
              >
                All
              </button>
            </div>

            {/* Font Style Selector */}
            <div className="hidden md:flex items-center border border-[#22418A]/15 rounded-full bg-[#FAF7EE] px-1.5 py-0.5 text-xs gap-1">
              <button
                onClick={() => setFontTheme("lora")}
                className={`px-1.5 py-0.5 font-['Lora',serif] font-bold rounded-full text-[10.5px] ${
                  fontTheme === "lora" ? "bg-[#22418A] text-white" : "text-[#1B2A4A]"
                }`}
                title="Literary Serif (Lora)"
              >
                Lora
              </button>
              <button
                onClick={() => setFontTheme("playfair")}
                className={`px-1.5 py-0.5 font-['Playfair_Display',serif] font-bold rounded-full text-[10.5px] ${
                  fontTheme === "playfair" ? "bg-[#22418A] text-white" : "text-[#1B2A4A]"
                }`}
                title="Romantic Serif (Playfair)"
              >
                Playfair
              </button>
              <button
                onClick={() => setFontTheme("sans")}
                className={`px-1.5 py-0.5 font-sans font-bold rounded-full text-[10.5px] ${
                  fontTheme === "sans" ? "bg-[#22418A] text-white" : "text-[#1B2A4A]"
                }`}
                title="Clean Sans (Jakarta)"
              >
                Sans
              </button>
            </div>

            {/* Font Size Adjuster */}
            <div className="hidden sm:flex items-center border border-[#22418A]/15 rounded-full bg-[#FAF7EE] text-[10.5px] font-bold">
              <button
                onClick={() => setFontSizeOffset((o) => Math.max(-1, o - 1))}
                className="px-2 py-0.5 text-[#5A6788] hover:text-[#1B2A4A] disabled:opacity-30 cursor-pointer"
                disabled={fontSizeOffset === -1}
                title="Decrease font size"
              >
                A-
              </button>
              <button
                onClick={() => setFontSizeOffset((o) => Math.min(1, o + 1))}
                className="px-2 py-0.5 text-[#5A6788] hover:text-[#1B2A4A] disabled:opacity-30 cursor-pointer border-l border-[#22418A]/10"
                disabled={fontSizeOffset === 1}
                title="Increase font size"
              >
                A+
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-[#FAF7EE] hover:bg-white border border-[#22418A]/15 flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5 text-[#1B2A4A]" />
            </button>
          </div>
        </div>

        {/* ================= VIEW 1: TYPEWRITER WORD-BY-WORD REVEAL ================= */}
        {viewMode === "typewriter" && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#FAF7EE]/40">
            {/* Control Bar: Prev, Next, Play/Pause, Sound */}
            <div className="px-3 sm:px-5 py-1.5 bg-white/65 border-b border-[#22418A]/10 flex items-center justify-between gap-1.5 text-[11px] shrink-0">
              {/* Pagination */}
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="px-2 py-0.5 rounded-full bg-[#FAF7EE] disabled:opacity-30 hover:bg-white border border-[#22418A]/15 font-bold cursor-pointer transition-all disabled:cursor-not-allowed flex items-center gap-0.5 text-[#1B2A4A]"
                >
                  <ChevronLeft className="w-3 h-3" />
                  <span className="hidden sm:inline">Prev</span>
                </button>

                <button
                  onClick={handleNext}
                  disabled={currentIndex === paragraphs.length - 1}
                  className="px-2 py-0.5 rounded-full bg-[#FAF7EE] disabled:opacity-30 hover:bg-white border border-[#22418A]/15 font-bold cursor-pointer transition-all disabled:cursor-not-allowed flex items-center gap-0.5 text-[#1B2A4A]"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {/* Play / Speed / Audio */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsPlaying((p) => !p)}
                  disabled={isComplete}
                  className="px-2 py-0.5 rounded-full bg-[#FAF7EE] hover:bg-white disabled:opacity-40 border border-[#22418A]/15 font-bold flex items-center gap-1 cursor-pointer text-[#1B2A4A]"
                >
                  {isPlaying && !isComplete ? (
                    <>
                      <Pause className="w-2.5 h-2.5 text-[#B8304A]" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-2.5 h-2.5 text-[#22418A]" />
                      <span>{isComplete ? "Done" : "Type"}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleRestart}
                  className="p-1 rounded-full bg-[#FAF7EE] hover:bg-white border border-[#22418A]/15 cursor-pointer"
                  title="Re-type letter"
                >
                  <RotateCcw className="w-2.5 h-2.5 text-[#5A6788]" />
                </button>

                <button
                  onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
                  className="px-1.5 py-0.5 rounded-full bg-[#FAF7EE] border border-[#22418A]/15 font-mono font-bold text-[10px]"
                  title="Speed"
                >
                  {speed}x
                </button>

                <button
                  onClick={() => setSoundEnabled((s) => !s)}
                  className={`p-1 rounded-full border border-[#22418A]/15 cursor-pointer ${
                    soundEnabled ? "bg-[#FFF6D6] text-[#C9892B]" : "bg-[#FAF7EE] text-[#5A6788]"
                  }`}
                  title={soundEnabled ? "Mute typing audio" : "Enable typing audio"}
                >
                  {soundEnabled ? <Volume2 className="w-2.5 h-2.5" /> : <VolumeX className="w-2.5 h-2.5" />}
                </button>

                {!isComplete && (
                  <button
                    onClick={handleRevealAll}
                    className="px-2 py-0.5 rounded-full bg-white hover:bg-[#FAF7EE] border border-[#22418A]/30 font-bold text-[#22418A] cursor-pointer"
                  >
                    Full
                  </button>
                )}
              </div>
            </div>

            {/* Scrubber slider */}
            <div className="px-3 sm:px-5 py-1 bg-[#FAF7EE]/80 border-b border-[#22418A]/10 flex items-center gap-2 shrink-0">
              <span className="text-[9.5px] font-mono text-[#5A6788]">Letter</span>
              <input
                type="range"
                min="0"
                max={paragraphs.length - 1}
                value={currentIndex}
                onChange={(e) => setCurrentIndex(Number(e.target.value))}
                className="flex-1 accent-[#B8304A] cursor-pointer h-1 bg-[#22418A]/15 rounded"
              />
              <span className="font-mono text-[10.5px] font-bold text-[#1B2A4A] min-w-[28px] text-right">
                #{currentIndex + 1}
              </span>
            </div>

            {/* Scrollable Letter Body: Native Touch Scrolling on Mobile */}
            <div
              ref={scrollContainerRef}
              onScroll={(e) => handleScrollTracking(e, false)}
              className="flex-1 overflow-y-auto overscroll-y-contain touch-pan-y p-2.5 sm:p-6"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div
                className="relative max-w-2xl mx-auto p-5 sm:p-10 bg-[#FCFAF2] rounded-xl border border-[#22418A]/15 shadow-md flex flex-col justify-between"
                onDoubleClick={() => toggleLiked(currentIndex)}
                style={{
                  backgroundImage:
                    "radial-gradient(#1B2A4A 0.4px, transparent 0.4px), linear-gradient(to bottom, transparent 96%, rgba(34, 65, 138, 0.03) 96%)",
                  backgroundSize: "24px 24px, 100% 32px",
                }}
              >
                {/* Letterhead */}
                <div className="flex items-center justify-between pb-3 border-b border-[#22418A]/15 gap-2">
                  <div>
                    <span className="font-mono text-[11px] font-bold tracking-widest text-[#22418A] uppercase block">
                      LETTER #{currentIndex + 1}
                    </span>
                    <span className="font-['Homemade_Apple',cursive] text-xs text-[#C9892B] font-bold">
                      kept since 3 August 2022
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="border border-[#0A0D14]/20 px-2 py-0.5 bg-[#FFFFFF] text-[10px] font-mono font-bold text-[#0A0D14]">
                      06 JUN 2026
                    </span>
                    <button
                      onClick={() => toggleLiked(currentIndex)}
                      className="p-1 hover:text-[#B8304A] cursor-pointer"
                      title="Bookmark"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          likedMap[currentIndex] ? "text-[#B8304A] fill-[#B8304A]" : "text-[#5A6788]"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Main Beautiful Letter Text with Warm Literary Typography */}
                <div className="my-5 sm:my-8 text-left">
                  <p
                    className={`${getFontFamilyClass()} ${getFontSizeClass()} font-semibold text-[#14233D] tracking-normal select-none`}
                  >
                    {words.slice(0, revealedWordCount).map((word, wIdx) => {
                      const isHeaderLine = word === "MY" || word === "FINAL" || word === "NOTE…" || word === "Sanjana,";
                      return (
                        <span
                          key={wIdx}
                          className={`inline-block mr-1.5 animate-in fade-in duration-100 ${
                            isHeaderLine ? "text-[#B8304A] font-bold" : "text-[#14233D]"
                          }`}
                        >
                          {word}
                        </span>
                      );
                    })}

                    {/* Blinking Typewriter Cursor */}
                    {!isComplete && (
                      <span className="inline-block w-2.5 h-5 bg-[#B8304A] ml-1 animate-pulse align-middle" />
                    )}
                  </p>
                </div>

                {/* Personal Space Disclaimer Note (Light Theme) */}
                <div className="mb-3 p-3 bg-[#FFF6D6]/90 border border-[#C9892B]/40 rounded-lg text-[11px] text-[#1B2A4A] leading-relaxed">
                  <strong className="text-[#B8304A] uppercase font-mono tracking-wider">Disclaimer: </strong>
                  To any stalkers who are not relating to me and her: <strong>go get a life.</strong> Remember, this is
                  my personal space — if anyone stalks in between, just remember{" "}
                  <strong className="text-[#B8304A] underline">I can see your life more than this.</strong>
                </div>

                {/* Letter Footer Navigation */}
                <div className="pt-3 border-t border-[#22418A]/15 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[#5A6788] italic hidden sm:inline">
                    Double-tap anywhere to bookmark
                  </span>

                  {currentIndex < paragraphs.length - 1 ? (
                    <button
                      onClick={handleNext}
                      className="ml-auto px-4 py-1.5 rounded-lg bg-[#22418A] hover:bg-[#1B2A4A] text-white font-bold flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                    >
                      <span>Next Letter</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="ml-auto font-mono text-xs font-bold text-[#C9892B]">
                      Final letter sealed
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= VIEW 2: ALL LETTERS CONTINUOUS SCROLL ================= */}
        {viewMode === "all" && (
          <div
            onScroll={(e) => handleScrollTracking(e, true)}
            className="flex-1 overflow-y-auto overscroll-y-contain touch-pan-y p-3 sm:p-8 space-y-4 select-none bg-[#FAF8F5]"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {/* Manifest banner */}
            <div className="p-3.5 bg-[#FFFFFF] rounded-xl border border-[#22418A]/15 shadow-sm flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-mono text-xs font-bold text-[#B8304A] tracking-wider uppercase block">
                  ALL {paragraphs.length} LETTERS · JUNE 06, 2026
                </span>
                <span className="text-xs text-[#5A6788]">Lighthouse Harbor Transmission Archive</span>
              </div>
              <span className="font-mono text-xs font-bold text-[#5A6788]">
                {totalDays.toLocaleString("en-IN")} nights guarded
              </span>
            </div>

            {/* Personal Space Disclaimer Note (Light Theme) */}
            <div className="p-3.5 bg-[#FFF6D6] border border-[#C9892B]/50 rounded-xl text-xs text-[#1B2A4A] leading-relaxed shadow-2xs">
              <strong className="text-[#B8304A] uppercase font-mono tracking-wider block text-[10.5px] mb-0.5">
                ⚠ Personal Space Disclaimer
              </strong>
              To any stalkers who are not relating to me and her: <strong>go get a life.</strong> Remember, this is my
              personal space — if anyone stalks in between, just remember{" "}
              <strong className="text-[#B8304A] underline">I can see your life more than this.</strong>
            </div>

            {/* Telugu Quote Highlight */}
            <div className="p-4 sm:p-5 bg-[#FCFAF2] rounded-xl border border-[#C9892B]/30 shadow-sm space-y-1.5">
              <p className={`${getFontFamilyClass()} text-base sm:text-lg font-bold text-[#14233D] leading-relaxed`}>
                “Nuvvu ennisarlu nannu pagalkottina... ennisarlu na gunde ni mukkalu chesina... I can't stop loving you like this.”
              </p>
              <p className="text-xs text-[#5A6788] italic">
                Even if silence stands between us, my heart will forever keep the light burning on the horizon. Every broken seam is sealed with gold.
              </p>
            </div>

            {/* All Letters Cards with Warm Literary Typography */}
            <div className="space-y-4">
              {paragraphs.map((text, idx) => (
                <div
                  key={idx}
                  onDoubleClick={() => toggleLiked(idx)}
                  className="p-4 sm:p-6 bg-[#FCFAF2] rounded-xl border border-[#22418A]/12 shadow-sm hover:border-[#22418A]/30 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#22418A]/10 text-xs font-mono">
                    <span className="font-bold text-[#22418A]">LETTER #{idx + 1}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLiked(idx);
                      }}
                      className="p-1 hover:text-[#B8304A] cursor-pointer"
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          likedMap[idx] ? "text-[#B8304A] fill-[#B8304A]" : "text-[#5A6788]/40"
                        }`}
                      />
                    </button>
                  </div>
                  <p
                    className={`${getFontFamilyClass()} ${getFontSizeClass()} font-semibold text-[#14233D] tracking-normal select-none whitespace-pre-line`}
                  >
                    {text}
                  </p>
                </div>
              ))}
            </div>

            {/* Footer Telugu Seal */}
            <div className="py-6 text-center space-y-2 border-t border-[#22418A]/15">
              <p className="font-['Lora',serif] font-bold text-lg text-[#C9892B] italic">
                “PREMA ANDARIKI DORAKADHU. DORIKITHE PORADALI.”
              </p>
              <p className="text-xs text-[#5A6788]">
                And I fought for it... Good luck with your journey. Transmitted June 06, 2026.
              </p>
              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="px-6 py-2 rounded-lg bg-[#22418A] hover:bg-[#1B2A4A] text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Close Archive
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
