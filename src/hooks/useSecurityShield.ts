import { useState, useEffect, useCallback, useRef } from "react";

export interface VisitorNetworkProfile {
  ip: string;
  isp: string;
  org: string;
  city: string;
  region: string;
  country: string;
  timezone: string;
  isVpn: boolean;
  vpnReason: string;
}

export function useSecurityShield(
  onSecurityEvent?: (eventType: string, detail: string) => void,
  onNetworkProfileResolved?: (profile: VisitorNetworkProfile) => void
) {
  const [isVpnDetected, setIsVpnDetected] = useState<boolean>(false);
  const [vpnReason, setVpnReason] = useState<string | null>(null);
  const [vpnDetails, setVpnDetails] = useState<{
    ip?: string;
    org?: string;
    country?: string;
    timezone?: string;
  } | null>(null);
  const [isCheckingVpn, setIsCheckingVpn] = useState<boolean>(true);
  const [isCaptureProtected, setIsCaptureProtected] = useState<boolean>(false);
  const [captureWarning, setCaptureWarning] = useState<string | null>(null);
  const [isBlurred, setIsBlurred] = useState<boolean>(false);
  const [securityEventsCount, setSecurityEventsCount] = useState<number>(0);
  const [lastSecurityEvent, setLastSecurityEvent] = useState<string | null>(null);

  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastBlurLogRef = useRef<number>(0);
  const bypassRef = useRef<boolean>(
    typeof window !== "undefined" && sessionStorage.getItem("alna_keeper_vpn_bypass") === "1"
  );

  const disclaimerClipboardText =
    "al:na DISCLAIMER — To any stalkers who are not relating to me and her: go get a life. This is my personal space; if anyone stalks in between, remember I can see your life more than this.";

  // Trigger active capture block curtain + toast warning + clipboard wipe + silent Keeper log
  const triggerCaptureWarning = useCallback(
    (eventType: string, msg: string, lockCurtain: boolean = true) => {
      setCaptureWarning(msg);
      if (lockCurtain) {
        setIsCaptureProtected(true);
        setIsBlurred(true);
      }
      setSecurityEventsCount((prev) => prev + 1);
      setLastSecurityEvent(msg);

      if (onSecurityEvent) {
        onSecurityEvent(eventType, msg);
      }

      // Immediately overwrite clipboard so PrintScreen / Snipping Tool image or copied text is replaced
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(disclaimerClipboardText).catch(() => {});
        }
      } catch (_) {}

      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
      warningTimerRef.current = setTimeout(() => {
        setCaptureWarning(null);
        setIsCaptureProtected(false);
      }, 4500);
    },
    [onSecurityEvent]
  );

  // 1. Active VPN, Proxy, Tor & Datacenter Detection + Silent Network Intelligence
  const checkVpnStatus = useCallback(async () => {
    setIsCheckingVpn(true);

    const vpnKeywords = [
      "vpn",
      "proxy",
      "datacenter",
      "hosting",
      "tor",
      "ovh",
      "digitalocean",
      "hetzner",
      "m247",
      "packethub",
      "expressvpn",
      "nordvpn",
      "surfshark",
      "proton",
      "cloudflare warp",
      "mullvad",
      "windscribe",
      "cyberghost",
      "private internet access",
      "linode",
      "vultr",
      "choopa",
      "leaseweb",
      "contabo",
      "tzulo",
      "datapacket",
      "anonine",
      "hide.me",
      "astrill",
      "vyprvpn",
    ];

    const checkTimezoneMismatch = (ipTz?: string, utcOffsetHours?: number): boolean => {
      try {
        const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (ipTz && clientTz && ipTz !== clientTz) {
          if (typeof utcOffsetHours === "number" && !isNaN(utcOffsetHours)) {
            const deviceOffsetMin = -new Date().getTimezoneOffset();
            const ipOffsetMin = utcOffsetHours * 60;
            if (Math.abs(deviceOffsetMin - ipOffsetMin) > 150) {
              return true;
            }
          }
        }
      } catch (_) {}
      return false;
    };

    try {
      const controller1 = new AbortController();
      const timeout1 = setTimeout(() => controller1.abort(), 4500);
      const res1 = await fetch("https://ipwho.is/", { signal: controller1.signal });
      clearTimeout(timeout1);

      if (res1.ok) {
        const data = await res1.json();
        if (data && data.success !== false) {
          const isp = String(data.connection?.isp || data.connection?.org || "Unknown ISP");
          const org = String(data.connection?.org || data.connection?.isp || "Unknown Org");
          const orgLower = `${isp} ${org} ${data.connection?.domain || ""}`.toLowerCase();
          const ipTz = data.timezone?.id || "";
          const ipOffsetHours =
            typeof data.timezone?.offset === "number" ? data.timezone.offset / 3600 : undefined;

          setVpnDetails({
            ip: data.ip,
            org: isp,
            country: data.country,
            timezone: ipTz,
          });

          const isKnownVpnOrg = vpnKeywords.some((kw) => orgLower.includes(kw));
          const isSecurityFlagged = Boolean(
            data.security?.vpn || data.security?.proxy || data.security?.tor || data.security?.hosting
          );
          const tzMismatch = checkTimezoneMismatch(ipTz, ipOffsetHours);
          const isVpn = isSecurityFlagged || isKnownVpnOrg || tzMismatch;

          const reason = isSecurityFlagged
            ? "VPN / Proxy / Anonymizer tunnel detected on your network."
            : isKnownVpnOrg
            ? `Datacenter or VPN provider blocked (${org}).`
            : tzMismatch
            ? `Network routing mismatch: IP location (${ipTz}) does not match device timezone.`
            : "Direct Connection";

          if (onNetworkProfileResolved) {
            onNetworkProfileResolved({
              ip: data.ip || "Unknown",
              isp,
              org,
              city: data.city || "",
              region: data.region || "",
              country: data.country || "",
              timezone: ipTz || Intl.DateTimeFormat().resolvedOptions().timeZone || "",
              isVpn,
              vpnReason: reason,
            });
          }

          if (isVpn && !bypassRef.current) {
            setIsVpnDetected(true);
            setVpnReason(reason);
            setIsCheckingVpn(false);
            if (onSecurityEvent) {
              onSecurityEvent("VPN_BLOCKED", `${data.ip || "IP"} (${isp}) — ${reason}`);
            }
            return;
          }

          setIsVpnDetected(false);
          setVpnReason(null);
          setIsCheckingVpn(false);
          return;
        }
      }
    } catch (_) {}

    try {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 4500);
      const res2 = await fetch("https://ipapi.co/json/", { signal: controller2.signal });
      clearTimeout(timeout2);

      if (res2.ok) {
        const data = await res2.json();
        const org = String(data.org || "Unknown ISP");
        const orgLower = `${org} ${data.asn || ""}`.toLowerCase();

        setVpnDetails({
          ip: data.ip,
          org,
          country: data.country_name,
          timezone: data.timezone,
        });

        const isKnownVpnOrg = vpnKeywords.some((kw) => orgLower.includes(kw));
        let ipOffsetHours: number | undefined = undefined;
        if (data.utc_offset) {
          const raw = parseInt(data.utc_offset, 10);
          if (!isNaN(raw)) {
            ipOffsetHours = Math.trunc(raw / 100) + (raw % 100) / 60;
          }
        }
        const tzMismatch = checkTimezoneMismatch(data.timezone, ipOffsetHours);
        const isVpn = Boolean(data.proxy || data.hosting || isKnownVpnOrg || tzMismatch);

        const reason = data.proxy
          ? "Proxy connection flagged by network security."
          : isKnownVpnOrg
          ? `Datacenter / VPN tunnel detected (${org}).`
          : tzMismatch
          ? `Timezone routing mismatch detected (${data.timezone}).`
          : "Direct Connection";

        if (onNetworkProfileResolved) {
          onNetworkProfileResolved({
            ip: data.ip || "Unknown",
            isp: org,
            org,
            city: data.city || "",
            region: data.region || "",
            country: data.country_name || "",
            timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "",
            isVpn,
            vpnReason: reason,
          });
        }

        if (isVpn && !bypassRef.current) {
          setIsVpnDetected(true);
          setVpnReason(reason);
          setIsCheckingVpn(false);
          if (onSecurityEvent) {
            onSecurityEvent("VPN_BLOCKED", `${data.ip || "IP"} (${org}) — ${reason}`);
          }
          return;
        }
      }
    } catch (_) {}

    setIsVpnDetected(false);
    setVpnReason(null);
    setIsCheckingVpn(false);
  }, [onNetworkProfileResolved, onSecurityEvent]);

  // 2. Active Anti-Screenshot, Anti-Recording, Anti-Copy, Anti-Right-Click & Focus Curtain
  useEffect(() => {
    // A. Block browser Screen Capture API (getDisplayMedia)
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === "function") {
      navigator.mediaDevices.getDisplayMedia = async () => {
        triggerCaptureWarning(
          "SCREEN_RECORD_BLOCKED",
          "Screen Recording Blocked • Personal Space Protected",
          true
        );
        throw new DOMException("Screen recording is disabled on this site.", "NotAllowedError");
      };
    }

    // B. Multi-touch gesture blocker (2+ or 3-finger screenshot on Android / iOS)
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches && e.touches.length >= 2) {
        if (e.touches.length >= 3) {
          e.preventDefault();
          e.stopPropagation();
        }
        setIsBlurred(true);
        triggerCaptureWarning(
          "MOBILE_SCREENSHOT_BLOCKED",
          `${e.touches.length}-Finger Screenshot Gesture Blocked • Personal Space Protected`,
          true
        );
      }
    };

    // C. Pre-emptive & Active Keyboard Screenshot / Snipping / Inspect Blocker
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. PrintScreen / SysRq key
      if (e.key === "PrintScreen" || e.code === "PrintScreen" || e.keyCode === 44) {
        e.preventDefault();
        e.stopPropagation();
        setIsBlurred(true);
        triggerCaptureWarning(
          "SCREENSHOT_BLOCKED",
          "PrintScreen Screenshot Blocked • Clipboard Cleared",
          true
        );
        return;
      }

      // 2. Pre-emptively raise the Light-Theme Privacy Curtain the instant Meta (Win/Cmd) + Shift
      // or Meta (Win key) or Alt + PrintScreen is pressed — BEFORE OS Snipping Tool (Win+Shift+S / Cmd+Shift+3/4/5) captures the frame!
      if (
        (e.metaKey && e.shiftKey) ||
        (e.ctrlKey && e.shiftKey) ||
        e.key === "Meta" ||
        e.key === "OS" ||
        (e.altKey && e.key === "PrintScreen")
      ) {
        setIsBlurred(true);
        const key = e.key.toLowerCase();
        if (["s", "3", "4", "5", "6", "r"].includes(key)) {
          e.preventDefault();
          e.stopPropagation();
          triggerCaptureWarning(
            "SCREENSHOT_SHORTCUT_BLOCKED",
            `Screen Capture Shortcut (${e.metaKey ? "Cmd/Win" : "Ctrl"}+Shift+${key.toUpperCase()}) Blocked`,
            true
          );
          return;
        }
        if (["i", "c", "j"].includes(key)) {
          e.preventDefault();
          e.stopPropagation();
          triggerCaptureWarning(
            "DEVTOOLS_BLOCKED",
            "Developer Tools Inspection Blocked • Protected Space",
            true
          );
          return;
        }
      }

      // 3. F12 DevTools
      if (e.key === "F12" || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        triggerCaptureWarning("DEVTOOLS_BLOCKED", "F12 Developer Inspection Blocked", true);
        return;
      }

      // 4. Windows Game Bar recording (Meta + Alt + R / Meta + G)
      if (e.metaKey && (e.key.toLowerCase() === "g" || (e.altKey && e.key.toLowerCase() === "r"))) {
        e.preventDefault();
        e.stopPropagation();
        setIsBlurred(true);
        triggerCaptureWarning("SCREEN_RECORD_BLOCKED", "Screen Recording Shortcut Blocked", true);
        return;
      }

      // 5. Ctrl/Cmd + P (Print), Ctrl/Cmd + S (Save), Ctrl/Cmd + U (View Source), Ctrl/Cmd + C (Copy)
      if (
        (e.ctrlKey || e.metaKey) &&
        ["p", "s", "u", "c", "x"].includes(e.key.toLowerCase())
      ) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        e.stopPropagation();
        triggerCaptureWarning(
          "EXPORT_OR_COPY_BLOCKED",
          `Shortcut Ctrl/Cmd+${e.key.toUpperCase()} Disabled • Personal Space Protected`,
          false
        );
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen" || e.code === "PrintScreen" || e.keyCode === 44) {
        e.preventDefault();
        setIsBlurred(true);
        triggerCaptureWarning(
          "SCREENSHOT_BLOCKED",
          "Screenshot Attempt Blocked & Clipboard Wiped",
          true
        );
      }
    };

    // D. Window blur & visibility change privacy curtain
    // Instantly covers the screen when Snipping Tool, macOS Capture, or Mobile Control Center opens
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setIsBlurred(true);
        const now = Date.now();
        if (now - lastBlurLogRef.current > 3000) {
          lastBlurLogRef.current = now;
          if (onSecurityEvent) {
            onSecurityEvent(
              "TAB_HIDDEN_OR_CAPTURE_OVERLAY",
              "Screen hidden due to Tab Switch / App Switcher / Capture Tool Overlay"
            );
          }
        }
      }
    };

    const handleBlur = () => {
      setIsBlurred(true);
    };

    // E. Block right-click / long-press context menu
    const handleContextMenu = (e: MouseEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        triggerCaptureWarning(
          "RIGHT_CLICK_BLOCKED",
          "Right-Click & Saving Disabled • Personal Space Protected",
          false
        );
      }
    };

    // F. Block copy / cut / drag of letters and artwork
    const handleCopyCut = (e: ClipboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA") {
        let snippet = "";
        try {
          snippet = (window.getSelection()?.toString() || "").trim().slice(0, 60);
        } catch (_) {}
        e.preventDefault();
        if (e.clipboardData) {
          e.clipboardData.setData("text/plain", disclaimerClipboardText);
        }
        triggerCaptureWarning(
          "COPY_BLOCKED",
          snippet
            ? `Text Copy Blocked ("${snippet}...")`
            : "Copying Disabled • Personal Archive Protected",
          false
        );
      }
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleBeforePrint = () => {
      setIsBlurred(true);
      triggerCaptureWarning("PRINT_BLOCKED", "Printing & PDF Export Disabled", true);
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp, { capture: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopyCut);
    document.addEventListener("cut", handleCopyCut);
    document.addEventListener("dragstart", handleDragStart);
    window.addEventListener("beforeprint", handleBeforePrint);

    checkVpnStatus();

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopyCut);
      document.removeEventListener("cut", handleCopyCut);
      window.removeEventListener("dragstart", handleDragStart);
      window.removeEventListener("beforeprint", handleBeforePrint);
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
    };
  }, [triggerCaptureWarning, checkVpnStatus, onSecurityEvent]);

  const bypassVpnForSession = useCallback(() => {
    bypassRef.current = true;
    sessionStorage.setItem("alna_keeper_vpn_bypass", "1");
    setIsVpnDetected(false);
    setVpnReason(null);
  }, []);

  const dismissBlur = useCallback(() => {
    setIsBlurred(false);
    setIsCaptureProtected(false);
  }, []);

  return {
    isVpnDetected,
    vpnReason,
    vpnDetails,
    isCheckingVpn,
    isCaptureProtected,
    captureWarning,
    isBlurred,
    securityEventsCount,
    lastSecurityEvent,
    recheckVpn: checkVpnStatus,
    bypassVpnForSession,
    dismissBlur,
  };
}
