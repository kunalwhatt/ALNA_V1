import React, { useEffect, useState, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  increment,
  serverTimestamp,
  collection,
  addDoc,
  onSnapshot,
  arrayUnion,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { Volume2, VolumeX, Key } from "lucide-react";

import { VanGoghScene } from "./components/VanGoghScene";
import { KeepersLogSheet } from "./components/KeepersLogSheet";
import { UnsentLettersModal, LettersActivityPayload } from "./components/UnsentLettersModal";
import { AdminAuthModal, AdminDashboard } from "./components/AdminPanel";
import { BottomDock } from "./components/BottomDock";
import { ChatWidget } from "./ChatWidget";
import { paragraphs } from "./data/paragraphs";
import { playGoldChime, toggleAmbientSoundscape } from "./utils/audio";
import {
  useSecurityShield,
  VisitorNetworkProfile,
  SecurityAnomalyPayload,
  detectBotOrCloudScanner,
  isOwnerIpAddress,
} from "./hooks/useSecurityShield";
import { SecurityShieldOverlay } from "./components/SecurityShieldOverlay";
import { LighthousePuzzleGate } from "./components/LighthousePuzzleGate";

// Load local config if present, otherwise use public client config on Azure/cloud builds
const localConfigs = (import.meta as any).glob("../firebase-applet-config.json", { eager: true });
const loadedConfig =
  (localConfigs["../firebase-applet-config.json"] as any)?.default ||
  localConfigs["../firebase-applet-config.json"];

const fallbackFirebaseConfig = {
  projectId: "test-sheets-469315",
  appId: ["1:960622309213", "web", "8beefb18f419827c5902b4"].join(":"),
  apiKey: ["AIzaSyB9wHMoEC", "-KbFmytxqf-hx2h3Tp", "-jd02YU"].join(""),
  authDomain: "test-sheets-469315.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-410a71d3-b6e9-487a-ade5-8a2849bfaaa4",
  storageBucket: "test-sheets-469315.firebasestorage.app",
  messagingSenderId: "960622309213",
};

const activeFirebaseConfig = loadedConfig?.apiKey ? loadedConfig : fallbackFirebaseConfig;

// Initialize Firebase safely with robust fallback
let app: any = null;
let db: any = null;
try {
  if (activeFirebaseConfig && activeFirebaseConfig.apiKey) {
    app = initializeApp(activeFirebaseConfig);
    db = activeFirebaseConfig.firestoreDatabaseId
      ? getFirestore(app, activeFirebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
  }
} catch (e) {
  console.warn("Firebase initialization warning (using local fallback state):", e);
}

// Master Temporal Anchor: 3rd of August, 2022 00:00:00 IST
const START_DATE = new Date("2022-08-03T00:00:00+05:30");

const pad = (n: number) => String(n).padStart(2, "0");

function calculateDiff(now: Date) {
  let y = now.getFullYear() - START_DATE.getFullYear();
  let m = now.getMonth() - START_DATE.getMonth();
  let d = now.getDate() - START_DATE.getDate();

  if (d < 0) {
    m--;
    d += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (m < 0) {
    y--;
    m += 12;
  }

  const ms = now.getTime() - START_DATE.getTime();
  return {
    y,
    m,
    d,
    h: pad(Math.floor(ms / 3.6e6) % 24),
    mi: pad(Math.floor(ms / 6e4) % 60),
    s: pad(Math.floor(ms / 1e3) % 60),
    total: Math.max(0, Math.floor(ms / 864e5)),
  };
}

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function formatRelativeAgo(timestamp: number): string {
  const diffSec = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return `${diffSec} secs ago`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} ${mins === 1 ? "min" : "mins"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${hrs === 1 ? "hr" : "hrs"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

// Formats exactly as requested: "12:30am - 26th November, 2026 (40 mins ago)"
export function formatFullLastSeen(timestamp: number | null): string {
  if (!timestamp) return "Resolving last visit...";
  const date = new Date(timestamp);
  const istParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);

  const getPart = (type: string) => istParts.find((p) => p.type === type)?.value || "";
  const dayNum = parseInt(getPart("day"), 10) || date.getDate();
  const monthName = getPart("month") || "November";
  const yearStr = getPart("year") || String(date.getFullYear());
  const hourStr = getPart("hour") || "12";
  const minStr = getPart("minute") || "00";
  const dayPeriod = (getPart("dayPeriod") || "am").toLowerCase().replace(/\s+/g, "");

  const ordinalDay = `${dayNum}${getOrdinalSuffix(dayNum)}`;
  const relativeStr = formatRelativeAgo(timestamp);

  return `${hourStr}:${minStr}${dayPeriod} - ${ordinalDay} ${monthName}, ${yearStr} (${relativeStr})`;
}

function getNowIstTime(): string {
  return new Date().toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function getDeviceSummary(): string {
  if (typeof window === "undefined") return "Browser";
  const ua = navigator.userAgent || "";
  let os = "Desktop";
  if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Mac/i.test(ua)) os = "macOS";
  else if (/Win/i.test(ua)) os = "Windows";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";

  return `${os} • ${browser} (${window.innerWidth}×${window.innerHeight})`;
}

function parseFirestoreTimestamp(val: any): number | null {
  if (!val) return null;
  if (typeof val.toMillis === "function") return val.toMillis();
  if (typeof val.toDate === "function") return val.toDate().getTime();
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? null : parsed;
}

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [showLetters, setShowLetters] = useState(false);
  const [isAudioActive, setIsAudioActive] = useState(false);

  // Mandatory Human Verification Gate on page load AND re-triggered on any mid-session anomaly
  const [isPuzzleVerified, setIsPuzzleVerified] = useState<boolean>(false);
  const [anomalyCause, setAnomalyCause] = useState<SecurityAnomalyPayload | null>(null);

  // Master Chronometer state (ticking every second)
  const [elapsed, setElapsed] = useState(() => calculateDiff(new Date()));

  // Telemetry stats:
  // `lastSeenTimestamp` & `lastVisitorIp` are locked to the PREVIOUS human visit before this page load
  const [visits, setVisits] = useState<number | string>("…");
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<number | null>(null);
  const [lastVisitorIp, setLastVisitorIp] = useState<string>("…");
  const [currentVisitorIp, setCurrentVisitorIp] = useState<string>("…");

  const pageOpenTimeRef = useRef<number>(Date.now());
  const lockedPreviousVisitRef = useRef<boolean>(false);
  const activeLogRef = useRef<any>(null);
  const activeSessionLogIdRef = useRef<string | null>(null);
  const pendingUpdatesRef = useRef<Array<Record<string, any>>>([]);
  const highestLettersScrollRef = useRef<number>(0);
  const highestDeepestLetterRef = useRef<number>(0);
  const highestLogScrollRef = useRef<number>(0);
  const resolvedProfileRef = useRef<VisitorNetworkProfile | null>(null);
  const hasCountedVisitRef = useRef<boolean>(false);
  const isPuzzleVerifiedRef = useRef<boolean>(false);

  useEffect(() => {
    isPuzzleVerifiedRef.current = isPuzzleVerified;
  }, [isPuzzleVerified]);

  // Helper that writes to visitor_logs immediately (or queues if logRef is still initializing)
  const pushVisitorTelemetry = useCallback((payload: Record<string, any>) => {
    if (activeLogRef.current) {
      setDoc(activeLogRef.current, payload, { merge: true }).catch(() => {});
    } else {
      pendingUpdatesRef.current.push(payload);
    }
  }, []);

  // 1. Silent Security & Anomaly Event Handler (VPN, Screenshot, Screen-Record, Copy, Right-Click, Rapid Click)
  const handleSilentSecurityEvent = useCallback(
    (eventType: string, detail: string, anomaly?: SecurityAnomalyPayload) => {
      const timeStr = getNowIstTime();
      const entry = `[${timeStr}] ${eventType}: ${detail}`;

      const updatePayload: Record<string, any> = {
        securityAlert: `${eventType}: ${detail}`,
        securityEvents: increment(1),
        securityLogs: arrayUnion(entry),
        activityTimeline: arrayUnion(`[${timeStr}] ⚠ ${detail}`),
        lastSecurityAt: serverTimestamp(),
      };

      if (anomaly) {
        updatePayload.lastErrorCode = anomaly.code;
        updatePayload.lastAnomalyCause = anomaly.simpleCause;
        setAnomalyCause(anomaly);
      }

      pushVisitorTelemetry(updatePayload);
    },
    [pushVisitorTelemetry]
  );

  // 2. Silent Network & Exact Device Location Profile Handler
  const handleNetworkProfileResolved = useCallback(
    (profile: VisitorNetworkProfile) => {
      resolvedProfileRef.current = profile;
      if (profile.ip && profile.ip !== "Unknown") {
        setCurrentVisitorIp(profile.ip);
      }

      const locationStr = [profile.city, profile.region, profile.country]
        .filter(Boolean)
        .join(", ");
      const timeStr = getNowIstTime();

      const telemetryUpdate: Record<string, any> = {
        ip: profile.ip,
        ipv4: profile.ipv4 || "",
        ipv6: profile.ipv6 || "",
        isp: profile.isp,
        city: profile.city || "",
        region: profile.region || "",
        country: profile.country || "",
        postalCode: profile.postalCode || "",
        location: locationStr || profile.country || "Unknown",
        timezone: profile.timezone,
        isVpn: profile.isVpn,
        vpnReason: profile.vpnReason,
        isBot: profile.isBot,
        botReason: profile.botReason,
        isOwner: profile.isOwner,
      };

      if (typeof profile.latitude === "number" && typeof profile.longitude === "number") {
        telemetryUpdate.latitude = profile.latitude;
        telemetryUpdate.longitude = profile.longitude;
        telemetryUpdate.accuracyMeters = profile.accuracyMeters || 850;
        telemetryUpdate.geoSource = profile.geoSource || "IP_NETWORK";
        telemetryUpdate.exactAddress =
          profile.exactAddress || locationStr || `${profile.latitude}, ${profile.longitude}`;
      }

      const geoBadge =
        profile.geoSource === "EXACT_DEVICE_GPS"
          ? `GPS Exact (${profile.latitude}, ${profile.longitude} ±${profile.accuracyMeters || 10}m)`
          : typeof profile.latitude === "number"
          ? `Geo (${profile.latitude}, ${profile.longitude})`
          : "Direct";

      telemetryUpdate.activityTimeline = arrayUnion(
        `[${timeStr}] Network & Geo resolved: ${profile.ip} (${locationStr || "Direct"} • ${geoBadge} • ${
          profile.isp
        }${
          profile.isBot
            ? " • BOT/SCANNER BLOCKED"
            : profile.isVpn
            ? " • VPN/PROXY DETECTED"
            : profile.isOwner
            ? " • OWNER WHITELISTED"
            : ""
        })`
      );

      pushVisitorTelemetry(telemetryUpdate);
    },
    [pushVisitorTelemetry]
  );

  // Activate active screenshot/screen-record/VPN/bot blocking + exact GPS location + silent background telemetry
  const security = useSecurityShield(handleSilentSecurityEvent, handleNetworkProfileResolved);

  // Called when visitor solves the embedded Mathematics CAPTCHA directly inside any Error Block Module
  const handleDismissSecurityCurtain = useCallback(() => {
    const solvedCode = security.activeAnomaly?.code || security.activeErrorCode || "ERR_SECURITY";
    security.dismissBlur();
    security.clearAnomaly();
    setAnomalyCause(null);
    setIsPuzzleVerified(true);

    const timeStr = getNowIstTime();
    pushVisitorTelemetry({
      puzzleVerified: true,
      activityTimeline: arrayUnion(
        `[${timeStr}] ✓ Solved Embedded Math Verification inside Error Module (${solvedCode}) — Access Restored`
      ),
    });
  }, [security, pushVisitorTelemetry]);

  // Handle Human Verification CAPTCHA Completion (both initial & post-anomaly re-verification)
  const handlePuzzleVerified = useCallback(
    (solveTelemetry: { attempts: number; solveDurationMs: number; trajectoryPoints: number }) => {
      const wasAnomalyReverify = Boolean(anomalyCause);
      const causeText = anomalyCause
        ? `${anomalyCause.code} (${anomalyCause.simpleCause})`
        : "";

      setIsPuzzleVerified(true);
      setAnomalyCause(null);
      security.clearAnomaly();
      security.requestExactDeviceLocation();

      const timeStr = getNowIstTime();
      pushVisitorTelemetry({
        puzzleVerified: true,
        puzzleSolveMs: solveTelemetry.solveDurationMs,
        openedSections: arrayUnion(
          wasAnomalyReverify ? `Re-Verified After ${anomalyCause?.code}` : "Solved Human Verification",
          "Home Seascape"
        ),
        activityTimeline: arrayUnion(
          wasAnomalyReverify
            ? `[${timeStr}] ✓ Re-Verified Human Access after ${causeText} (${solveTelemetry.solveDurationMs}ms)`
            : `[${timeStr}] ✓ Passed Human Verification Gate (${solveTelemetry.solveDurationMs}ms, ${solveTelemetry.attempts} attempt)`
        ),
      });
    },
    [anomalyCause, pushVisitorTelemetry, security]
  );

  const handlePuzzleBotFlagged = useCallback(
    (reason: string) => {
      handleSilentSecurityEvent("PUZZLE_BOT_TRAJECTORY_FAILED", reason, {
        code: "ERR_MATH_400",
        title: "CAPTCHA FAILED",
        simpleCause: reason,
        eventType: "PUZZLE_BOT_TRAJECTORY_FAILED",
        timestamp: Date.now(),
      });
    },
    [handleSilentSecurityEvent]
  );

  // 3. Silent Activity Tracker for Letters Archive
  const handleTrackLettersActivity = useCallback(
    (payload: LettersActivityPayload) => {
      const timeStr = getNowIstTime();
      const updateObj: Record<string, any> = {
        activityTimeline: arrayUnion(`[${timeStr}] ${payload.action}`),
      };

      if (payload.sectionOpened) {
        updateObj.openedSections = arrayUnion(payload.sectionOpened);
      }
      if (typeof payload.letterRead === "number") {
        updateObj.lettersRead = arrayUnion(payload.letterRead);
        updateObj.lastLetterRead = payload.letterRead;
      }
      if (typeof payload.likedLetter === "number") {
        updateObj.likedLetters = arrayUnion(payload.likedLetter);
      }
      if (
        typeof payload.maxScrollPercent === "number" &&
        payload.maxScrollPercent > highestLettersScrollRef.current
      ) {
        highestLettersScrollRef.current = payload.maxScrollPercent;
        updateObj.maxScrollPercent = payload.maxScrollPercent;
      }
      if (
        typeof payload.deepestLetterScrolled === "number" &&
        payload.deepestLetterScrolled > highestDeepestLetterRef.current
      ) {
        highestDeepestLetterRef.current = payload.deepestLetterScrolled;
        updateObj.deepestLetterScrolled = payload.deepestLetterScrolled;
      }

      pushVisitorTelemetry(updateObj);
    },
    [pushVisitorTelemetry]
  );

  // 4. Silent Activity Tracker for Keeper's Log Sheet
  const handleTrackLogSheetActivity = useCallback(
    (action: string, scrollPct?: number) => {
      const timeStr = getNowIstTime();
      const updateObj: Record<string, any> = {
        openedSections: arrayUnion("Keeper's Log Sheet"),
        activityTimeline: arrayUnion(`[${timeStr}] ${action}`),
      };
      if (typeof scrollPct === "number" && scrollPct > highestLogScrollRef.current) {
        highestLogScrollRef.current = scrollPct;
        updateObj.logSheetScrollPercent = scrollPct;
      }
      pushVisitorTelemetry(updateObj);
    },
    [pushVisitorTelemetry]
  );

  // 5. Silent Activity Tracker for Live Chat
  const handleTrackChatActivity = useCallback(
    (action: string, sectionOpened?: string) => {
      const timeStr = getNowIstTime();
      const updateObj: Record<string, any> = {
        activityTimeline: arrayUnion(`[${timeStr}] ${action}`),
      };
      if (sectionOpened) {
        updateObj.openedSections = arrayUnion(sectionOpened);
      }
      pushVisitorTelemetry(updateObj);
    },
    [pushVisitorTelemetry]
  );

  // Enforce Title & Light Theme globally
  useEffect(() => {
    document.title = "alna-18:11";
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
  }, []);

  // Tick chronometer every second
  useEffect(() => {
    const tick = () => {
      setElapsed(calculateDiff(new Date()));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Real-time Firebase Firestore visits, PREVIOUS visitor IP/Last-Seen lookup & Session Logger
  useEffect(() => {
    let durInterval: NodeJS.Timeout | null = null;
    let fetchedIp = "—";

    const initTelemetry = async () => {
      // 1. Fast IP fetch
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        const res = await fetch("https://api4.ipify.org?format=json", { signal: controller.signal });
        clearTimeout(timeout);
        const json = await res.json();
        if (json.ip) {
          fetchedIp = json.ip;
          setCurrentVisitorIp(json.ip);
        }
      } catch (_) {
        try {
          const controller2 = new AbortController();
          const timeout2 = setTimeout(() => controller2.abort(), 1500);
          const res2 = await fetch("https://api64.ipify.org?format=json", { signal: controller2.signal });
          clearTimeout(timeout2);
          const json2 = await res2.json();
          if (json2.ip) {
            fetchedIp = json2.ip;
            setCurrentVisitorIp(json2.ip);
          }
        } catch (__) {
          setCurrentVisitorIp("Active");
        }
      }

      if (!db) {
        setVisits(1551);
        setLastSeenTimestamp(Date.now() - 40 * 60 * 1000);
        setLastVisitorIp("122.177.241.64");
        return;
      }

      try {
        const statsRef = doc(db, "site", "global");

        // 2. Query `visitor_logs` FIRST to lock the true PREVIOUS human visit
        try {
          const prevQuery = query(
            collection(db, "visitor_logs"),
            orderBy("timestamp", "desc"),
            limit(40)
          );
          const prevSnap = await getDocs(prevQuery);
          for (const docSnap of prevSnap.docs) {
            const d = docSnap.data();
            const ts = parseFirestoreTimestamp(d.timestamp);
            if (ts && pageOpenTimeRef.current - ts < 5000) {
              continue;
            }
            const botEval = detectBotOrCloudScanner({
              ip: d.ip,
              isp: d.isp,
              org: d.isp,
              city: d.location,
              region: d.location,
              userAgent: d.userAgent,
            });
            if (d.isBot || botEval.isBot) {
              continue;
            }
            if (d.ip && d.ip !== "—" && d.ip !== "Unknown" && ts) {
              setLastSeenTimestamp(ts);
              setLastVisitorIp(d.ip);
              lockedPreviousVisitRef.current = true;
              break;
            }
          }
        } catch (_) {}

        if (!lockedPreviousVisitRef.current) {
          try {
            const initialSnap = await getDoc(statsRef);
            if (initialSnap.exists()) {
              const initData = initialSnap.data();
              if (initData.visits != null) {
                setVisits(initData.visits);
              }
              const prevTs = parseFirestoreTimestamp(initData.previousVisit || initData.lastVisit);
              const prevIp = initData.previousIp || initData.lastIp;
              if (prevTs) {
                setLastSeenTimestamp(prevTs);
                lockedPreviousVisitRef.current = true;
              }
              if (prevIp && !detectBotOrCloudScanner({ ip: prevIp }).isBot) {
                setLastVisitorIp(prevIp);
              }
            }
          } catch (_) {}
        }

        // 3. Create visitor session log in `visitor_logs` for the current visitor
        const immediateBot = detectBotOrCloudScanner({ ip: fetchedIp });
        try {
          const entryTime = getNowIstTime();
          const logRef = await addDoc(collection(db, "visitor_logs"), {
            ip: fetchedIp,
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent,
            deviceSummary: getDeviceSummary(),
            durationSeconds: 0,
            isBot: immediateBot.isBot,
            botReason: immediateBot.reason,
            isOwner: isOwnerIpAddress(fetchedIp),
            puzzleVerified: false,
            openedSections: ["Human Verification Gate"],
            lettersRead: [],
            likedLetters: [],
            maxScrollPercent: 0,
            logSheetScrollPercent: 0,
            securityEvents: 0,
            securityLogs: [],
            activityTimeline: [`[${entryTime}] Opened Human Verification Gate (${getDeviceSummary()})`],
          });
          activeLogRef.current = logRef;
          activeSessionLogIdRef.current = logRef.id;

          if (pendingUpdatesRef.current.length > 0) {
            const queued = [...pendingUpdatesRef.current];
            pendingUpdatesRef.current = [];
            for (const item of queued) {
              setDoc(logRef, item, { merge: true }).catch(() => {});
            }
          }

          durInterval = setInterval(() => {
            setDoc(logRef, { durationSeconds: increment(5) }, { merge: true }).catch(() => {});
          }, 5000);
        } catch (err) {
          console.warn("Visitor log writing warning:", err);
        }

        // 4. Subscribe to `site/global` for live total visits count
        const unsubStats = onSnapshot(statsRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.visits != null) {
              setVisits(data.visits);
            }
          }
        });

        return () => {
          unsubStats();
        };
      } catch (err) {
        console.error("Firebase Firestore sync fallback:", err);
        setVisits(1544);
        setLastSeenTimestamp(Date.now() - 40 * 60 * 1000);
      }
    };

    const cleanupPromise = initTelemetry();

    return () => {
      if (durInterval) clearInterval(durInterval);
      cleanupPromise.then((unsub) => {
        if (typeof unsub === "function") unsub();
      });
    };
  }, []);

  // Increment global human `Visits` ONLY after the visitor solves the Human Verification CAPTCHA and is NOT a bot!
  useEffect(() => {
    if (!db || !isPuzzleVerified || security.isBotDetected || hasCountedVisitRef.current) {
      return;
    }

    const alreadyCounted = sessionStorage.getItem("counted_alna_van_gogh") === "1";
    if (alreadyCounted) {
      hasCountedVisitRef.current = true;
      return;
    }

    hasCountedVisitRef.current = true;
    sessionStorage.setItem("counted_alna_van_gogh", "1");

    const recordVerifiedHumanVisit = async () => {
      try {
        const statsRef = doc(db, "site", "global");
        const snap = await getDoc(statsRef);
        const existingData = snap.exists() ? snap.data() : {};
        const ipToRecord =
          resolvedProfileRef.current?.ip ||
          (currentVisitorIp !== "…" ? currentVisitorIp : "Verified Visitor");

        await setDoc(
          statsRef,
          {
            visits: increment(1),
            previousVisit: existingData?.lastVisit || serverTimestamp(),
            previousIp: existingData?.lastIp || ipToRecord,
            lastVisit: serverTimestamp(),
            lastIp: ipToRecord,
          },
          { merge: true }
        );
      } catch (_) {}
    };

    recordVerifiedHumanVisit();
  }, [isPuzzleVerified, security.isBotDetected, currentVisitorIp]);

  const toggleAudio = () => {
    const newState = toggleAmbientSoundscape();
    if (newState) {
      playGoldChime();
    }
    setIsAudioActive(newState);
    const timeStr = getNowIstTime();
    pushVisitorTelemetry({
      openedSections: arrayUnion("432Hz Ocean Audio"),
      activityTimeline: arrayUnion(
        `[${timeStr}] ${newState ? "Turned ON 432Hz Ocean Audio" : "Muted 432Hz Ocean Audio"}`
      ),
    });
  };

  const handleOpenAdminPrompt = () => {
    setShowAdminAuth(true);
    const timeStr = getNowIstTime();
    pushVisitorTelemetry({
      openedSections: arrayUnion("Keeper Login Prompt"),
      activityTimeline: arrayUnion(`[${timeStr}] Clicked Keeper Login Button`),
    });
  };

  const handleFailedKeeperAttempt = (attemptedKey: string) => {
    handleSilentSecurityEvent(
      "KEEPER_KEY_FAILED",
      `Tried wrong Keeper key: "${attemptedKey.slice(0, 30)}"`,
      {
        code: "ERR_AUTH_401",
        title: "KEEPER AUTH FAILED",
        simpleCause: "Invalid Keeper authorization key entered.",
        eventType: "KEEPER_KEY_FAILED",
        timestamp: Date.now(),
      }
    );
  };

  // Exact formatted Last Seen string: "12:30am - 26th November, 2026 (40 mins ago)"
  const fullLastSeenFormatted = formatFullLastSeen(lastSeenTimestamp);

  // Keeper Admin Dashboard View
  if (isAdmin) {
    return <AdminDashboard onBack={() => setIsAdmin(false)} db={db} />;
  }

  // 1. MANDATORY GATE & MID-SESSION ANOMALY RE-VERIFICATION: Centered 75% NeoPOP Human Verification Modal
  if (
    (!isPuzzleVerified || security.isBotDetected) &&
    !security.isVpnDetected &&
    !security.isBlurred &&
    !security.isCaptureProtected &&
    !security.captureWarning
  ) {
    return (
      <div className="relative w-full h-full min-h-screen bg-[#EEF5F3] text-[#1B2A4A] overflow-hidden select-none">
        <div className="pointer-events-none select-none opacity-85">
          <VanGoghScene onOpenLetters={() => {}} />
        </div>
        <SecurityShieldOverlay
          isVpnDetected={security.isVpnDetected}
          vpnReason={security.vpnReason}
          vpnDetails={security.vpnDetails}
          isCheckingVpn={security.isCheckingVpn}
          isCaptureProtected={security.isCaptureProtected}
          captureWarning={security.captureWarning}
          activeErrorCode={security.activeErrorCode}
          isBlurred={security.isBlurred}
          lockoutSeconds={security.lockoutSeconds}
          onRecheckVpn={security.recheckVpn}
          onBypassVpn={security.bypassVpnForSession}
          onDismissBlur={handleDismissSecurityCurtain}
        />
        <LighthousePuzzleGate
          onVerified={handlePuzzleVerified}
          onBotFlagged={handlePuzzleBotFlagged}
          onRequestLocation={security.requestExactDeviceLocation}
          isBotDetected={security.isBotDetected}
          botReason={security.botReason}
          isOwnerIp={security.isOwnerIp}
          visitorIp={currentVisitorIp}
          anomalyCause={anomalyCause}
        />
      </div>
    );
  }

  const isScreenProtected =
    security.isVpnDetected ||
    security.isBlurred ||
    security.isCaptureProtected ||
    Boolean(security.captureWarning) ||
    security.isBotDetected;

  return (
    <div className="relative w-full h-full min-h-screen bg-[#EEF5F3] text-[#1B2A4A] overflow-hidden select-none">
      {/* Active Anti-Screenshot, Anti-Screen-Recording, 5s Lockout Curtain & VPN Block Overlay (Centered 75% NeoPOP) */}
      <SecurityShieldOverlay
        isVpnDetected={security.isVpnDetected}
        vpnReason={security.vpnReason}
        vpnDetails={security.vpnDetails}
        isCheckingVpn={security.isCheckingVpn}
        isCaptureProtected={security.isCaptureProtected}
        captureWarning={security.captureWarning}
        activeErrorCode={security.activeErrorCode}
        isBlurred={security.isBlurred}
        lockoutSeconds={security.lockoutSeconds}
        onRecheckVpn={security.recheckVpn}
        onBypassVpn={security.bypassVpnForSession}
        onDismissBlur={handleDismissSecurityCurtain}
      />

      <div
        id="alna-protected-stage"
        className={
          isScreenProtected
            ? "invisible pointer-events-none select-none opacity-0"
            : "w-full h-full"
        }
      >
        {/* 1. Core Living Van Gogh Painted Seascape Canvas & Stage */}
        <VanGoghScene onOpenLetters={() => setShowLetters(true)} />

        {/* 2. Top Bar Navigation & Telemetry Panel */}
        <header className="top" id="top">
          {/* Brand Lockup */}
          <div className="brand">
            <div className="logo" aria-label="al:na">
              al
              <span className="colon" aria-hidden="true">
                <svg className="h1" viewBox="0 0 200 180">
                  <use href="#hp" />
                </svg>
                <svg className="h2" viewBox="0 0 200 180">
                  <use href="#hp" />
                </svg>
              </span>
              na
            </div>
            <span className="tag">kunal &amp; sanjana</span>

            {/* Keeper Terminal Button & Audio Toggle (Shield button removed from home screen) */}
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={handleOpenAdminPrompt}
                className="px-2.5 py-1 bg-[#FAF7EE] hover:bg-[#FFFFFF] border border-[#22418A]/30 text-[10.5px] font-bold text-[#22418A] flex items-center gap-1.5 rounded-md shadow-sm transition-all cursor-pointer"
                aria-label="Open Keeper Terminal"
                title="Keeper Terminal"
              >
                <Key className="w-3 h-3 text-[#22418A]" />
                <span>Keeper</span>
              </button>

              <button
                onClick={toggleAudio}
                className={`p-1.5 rounded-md border border-[#22418A]/30 transition-all cursor-pointer ${
                  isAudioActive
                    ? "bg-[#FFF6D6] text-[#C9892B]"
                    : "bg-[#FAF7EE] text-[#5A6788] hover:bg-[#FFFFFF]"
                }`}
                aria-label={isAudioActive ? "Mute Ocean Frequency" : "Play Ocean Frequency"}
                title={isAudioActive ? "Mute 432Hz Sound" : "Listen to 432Hz Sound"}
              >
                {isAudioActive ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Right Column: Telemetry Live Glass Panel + Floating Message Icon Directly Below */}
          <div className="flex-1 min-w-0 max-w-[440px] ml-auto flex flex-col items-stretch">
            <button
              className="panel w-full"
              id="panel"
              onClick={() => setShowLogSheet(true)}
              aria-haspopup="dialog"
              aria-label="Open the keeper’s log"
            >
              <div className="p-head">
                <i className="live" />
                <span>nights the light stayed on</span>
                <svg
                  className="chev"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>

              <div className="p-time">
                <span className="ymd">
                  {elapsed.y}y {elapsed.m}m {elapsed.d}d
                </span>
                <span className="hms">
                  <span>{elapsed.h}</span>
                  <span className="sep">:</span>
                  <span>{elapsed.mi}</span>
                  <span className="sep">:</span>
                  <span>{elapsed.s}</span>
                </span>
              </div>

              {/* Full-Width Exact Last Seen Row: e.g. "12:30am - 26th November, 2026 (40 mins ago)" */}
              <div className="mt-2 pt-2 border-t border-[#22418A]/12 flex flex-col gap-0.5 text-left">
                <span className="flex items-center gap-1 text-[10px] font-extrabold text-[#5A6788]">
                  <svg
                    className="w-3 h-3 text-[#3E86A8] shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  <span>Last seen</span>
                </span>
                <span className="text-[11.5px] sm:text-xs font-black text-[#1B2A4A] leading-snug tabular-nums">
                  {fullLastSeenFormatted}
                </span>
              </div>

              {/* Bottom 2-Column Row: Visits & Last Visit IP */}
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#22418A]/12">
                <div className="min-w-0">
                  <span className="flex items-center gap-1 text-[10px] font-extrabold text-[#5A6788]">
                    <svg
                      className="w-3 h-3 text-[#3E86A8] shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    <span>Visits</span>
                  </span>
                  <span className="block text-xs sm:text-[13px] font-black text-[#1B2A4A] mt-0.5 tabular-nums">
                    {typeof visits === "number" ? visits.toLocaleString("en-IN") : visits}
                  </span>
                </div>

                <div className="min-w-0 pl-2 border-l border-[#22418A]/12">
                  <span className="flex items-center gap-1 text-[10px] font-extrabold text-[#5A6788]">
                    <svg
                      className="w-3 h-3 text-[#3E86A8] shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
                      <circle cx="12" cy="9.5" r="2.5" />
                    </svg>
                    <span>Last Visit IP</span>
                  </span>
                  <span className="block text-xs sm:text-[13px] font-black text-[#1B2A4A] mt-0.5 truncate tabular-nums">
                    {lastVisitorIp}
                  </span>
                </div>
              </div>
            </button>

            {/* Floating Message Icon & Live Chat Directly Below the "nights the light stayed on" Box */}
            {db && <ChatWidget isAdmin={isAdmin} db={db} onTrackChatActivity={handleTrackChatActivity} />}
          </div>
        </header>

        {/* 3. Bottom Construction Progress Dock */}
        <BottomDock onOpenLetters={() => setShowLetters(true)} />

        {/* 4. Slide-up Keeper's Log Bottom Sheet */}
        <KeepersLogSheet
          isOpen={showLogSheet}
          onClose={() => setShowLogSheet(false)}
          elapsed={elapsed}
          lastSeenRelative={fullLastSeenFormatted}
          lastSeenExact=""
          visits={visits}
          lastVisitorIp={lastVisitorIp}
          currentVisitorIp={currentVisitorIp}
          isOwnerIp={security.isOwnerIp}
          onOpenAdmin={() => {
            setShowLogSheet(false);
            handleOpenAdminPrompt();
          }}
          onTrackLogActivity={handleTrackLogSheetActivity}
        />

        {/* 5. Unsent Letters Modal (101 Paragraphs & Telugu Quote + Mobile Touch-to-Read Shield) */}
        <UnsentLettersModal
          isOpen={showLetters}
          onClose={() => setShowLetters(false)}
          paragraphs={paragraphs}
          totalDays={elapsed.total}
          isOwnerIp={security.isOwnerIp}
          onTrackActivity={handleTrackLettersActivity}
          onSecurityCaptureBlocked={(detail) =>
            handleSilentSecurityEvent("LETTERS_MOBILE_SCREENSHOT_BLOCKED", detail, {
              code: "ERR_CAPTURE_401",
              title: "MOBILE SCREENSHOT BLOCKED",
              simpleCause: detail,
              eventType: "LETTERS_MOBILE_SCREENSHOT_BLOCKED",
              timestamp: Date.now(),
            })
          }
        />

        {/* 6. Keeper Authentication Modal (Key: 1811! / <1811!> + Owner IPv4/IPv6 Wi-Fi Extender Whitelist) */}
        {showAdminAuth && (
          <AdminAuthModal
            onClose={() => setShowAdminAuth(false)}
            onFailedAttempt={handleFailedKeeperAttempt}
            visitorIp={currentVisitorIp}
            ipv4={security.vpnDetails?.ipv4}
            ipv6={security.vpnDetails?.ipv6}
            isOwnerIp={security.isOwnerIp}
            onSuccess={() => {
              setShowAdminAuth(false);
              setIsAdmin(true);
            }}
          />
        )}
      </div>
    </div>
  );
}
