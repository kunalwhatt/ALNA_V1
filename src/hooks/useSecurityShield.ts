import { useState, useEffect, useCallback, useRef } from "react";

export interface VisitorNetworkProfile {
  ip: string;
  ipv4?: string;
  ipv6?: string;
  isp: string;
  org: string;
  asn?: string;
  city: string;
  region: string;
  country: string;
  postalCode?: string;
  timezone: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  geoSource?: "EXACT_DEVICE_GPS" | "IP_NETWORK";
  exactAddress?: string;
  isVpn: boolean;
  vpnReason: string;
  isBot: boolean;
  botReason: string;
  isOwner: boolean;
}

export interface SecurityAnomalyPayload {
  code: string;
  title: string;
  simpleCause: string;
  eventType: string;
  timestamp: number;
}

// Kunal's Registered Owner IPv4 & IPv6 + Wi-Fi Extender / Router Prefix Whitelist
export const OWNER_IPV4_EXACT = "122.177.241.64";
export const OWNER_IPV4_EXTENDER_PREFIX = "122.177.241.";
export const OWNER_IPV4_BROADBAND_PREFIX = "122.177.";
export const OWNER_IPV6_EXACT = "2401:4900:88f7:eec7:105a:6bc5:2ae4:aeb2";
export const OWNER_IPV6_EXTENDER_PREFIX = "2401:4900:88f7:eec7";
export const OWNER_IPV6_ROUTER_PREFIX = "2401:4900:88f7:";

export function isOwnerIpAddress(
  primaryIp?: string,
  ipv4?: string,
  ipv6?: string
): boolean {
  const candidates = [primaryIp, ipv4, ipv6]
    .filter(Boolean)
    .map((s) => String(s).trim().toLowerCase());

  for (const ip of candidates) {
    if (
      ip === OWNER_IPV4_EXACT ||
      ip === OWNER_IPV6_EXACT ||
      ip.startsWith(OWNER_IPV4_EXTENDER_PREFIX) ||
      ip.startsWith(OWNER_IPV6_EXTENDER_PREFIX) ||
      ip.startsWith(OWNER_IPV6_ROUTER_PREFIX)
    ) {
      return true;
    }
  }

  try {
    if (
      typeof window !== "undefined" &&
      localStorage.getItem("alna_owner_device_verified") === "1"
    ) {
      for (const ip of candidates) {
        if (ip.startsWith(OWNER_IPV4_BROADBAND_PREFIX) || ip.startsWith("2401:4900:")) {
          return true;
        }
      }
    }
  } catch (_) {}

  return false;
}

// Detect Google Cloud / Datacenter Automated Scanners (e.g., 34.123.170.104, 34.72.176.129, 34.135.23.132, 35.253.200.255, AS396982, Council Bluffs / Kane Iowa)
export function detectBotOrCloudScanner(params: {
  ip?: string;
  isp?: string;
  org?: string;
  asn?: string;
  city?: string;
  region?: string;
  userAgent?: string;
}): { isBot: boolean; reason: string; errorCode: string } {
  const ip = String(params.ip || "").trim().toLowerCase();
  const ispOrg = `${params.isp || ""} ${params.org || ""} ${params.asn || ""}`.toLowerCase();
  const loc = `${params.city || ""} ${params.region || ""}`.toLowerCase();
  const ua = String(
    params.userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "")
  ).toLowerCase();

  const knownBotIpPrefixes = [
    "34.123.",
    "34.72.",
    "34.135.",
    "35.253.",
    "34.134.",
    "34.136.",
    "34.66.",
    "34.67.",
    "34.68.",
    "34.69.",
    "34.70.",
    "34.71.",
    "35.184.",
    "35.188.",
    "35.192.",
    "35.193.",
    "35.202.",
    "35.224.",
    "35.232.",
    "35.238.",
    "35.239.",
    "66.249.",
  ];

  if (knownBotIpPrefixes.some((prefix) => ip.startsWith(prefix))) {
    return {
      isBot: true,
      errorCode: "ERR_BOT_429",
      reason: `Blocked Google Cloud Automated Scanner (${ip} • AS396982 / Council Bluffs, Iowa)`,
    };
  }

  if (
    ispOrg.includes("as396982") ||
    ispOrg.includes("googleusercontent") ||
    ispOrg.includes("google cloud") ||
    (ispOrg.includes("google llc") &&
      (loc.includes("iowa") ||
        loc.includes("council bluffs") ||
        loc.includes("kane") ||
        ip.startsWith("34.") ||
        ip.startsWith("35.")))
  ) {
    return {
      isBot: true,
      errorCode: "ERR_BOT_429",
      reason: `Blocked Google LLC Cloud Crawler (${params.ip || "GCP"} • ${
        params.city || "Iowa"
      })`,
    };
  }

  const botUaPatterns = [
    "headlesschrome",
    "phantomjs",
    "puppeteer",
    "playwright",
    "selenium",
    "webdriver",
    "googlebot",
    "adsbot-google",
    "mediapartners-google",
    "apis-google",
    "google-inspectiontool",
    "pageburst",
    "lighthouse",
    "bingbot",
    "slurp",
    "duckduckbot",
    "baiduspider",
    "yandexbot",
    "facebot",
    "facebookexternalhit",
    "twitterbot",
    "linkedinbot",
    "whatsapp",
    "telegrambot",
    "discordbot",
    "slackbot",
    "applebot",
    "petalbot",
    "semrushbot",
    "ahrefsbot",
    "mj12bot",
    "dotbot",
    "uptime",
    "pingdom",
    "statuscake",
    "python-requests",
    "curl/",
    "wget/",
    "go-http-client",
  ];

  if (botUaPatterns.some((pat) => ua.includes(pat))) {
    return {
      isBot: true,
      errorCode: "ERR_BOT_429",
      reason: "Blocked Automated Crawler / Link-Preview Bot User-Agent",
    };
  }

  if (typeof navigator !== "undefined" && (navigator as any).webdriver === true) {
    return {
      isBot: true,
      errorCode: "ERR_BOT_429",
      reason: "Blocked Headless WebDriver Automation Engine",
    };
  }

  return { isBot: false, reason: "", errorCode: "" };
}

// Synchronous 0ms DOM curtain toggle so hardware screenshots & screen recorders capture a solid cream screen
function setInstantDomShieldActive(active: boolean) {
  if (typeof document === "undefined") return;
  const stage = document.getElementById("alna-protected-stage");
  const curtain = document.getElementById("alna-instant-curtain");
  if (stage) {
    stage.style.visibility = active ? "hidden" : "visible";
    stage.style.opacity = active ? "0" : "1";
  }
  if (curtain) {
    curtain.style.display = active ? "flex" : "none";
  }
}

export function useSecurityShield(
  onSecurityEvent?: (
    eventType: string,
    detail: string,
    anomaly?: SecurityAnomalyPayload
  ) => void,
  onNetworkProfileResolved?: (profile: VisitorNetworkProfile) => void
) {
  const [isVpnDetected, setIsVpnDetected] = useState<boolean>(false);
  const [vpnReason, setVpnReason] = useState<string | null>(null);
  const [vpnDetails, setVpnDetails] = useState<{
    ip?: string;
    ipv4?: string;
    ipv6?: string;
    org?: string;
    country?: string;
    timezone?: string;
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
    geoSource?: "EXACT_DEVICE_GPS" | "IP_NETWORK";
    exactAddress?: string;
  } | null>(null);
  const [isBotDetected, setIsBotDetected] = useState<boolean>(false);
  const [botReason, setBotReason] = useState<string | null>(null);
  const [isOwnerIp, setIsOwnerIp] = useState<boolean>(false);
  const [isCheckingVpn, setIsCheckingVpn] = useState<boolean>(true);
  const [isCaptureProtected, setIsCaptureProtected] = useState<boolean>(false);
  const [captureWarning, setCaptureWarning] = useState<string | null>(null);
  const [activeErrorCode, setActiveErrorCode] = useState<string>("ERR_CAPTURE_401");
  const [activeAnomaly, setActiveAnomaly] = useState<SecurityAnomalyPayload | null>(null);
  const [isBlurred, setIsBlurred] = useState<boolean>(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);
  const [securityEventsCount, setSecurityEventsCount] = useState<number>(0);
  const [lastSecurityEvent, setLastSecurityEvent] = useState<string | null>(null);

  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lockoutIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastBlurLogRef = useRef<number>(0);
  const rapidClickTimestampsRef = useRef<number[]>([]);
  const profileCacheRef = useRef<VisitorNetworkProfile | null>(null);
  const bypassRef = useRef<boolean>(
    typeof window !== "undefined" &&
      (sessionStorage.getItem("alna_keeper_vpn_bypass") === "1" ||
        localStorage.getItem("alna_owner_device_verified") === "1")
  );

  const disclaimerClipboardText =
    "al:na DISCLAIMER — To any stalkers who are not relating to me and her: go get a life. This is my personal space; if anyone stalks in between, remember I can see your life more than this.";

  const startLockoutCountdown = useCallback((seconds: number) => {
    setLockoutSeconds(seconds);
    if (lockoutIntervalRef.current) {
      clearInterval(lockoutIntervalRef.current);
    }
    lockoutIntervalRef.current = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          if (lockoutIntervalRef.current) {
            clearInterval(lockoutIntervalRef.current);
            lockoutIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Trigger instant 0ms capture block curtain + 5s mandatory lock + error code + anomaly payload
  const triggerCaptureWarning = useCallback(
    (
      eventType: string,
      msg: string,
      lockCurtain: boolean = true,
      errorCode: string = "ERR_CAPTURE_401",
      simpleCause?: string
    ) => {
      const resolvedSimpleCause =
        simpleCause ||
        (errorCode === "ERR_RECORD_402"
          ? "Screen recording or media capture attempt detected."
          : errorCode === "ERR_DEVTOOLS_406"
          ? "Developer inspection tool shortcut detected."
          : errorCode === "ERR_COPY_407"
          ? "Unauthorized text copy or context save attempt detected."
          : errorCode === "ERR_FOCUS_408"
          ? "Window focus switch or system capture overlay detected."
          : errorCode === "ERR_ANOMALY_409"
          ? "Unusual rapid clicking or behavioral anomaly detected."
          : "Screenshot or multi-finger capture gesture detected.");

      const anomalyPayload: SecurityAnomalyPayload = {
        code: errorCode,
        title: eventType.replace(/_/g, " "),
        simpleCause: resolvedSimpleCause,
        eventType,
        timestamp: Date.now(),
      };

      setActiveErrorCode(errorCode);
      setActiveAnomaly(anomalyPayload);

      if (lockCurtain) {
        setInstantDomShieldActive(true);
        setIsCaptureProtected(true);
        setIsBlurred(true);
        startLockoutCountdown(5);
      }

      setCaptureWarning(msg);
      setSecurityEventsCount((prev) => prev + 1);
      setLastSecurityEvent(`[${errorCode}] ${msg}`);

      if (onSecurityEvent) {
        onSecurityEvent(eventType, `[${errorCode}] ${msg}`, anomalyPayload);
      }

      // Immediately overwrite clipboard so any PrintScreen / Snipping Tool / iOS / Android copy contains the Disclaimer
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(disclaimerClipboardText).catch(() => {});
        }
      } catch (_) {}

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    },
    [onSecurityEvent, startLockoutCountdown]
  );

  // High-Accuracy Device GPS / Wi-Fi Triangulation + Reverse Geocode Resolver
  const requestExactDeviceLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const acc = Math.round(pos.coords.accuracy || 10);

        let exactAddress = "";
        let city = profileCacheRef.current?.city || "";
        let region = profileCacheRef.current?.region || "";
        let country = profileCacheRef.current?.country || "";
        let postalCode = profileCacheRef.current?.postalCode || "";

        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 3200);
          const revRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            {
              signal: ctrl.signal,
              headers: { "Accept-Language": "en" },
            }
          );
          clearTimeout(t);
          if (revRes.ok) {
            const revJson = await revRes.json();
            exactAddress = revJson?.display_name || "";
            const addr = revJson?.address || {};
            city =
              addr.suburb ||
              addr.neighbourhood ||
              addr.city ||
              addr.town ||
              addr.village ||
              addr.county ||
              city;
            region = addr.state || addr.state_district || region;
            country = addr.country || country;
            postalCode = addr.postcode || postalCode;
          }
        } catch (_) {}

        setVpnDetails((prev) => ({
          ...(prev || {}),
          latitude: lat,
          longitude: lng,
          accuracyMeters: acc,
          geoSource: "EXACT_DEVICE_GPS",
          exactAddress: exactAddress || `${lat}, ${lng}`,
        }));

        if (profileCacheRef.current && onNetworkProfileResolved) {
          const updated: VisitorNetworkProfile = {
            ...profileCacheRef.current,
            city: city || profileCacheRef.current.city,
            region: region || profileCacheRef.current.region,
            country: country || profileCacheRef.current.country,
            postalCode: postalCode || profileCacheRef.current.postalCode,
            latitude: lat,
            longitude: lng,
            accuracyMeters: acc,
            geoSource: "EXACT_DEVICE_GPS",
            exactAddress: exactAddress || `${lat}, ${lng}`,
          };
          profileCacheRef.current = updated;
          onNetworkProfileResolved(updated);
        }
      },
      () => {
        // Fallback already populated via IP/ISP geolocation
      },
      {
        enableHighAccuracy: true,
        timeout: 9000,
        maximumAge: 0,
      }
    );
  }, [onNetworkProfileResolved]);

  // 1. Fast Parallel Dual-Stack (IPv4 + IPv6) Owner Check, Exact Geolocation, Bot/Crawler Check & VPN Detection
  const checkVpnStatus = useCallback(async () => {
    setIsCheckingVpn(true);

    const immediateBot = detectBotOrCloudScanner({});
    if (immediateBot.isBot) {
      setIsBotDetected(true);
      setBotReason(immediateBot.reason);
      setActiveErrorCode("ERR_BOT_429");
      setIsCheckingVpn(false);
      return;
    }

    const fetchWithTimeout = async (url: string, ms: number) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok) return await res.json();
      } catch (_) {
        clearTimeout(t);
      }
      return null;
    };

    const [v4Res, v6Res, geoRes] = await Promise.all([
      fetchWithTimeout("https://api4.ipify.org?format=json", 1800),
      fetchWithTimeout("https://api64.ipify.org?format=json", 1800),
      fetchWithTimeout("https://ipwho.is/", 2000),
    ]);

    const detectedIpv4 = v4Res?.ip || "";
    const detectedIpv6 = v6Res?.ip || "";
    let data = geoRes;

    if (!data || data.success === false) {
      data = await fetchWithTimeout("https://ipapi.co/json/", 2000);
    }

    const primaryIp = data?.ip || detectedIpv4 || detectedIpv6 || "Unknown";
    const ownerRecognized = isOwnerIpAddress(primaryIp, detectedIpv4, detectedIpv6);
    setIsOwnerIp(ownerRecognized);

    if (ownerRecognized) {
      bypassRef.current = true;
      try {
        localStorage.setItem("alna_owner_device_verified", "1");
        sessionStorage.setItem("alna_keeper_vpn_bypass", "1");
      } catch (_) {}
    }

    const isp = String(
      data?.connection?.isp || data?.org || data?.connection?.org || "Direct ISP"
    );
    const org = String(
      data?.connection?.org || data?.org || data?.connection?.isp || "Direct Network"
    );
    const asn = String(data?.connection?.asn || data?.asn || "");
    const city = String(data?.city || "");
    const region = String(data?.region || "");
    const country = String(data?.country || data?.country_name || "");
    const postalCode = String(data?.postal || "");
    const ipTz = String(
      data?.timezone?.id ||
        data?.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        ""
    );

    const rawLat = typeof data?.latitude === "number" ? data.latitude : Number(data?.latitude);
    const rawLng = typeof data?.longitude === "number" ? data.longitude : Number(data?.longitude);
    const hasCoords = !Number.isNaN(rawLat) && !Number.isNaN(rawLng) && (rawLat !== 0 || rawLng !== 0);
    const latitude = hasCoords ? Number(rawLat.toFixed(5)) : undefined;
    const longitude = hasCoords ? Number(rawLng.toFixed(5)) : undefined;
    const exactAddress = [city, region, postalCode, country].filter(Boolean).join(", ");

    setVpnDetails({
      ip: detectedIpv4 || primaryIp,
      ipv4: detectedIpv4 || undefined,
      ipv6: detectedIpv6 || undefined,
      org: isp,
      country,
      timezone: ipTz,
      latitude,
      longitude,
      accuracyMeters: hasCoords ? 850 : undefined,
      geoSource: "IP_NETWORK",
      exactAddress,
    });

    const botCheck = detectBotOrCloudScanner({
      ip: primaryIp,
      isp,
      org,
      asn,
      city,
      region,
    });

    if (botCheck.isBot && !ownerRecognized) {
      setIsBotDetected(true);
      setBotReason(botCheck.reason);
      setActiveErrorCode("ERR_BOT_429");
      setIsCheckingVpn(false);
      const botProfile: VisitorNetworkProfile = {
        ip: primaryIp,
        ipv4: detectedIpv4,
        ipv6: detectedIpv6,
        isp,
        org,
        asn,
        city,
        region,
        country,
        postalCode,
        timezone: ipTz,
        latitude,
        longitude,
        accuracyMeters: hasCoords ? 850 : undefined,
        geoSource: "IP_NETWORK",
        exactAddress,
        isVpn: true,
        vpnReason: botCheck.reason,
        isBot: true,
        botReason: botCheck.reason,
        isOwner: false,
      };
      profileCacheRef.current = botProfile;
      if (onNetworkProfileResolved) {
        onNetworkProfileResolved(botProfile);
      }
      if (onSecurityEvent) {
        onSecurityEvent(
          "BOT_CRAWLER_BLOCKED",
          `[ERR_BOT_429] ${primaryIp} (${isp}) — ${botCheck.reason}`,
          {
            code: "ERR_BOT_429",
            title: "BOT CRAWLER BLOCKED",
            simpleCause: botCheck.reason,
            eventType: "BOT_CRAWLER_BLOCKED",
            timestamp: Date.now(),
          }
        );
      }
      return;
    }

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

    const orgLower = `${isp} ${org} ${data?.connection?.domain || ""}`.toLowerCase();
    const isKnownVpnOrg = vpnKeywords.some((kw) => orgLower.includes(kw));
    const isSecurityFlagged = Boolean(
      data?.security?.vpn ||
        data?.security?.proxy ||
        data?.security?.tor ||
        data?.security?.hosting ||
        data?.proxy ||
        data?.hosting
    );

    let tzMismatch = false;
    try {
      const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const ipOffsetHours =
        typeof data?.timezone?.offset === "number" ? data.timezone.offset / 3600 : undefined;
      if (ipTz && clientTz && ipTz !== clientTz && typeof ipOffsetHours === "number") {
        const deviceOffsetMin = -new Date().getTimezoneOffset();
        const ipOffsetMin = ipOffsetHours * 60;
        if (Math.abs(deviceOffsetMin - ipOffsetMin) > 150) {
          tzMismatch = true;
        }
      }
    } catch (_) {}

    const isVpn = !ownerRecognized && (isSecurityFlagged || isKnownVpnOrg || tzMismatch);
    const reason = ownerRecognized
      ? "Recognized Keeper Network (Owner Whitelisted)"
      : isSecurityFlagged
      ? "VPN / Proxy / Anonymizer tunnel detected on your network."
      : isKnownVpnOrg
      ? `Datacenter or VPN provider blocked (${org}).`
      : tzMismatch
      ? `Network routing mismatch: IP location (${ipTz}) does not match device timezone.`
      : "Direct Connection";

    const resolvedProfile: VisitorNetworkProfile = {
      ip: detectedIpv4 || primaryIp,
      ipv4: detectedIpv4,
      ipv6: detectedIpv6,
      isp,
      org,
      asn,
      city,
      region,
      country,
      postalCode,
      timezone: ipTz,
      latitude,
      longitude,
      accuracyMeters: hasCoords ? 850 : undefined,
      geoSource: "IP_NETWORK",
      exactAddress,
      isVpn,
      vpnReason: reason,
      isBot: false,
      botReason: "",
      isOwner: ownerRecognized,
    };

    profileCacheRef.current = resolvedProfile;

    if (onNetworkProfileResolved) {
      onNetworkProfileResolved(resolvedProfile);
    }

    // Attempt to upgrade to Exact Device GPS Coordinates automatically
    requestExactDeviceLocation();

    if (isVpn && !bypassRef.current && !ownerRecognized) {
      setIsVpnDetected(true);
      setVpnReason(reason);
      setActiveErrorCode("ERR_VPN_403");
      setIsCheckingVpn(false);
      if (onSecurityEvent) {
        onSecurityEvent("VPN_BLOCKED", `[ERR_VPN_403] ${primaryIp} (${isp}) — ${reason}`, {
          code: "ERR_VPN_403",
          title: "VPN OR PROXY BLOCKED",
          simpleCause: reason,
          eventType: "VPN_BLOCKED",
          timestamp: Date.now(),
        });
      }
      return;
    }

    setIsVpnDetected(false);
    setVpnReason(null);
    setIsCheckingVpn(false);
  }, [onNetworkProfileResolved, onSecurityEvent, requestExactDeviceLocation]);

  // 2. Comprehensive Anti-Screen-Recording, Anti-Screenshot & Anomaly Detection (Desktop, Android & iPhone)
  useEffect(() => {
    // A1. Block Browser Screen / Window / Tab Recording (getDisplayMedia)
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getDisplayMedia = async () => {
        triggerCaptureWarning(
          "SCREEN_RECORD_BLOCKED",
          "Screen Recording Blocked • Personal Space Protected",
          true,
          "ERR_RECORD_402",
          "Browser screen or window recording attempt blocked."
        );
        throw new DOMException("Screen recording is disabled on this site.", "NotAllowedError");
      };

      // A2. Block legacy desktop/tab capture constraints in getUserMedia
      if (typeof navigator.mediaDevices.getUserMedia === "function") {
        const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
          const str = JSON.stringify(constraints || {}).toLowerCase();
          if (
            str.includes("chromemediasource") ||
            str.includes("desktop") ||
            str.includes("screen") ||
            str.includes("window") ||
            str.includes("tab")
          ) {
            triggerCaptureWarning(
              "SCREEN_RECORD_BLOCKED",
              "Screen / Tab Capture Stream Blocked • Personal Space Protected",
              true,
              "ERR_RECORD_402",
              "Tab or desktop video stream capture attempt blocked."
            );
            throw new DOMException("Screen capture is disabled on this site.", "NotAllowedError");
          }
          return origGetUserMedia(constraints);
        };
      }
    }

    // A3. Block Canvas Stream Recording (HTMLCanvasElement.prototype.captureStream)
    if (
      typeof HTMLCanvasElement !== "undefined" &&
      HTMLCanvasElement.prototype &&
      typeof (HTMLCanvasElement.prototype as any).captureStream === "function"
    ) {
      (HTMLCanvasElement.prototype as any).captureStream = function () {
        triggerCaptureWarning(
          "CANVAS_SCREEN_RECORD_BLOCKED",
          "Canvas Video Recording Blocked • Personal Space Protected",
          true,
          "ERR_RECORD_402",
          "Canvas video stream recording attempt blocked."
        );
        throw new DOMException("Canvas recording is disabled.", "NotAllowedError");
      };
    }

    // A4. Block MediaRecorder API
    if (typeof window !== "undefined" && "MediaRecorder" in window) {
      const BlockedMediaRecorder = function () {
        triggerCaptureWarning(
          "MEDIA_RECORDER_BLOCKED",
          "MediaRecorder Screen Capture Blocked • Personal Space Protected",
          true,
          "ERR_RECORD_402",
          "MediaRecorder screen recording engine blocked."
        );
        throw new DOMException("MediaRecorder is disabled on this site.", "NotAllowedError");
      } as any;
      BlockedMediaRecorder.isTypeSupported = () => false;
      try {
        (window as any).MediaRecorder = BlockedMediaRecorder;
      } catch (_) {}
    }

    // A5. Block Picture-in-Picture & Screen Mirroring
    const handlePiP = (e: Event) => {
      e.preventDefault();
      triggerCaptureWarning(
        "PIP_RECORD_BLOCKED",
        "Picture-in-Picture & External Capture Blocked",
        true,
        "ERR_RECORD_402",
        "Picture-in-Picture video extraction blocked."
      );
    };

    const handleScreenChange = () => {
      if ((window.screen as any)?.isExtended) {
        triggerCaptureWarning(
          "EXTERNAL_CAPTURE_DISPLAY_DETECTED",
          "External Display / Screen Mirroring Recorder Detected — Screen Blanked",
          true,
          "ERR_RECORD_402",
          "External screen mirroring or capture display detected."
        );
      }
    };

    // A6. Mobile iOS / Android Screen Recorder Status-Bar / Floating Pill Viewport Shift Detector
    let baseInnerHeight = typeof window !== "undefined" ? window.innerHeight : 0;
    const handleVisualViewportChange = () => {
      if (!window.visualViewport) return;
      const activeTag = document.activeElement?.tagName;
      if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;

      const heightDiff = Math.abs(window.innerHeight - baseInnerHeight);
      if (
        window.visualViewport.offsetTop > 0 ||
        (heightDiff > 14 && heightDiff < 95)
      ) {
        baseInnerHeight = window.innerHeight;
        setInstantDomShieldActive(true);
        triggerCaptureWarning(
          "MOBILE_SCREEN_RECORD_OVERLAY_DETECTED",
          "Mobile Screen Recording / Floating Capture Overlay Blocked • Locked for 5s",
          true,
          "ERR_RECORD_402",
          "Mobile screen recorder bar or floating capture overlay detected."
        );
      } else {
        baseInnerHeight = window.innerHeight;
      }
    };

    // B. Multi-touch gesture blocker (2+ or 3-finger screenshot / screen-record on Android / iPhone)
    const handleTouchStartOrMove = (e: TouchEvent) => {
      if (e.touches && e.touches.length >= 2) {
        setInstantDomShieldActive(true);
        if (e.cancelable) {
          e.preventDefault();
        }
        e.stopPropagation();
        triggerCaptureWarning(
          "MOBILE_SCREENSHOT_OR_RECORD_BLOCKED",
          `Mobile ${e.touches.length}-Finger Capture Gesture Blocked • Locked for 5s`,
          true,
          "ERR_CAPTURE_401",
          `Multi-finger (${e.touches.length} fingers) mobile screenshot gesture detected.`
        );
      }
    };

    // C. Mobile iOS / Android `touchcancel` Interceptor
    const handleTouchCancel = () => {
      setInstantDomShieldActive(true);
      triggerCaptureWarning(
        "MOBILE_CAPTURE_OR_RECORD_SHADE_INTERCEPTED",
        "Mobile System Capture / Screen Record Shade Blocked • Screen Blanked",
        true,
        "ERR_CAPTURE_401",
        "Hardware button screenshot or system control shade interrupted touch."
      );
    };

    // D. Keyboard Screenshot & Screen Recording Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. PrintScreen / SysRq key
      if (e.key === "PrintScreen" || e.code === "PrintScreen" || e.keyCode === 44) {
        setInstantDomShieldActive(true);
        e.preventDefault();
        e.stopPropagation();
        triggerCaptureWarning(
          "SCREENSHOT_BLOCKED",
          "PrintScreen Screenshot Blocked • Clipboard Wiped",
          true,
          "ERR_CAPTURE_401",
          "PrintScreen hardware screenshot key pressed."
        );
        return;
      }

      // 2. Meta/Ctrl + Shift capture & DevTools shortcuts
      if (
        (e.metaKey && e.shiftKey) ||
        (e.ctrlKey && e.shiftKey) ||
        e.key === "Meta" ||
        e.key === "OS" ||
        (e.altKey && e.key === "PrintScreen")
      ) {
        setInstantDomShieldActive(true);
        setIsBlurred(true);
        const key = e.key.toLowerCase();
        if (["s", "3", "4", "5", "6", "r"].includes(key)) {
          e.preventDefault();
          e.stopPropagation();
          const isRec = key === "5" || key === "r";
          triggerCaptureWarning(
            "SCREEN_RECORD_OR_CAPTURE_SHORTCUT_BLOCKED",
            `Screen Recording / Capture Shortcut (${
              e.metaKey ? "Cmd/Win" : "Ctrl"
            }+Shift+${key.toUpperCase()}) Blocked`,
            true,
            isRec ? "ERR_RECORD_402" : "ERR_CAPTURE_401",
            `System capture shortcut (${e.metaKey ? "Cmd/Win" : "Ctrl"}+Shift+${key.toUpperCase()}) pressed.`
          );
          return;
        }
        if (["i", "c", "j"].includes(key)) {
          e.preventDefault();
          e.stopPropagation();
          triggerCaptureWarning(
            "DEVTOOLS_BLOCKED",
            "Developer Tools Inspection Blocked • Protected Space",
            true,
            "ERR_DEVTOOLS_406",
            "Browser Developer Tools inspection shortcut pressed."
          );
          return;
        }
      }

      // 3. F12 DevTools
      if (e.key === "F12" || e.keyCode === 123) {
        setInstantDomShieldActive(true);
        e.preventDefault();
        e.stopPropagation();
        triggerCaptureWarning(
          "DEVTOOLS_BLOCKED",
          "F12 Developer Inspection Blocked",
          true,
          "ERR_DEVTOOLS_406",
          "F12 Developer Tools key pressed."
        );
        return;
      }

      // 4. Windows Game Bar & Screen Recorder (Win + Alt + R, Win + G, Alt + F9)
      if (
        (e.metaKey && (e.key.toLowerCase() === "g" || (e.altKey && e.key.toLowerCase() === "r"))) ||
        (e.altKey && e.key === "F9")
      ) {
        setInstantDomShieldActive(true);
        e.preventDefault();
        e.stopPropagation();
        triggerCaptureWarning(
          "SCREEN_RECORD_SHORTCUT_BLOCKED",
          "Screen Recording Shortcut (Game Bar / Recorder) Blocked",
          true,
          "ERR_RECORD_402",
          "Screen recorder shortcut (Game Bar / Alt+F9) detected."
        );
        return;
      }

      // 5. Ctrl/Cmd + P, S, U, C, X
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
          false,
          "ERR_COPY_407",
          `Keyboard export/copy shortcut (Ctrl/Cmd+${e.key.toUpperCase()}) attempted.`
        );
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen" || e.code === "PrintScreen" || e.keyCode === 44) {
        setInstantDomShieldActive(true);
        e.preventDefault();
        triggerCaptureWarning(
          "SCREENSHOT_BLOCKED",
          "Screenshot Attempt Blocked & Clipboard Wiped",
          true,
          "ERR_CAPTURE_401",
          "PrintScreen screenshot key release intercepted."
        );
      }
    };

    // E. Instant 0ms Window Blur, PageHide & Visibility Change Curtain
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setInstantDomShieldActive(true);
        setIsBlurred(true);
        setIsCaptureProtected(true);
        setActiveErrorCode("ERR_FOCUS_408");
        startLockoutCountdown(5);
        setCaptureWarning(
          "Screen Recording & Capture Shield • Blanked during Tab Switch or Mobile Control Center Shade"
        );
        const now = Date.now();
        if (now - lastBlurLogRef.current > 2500) {
          lastBlurLogRef.current = now;
          const anomalyPayload: SecurityAnomalyPayload = {
            code: "ERR_FOCUS_408",
            title: "VISIBILITY HIDDEN / SHADE",
            simpleCause: "Tab switch or mobile control center capture shade opened.",
            eventType: "SCREEN_RECORD_OR_CAPTURE_SHADE_BLOCKED",
            timestamp: now,
          };
          setActiveAnomaly(anomalyPayload);
          if (onSecurityEvent) {
            onSecurityEvent(
              "SCREEN_RECORD_OR_CAPTURE_SHADE_BLOCKED",
              "[ERR_FOCUS_408] Screen blanked instantaneously on Visibility Hidden / Control Center Shade",
              anomalyPayload
            );
          }
        }
      }
    };

    const handleBlur = () => {
      setInstantDomShieldActive(true);
      setIsBlurred(true);
      setIsCaptureProtected(true);
      setActiveErrorCode("ERR_FOCUS_408");
      startLockoutCountdown(5);
      setCaptureWarning(
        "Screen Recording & Capture Blocked • Window Paused When Recorder / Capture Tool Is Active"
      );
      const now = Date.now();
      if (now - lastBlurLogRef.current > 2500) {
        lastBlurLogRef.current = now;
        const anomalyPayload: SecurityAnomalyPayload = {
          code: "ERR_FOCUS_408",
          title: "WINDOW FOCUS LOST",
          simpleCause: "Window lost focus to an external screen capture or recording tool.",
          eventType: "SCREEN_RECORD_OR_BLUR_SHIELD_ENGAGED",
          timestamp: now,
        };
        setActiveAnomaly(anomalyPayload);
        if (onSecurityEvent) {
          onSecurityEvent(
            "SCREEN_RECORD_OR_BLUR_SHIELD_ENGAGED",
            "[ERR_FOCUS_408] Window lost focus to external tool/recorder — Anti-Recording Curtain locked for 5s",
            anomalyPayload
          );
        }
      }
    };

    // F. Block right-click / mobile long-press context menu
    const handleContextMenu = (e: MouseEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        triggerCaptureWarning(
          "RIGHT_CLICK_OR_LONG_PRESS_BLOCKED",
          "Long-Press / Right-Click Saving Disabled • Personal Space Protected",
          false,
          "ERR_COPY_407",
          "Right-click or long-press context menu inspection attempted."
        );
      }
    };

    // G. Block copy / cut / drag of letters and artwork
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
          false,
          "ERR_COPY_407",
          "Attempted to copy protected letter text to clipboard."
        );
      }
    };

    // H. Behavioral Rapid-Click / Scraping Anomaly Detector
    const handleGlobalClickAnomaly = () => {
      const now = Date.now();
      const recent = rapidClickTimestampsRef.current.filter((t) => now - t < 2400);
      recent.push(now);
      rapidClickTimestampsRef.current = recent;
      if (recent.length >= 15) {
        rapidClickTimestampsRef.current = [];
        triggerCaptureWarning(
          "ANOMALY_RAPID_INTERACTION",
          "Unusual Rapid Clicking / Automated Interaction Anomaly Detected",
          false,
          "ERR_ANOMALY_409",
          "Unusual rapid clicking or automated scraping pattern detected (15+ actions in 2s)."
        );
      }
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleBeforePrint = () => {
      setInstantDomShieldActive(true);
      setIsBlurred(true);
      triggerCaptureWarning(
        "PRINT_BLOCKED",
        "Printing & PDF Export Disabled",
        true,
        "ERR_CAPTURE_401",
        "Print or PDF export attempted."
      );
    };

    window.addEventListener("touchstart", handleTouchStartOrMove, { capture: true, passive: false });
    window.addEventListener("touchmove", handleTouchStartOrMove, { capture: true, passive: false });
    window.addEventListener("touchcancel", handleTouchCancel, { capture: true });
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp, { capture: true });
    window.addEventListener("click", handleGlobalClickAnomaly, { capture: true });
    document.addEventListener("visibilitychange", handleVisibilityChange, { capture: true });
    document.addEventListener("enterpictureinpicture", handlePiP, { capture: true });
    window.addEventListener("pagehide", handleBlur, { capture: true });
    window.addEventListener("blur", handleBlur, { capture: true });
    window.addEventListener("contextmenu", handleContextMenu, { capture: true });
    document.addEventListener("copy", handleCopyCut, { capture: true });
    document.addEventListener("cut", handleCopyCut, { capture: true });
    document.addEventListener("dragstart", handleDragStart, { capture: true });
    window.addEventListener("beforeprint", handleBeforePrint, { capture: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleVisualViewportChange);
    }
    if (window.screen && "onchange" in window.screen) {
      (window.screen as any).addEventListener?.("change", handleScreenChange);
    }

    checkVpnStatus();

    return () => {
      window.removeEventListener("touchstart", handleTouchStartOrMove, { capture: true });
      window.removeEventListener("touchmove", handleTouchStartOrMove, { capture: true });
      window.removeEventListener("touchcancel", handleTouchCancel, { capture: true });
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
      window.removeEventListener("click", handleGlobalClickAnomaly, { capture: true });
      document.removeEventListener("visibilitychange", handleVisibilityChange, { capture: true });
      document.removeEventListener("enterpictureinpicture", handlePiP, { capture: true });
      window.removeEventListener("pagehide", handleBlur, { capture: true });
      window.removeEventListener("blur", handleBlur, { capture: true });
      window.removeEventListener("contextmenu", handleContextMenu, { capture: true });
      document.removeEventListener("copy", handleCopyCut, { capture: true });
      document.removeEventListener("cut", handleCopyCut, { capture: true });
      document.removeEventListener("dragstart", handleDragStart, { capture: true });
      window.removeEventListener("beforeprint", handleBeforePrint, { capture: true });
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleVisualViewportChange);
      }
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      if (lockoutIntervalRef.current) {
        clearInterval(lockoutIntervalRef.current);
      }
    };
  }, [triggerCaptureWarning, checkVpnStatus, onSecurityEvent, startLockoutCountdown]);

  const bypassVpnForSession = useCallback(() => {
    bypassRef.current = true;
    try {
      sessionStorage.setItem("alna_keeper_vpn_bypass", "1");
      localStorage.setItem("alna_owner_device_verified", "1");
    } catch (_) {}
    setIsVpnDetected(false);
    setVpnReason(null);
    setIsOwnerIp(true);
  }, []);

  const dismissBlur = useCallback(() => {
    if (lockoutSeconds > 0) return;
    setInstantDomShieldActive(false);
    setIsBlurred(false);
    setIsCaptureProtected(false);
    setCaptureWarning(null);
  }, [lockoutSeconds]);

  const clearAnomaly = useCallback(() => {
    setActiveAnomaly(null);
  }, []);

  return {
    isVpnDetected,
    vpnReason,
    vpnDetails,
    isBotDetected,
    botReason,
    isOwnerIp,
    isCheckingVpn,
    isCaptureProtected,
    captureWarning,
    activeErrorCode,
    activeAnomaly,
    isBlurred,
    lockoutSeconds,
    securityEventsCount,
    lastSecurityEvent,
    recheckVpn: checkVpnStatus,
    requestExactDeviceLocation,
    bypassVpnForSession,
    dismissBlur,
    clearAnomaly,
  };
}
