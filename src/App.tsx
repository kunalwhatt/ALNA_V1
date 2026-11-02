import React, { useEffect, useState, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  increment,
  serverTimestamp,
  collection,
  addDoc,
  onSnapshot,
  arrayUnion,
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
import { useSecurityShield, VisitorNetworkProfile } from "./hooks/useSecurityShield";
import { SecurityShieldOverlay } from "./components/SecurityShieldOverlay";

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

function formatAgo(timestamp: number | null): string {
  if (!timestamp) return "First contact";
  const diffSec = Math.max(0, (Date.now() - timestamp) / 1000);
  if (diffSec < 45) return "Just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
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

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [showLetters, setShowLetters] = useState(false);
  const [isAudioActive, setIsAudioActive] = useState(false);

  // Master Chronometer state (ticking every second)
  const [elapsed, setElapsed] = useState(() => calculateDiff(new Date()));

  // Telemetry stats
  const [visits, setVisits] = useState<number | string>("…");
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<number | null>(null);
  const [visitorIp, setVisitorIp] = useState<string>("…");

  const activeLogRef = useRef<any>(null);
  const pendingUpdatesRef = useRef<Array<Record<string, any>>>([]);
  const highestLettersScrollRef = useRef<number>(0);
  const highestDeepestLetterRef = useRef<number>(0);
  const highestLogScrollRef = useRef<number>(0);

  // Helper that writes to visitor_logs immediately (or queues if logRef is still initializing)
  const pushVisitorTelemetry = useCallback((payload: Record<string, any>) => {
    if (activeLogRef.current) {
      setDoc(activeLogRef.current, payload, { merge: true }).catch(() => {});
    } else {
      pendingUpdatesRef.current.push(payload);
    }
  }, []);

  // 1. Silent Security & Capture Event Handler (VPN, Screenshot, Screen-Record, Copy, Right-Click, Tab Switch)
  const handleSilentSecurityEvent = useCallback(
    (eventType: string, detail: string) => {
      const timeStr = getNowIstTime();
      const entry = `[${timeStr}] ${eventType}: ${detail}`;
      pushVisitorTelemetry({
        securityAlert: `${eventType}: ${detail}`,
        securityEvents: increment(1),
        securityLogs: arrayUnion(entry),
        activityTimeline: arrayUnion(`[${timeStr}] ⚠ ${detail}`),
        lastSecurityAt: serverTimestamp(),
      });
    },
    [pushVisitorTelemetry]
  );

  // 2. Silent Network & VPN Profile Handler
  const handleNetworkProfileResolved = useCallback(
    (profile: VisitorNetworkProfile) => {
      if (profile.ip && profile.ip !== "Unknown") {
        setVisitorIp(profile.ip);
      }
      const locationStr = [profile.city, profile.region, profile.country].filter(Boolean).join(", ");
      const timeStr = getNowIstTime();
      pushVisitorTelemetry({
        ip: profile.ip,
        isp: profile.isp,
        location: locationStr || profile.country || "Unknown",
        timezone: profile.timezone,
        isVpn: profile.isVpn,
        vpnReason: profile.vpnReason,
        activityTimeline: arrayUnion(
          `[${timeStr}] Network resolved: ${profile.ip} (${locationStr || "Direct"} • ${profile.isp}${
            profile.isVpn ? " • VPN/PROXY DETECTED" : ""
          })`
        ),
      });
    },
    [pushVisitorTelemetry]
  );

  // Activate active screenshot/VPN/copy blocking + 100% silent background telemetry
  const security = useSecurityShield(handleSilentSecurityEvent, handleNetworkProfileResolved);

  // 3. Silent Activity Tracker for Letters Archive (Reading, Scrolling, Mode Switch, Bookmarks)
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

  // Real-time Firebase Firestore visits & IP tracking
  useEffect(() => {
    let durInterval: NodeJS.Timeout | null = null;
    let fetchedIp = "—";

    const fetchIpAndTrack = async () => {
      // 1. Fetch visitor IP
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
        clearTimeout(timeout);
        const json = await res.json();
        if (json.ip) {
          fetchedIp = json.ip;
          setVisitorIp(json.ip);
        }
      } catch (e) {
        try {
          const r = await fetch("https://ipinfo.io/json");
          const j = await r.json();
          if (j.ip) {
            fetchedIp = j.ip;
            setVisitorIp(j.ip);
          }
        } catch (err) {
          setVisitorIp("Active");
        }
      }

      // 2. Real-time Firebase Firestore Sync
      if (!db) {
        setVisits(1551);
        setLastSeenTimestamp(Date.now() - 14 * 60 * 1000);
        return;
      }
      try {
        const statsRef = doc(db, "site", "global");

        const unsub = onSnapshot(statsRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.visits != null) {
              setVisits(data.visits);
            }
            if (data.lastVisit) {
              const ts =
                typeof data.lastVisit.toMillis === "function"
                  ? data.lastVisit.toMillis()
                  : typeof data.lastVisit.toDate === "function"
                  ? data.lastVisit.toDate().getTime()
                  : new Date(data.lastVisit).getTime();
              setLastSeenTimestamp(ts);
            }
          }
        });

        // Atomic visit increment guard (once per session)
        const alreadyCounted = sessionStorage.getItem("counted_alna_van_gogh") === "1";
        if (!alreadyCounted) {
          sessionStorage.setItem("counted_alna_van_gogh", "1");
          await setDoc(
            statsRef,
            {
              visits: increment(1),
              lastVisit: serverTimestamp(),
              lastIp: fetchedIp,
            },
            { merge: true }
          );
        }

        // 3. Create visitor intelligence session log for EVERY visitor
        try {
          const entryTime = getNowIstTime();
          const logRef = await addDoc(collection(db, "visitor_logs"), {
            ip: fetchedIp,
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent,
            deviceSummary: getDeviceSummary(),
            durationSeconds: 0,
            openedSections: ["Home Seascape"],
            lettersRead: [],
            likedLetters: [],
            maxScrollPercent: 0,
            logSheetScrollPercent: 0,
            securityEvents: 0,
            securityLogs: [],
            activityTimeline: [`[${entryTime}] Entered Home Seascape (${getDeviceSummary()})`],
          });
          activeLogRef.current = logRef;

          // Flush any early network/security/activity updates queued before logRef was ready
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

        return unsub;
      } catch (err) {
        console.error("Firebase Firestore sync fallback:", err);
        setVisits(1544);
        setLastSeenTimestamp(Date.now());
      }
    };

    const cleanupPromise = fetchIpAndTrack();

    return () => {
      if (durInterval) clearInterval(durInterval);
      cleanupPromise.then((unsub) => {
        if (typeof unsub === "function") unsub();
      });
    };
  }, []);

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
      `Tried wrong Keeper key: "${attemptedKey.slice(0, 30)}"`
    );
  };

  const lastSeenRelative = formatAgo(lastSeenTimestamp);
  const lastSeenExact = lastSeenTimestamp
    ? new Date(lastSeenTimestamp).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : "";

  // Keeper Admin Dashboard View
  if (isAdmin) {
    return <AdminDashboard onBack={() => setIsAdmin(false)} db={db} />;
  }

  const isScreenProtected =
    security.isVpnDetected || security.isBlurred || security.isCaptureProtected;

  return (
    <div className="relative w-full h-full min-h-screen bg-[#EEF5F3] text-[#1B2A4A] overflow-hidden select-none">
      {/* 0. Active Anti-Screenshot, Anti-Recording, Focus Curtain & VPN Block Overlay (Light Theme) */}
      <SecurityShieldOverlay
        isVpnDetected={security.isVpnDetected}
        vpnReason={security.vpnReason}
        vpnDetails={security.vpnDetails}
        isCheckingVpn={security.isCheckingVpn}
        isCaptureProtected={security.isCaptureProtected}
        captureWarning={security.captureWarning}
        isBlurred={security.isBlurred}
        onRecheckVpn={security.recheckVpn}
        onBypassVpn={security.bypassVpnForSession}
        onDismissBlur={security.dismissBlur}
      />

      <div
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
                  isAudioActive ? "bg-[#FFF6D6] text-[#C9892B]" : "bg-[#FAF7EE] text-[#5A6788] hover:bg-[#FFFFFF]"
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

              <div className="p-stats">
                <div className="stat">
                  <span className="lbl">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 2" />
                    </svg>
                    Last seen
                  </span>
                  <span className="val">{lastSeenRelative}</span>
                </div>

                <div className="stat">
                  <span className="lbl">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Visits
                  </span>
                  <span className="val">{typeof visits === "number" ? visits.toLocaleString("en-IN") : visits}</span>
                </div>

                <div className="stat">
                  <span className="lbl">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
                      <circle cx="12" cy="9.5" r="2.5" />
                    </svg>
                    Visitor IP
                  </span>
                  <span className="val">{visitorIp}</span>
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
          lastSeenRelative={lastSeenRelative}
          lastSeenExact={lastSeenExact}
          visits={visits}
          visitorIp={visitorIp}
          onOpenAdmin={() => {
            setShowLogSheet(false);
            handleOpenAdminPrompt();
          }}
          onTrackLogActivity={handleTrackLogSheetActivity}
        />

        {/* 5. Unsent Letters Modal (101 Paragraphs & Telugu Quote) */}
        <UnsentLettersModal
          isOpen={showLetters}
          onClose={() => setShowLetters(false)}
          paragraphs={paragraphs}
          totalDays={elapsed.total}
          onTrackActivity={handleTrackLettersActivity}
        />

        {/* 6. Keeper Authentication Modal (Key: 1811! / <1811!>) */}
        {showAdminAuth && (
          <AdminAuthModal
            onClose={() => setShowAdminAuth(false)}
            onFailedAttempt={handleFailedKeeperAttempt}
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
