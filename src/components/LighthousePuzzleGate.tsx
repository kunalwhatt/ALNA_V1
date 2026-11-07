import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Calculator,
  Lock,
  Clock,
} from "lucide-react";
import { NeoCard } from "./neopop/NeoCard";
import { NeoButton } from "./neopop/NeoButton";
import { Typography } from "./neopop/Typography";
import { FontVariant } from "./neopop/primitives";
import { playPorcelainClick, playGoldChime } from "../utils/audio";
import { SecurityAnomalyPayload } from "../hooks/useSecurityShield";

interface LighthousePuzzleGateProps {
  onVerified: (solveTelemetry: {
    attempts: number;
    solveDurationMs: number;
    trajectoryPoints: number;
  }) => void;
  onBotFlagged?: (reason: string) => void;
  onRequestLocation?: () => void;
  isBotDetected: boolean;
  botReason: string | null;
  isOwnerIp: boolean;
  visitorIp: string;
  anomalyCause?: SecurityAnomalyPayload | null;
}

type MathOperator = "+" | "−" | "×";

interface MathChallenge {
  a: number;
  b: number;
  operator: MathOperator;
  operatorLabel: string;
  answer: number;
}

function generateMathChallenge(): MathChallenge {
  const ops: MathOperator[] = ["+", "−", "×"];
  const operator = ops[Math.floor(Math.random() * ops.length)];

  if (operator === "+") {
    const a = Math.floor(11 + Math.random() * 38);
    const b = Math.floor(4 + Math.random() * 25);
    return {
      a,
      b,
      operator: "+",
      operatorLabel: "ADDITION",
      answer: a + b,
    };
  }

  if (operator === "−") {
    const a = Math.floor(18 + Math.random() * 42);
    const b = Math.floor(4 + Math.random() * (a - 6));
    return {
      a,
      b,
      operator: "−",
      operatorLabel: "SUBTRACTION",
      answer: a - b,
    };
  }

  // Multiplication (×)
  const a = Math.floor(3 + Math.random() * 10);
  const b = Math.floor(3 + Math.random() * 9);
  return {
    a,
    b,
    operator: "×",
    operatorLabel: "MULTIPLICATION",
    answer: a * b,
  };
}

export const LighthousePuzzleGate: React.FC<LighthousePuzzleGateProps> = ({
  onVerified,
  onBotFlagged,
  onRequestLocation,
  isBotDetected,
  botReason,
  anomalyCause,
}) => {
  const [challenge, setChallenge] = useState<MathChallenge>(() =>
    generateMathChallenge()
  );
  const [userInput, setUserInput] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [errorCode, setErrorCode] = useState<string>("");
  const [attempts, setAttempts] = useState<number>(0);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(120);

  const mountTimeRef = useRef<number>(Date.now());
  const interactionCountRef = useRef<number>(0);

  const refreshChallenge = useCallback((autoTriggered = false) => {
    if (!autoTriggered) {
      playPorcelainClick();
    }
    setChallenge(generateMathChallenge());
    setUserInput("");
    setSecondsLeft(120);
    mountTimeRef.current = Date.now();
    if (autoTriggered) {
      setErrorCode("ERR_TIMEOUT_408");
      setError("120s expired — Equation auto-refreshed.");
    } else {
      setError("");
      setErrorCode("");
    }
  }, []);

  // 120-Second Automatic CAPTCHA Refresh Countdown
  useEffect(() => {
    if (isSuccess || isBotDetected) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setChallenge(generateMathChallenge());
          setUserInput("");
          mountTimeRef.current = Date.now();
          setErrorCode("ERR_TIMEOUT_408");
          setError("120s timer expired — New equation generated.");
          return 120;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isSuccess, isBotDetected]);

  useEffect(() => {
    mountTimeRef.current = Date.now();
  }, [anomalyCause]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSuccess || isBotDetected) return;

    if (onRequestLocation) {
      onRequestLocation();
    }

    const clean = userInput.trim();
    if (!clean) {
      setErrorCode("ERR_INPUT_400");
      setError("Please enter the answer to continue.");
      return;
    }

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    const solveDurationMs = Date.now() - mountTimeRef.current;

    // Anti-bot speed check (< 150ms instant form fill)
    if (solveDurationMs < 150 && interactionCountRef.current === 0) {
      setErrorCode("ERR_BOT_SPEED_429");
      setError("Automated submission blocked. Type the answer manually.");
      if (onBotFlagged) {
        onBotFlagged(`Instant bot form fill detected (${solveDurationMs}ms)`);
      }
      setChallenge(generateMathChallenge());
      setUserInput("");
      setSecondsLeft(120);
      return;
    }

    const parsed = Number(clean);
    if (!Number.isNaN(parsed) && parsed === challenge.answer) {
      setIsSuccess(true);
      setError("");
      setErrorCode("");
      playGoldChime();
      setTimeout(() => {
        onVerified({
          attempts: nextAttempts,
          solveDurationMs,
          trajectoryPoints: interactionCountRef.current || 1,
        });
      }, 240);
    } else {
      setErrorCode("ERR_MATH_400");
      setError("Incorrect answer. Try this new equation.");
      if (onBotFlagged && nextAttempts >= 3) {
        onBotFlagged(`Failed Math CAPTCHA ${nextAttempts} times`);
      }
      setChallenge(generateMathChallenge());
      setUserInput("");
      setSecondsLeft(120);
    }
  };

  return (
    <div
      id="alna-puzzle-gate-modal"
      className="fixed inset-0 z-[9800] flex items-center justify-center bg-[#1B2A4A]/45 backdrop-blur-md select-none font-['Outfit','Plus_Jakarta_Sans',sans-serif]"
    >
      {/* Centered 75% Screen Size Container */}
      <div className="w-[75vw] max-w-[350px] max-h-[75dvh] mx-auto my-auto flex items-center justify-center">
        <NeoCard
          elevation="lg"
          variant="porcelain"
          className="w-full p-4 sm:p-5 bg-[#FAF7EE] border-2 border-[#0A0D14] shadow-[6px_6px_0px_#0A0D14] flex flex-col items-center overflow-y-auto max-h-[75dvh]"
        >
          {/* Top NeoPOP Status & 120s Auto-Refresh Bar */}
          <div className="w-full flex items-center justify-between pb-2 mb-2.5 border-b-2 border-[#0A0D14]/15">
            <span
              className={`px-2 py-0.5 border border-[#0A0D14] text-[9.5px] font-extrabold uppercase tracking-wider shadow-[2px_2px_0px_#0A0D14] ${
                isBotDetected
                  ? "bg-[#B8304A] text-white"
                  : anomalyCause
                  ? "bg-[#B8304A] text-white"
                  : "bg-[#22418A] text-[#F2C230]"
              }`}
            >
              {isBotDetected
                ? "ERR_BOT_429"
                : anomalyCause
                ? anomalyCause.code
                : "GATE_200"}
            </span>

            {!isBotDetected && (
              <span className="px-2 py-0.5 bg-[#FFF6D6] border border-[#0A0D14] text-[9.5px] font-extrabold text-[#0A0D14] flex items-center gap-1 tabular-nums">
                <Clock className="w-2.5 h-2.5 text-[#C9892B]" />
                <span>REFRESH: {secondsLeft}s</span>
              </span>
            )}
          </div>

          {/* Top NeoPOP Icon Box */}
          <div
            className={`w-10 h-10 border-2 border-[#0A0D14] flex items-center justify-center mb-2 shadow-[3px_3px_0px_#0A0D14] shrink-0 ${
              anomalyCause || isBotDetected
                ? "bg-[#B8304A] text-[#FFFFFF]"
                : "bg-[#22418A] text-[#F2C230]"
            }`}
          >
            <Calculator className="w-5 h-5" />
          </div>

          <Typography
            {...FontVariant.CapsBold10}
            color={anomalyCause ? "#B8304A" : "#22418A"}
            className="mb-0.5 text-center"
          >
            {anomalyCause ? "ANOMALY RE-VERIFICATION" : "SECURITY CHALLENGE"}
          </Typography>

          <Typography
            {...FontVariant.HeadingBold18}
            color="#0A0D14"
            className="text-center mb-0.5"
          >
            Human Verification
          </Typography>

          <Typography
            {...FontVariant.BodyRegular12}
            color="#5A6788"
            className="text-center mb-3"
          >
            {anomalyCause
              ? "Activity flagged — solve to resume session"
              : "Solve the equation to enter al:na"}
          </Typography>

          {/* Simple Anomaly Cause Box when triggered mid-session */}
          {anomalyCause && !isBotDetected && (
            <div className="w-full p-2.5 mb-3 bg-[#FDE8EC] border-2 border-[#0A0D14] shadow-[3px_3px_0px_#0A0D14] text-left">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#B8304A] flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>Cause • {anomalyCause.code}</span>
                </span>
              </div>
              <p className="text-[11px] font-bold text-[#0A0D14] leading-snug">
                {anomalyCause.simpleCause}
              </p>
            </div>
          )}

          {isBotDetected ? (
            <div className="w-full space-y-2.5">
              <div className="p-3 bg-[#FDE8EC] border-2 border-[#0A0D14] shadow-[3px_3px_0px_#0A0D14] text-left space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#B8304A] uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Automated Bot Blocked (ERR_BOT_429)</span>
                </div>
                <Typography
                  {...FontVariant.BodyRegular12}
                  color="#0A0D14"
                  className="font-semibold"
                >
                  {botReason ||
                    "Connections from automated datacenter crawlers and headless scanners are restricted."}
                </Typography>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-2.5">
              {/* NeoPOP Equation Display Box */}
              <div className="w-full bg-[#FFFFFF] border-2 border-[#0A0D14] shadow-[3px_3px_0px_#0A0D14] p-2.5">
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#0A0D14]/15">
                  <span className="px-2 py-0.5 bg-[#FFF6D6] border border-[#0A0D14] text-[9.5px] font-extrabold uppercase tracking-wider text-[#0A0D14]">
                    {challenge.operatorLabel}
                  </span>

                  <button
                    type="button"
                    onClick={() => refreshChallenge(false)}
                    className="px-2 py-0.5 bg-[#FAF7EE] hover:bg-[#FFFFFF] border border-[#0A0D14] text-[10px] font-bold text-[#0A0D14] flex items-center gap-1 cursor-pointer shadow-[2px_2px_0px_#0A0D14] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                    title="Get another equation"
                  >
                    <RefreshCw className="w-2.5 h-2.5 text-[#22418A]" />
                    <span>New</span>
                  </button>
                </div>

                {/* Crisp Neo Font Equation */}
                <div className="py-1 flex items-center justify-center gap-2 text-center">
                  <span className="text-2xl sm:text-3xl font-extrabold text-[#0A0D14] tracking-tight tabular-nums">
                    {challenge.a}
                  </span>
                  <span className="w-7 h-7 bg-[#22418A] text-[#F2C230] border-2 border-[#0A0D14] shadow-[2px_2px_0px_#0A0D14] flex items-center justify-center text-base font-black">
                    {challenge.operator}
                  </span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-[#0A0D14] tracking-tight tabular-nums">
                    {challenge.b}
                  </span>
                  <span className="text-xl font-extrabold text-[#5A6788]">=</span>
                  <span className="px-2 py-0.5 bg-[#FFF6D6] border-2 border-[#0A0D14] text-xl sm:text-2xl font-black text-[#B8304A] tabular-nums shadow-[2px_2px_0px_#0A0D14]">
                    {userInput || "?"}
                  </span>
                </div>
              </div>

              {/* NeoPOP Answer Input Field */}
              <div className="w-full">
                <input
                  type="number"
                  inputMode="numeric"
                  autoFocus
                  placeholder="Enter Answer"
                  value={userInput}
                  onChange={(e) => {
                    interactionCountRef.current += 1;
                    setError("");
                    setErrorCode("");
                    setUserInput(e.target.value);
                  }}
                  className="w-full bg-[#FFFFFF] border-2 border-[#0A0D14] px-3 py-2 text-sm sm:text-base text-[#0A0D14] placeholder-[#7B8191] outline-none focus:border-[#22418A] text-center font-extrabold tracking-wider shadow-[2px_2px_0px_#0A0D14] tabular-nums"
                />
              </div>

              {/* Error or Success State with NeoPOP Error Code */}
              {error && (
                <div className="p-2 bg-[#FDE8EC] border-2 border-[#0A0D14] shadow-[2px_2px_0px_#0A0D14] flex flex-col items-center justify-center gap-0.5 text-[10.5px] text-[#B8304A] font-bold text-center">
                  {errorCode && (
                    <span className="px-1.5 py-0.2 bg-[#B8304A] text-white text-[9px] font-extrabold uppercase tracking-wider">
                      {errorCode}
                    </span>
                  )}
                  <span className="text-[#0A0D14]">{error}</span>
                </div>
              )}

              {isSuccess && (
                <div className="p-2 bg-[#D1FAE5] border-2 border-[#0A0D14] shadow-[2px_2px_0px_#0A0D14] flex items-center justify-center gap-1.5 text-[11px] text-[#065F46] font-extrabold">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Verified! Unlocking...</span>
                </div>
              )}

              {/* NeoPOP Submit CTA */}
              <NeoButton type="submit" variant="primary" size="md" fullWidth>
                <span className="flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#F2C230]" />
                  <span>Verify &amp; Unlock</span>
                </span>
              </NeoButton>
            </form>
          )}
        </NeoCard>
      </div>
    </div>
  );
};
