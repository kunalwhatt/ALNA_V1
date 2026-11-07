import React, { useState, useEffect, useCallback } from "react";
import {
  EyeOff,
  RefreshCw,
  Key,
  AlertTriangle,
  WifiOff,
  CameraOff,
  Lock,
  ShieldAlert,
  Clock,
} from "lucide-react";
import { NeoCard } from "./neopop/NeoCard";
import { Typography } from "./neopop/Typography";
import { FontVariant } from "./neopop/primitives";
import { playPorcelainClick, playGoldChime } from "../utils/audio";

interface SecurityShieldOverlayProps {
  isVpnDetected: boolean;
  vpnReason: string | null;
  vpnDetails: {
    ip?: string;
    ipv4?: string;
    ipv6?: string;
    org?: string;
    country?: string;
    timezone?: string;
  } | null;
  isCheckingVpn: boolean;
  isCaptureProtected: boolean;
  captureWarning: string | null;
  activeErrorCode?: string;
  isBlurred: boolean;
  lockoutSeconds: number;
  onRecheckVpn: () => void;
  onBypassVpn: () => void;
  onDismissBlur: () => void;
}

type MathOperator = "+" | "−" | "×";

interface MathChallenge {
  a: number;
  b: number;
  operator: MathOperator;
  answer: number;
}

function generateMathChallenge(): MathChallenge {
  const ops: MathOperator[] = ["+", "−", "×"];
  const operator = ops[Math.floor(Math.random() * ops.length)];

  if (operator === "+") {
    const a = Math.floor(11 + Math.random() * 38);
    const b = Math.floor(4 + Math.random() * 25);
    return { a, b, operator: "+", answer: a + b };
  }

  if (operator === "−") {
    const a = Math.floor(18 + Math.random() * 42);
    const b = Math.floor(4 + Math.random() * (a - 6));
    return { a, b, operator: "−", answer: a - b };
  }

  const a = Math.floor(3 + Math.random() * 10);
  const b = Math.floor(3 + Math.random() * 9);
  return { a, b, operator: "×", answer: a * b };
}

export const SecurityShieldOverlay: React.FC<SecurityShieldOverlayProps> = ({
  isVpnDetected,
  vpnReason,
  vpnDetails,
  isCaptureProtected,
  captureWarning,
  activeErrorCode = "ERR_CAPTURE_401",
  isBlurred,
  lockoutSeconds,
  onBypassVpn,
  onDismissBlur,
}) => {
  const [showKeeperOverride, setShowKeeperOverride] = useState(false);
  const [overrideKey, setOverrideKey] = useState("");
  const [overrideError, setOverrideError] = useState("");

  // Compact Inline Mathematics CAPTCHA state (replaces the bottom button bar in 70% / 25% split)
  const [challenge, setChallenge] = useState<MathChallenge>(() =>
    generateMathChallenge()
  );
  const [mathInput, setMathInput] = useState<string>("");
  const [mathError, setMathError] = useState<string>("");
  const [secondsLeft, setSecondsLeft] = useState<number>(120);

  const showCurtain = (isBlurred || isCaptureProtected) && !isVpnDetected;
  const showNonCurtainAlert = Boolean(captureWarning && !showCurtain && !isVpnDetected);
  const isAnyErrorModuleOpen = showCurtain || showNonCurtainAlert || isVpnDetected;

  const resolvedCurtainCode =
    activeErrorCode || (isCaptureProtected ? "ERR_CAPTURE_401" : "ERR_FOCUS_408");

  const refreshMathChallenge = useCallback(() => {
    playPorcelainClick();
    setChallenge(generateMathChallenge());
    setMathInput("");
    setMathError("");
    setSecondsLeft(120);
  }, []);

  useEffect(() => {
    if (isAnyErrorModuleOpen) {
      setChallenge(generateMathChallenge());
      setMathInput("");
      setMathError("");
      setSecondsLeft(120);
    }
  }, [isAnyErrorModuleOpen, activeErrorCode]);

  // 120-Second Auto-Refresh Timer
  useEffect(() => {
    if (!isAnyErrorModuleOpen) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setChallenge(generateMathChallenge());
          setMathInput("");
          setMathError("120s expired — New equation generated");
          return 120;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isAnyErrorModuleOpen]);

  const handleMathUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showCurtain && lockoutSeconds > 0) return;

    const clean = mathInput.trim();
    if (!clean) {
      setMathError("ERR_INPUT_400 • Enter answer first");
      return;
    }

    const parsed = Number(clean);
    if (!Number.isNaN(parsed) && parsed === challenge.answer) {
      setMathError("");
      setMathInput("");
      playGoldChime();
      if (isVpnDetected) {
        onBypassVpn();
      } else {
        onDismissBlur();
      }
    } else {
      setMathError("ERR_MATH_400 • Wrong answer, try again");
      setChallenge(generateMathChallenge());
      setMathInput("");
      setSecondsLeft(120);
    }
  };

  const handleOverrideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = overrideKey.trim().replace(/^<|>$/g, "").trim();
    if (clean === "1811!" || clean === "1811!#kunal") {
      setOverrideError("");
      setOverrideKey("");
      setShowKeeperOverride(false);
      onBypassVpn();
    } else {
      setOverrideError("ERR_AUTH_401 • Invalid Keeper key.");
    }
  };

  // Compact single-row bar in the exact size & position of the old "Re-Verify Human Access" button:
  // Left ~72% displays the Mathematics CAPTCHA + inline answer input | Right ~28% is the Verify button
  const renderCompactBottomMathBar = (isLockedCountdown: boolean) => (
    <form onSubmit={handleMathUnlockSubmit} className="w-full flex flex-col gap-1.5">
      <div className="w-full flex items-stretch justify-between gap-[3%] h-11">
        {/* 70%–72% Mathematics CAPTCHA Box */}
        <div className="w-[72%] bg-[#FFFFFF] border-2 border-[#0A0D14] shadow-[3px_3px_0px_#0A0D14] px-2 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 text-xs sm:text-sm font-black text-[#0A0D14] tabular-nums whitespace-nowrap">
            <span>{challenge.a}</span>
            <span className="px-1 py-0.2 bg-[#22418A] text-[#F2C230] border border-[#0A0D14] text-[11px] leading-none">
              {challenge.operator}
            </span>
            <span>{challenge.b}</span>
            <span className="text-[#5A6788]">=</span>
          </div>

          <input
            type="number"
            inputMode="numeric"
            placeholder="?"
            value={mathInput}
            onChange={(e) => {
              setMathError("");
              setMathInput(e.target.value);
            }}
            className="w-12 h-7 bg-[#FFF6D6] border-2 border-[#0A0D14] text-center font-black text-xs sm:text-sm text-[#B8304A] placeholder-[#B8304A]/50 outline-none focus:bg-white tabular-nums"
          />

          <button
            type="button"
            onClick={refreshMathChallenge}
            className="p-1 bg-[#FAF7EE] hover:bg-[#FFF6D6] border border-[#0A0D14] text-[#22418A] cursor-pointer shrink-0"
            title={`New equation (Auto-refresh in ${secondsLeft}s)`}
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        {/* 25% Verify Button */}
        <button
          type="submit"
          disabled={isLockedCountdown}
          className={`w-[25%] border-2 border-[#0A0D14] font-extrabold text-[10.5px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all ${
            isLockedCountdown
              ? "bg-[#E2E8F0] text-[#5A6788] cursor-not-allowed shadow-none"
              : "bg-[#0A0D14] hover:bg-[#22418A] text-[#FFFFFF] shadow-[3px_3px_0px_#C9892B] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
          }`}
        >
          <Lock className="w-3 h-3 text-[#F2C230] shrink-0" />
          <span>{isLockedCountdown ? `${lockoutSeconds}s` : "Verify"}</span>
        </button>
      </div>

      {/* Tiny inline status row for 120s auto-refresh or wrong answer */}
      <div className="w-full flex items-center justify-between text-[9.5px] font-bold px-0.5">
        {mathError ? (
          <span className="text-[#B8304A] font-extrabold truncate">{mathError}</span>
        ) : (
          <span className="text-[#5A6788]">Human Verification required to unlock</span>
        )}
        <span className="text-[#0A0D14] flex items-center gap-0.5 tabular-nums shrink-0">
          <Clock className="w-2.5 h-2.5 text-[#C9892B]" />
          <span>{secondsLeft}s</span>
        </span>
      </div>
    </form>
  );

  return (
    <>
      {/* 0. ZERO-DELAY SYNCHRONOUS DOM CURTAIN — Previous Clean NeoPOP Style + 70% Math / 25% Verify Bottom Bar */}
      <div
        id="alna-instant-curtain"
        style={{ display: showCurtain ? "flex" : "none" }}
        className="fixed inset-0 z-[9000] bg-[#FAF7EE] text-[#0A0D14] flex items-center justify-center select-none font-['Outfit','Plus_Jakarta_Sans',sans-serif]"
      >
        <div className="w-[75vw] max-w-[350px] max-h-[75dvh] mx-auto my-auto flex items-center justify-center">
          <NeoCard
            elevation="lg"
            variant="porcelain"
            className="w-full p-4 sm:p-5 bg-[#FAF7EE] border-2 border-[#0A0D14] shadow-[6px_6px_0px_#0A0D14] flex flex-col items-center text-center overflow-y-auto max-h-[75dvh]"
          >
            {/* Error Code Top Bar */}
            <div className="w-full flex items-center justify-between pb-2 mb-2.5 border-b-2 border-[#0A0D14]/15">
              <span className="px-2 py-0.5 bg-[#B8304A] text-[#FFFFFF] border border-[#0A0D14] text-[9.5px] font-extrabold uppercase tracking-wider shadow-[2px_2px_0px_#0A0D14]">
                {resolvedCurtainCode}
              </span>
              <span className="px-2 py-0.5 bg-[#FFF6D6] text-[#0A0D14] border border-[#0A0D14] text-[9.5px] font-extrabold uppercase tracking-wider">
                SECURITY SHIELD
              </span>
            </div>

            {/* NeoPOP Icon Box */}
            <div className="w-10 h-10 bg-[#B8304A] text-[#FFFFFF] border-2 border-[#0A0D14] flex items-center justify-center mb-2.5 shadow-[3px_3px_0px_#0A0D14] shrink-0">
              {isCaptureProtected ? (
                <CameraOff className="w-5 h-5" />
              ) : (
                <EyeOff className="w-5 h-5" />
              )}
            </div>

            <Typography
              {...FontVariant.CapsBold10}
              color="#B8304A"
              className="mb-0.5 text-center"
            >
              CAPTURE &amp; RECORDING RESTRICTED
            </Typography>

            <Typography
              {...FontVariant.HeadingBold18}
              color="#0A0D14"
              className="text-center mb-1"
            >
              {resolvedCurtainCode === "ERR_RECORD_402"
                ? "Screen Recording Blocked"
                : isCaptureProtected
                ? "Screenshot Blocked"
                : "Window Focus Paused"}
            </Typography>

            <Typography
              {...FontVariant.BodyRegular12}
              color="#5A6788"
              className="text-center mb-3"
            >
              {captureWarning ||
                "Screen content is blanked automatically on screenshots, screen recording, or focus switch."}
            </Typography>

            {/* Personal Space Disclaimer in NeoPOP Box */}
            <div className="w-full p-2.5 bg-[#FFF6D6] border-2 border-[#0A0D14] shadow-[3px_3px_0px_#0A0D14] text-left mb-3">
              <div className="flex items-center gap-1 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[#B8304A] shrink-0" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#B8304A]">
                  Personal Space Disclaimer
                </span>
              </div>
              <p className="text-[11px] text-[#0A0D14] font-semibold leading-snug">
                To any stalkers who are not relating to me and her:{" "}
                <strong>go get a life.</strong> Remember, this is my personal space — if
                anyone stalks in between, remember{" "}
                <span className="text-[#B8304A] font-extrabold underline">
                  I can see your life more than this.
                </span>
              </p>
            </div>

            {/* 70% Math CAPTCHA + 25% Verify Button in Exact Bottom Button Position */}
            {renderCompactBottomMathBar(lockoutSeconds > 0)}
          </NeoCard>
        </div>
      </div>

      {/* 1. VPN / PROXY / ANONYMIZER BLOCK GATE — Previous Clean NeoPOP Style + 70% Math / 25% Verify Bottom Bar */}
      {isVpnDetected && (
        <div className="fixed inset-0 z-[9999] bg-[#1B2A4A]/45 backdrop-blur-md flex items-center justify-center select-none font-['Outfit','Plus_Jakarta_Sans',sans-serif]">
          <div className="w-[75vw] max-w-[350px] max-h-[75dvh] mx-auto my-auto flex items-center justify-center">
            <NeoCard
              elevation="lg"
              variant="porcelain"
              className="w-full p-4 sm:p-5 bg-[#FAF7EE] border-2 border-[#0A0D14] shadow-[6px_6px_0px_#0A0D14] flex flex-col items-center text-center overflow-y-auto max-h-[75dvh]"
            >
              {/* Top Error Code Bar */}
              <div className="w-full flex items-center justify-between pb-2 mb-2.5 border-b-2 border-[#0A0D14]/15">
                <span className="px-2 py-0.5 bg-[#B8304A] text-[#FFFFFF] border border-[#0A0D14] text-[9.5px] font-extrabold uppercase tracking-wider shadow-[2px_2px_0px_#0A0D14]">
                  ERR_VPN_403
                </span>
                <span className="px-2 py-0.5 bg-[#FFF6D6] text-[#0A0D14] border border-[#0A0D14] text-[9.5px] font-extrabold uppercase tracking-wider">
                  NETWORK GATE
                </span>
              </div>

              <div className="w-10 h-10 bg-[#B8304A] text-[#FFFFFF] border-2 border-[#0A0D14] flex items-center justify-center mb-2 shadow-[3px_3px_0px_#0A0D14] shrink-0">
                <WifiOff className="w-5 h-5" />
              </div>

              <Typography
                {...FontVariant.CapsBold10}
                color="#B8304A"
                className="mb-0.5 text-center"
              >
                ANONYMIZED TRAFFIC BLOCKED
              </Typography>

              <Typography
                {...FontVariant.HeadingBold18}
                color="#0A0D14"
                className="text-center mb-2"
              >
                VPN / Proxy Restricted
              </Typography>

              {/* Cause Box */}
              <div className="w-full p-2.5 bg-[#FFFFFF] border-2 border-[#0A0D14] shadow-[3px_3px_0px_#0A0D14] text-left mb-2.5 space-y-1">
                <div className="text-[11px] font-extrabold text-[#B8304A] flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>{vpnReason || "VPN or Proxy tunnel detected."}</span>
                </div>
                {vpnDetails?.org && (
                  <div className="text-[10.5px] text-[#0A0D14] font-semibold pt-1 border-t border-[#0A0D14]/15">
                    <div>
                      <strong>ISP:</strong> {vpnDetails.org}
                    </div>
                    {vpnDetails.country && (
                      <div>
                        <strong>Region:</strong> {vpnDetails.country}{" "}
                        {vpnDetails.timezone ? `(${vpnDetails.timezone})` : ""}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Personal Space Disclaimer */}
              <div className="w-full p-2.5 bg-[#FFF6D6] border-2 border-[#0A0D14] shadow-[2px_2px_0px_#0A0D14] text-left mb-3">
                <p className="text-[10.5px] text-[#0A0D14] font-semibold leading-snug">
                  <strong className="text-[#B8304A] uppercase">Disclaimer:</strong> To any
                  stalkers not relating to me and her — <strong>go get a life.</strong>{" "}
                  Remember{" "}
                  <span className="text-[#B8304A] font-extrabold underline">
                    I can see your life more than this.
                  </span>
                </p>
              </div>

              {/* 70% Math CAPTCHA + 25% Verify Button in Exact Bottom Button Position */}
              <div className="w-full flex flex-col gap-2">
                {renderCompactBottomMathBar(false)}

                {!showKeeperOverride ? (
                  <button
                    type="button"
                    onClick={() => setShowKeeperOverride(true)}
                    className="text-[10.5px] text-[#5A6788] hover:text-[#0A0D14] font-bold py-0.5 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Key className="w-3 h-3" />
                    <span>Keeper Authorization Override</span>
                  </button>
                ) : (
                  <form
                    onSubmit={handleOverrideSubmit}
                    className="pt-2 border-t border-[#0A0D14]/15 space-y-2"
                  >
                    <div className="flex gap-1.5">
                      <input
                        type="password"
                        placeholder="Keeper Key"
                        value={overrideKey}
                        onChange={(e) => {
                          setOverrideError("");
                          setOverrideKey(e.target.value);
                        }}
                        className="flex-1 bg-white border-2 border-[#0A0D14] px-2.5 py-1.5 text-xs text-[#0A0D14] font-extrabold outline-none shadow-[2px_2px_0px_#0A0D14]"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-[#22418A] text-white font-extrabold text-[11px] uppercase border-2 border-[#0A0D14] shadow-[2px_2px_0px_#0A0D14] cursor-pointer"
                      >
                        Unlock
                      </button>
                    </div>
                    {overrideError && (
                      <p className="text-[10.5px] text-[#B8304A] font-extrabold">
                        {overrideError}
                      </p>
                    )}
                  </form>
                )}
              </div>
            </NeoCard>
          </div>
        </div>
      )}

      {/* 2. ACTION BLOCKED / ANOMALY MODULE — Previous Clean NeoPOP Style + 70% Math / 25% Verify Bottom Bar */}
      {showNonCurtainAlert && (
        <div className="fixed inset-0 z-[9500] bg-[#1B2A4A]/35 backdrop-blur-xs flex items-center justify-center select-none font-['Outfit','Plus_Jakarta_Sans',sans-serif] pointer-events-auto">
          <div className="w-[75vw] max-w-[350px] max-h-[75dvh] mx-auto my-auto flex items-center justify-center">
            <NeoCard
              elevation="lg"
              variant="porcelain"
              className="w-full p-4 bg-[#FAF7EE] border-2 border-[#0A0D14] shadow-[6px_6px_0px_#0A0D14] flex flex-col items-center text-center"
            >
              <div className="w-full flex items-center justify-between pb-2 mb-2 border-b-2 border-[#0A0D14]/15">
                <span className="px-2 py-0.5 bg-[#B8304A] text-white border border-[#0A0D14] text-[9.5px] font-extrabold uppercase tracking-wider shadow-[2px_2px_0px_#0A0D14]">
                  {activeErrorCode || "ERR_COPY_407"}
                </span>
                <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-[#22418A]">
                  SECURITY ALERT
                </span>
              </div>
              <Typography
                {...FontVariant.HeadingBold16}
                color="#0A0D14"
                className="mb-1 text-center"
              >
                Action Restricted
              </Typography>
              <Typography
                {...FontVariant.BodyRegular12}
                color="#5A6788"
                className="mb-3 text-center font-semibold"
              >
                {captureWarning}
              </Typography>

              {/* 70% Math CAPTCHA + 25% Verify Button in Exact Bottom Button Position */}
              {renderCompactBottomMathBar(false)}
            </NeoCard>
          </div>
        </div>
      )}
    </>
  );
};
