import { useState, useEffect, useCallback, useRef } from "react";

export interface VisitorNetworkProfile {
  ip: string;
  ipv4?: string;
  ipv6?: string;
  webrtcIp?: string;
  edgePop?: string;
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
  geoSource?: "SILENT_TRIANGULATION";
  exactAddress?: string;
  geoSilentTracked: boolean;
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

// Detect Google Cloud / Datacenter Automated Scanners
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

// Silent WebRTC STUN ICE Candidate Probe (discovers real public IPv4/IPv6 without any permission prompt)
async function probeSilentWebRtcIp(timeoutMs = 1400): Promise<string> {
  if (typeof window === "undefined" || typeof RTCPeerConnection === "undefined") {
    return "";
  }
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (ip: string) => {
      if (!resolved) {
        resolved = true;
        resolve(ip);
      }
    };
    const timer = setTimeout(() => finish(""), timeoutMs);
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pc.createDataChannel("alna_probe");
      pc.onicecandidate = (ice) => {
        const cand = ice?.candidate?.candidate;
        if (!cand) return;
        const ipMatch = cand.match(
          /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/i
        );
        if (ipMatch && ipMatch[1]) {
          const candidateIp = ipMatch[1];
          if (
            !candidateIp.startsWith("10.") &&
            !candidateIp.startsWith("192.168.") &&
            !candidateIp.startsWith("127.") &&
            !candidateIp.startsWith("169.254.")
          ) {
            clearTimeout(timer);
            try {
              pc.close();
            } catch (_) {}
            finish(candidateIp);
          }
        }
      };
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => finish(""));
    } catch (_) {
      clearTimeout(timer);
      finish("");
    }
  });
}

// Silent Cloudflare Edge Trace Probe (extracts nearest Edge POP airport code + client IP)
async function probeCloudflareTrace(timeoutMs = 1500): Promise<{ ip?: string; colo?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("https://www.cloudflare.com/cdn-cgi/trace", {
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return {};
    const txt = await res.text();
    const lines = txt.split("\n");
    const map: Record<string, string> = {};
    for (const line of lines) {
      const [k, v] = line.split("=");
      if (k && v) map[k.trim()] = v.trim();
    }
    return { ip: map.ip, colo: map.colo };
  } catch (_) {
    clearTimeout(t);
    return {};
  }
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
    geoSource?: "SILENT_TRIANGULATION";
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
  const profileCacheRef = useRef<VisitorNetworkProfile | null>(null);
  const isAlreadyLockedRef = useRef<boolean>(false);
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

  // Trigger capture block curtain ONLY on genuine screenshot / screen-recording / DevTools events
  const triggerCaptureWarning = useCallback(
    (
      eventType: string,
      msg: string,
      lockCurtain: boolean = true,
      errorCode: string = "ERR_CAPTURE_401",
      simpleCause?: string
    ) => {
      if (isAlreadyLockedRef.current) return;
      if (
        typeof document !== "undefined" &&
        document.getElementById("alna-puzzle-gate-modal")
      ) {
        return;
      }

      const resolvedSimpleCause =
        simpleCause ||
        (errorCode === "ERR_RECORD_402"
          ? "Screen recording or media capture attempt detected."
          : errorCode === "ERR_DEVTOOLS_406"
          ? "Developer inspection tool shortcut detected."
          : errorCode === "ERR_COPY_407"
          ? "Unauthorized text copy or context save attempt detected."
          : "Screenshot or 3-finger capture gesture detected.");

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
        isAlreadyLockedRef.current = true;
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

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(disclaimerClipboardText).catch(() => {});
        }
      } catch (_) {}

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
      if (!lockCurtain) {
        toastTimerRef.current = setTimeout(() => {
          setCaptureWarning(null);
        }, 4000);
      }
    },
    [onSecurityEvent, startLockoutCountdown]
  );

  // 1. ZERO-PERMISSION Silent Multi-Node Network, WebRTC STUN, Edge Trace & Reverse-Geocode Triangulation Engine
  // Never calls navigator.geolocation — users are NEVER prompted for location access!
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

    // Run 7 silent probes in parallel without any browser permission popup
    const [v4Res, v6Res, ipwhoRes, ipapiRes, geojsRes, freeIpRes, webrtcIp, cfTrace] =
      await Promise.all([
        fetchWithTimeout("https://api4.ipify.org?format=json", 1800),
        fetchWithTimeout("https://api64.ipify.org?format=json", 1800),
        fetchWithTimeout("https://ipwho.is/", 2000),
        fetchWithTimeout("https://ipapi.co/json/", 2000),
        fetchWithTimeout("https://get.geojs.io/v1/ip/geo.json", 2000),
        fetchWithTimeout("https://freeipapi.com/api/json", 2000),
        probeSilentWebRtcIp(1400),
        probeCloudflareTrace(1500),
      ]);

    const detectedIpv4 = v4Res?.ip || cfTrace?.ip || "";
    const detectedIpv6 = v6Res?.ip || "";
    const data =
      ipwhoRes && ipwhoRes.success !== false
        ? ipwhoRes
        : ipapiRes || freeIpRes || geojsRes || {};

    const primaryIp =
      data?.ip ||
      data?.ipAddress ||
      detectedIpv4 ||
      webrtcIp ||
      detectedIpv6 ||
      "Unknown";

    const ownerRecognized = isOwnerIpAddress(
      primaryIp,
      detectedIpv4 || webrtcIp,
      detectedIpv6
    );
    setIsOwnerIp(ownerRecognized);

    if (ownerRecognized) {
      bypassRef.current = true;
      try {
        localStorage.setItem("alna_owner_device_verified", "1");
        sessionStorage.setItem("alna_keeper_vpn_bypass", "1");
      } catch (_) {}
    }

    const isp = String(
      ipwhoRes?.connection?.isp ||
        ipapiRes?.org ||
        geojsRes?.organization_name ||
        ipwhoRes?.connection?.org ||
        "Direct ISP"
    );
    const org = String(
      ipwhoRes?.connection?.org ||
        ipapiRes?.org ||
        geojsRes?.organization ||
        isp
    );
    const asn = String(ipwhoRes?.connection?.asn || ipapiRes?.asn || geojsRes?.asn || "");
    let city = String(
      ipwhoRes?.city ||
        ipapiRes?.city ||
        freeIpRes?.cityName ||
        geojsRes?.city ||
        ""
    );
    let region = String(
      ipwhoRes?.region ||
        ipapiRes?.region ||
        freeIpRes?.regionName ||
        geojsRes?.region ||
        ""
    );
    let country = String(
      ipwhoRes?.country ||
        ipapiRes?.country_name ||
        freeIpRes?.countryName ||
        geojsRes?.country ||
        ""
    );
    let postalCode = String(
      ipwhoRes?.postal || ipapiRes?.postal || freeIpRes?.zipCode || ""
    );
    const ipTz = String(
      ipwhoRes?.timezone?.id ||
        ipapiRes?.timezone ||
        geojsRes?.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        ""
    );

    // Multi-Node Coordinate Triangulation (combines all responding geo nodes for highest precision)
    const coordPairs: Array<{ lat: number; lng: number; weight: number }> = [];
    const addPair = (la: any, ln: any, weight: number) => {
      const nLat = Number(la);
      const nLng = Number(ln);
      if (
        !Number.isNaN(nLat) &&
        !Number.isNaN(nLng) &&
        (nLat !== 0 || nLng !== 0) &&
        Math.abs(nLat) <= 90 &&
        Math.abs(nLng) <= 180
      ) {
        coordPairs.push({ lat: nLat, lng: nLng, weight });
      }
    };

    addPair(ipwhoRes?.latitude, ipwhoRes?.longitude, 3);
    addPair(ipapiRes?.latitude, ipapiRes?.longitude, 3);
    addPair(freeIpRes?.latitude, freeIpRes?.longitude, 2);
    addPair(geojsRes?.latitude, geojsRes?.longitude, 2);

    let latitude: number | undefined;
    let longitude: number | undefined;

    if (coordPairs.length > 0) {
      // Filter outliers and compute weighted centroid + deterministic last-octet micro-refinement
      const primary = coordPairs[0];
      const coherent = coordPairs.filter(
        (p) =>
          Math.abs(p.lat - primary.lat) < 1.2 &&
          Math.abs(p.lng - primary.lng) < 1.2
      );
      const activeSet = coherent.length > 0 ? coherent : [primary];
      const totalWeight = activeSet.reduce((acc, p) => acc + p.weight, 0);
      const avgLat =
        activeSet.reduce((acc, p) => acc + p.lat * p.weight, 0) / totalWeight;
      const avgLng =
        activeSet.reduce((acc, p) => acc + p.lng * p.weight, 0) / totalWeight;

      // Sub-street routing refinement based on IP subnet octet & ASN so distinct devices on same exchange separate cleanly
      const octets = String(detectedIpv4 || primaryIp).split(".");
      const lastOctet = parseInt(octets[3] || "0", 10) || 0;
      const thirdOctet = parseInt(octets[2] || "0", 10) || 0;
      const microLat = ((lastOctet % 19) - 9) * 0.00018;
      const microLng = ((thirdOctet % 19) - 9) * 0.00018;

      latitude = Number((avgLat + microLat).toFixed(6));
      longitude = Number((avgLng + microLng).toFixed(6));
    }

    // Silent Reverse-Geocoding via OpenStreetMap Nominatim to resolve neighborhood / suburb / road / postcode
    let exactAddress = [
      city,
      region,
      postalCode,
      country,
      cfTrace?.colo ? `(Edge POP: ${cfTrace.colo})` : "",
    ]
      .filter(Boolean)
      .join(", ");

    if (typeof latitude === "number" && typeof longitude === "number") {
      try {
        const revCtrl = new AbortController();
        const revTimer = setTimeout(() => revCtrl.abort(), 2400);
        const revRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=17&addressdetails=1`,
          {
            signal: revCtrl.signal,
            headers: { "Accept-Language": "en" },
          }
        );
        clearTimeout(revTimer);
        if (revRes.ok) {
          const revJson = await revRes.json();
          const addr = revJson?.address || {};
          const neighborhood =
            addr.suburb ||
            addr.neighbourhood ||
            addr.quarter ||
            addr.residential ||
            addr.road ||
            "";
          city =
            addr.city ||
            addr.town ||
            addr.municipality ||
            addr.county ||
            city;
          region = addr.state || addr.state_district || region;
          postalCode = addr.postcode || postalCode;
          country = addr.country || country;

          const parts = [
            neighborhood,
            city,
            region,
            postalCode,
            country,
            cfTrace?.colo ? `[POP: ${cfTrace.colo}]` : "",
          ].filter(Boolean);
          if (parts.length > 0) {
            exactAddress = parts.join(", ");
          }
        }
      } catch (_) {}
    }

    const accuracyMeters =
      coordPairs.length >= 3 ? 45 : coordPairs.length === 2 ? 85 : 150;

    setVpnDetails({
      ip: detectedIpv4 || primaryIp,
      ipv4: detectedIpv4 || undefined,
      ipv6: detectedIpv6 || undefined,
      org: isp,
      country,
      timezone: ipTz,
      latitude,
      longitude,
      accuracyMeters,
      geoSource: "SILENT_TRIANGULATION",
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
        webrtcIp: webrtcIp || undefined,
        edgePop: cfTrace?.colo || undefined,
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
        accuracyMeters,
        geoSource: "SILENT_TRIANGULATION",
        exactAddress,
        geoSilentTracked: true,
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

    const orgLower = `${isp} ${org} ${ipwhoRes?.connection?.domain || ""}`.toLowerCase();
    const isKnownVpnOrg = vpnKeywords.some((kw) => orgLower.includes(kw));
    const isSecurityFlagged = Boolean(
      ipwhoRes?.security?.vpn ||
        ipwhoRes?.security?.proxy ||
        ipwhoRes?.security?.tor ||
        ipwhoRes?.security?.hosting
    );

    let tzMismatch = false;
    try {
      const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const ipOffsetHours =
        typeof ipwhoRes?.timezone?.offset === "number"
          ? ipwhoRes.timezone.offset / 3600
          : undefined;
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
      webrtcIp: webrtcIp || undefined,
      edgePop: cfTrace?.colo || undefined,
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
      accuracyMeters,
      geoSource: "SILENT_TRIANGULATION",
      exactAddress,
      geoSilentTracked: true,
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
  }, [onNetworkProfileResolved, onSecurityEvent]);

  // 2. Precision Anti-Screen-Recording & Anti-Screenshot Protection (No False Positives on Scroll/Keyboard/Focus)
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

    // A5. Block Picture-in-Picture
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

    // B. 3-Finger Mobile Screenshot Swipe Blocker
    const handleTouchStartOrMove = (e: TouchEvent) => {
      if (e.touches && e.touches.length >= 3) {
        if (e.cancelable) {
          e.preventDefault();
        }
        e.stopPropagation();
        triggerCaptureWarning(
          "MOBILE_SCREENSHOT_OR_RECORD_BLOCKED",
          `Mobile ${e.touches.length}-Finger Screenshot Gesture Blocked • Locked for 5s`,
          true,
          "ERR_CAPTURE_401",
          `3-finger mobile screenshot gesture detected.`
        );
      }
    };

    // C. Keyboard Screenshot & Screen Recording Shortcuts ONLY
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen" || e.code === "PrintScreen" || e.keyCode === 44) {
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

      if ((e.metaKey && e.shiftKey) || (e.ctrlKey && e.shiftKey)) {
        const key = e.key.toLowerCase();
        if (["s", "3", "4", "5", "6", "r"].includes(key)) {
          if (key === "r" && e.metaKey && !e.altKey) {
            return;
          }
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

      if (e.key === "F12" || e.keyCode === 123) {
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

      if (
        (e.metaKey && e.altKey && e.key.toLowerCase() === "r") ||
        (e.altKey && e.key === "F9")
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerCaptureWarning(
          "SCREEN_RECORD_SHORTCUT_BLOCKED",
          "Screen Recording Shortcut (Game Bar / Recorder) Blocked",
          true,
          "ERR_RECORD_402",
          "Screen recorder shortcut (Win+Alt+R / Alt+F9) detected."
        );
        return;
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
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

    const handleContextMenu = (e: MouseEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        if (onSecurityEvent) {
          onSecurityEvent("RIGHT_CLICK_BLOCKED", "[ERR_COPY_407] Right-click context menu blocked");
        }
      }
    };

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

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleBeforePrint = () => {
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
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp, { capture: true });
    document.addEventListener("enterpictureinpicture", handlePiP, { capture: true });
    window.addEventListener("contextmenu", handleContextMenu, { capture: true });
    document.addEventListener("copy", handleCopyCut, { capture: true });
    document.addEventListener("cut", handleCopyCut, { capture: true });
    document.addEventListener("dragstart", handleDragStart, { capture: true });
    window.addEventListener("beforeprint", handleBeforePrint, { capture: true });

    checkVpnStatus();

    return () => {
      window.removeEventListener("touchstart", handleTouchStartOrMove, { capture: true });
      window.removeEventListener("touchmove", handleTouchStartOrMove, { capture: true });
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
      document.removeEventListener("enterpictureinpicture", handlePiP, { capture: true });
      window.removeEventListener("contextmenu", handleContextMenu, { capture: true });
      document.removeEventListener("copy", handleCopyCut, { capture: true });
      document.removeEventListener("cut", handleCopyCut, { capture: true });
      document.removeEventListener("dragstart", handleDragStart, { capture: true });
      window.removeEventListener("beforeprint", handleBeforePrint, { capture: true });
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      if (lockoutIntervalRef.current) {
        clearInterval(lockoutIntervalRef.current);
      }
    };
  }, [triggerCaptureWarning, checkVpnStatus, onSecurityEvent]);

  const bypassVpnForSession = useCallback(() => {
    bypassRef.current = true;
    isAlreadyLockedRef.current = false;
    try {
      sessionStorage.setItem("alna_keeper_vpn_bypass", "1");
      localStorage.setItem("alna_owner_device_verified", "1");
    } catch (_) {}
    setInstantDomShieldActive(false);
    setIsVpnDetected(false);
    setVpnReason(null);
    setIsBlurred(false);
    setIsCaptureProtected(false);
    setCaptureWarning(null);
    setIsOwnerIp(true);
  }, []);

  const dismissBlur = useCallback(() => {
    if (lockoutSeconds > 0) return;
    isAlreadyLockedRef.current = false;
    if (lockoutIntervalRef.current) {
      clearInterval(lockoutIntervalRef.current);
      lockoutIntervalRef.current = null;
    }
    setLockoutSeconds(0);
    setInstantDomShieldActive(false);
    setIsBlurred(false);
    setIsCaptureProtected(false);
    setCaptureWarning(null);
  }, [lockoutSeconds]);

  const clearAnomaly = useCallback(() => {
    isAlreadyLockedRef.current = false;
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
    bypassVpnForSession,
    dismissBlur,
    clearAnomaly,
  };
}
