import React, { useState } from "react";
import {
  ShieldAlert,
  EyeOff,
  RefreshCw,
  Key,
  AlertTriangle,
  WifiOff,
  CameraOff,
  Eye,
} from "lucide-react";

interface SecurityShieldOverlayProps {
  isVpnDetected: boolean;
  vpnReason: string | null;
  vpnDetails: {
    ip?: string;
    org?: string;
    country?: string;
    timezone?: string;
  } | null;
  isCheckingVpn: boolean;
  isCaptureProtected: boolean;
  captureWarning: string | null;
  isBlurred: boolean;
  onRecheckVpn: () => void;
  onBypassVpn: () => void;
  onDismissBlur: () => void;
}

export const SecurityShieldOverlay: React.FC<SecurityShieldOverlayProps> = ({
  isVpnDetected,
  vpnReason,
  vpnDetails,
  isCheckingVpn,
  isCaptureProtected,
  captureWarning,
  isBlurred,
  onRecheckVpn,
  onBypassVpn,
  onDismissBlur,
}) => {
  const [showKeeperOverride, setShowKeeperOverride] = useState(false);
  const [overrideKey, setOverrideKey] = useState("");
  const [overrideError, setOverrideError] = useState("");

  const handleOverrideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = overrideKey.trim().replace(/^<|>$/g, "").trim();
    if (clean === "1811!") {
      setOverrideError("");
      setOverrideKey("");
      setShowKeeperOverride(false);
      onBypassVpn();
    } else {
      setOverrideError("Invalid Keeper key. Disable VPN to proceed.");
    }
  };

  return (
    <>
      {/* 1. FULL-SCREEN VPN / PROXY / TOR BLOCK GATE (LIGHT THEME) */}
      {isVpnDetected && (
        <div className="fixed inset-0 z-[9999] bg-[#EEF5F3] text-[#1B2A4A] flex items-center justify-center p-4 select-none">
          <div className="w-full max-w-md bg-[#FAF7EE] text-[#1B2A4A] border-2 border-[#22418A] rounded-2xl shadow-[0_20px_60px_-15px_rgba(27,42,74,0.28),6px_6px_0px_#B8304A] p-6 sm:p-7 font-['Plus_Jakarta_Sans',sans-serif]">
            <div className="flex items-center justify-between pb-4 border-b-2 border-[#22418A]/20">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-[#FDE8EC] text-[#B8304A] border-2 border-[#B8304A] rounded-xl flex items-center justify-center shadow-[2px_2px_0px_#B8304A]">
                  <WifiOff className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#B8304A] block">
                    SECURITY PROTOCOL • VPN BLOCKED
                  </span>
                  <h2 className="font-['Bodoni_Moda',serif] font-black text-xl text-[#1B2A4A] leading-tight">
                    Anonymized Traffic Restricted
                  </h2>
                </div>
              </div>
              <ShieldAlert className="w-6 h-6 text-[#B8304A] shrink-0" />
            </div>

            <div className="py-4 space-y-3">
              {/* Personal Space & Stalker Disclaimer Box */}
              <div className="p-3.5 bg-[#FFF6D6] border-2 border-[#C9892B] rounded-xl text-xs text-[#1B2A4A] space-y-1.5 shadow-[3px_3px_0px_rgba(201,137,43,0.3)]">
                <div className="flex items-center gap-1.5 font-extrabold text-[#B8304A] uppercase tracking-wider text-[11px]">
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                  <span>Disclaimer — Personal Space Notice</span>
                </div>
                <p className="font-semibold leading-relaxed text-[#1B2A4A]">
                  To any stalkers who are not relating to me and her: <strong>go get a life.</strong> Remember,
                  this is my personal space — if anyone stalks in between, just remember{" "}
                  <span className="underline decoration-[#B8304A] decoration-2 font-extrabold text-[#B8304A]">
                    I can see your life more than this.
                  </span>
                </p>
              </div>

              <div className="p-3 bg-[#FDE8EC] border border-[#B8304A]/40 rounded-xl text-xs space-y-1.5 font-mono">
                <div className="font-bold text-[#B8304A] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{vpnReason || "VPN or Proxy tunnel detected."}</span>
                </div>
                {vpnDetails?.org && (
                  <div className="text-[11px] text-[#1B2A4A] pt-1 border-t border-[#B8304A]/20 flex flex-col gap-0.5">
                    <span>
                      <strong>Network:</strong> {vpnDetails.org}
                    </span>
                    {vpnDetails?.country && (
                      <span>
                        <strong>Region:</strong> {vpnDetails.country}{" "}
                        {vpnDetails.timezone ? `(${vpnDetails.timezone})` : ""}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="p-3 bg-white border border-[#22418A]/15 rounded-xl text-[11.5px] text-[#5A6788] space-y-1">
                <strong className="text-[#1B2A4A] block">How to access the Lighthouse:</strong>
                <span>1. Turn off your VPN, Cloudflare WARP, iCloud Private Relay, or proxy extension.</span>
                <span className="block">2. Tap &ldquo;Re-Verify Connection&rdquo; below.</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                onClick={onRecheckVpn}
                disabled={isCheckingVpn}
                className="w-full py-3 px-4 bg-[#22418A] hover:bg-[#1B2A4A] text-white font-bold text-xs uppercase tracking-wider rounded-xl border-2 border-[#1B2A4A] shadow-[3px_3px_0px_#1B2A4A] active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isCheckingVpn ? "animate-spin" : ""}`} />
                <span>{isCheckingVpn ? "Verifying Network..." : "Re-Verify Connection"}</span>
              </button>

              {!showKeeperOverride ? (
                <button
                  type="button"
                  onClick={() => setShowKeeperOverride(true)}
                  className="text-[11px] text-[#5A6788] hover:text-[#22418A] font-semibold py-1 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Key className="w-3 h-3" />
                  <span>Keeper Authorization Override</span>
                </button>
              ) : (
                <form onSubmit={handleOverrideSubmit} className="pt-2 border-t border-[#22418A]/15 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Keeper Key"
                      value={overrideKey}
                      onChange={(e) => {
                        setOverrideError("");
                        setOverrideKey(e.target.value);
                      }}
                      className="flex-1 bg-white border-2 border-[#22418A] rounded-lg px-3 py-2 text-xs text-[#1B2A4A] font-mono font-bold outline-none"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#22418A] text-white font-bold text-xs uppercase rounded-lg border-2 border-[#1B2A4A] cursor-pointer"
                    >
                      Unlock
                    </button>
                  </div>
                  {overrideError && <p className="text-[11px] text-[#B8304A] font-bold">{overrideError}</p>}
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. INSTANT ANTI-SCREENSHOT & FOCUS LOSS PRIVACY CURTAIN (SOLID LIGHT THEME) */}
      {(isBlurred || isCaptureProtected) && !isVpnDetected && (
        <div
          onClick={onDismissBlur}
          onPointerDown={onDismissBlur}
          className="fixed inset-0 z-[9000] bg-[#FAF7EE] text-[#1B2A4A] flex flex-col items-center justify-center p-5 text-center select-none cursor-pointer"
        >
          <div className="max-w-md w-full bg-[#FFFFFF] border-2 border-[#22418A] rounded-2xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(27,42,74,0.18),6px_6px_0px_#C9892B] flex flex-col items-center font-['Plus_Jakarta_Sans',sans-serif]">
            <div className="w-13 h-13 rounded-2xl bg-[#FDE8EC] border-2 border-[#B8304A] flex items-center justify-center mb-3.5 text-[#B8304A] shadow-[2px_2px_0px_#B8304A]">
              {isCaptureProtected ? <CameraOff className="w-6 h-6" /> : <EyeOff className="w-6 h-6" />}
            </div>

            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#B8304A] mb-1">
              al:na • SCREEN CAPTURE &amp; SNOOPING BLOCKED
            </span>

            <h3 className="font-['Bodoni_Moda',serif] font-black text-xl sm:text-2xl text-[#1B2A4A] mb-2">
              {isCaptureProtected
                ? "Screenshots & Recording Are Restricted"
                : "Personal Space Protected — Window Paused"}
            </h3>

            <p className="text-xs text-[#5A6788] leading-relaxed mb-3.5">
              {captureWarning ||
                "Screen content is automatically hidden when switching tabs, opening capture tools, or attempting screenshots."}
            </p>

            {/* Personal Space & Anti-Stalker Disclaimer Note */}
            <div className="w-full p-3.5 bg-[#FFF6D6] border-2 border-[#C9892B] rounded-xl text-left mb-4 shadow-[3px_3px_0px_rgba(201,137,43,0.28)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10.5px] font-mono font-extrabold uppercase tracking-wider text-[#B8304A] flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Disclaimer • Personal Space</span>
                </span>
              </div>
              <p className="text-xs text-[#1B2A4A] font-semibold leading-relaxed">
                To any stalkers who are not relating to me and her: <strong>go get a life.</strong> Remember, this is
                my personal space — if anyone stalks in between, just remember{" "}
                <span className="text-[#B8304A] font-extrabold underline decoration-[#B8304A]">
                  I can see your life more than this.
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={onDismissBlur}
              className="w-full py-3 px-5 bg-[#22418A] hover:bg-[#1B2A4A] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl border-2 border-[#1B2A4A] shadow-[3px_3px_0px_#C9892B] cursor-pointer transition-all"
            >
              Tap Anywhere to Return to the Lighthouse
            </button>
          </div>
        </div>
      )}

      {/* 3. FLOATING CAPTURE WARNING TOAST BANNER (LIGHT THEME) */}
      {captureWarning && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9500] w-[94%] max-w-md bg-[#FAF7EE] text-[#1B2A4A] border-2 border-[#B8304A] rounded-2xl shadow-[0_12px_32px_rgba(27,42,74,0.22),4px_4px_0px_#B8304A] p-3.5 flex flex-col gap-2 pointer-events-auto font-['Plus_Jakarta_Sans',sans-serif]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FDE8EC] border border-[#B8304A] flex items-center justify-center shrink-0">
              <CameraOff className="w-4 h-4 text-[#B8304A]" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#B8304A] font-extrabold block">
                SECURITY ALERT • ACTION BLOCKED
              </span>
              <p className="text-xs font-extrabold text-[#1B2A4A] truncate">{captureWarning}</p>
            </div>
          </div>
          <div className="px-2.5 py-2 bg-[#FFF6D6] border border-[#C9892B] rounded-lg text-[11px] font-semibold text-[#1B2A4A] leading-snug">
            <strong className="text-[#B8304A]">Disclaimer:</strong> Stalkers who are not relating to me and her —{" "}
            <strong>go get a life.</strong> This is my personal space; if anyone stalks in between, remember{" "}
            <strong className="text-[#B8304A] underline">I can see your life more than this.</strong>
          </div>
        </div>
      )}
    </>
  );
};
