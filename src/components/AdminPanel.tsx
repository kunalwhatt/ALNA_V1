import React, { useState, useEffect, useMemo } from "react";
import {
  Key,
  Trash2,
  ArrowLeft,
  Users,
  AlertTriangle,
  Eye,
  ShieldCheck,
  Download,
  ArrowUpDown,
  Search,
  BookOpen,
  CameraOff,
  ChevronDown,
  ChevronUp,
  Globe,
  Heart,
  Bot,
  Wifi,
  MapPin,
  Compass,
} from "lucide-react";
import {
  Firestore,
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  deleteDoc,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { Typography } from "./neopop/Typography";
import { FontVariant } from "./neopop/primitives";
import { NeoButton } from "./neopop/NeoButton";
import { NeoCard } from "./neopop/NeoCard";
import {
  detectBotOrCloudScanner,
  isOwnerIpAddress,
  OWNER_IPV4_EXACT,
  OWNER_IPV6_EXACT,
} from "../hooks/useSecurityShield";
import {
  GeoViewModule,
  InlineVisitorMiniMap,
  resolveVisitorGeo,
} from "./GeoViewModule";

interface AdminAuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
  onFailedAttempt?: (attemptedKey: string) => void;
  visitorIp?: string;
  ipv4?: string;
  ipv6?: string;
  isOwnerIp?: boolean;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  onClose,
  onSuccess,
  onFailedAttempt,
  visitorIp,
  ipv4,
  ipv6,
  isOwnerIp = false,
}) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const ownerMatch = isOwnerIp || isOwnerIpAddress(visitorIp, ipv4, ipv6);

  const handleUnlockSuccess = () => {
    try {
      localStorage.setItem("alna_owner_device_verified", "1");
      sessionStorage.setItem("alna_keeper_vpn_bypass", "1");
    } catch (_) {}
    onSuccess();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = password.trim().replace(/^<|>$/g, "").trim();

    if (cleanKey === "1811!" || password.trim() === "<1811!>" || password.trim() === "1811!") {
      handleUnlockSuccess();
    } else {
      if (onFailedAttempt) {
        onFailedAttempt(password);
      }
      setError("Incorrect authorization key. Access denied.");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#1B2A4A]/50 backdrop-blur-md font-['Outfit','Plus_Jakarta_Sans',sans-serif]">
      {/* Centered 75% Screen Size Container */}
      <div className="w-[75vw] max-w-[350px] max-h-[75dvh] mx-auto my-auto flex items-center justify-center">
        <NeoCard
          elevation="lg"
          variant="porcelain"
          className="w-full p-4 sm:p-5 bg-[#FAF7EE] border-2 border-[#0A0D14] shadow-[6px_6px_0px_#0A0D14] flex flex-col items-center overflow-y-auto max-h-[75dvh]"
        >
          {/* Top NeoPOP Status Bar */}
          <div className="w-full flex items-center justify-between pb-2 mb-2.5 border-b-2 border-[#0A0D14]/15">
            <span className="px-2 py-0.5 bg-[#22418A] text-[#F2C230] border border-[#0A0D14] text-[9.5px] font-extrabold uppercase tracking-wider shadow-[2px_2px_0px_#0A0D14]">
              KEEPER_AUTH
            </span>
            <span className="px-2 py-0.5 bg-[#FFF6D6] text-[#0A0D14] border border-[#0A0D14] text-[9.5px] font-extrabold uppercase tracking-wider">
              TERMINAL
            </span>
          </div>

          {/* Header Icon */}
          <div className="w-10 h-10 bg-[#22418A] text-[#F2C230] border-2 border-[#0A0D14] flex items-center justify-center mb-2 shadow-[3px_3px_0px_#0A0D14] shrink-0">
            <Key className="w-5 h-5" />
          </div>

          <Typography {...FontVariant.HeadingBold18} color="#0A0D14" className="text-center mb-0.5">
            Keeper Terminal
          </Typography>

          <Typography {...FontVariant.BodyRegular12} color="#5A6788" className="text-center mb-3">
            Authenticate to view visitor activity, exact GPS pins &amp; Geo View
          </Typography>

          {/* Owner IPv4 / IPv6 / Wi-Fi Extender Recognition Status */}
          <div
            className={`w-full p-2.5 mb-3 border-2 border-[#0A0D14] shadow-[2px_2px_0px_#0A0D14] text-xs font-mono flex flex-col gap-0.5 ${
              ownerMatch
                ? "bg-[#D1FAE5] text-[#065F46]"
                : "bg-[#FFF6D6] text-[#0A0D14]"
            }`}
          >
            <div className="flex items-center justify-between font-extrabold text-[11px]">
              <span className="flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {ownerMatch
                    ? "✓ Keeper IP Whitelisted"
                    : "Keeper IP Verification"}
                </span>
              </span>
            </div>
            <div className="text-[10px] opacity-90 truncate">
              IP: {ipv4 || visitorIp || "Resolving..."}
              {ipv6 ? " • IPv6 Active" : ""}
            </div>
          </div>

          {/* One-Tap Instant Unlock if connected from Kunal's exact IPv4 or IPv6 / Wi-Fi Extender */}
          {ownerMatch && (
            <button
              type="button"
              onClick={handleUnlockSuccess}
              className="w-full py-2.5 px-3 mb-2.5 bg-[#065F46] hover:bg-[#047857] text-white font-extrabold text-[11px] uppercase tracking-wider border-2 border-[#0A0D14] shadow-[3px_3px_0px_#0A0D14] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <ShieldCheck className="w-4 h-4 text-[#F2C230]" />
              <span>Instant Owner Unlock ({ipv4 || OWNER_IPV4_EXACT})</span>
            </button>
          )}

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-2.5">
            <div className="relative w-full">
              <input
                type="password"
                autoFocus
                placeholder="Authorization Key (1811!)"
                value={password}
                onChange={(e) => {
                  setError("");
                  setPassword(e.target.value);
                }}
                className="w-full bg-[#FFFFFF] border-2 border-[#0A0D14] px-3 py-2 text-sm text-[#0A0D14] placeholder-[#7B8191] outline-none focus:border-[#22418A] text-center font-extrabold tracking-widest shadow-[2px_2px_0px_#0A0D14]"
              />
            </div>

            {error && (
              <div className="p-2 bg-[#FDE8EC] border-2 border-[#0A0D14] shadow-[2px_2px_0px_#0A0D14] flex flex-col items-center justify-center gap-0.5 text-[10.5px] text-[#B8304A] font-bold text-center">
                <span className="px-1.5 py-0.2 bg-[#B8304A] text-white text-[9px] font-extrabold uppercase tracking-wider">
                  ERR_AUTH_401
                </span>
                <span className="text-[#0A0D14] flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-[#B8304A] shrink-0" />
                  <span>{error}</span>
                </span>
              </div>
            )}

            <NeoButton type="submit" variant="primary" size="md" fullWidth>
              Verify &amp; Unlock
            </NeoButton>

            <button
              type="button"
              onClick={onClose}
              className="text-xs text-[#5A6788] hover:text-[#0A0D14] font-bold transition-colors py-1 cursor-pointer"
            >
              Cancel
            </button>
          </form>
        </NeoCard>
      </div>
    </div>
  );
};

interface AdminDashboardProps {
  onBack: () => void;
  db: Firestore;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack, db }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [resetting, setResetting] = useState(false);
  const [purgingBots, setPurgingBots] = useState(false);
  const [activeTab, setActiveTab] = useState<"visitors" | "geoview" | "telemetry">("visitors");
  const [selectedGeoLogId, setSelectedGeoLogId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"humans" | "readers" | "flagged" | "bots" | "all">("humans");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [searchFilter, setSearchFilter] = useState("");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Subscribe to visitor logs & global stats
  useEffect(() => {
    const statsUnsub = onSnapshot(doc(db, "site", "global"), (snap) => {
      if (snap.exists()) {
        setGlobalStats(snap.data());
      }
    });

    const q = query(collection(db, "visitor_logs"), orderBy("timestamp", "asc"));
    const logsUnsub = onSnapshot(
      q,
      (snap) => {
        const fetched = snap.docs.map((docSnap, idx) => {
          const d = docSnap.data();
          const botEvaluation = detectBotOrCloudScanner({
            ip: d.ip,
            isp: d.isp,
            org: d.isp,
            city: d.location,
            region: d.location,
            userAgent: d.userAgent,
          });
          const isBotEntry = Boolean(d.isBot || botEvaluation.isBot);
          const botReasonStr = d.botReason || botEvaluation.reason || "";
          const isOwnerEntry = Boolean(d.isOwner || isOwnerIpAddress(d.ip, d.ipv4, d.ipv6));

          return {
            id: docSnap.id,
            sequence: idx + 1,
            ...d,
            isBotComputed: isBotEntry,
            botReasonComputed: botReasonStr,
            isOwnerComputed: isOwnerEntry,
          };
        });
        setLogs(fetched);
        setLoading(false);
      },
      (err) => {
        console.warn("Logs snapshot fallback:", err);
        setLoading(false);
      }
    );

    return () => {
      statsUnsub();
      logsUnsub();
    };
  }, [db]);

  const humanLogs = useMemo(() => logs.filter((l) => !l.isBotComputed), [logs]);
  const botLogs = useMemo(() => logs.filter((l) => l.isBotComputed), [logs]);

  const flaggedCount = useMemo(
    () =>
      humanLogs.filter(
        (l) =>
          l.isVpn ||
          l.securityAlert ||
          (Array.isArray(l.securityLogs) && l.securityLogs.length > 0) ||
          (l.securityEvents && l.securityEvents > 0)
      ).length,
    [humanLogs]
  );

  const readersCount = useMemo(
    () =>
      humanLogs.filter(
        (l) =>
          (Array.isArray(l.lettersRead) && l.lettersRead.length > 0) ||
          (l.maxScrollPercent && l.maxScrollPercent > 0)
      ).length,
    [humanLogs]
  );

  // Sorted and filtered logs
  const processedLogs = useMemo(() => {
    let result = [...logs];
    if (sortOrder === "desc") {
      result.reverse();
    }

    if (filterMode === "humans") {
      result = result.filter((l) => !l.isBotComputed);
    } else if (filterMode === "bots") {
      result = result.filter((l) => l.isBotComputed);
    } else if (filterMode === "readers") {
      result = result.filter(
        (l) =>
          !l.isBotComputed &&
          ((Array.isArray(l.lettersRead) && l.lettersRead.length > 0) ||
            (Array.isArray(l.openedSections) && l.openedSections.length > 1) ||
            (l.maxScrollPercent && l.maxScrollPercent > 0))
      );
    } else if (filterMode === "flagged") {
      result = result.filter(
        (l) =>
          !l.isBotComputed &&
          (l.isVpn ||
            l.securityAlert ||
            (Array.isArray(l.securityLogs) && l.securityLogs.length > 0) ||
            (l.securityEvents && l.securityEvents > 0))
      );
    }

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      result = result.filter(
        (l) =>
          (l.ip && l.ip.toLowerCase().includes(q)) ||
          (l.location && l.location.toLowerCase().includes(q)) ||
          (l.exactAddress && l.exactAddress.toLowerCase().includes(q)) ||
          (l.isp && l.isp.toLowerCase().includes(q)) ||
          (l.userAgent && l.userAgent.toLowerCase().includes(q)) ||
          (Array.isArray(l.openedSections) && l.openedSections.join(" ").toLowerCase().includes(q)) ||
          (Array.isArray(l.securityLogs) && l.securityLogs.join(" ").toLowerCase().includes(q))
      );
    }
    return result;
  }, [logs, sortOrder, filterMode, searchFilter]);

  const handleResetVisits = async () => {
    if (confirm("Reset telemetry counter to zero?")) {
      setResetting(true);
      try {
        await setDoc(doc(db, "site", "global"), { visits: 0 }, { merge: true });
      } catch (err) {
        console.error("Failed to reset:", err);
      } finally {
        setResetting(false);
      }
    }
  };

  const handlePurgeBotLogs = async () => {
    if (!botLogs.length) return;
    setPurgingBots(true);
    try {
      const deletions = botLogs.map((b) => deleteDoc(doc(db, "visitor_logs", b.id)));
      await Promise.all(deletions);
    } catch (err) {
      console.error("Failed to purge bot logs:", err);
    } finally {
      setPurgingBots(false);
    }
  };

  const handleClearLogs = async () => {
    if (confirm("Purge all visitor log history?")) {
      try {
        const q = query(collection(db, "visitor_logs"));
        const snap = await getDocs(q);
        const batch = snap.docs.map((d) => deleteDoc(d.ref));
        await Promise.all(batch);
      } catch (err) {
        console.error("Failed to clear logs:", err);
      }
    }
  };

  const exportCsv = () => {
    if (!processedLogs.length) return;
    const headers = [
      "Index",
      "Visitor Type",
      "IP Address",
      "Exact Coordinates",
      "Geo Precision",
      "Location / Address",
      "ISP / Org",
      "Human Verified",
      "VPN Detected",
      "Last Error Code",
      "Dwell Time (s)",
      "What They Opened",
      "Letters Read",
      "Liked Letters",
      "Max Scroll %",
      "Deepest Letter Scrolled",
      "Security / Capture Attempts",
      "Activity Timeline",
      "Timestamp",
      "Device / User Agent",
    ];
    const rows = processedLogs.map((l, idx) => {
      const geo = resolveVisitorGeo(l, idx);
      return [
        l.sequence,
        l.isOwnerComputed ? "OWNER (KUNAL)" : l.isBotComputed ? "BOT / SCANNER" : "HUMAN VISITOR",
        l.ip || "Unknown",
        `"${geo.lat}, ${geo.lng}"`,
        `"${geo.geoSource} (±${geo.accuracyMeters}m)"`,
        `"${(geo.exactAddress || l.location || "").replace(/"/g, '""')}"`,
        `"${(l.isp || "").replace(/"/g, '""')}"`,
        l.puzzleVerified ? "YES" : "NO",
        l.isVpn ? "YES" : "NO",
        geo.lastErrorCode,
        l.durationSeconds || 0,
        `"${(Array.isArray(l.openedSections) ? l.openedSections.join(" | ") : "Home Seascape").replace(/"/g, '""')}"`,
        `"${(Array.isArray(l.lettersRead) ? l.lettersRead.map((n: number) => `#${n}`).join(", ") : "None").replace(/"/g, '""')}"`,
        `"${(Array.isArray(l.likedLetters) ? l.likedLetters.map((n: number) => `#${n}`).join(", ") : "None").replace(/"/g, '""')}"`,
        `${l.maxScrollPercent || 0}%`,
        l.deepestLetterScrolled ? `Letter #${l.deepestLetterScrolled}` : "—",
        `"${(Array.isArray(l.securityLogs) ? l.securityLogs.join(" | ") : l.securityAlert || "None").replace(/"/g, '""')}"`,
        `"${(Array.isArray(l.activityTimeline) ? l.activityTimeline.join(" -> ") : "").replace(/"/g, '""')}"`,
        l.timestamp
          ? new Date(l.timestamp.toDate ? l.timestamp.toDate() : l.timestamp).toISOString()
          : "",
        `"${(l.userAgent || "").replace(/"/g, '""')}"`,
      ];
    });
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `lighthouse_full_intelligence_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDuration = (sec: number | undefined) => {
    if (!sec || sec < 5) return "< 5s";
    if (sec < 60) return `${sec}s`;
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
  };

  return (
    <div className="w-full min-h-screen bg-[#FAF7EE] text-[#0A0D14] p-3 sm:p-8 font-['Outfit','Plus_Jakarta_Sans',sans-serif] select-text">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b-2 border-[#0A0D14]">
          <div className="flex items-center gap-3">
            <NeoButton variant="secondary" size="sm" onClick={onBack} className="flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              <span>Return</span>
            </NeoButton>
            <div>
              <Typography {...FontVariant.HeadingBold20} color="#0A0D14">
                Keeper Silent Intelligence, Geo View &amp; Activity Terminal
              </Typography>
              <Typography {...FontVariant.BodyRegular13} color="#5A6788">
                Real-time tracking of exact device GPS coordinates, interactive map pins, what visitors opened, read &amp; scrolled, and NeoPOP anomaly codes
              </Typography>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <NeoButton
              variant={activeTab === "visitors" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setActiveTab("visitors")}
            >
              Visitor Intelligence ({humanLogs.length} Humans)
            </NeoButton>
            <NeoButton
              variant={activeTab === "geoview" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setActiveTab("geoview")}
            >
              <span className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-[#F2C230]" />
                <span>Geo View • Real Map (Desktop)</span>
              </span>
            </NeoButton>
            <NeoButton
              variant={activeTab === "telemetry" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setActiveTab("telemetry")}
            >
              Counter &amp; IP Controls
            </NeoButton>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <NeoCard elevation="md" variant="porcelain" className="p-4 bg-[#FFFFFF]">
            <div className="flex items-center justify-between pb-2 border-b border-[#0A0D14]/15">
              <Typography {...FontVariant.CapsBold11} color="#5A6788">
                VERIFIED VISITS
              </Typography>
              <Eye className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <div className="mt-2.5">
              <span className="font-['Cinzel',serif] text-2xl sm:text-3xl font-black text-[#0A0D14] tabular-nums">
                {globalStats?.visits ?? "—"}
              </span>
            </div>
          </NeoCard>

          <NeoCard elevation="md" variant="porcelain" className="p-4 bg-[#FFFFFF]">
            <div className="flex items-center justify-between pb-2 border-b border-[#0A0D14]/15">
              <Typography {...FontVariant.CapsBold11} color="#5A6788">
                HUMAN SESSIONS
              </Typography>
              <Users className="w-4 h-4 text-[#22418A]" />
            </div>
            <div className="mt-2.5 font-mono font-bold text-xl sm:text-2xl text-[#0A0D14] tabular-nums">
              {humanLogs.length} Humans
            </div>
          </NeoCard>

          <NeoCard elevation="md" variant="porcelain" className="p-4 bg-[#FFFFFF]">
            <div className="flex items-center justify-between pb-2 border-b border-[#0A0D14]/15">
              <Typography {...FontVariant.CapsBold11} color="#5A6788">
                LETTERS READERS
              </Typography>
              <BookOpen className="w-4 h-4 text-[#C9892B]" />
            </div>
            <div className="mt-2.5 font-mono font-bold text-xl sm:text-2xl text-[#22418A] tabular-nums">
              {readersCount} Read/Scrolled
            </div>
          </NeoCard>

          <NeoCard elevation="md" variant="porcelain" className="p-4 bg-[#FFFFFF]">
            <div className="flex items-center justify-between pb-2 border-b border-[#0A0D14]/15">
              <Typography {...FontVariant.CapsBold11} color="#5A6788">
                BOTS &amp; FLAGS
              </Typography>
              <CameraOff className="w-4 h-4 text-[#B8304A]" />
            </div>
            <div className="mt-2.5 font-mono font-bold text-lg sm:text-xl text-[#B8304A] tabular-nums">
              {flaggedCount} Flags · {botLogs.length} Bots
            </div>
          </NeoCard>
        </div>

        {/* Tab 1: Visitor Intelligence Table */}
        {activeTab === "visitors" && (
          <NeoCard elevation="md" variant="porcelain" className="p-4 sm:p-5 bg-[#FFFFFF]">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b-2 border-[#0A0D14] mb-4">
              {/* Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setFilterMode("humans")}
                  className={`px-3 py-1.5 text-xs font-bold border border-[#0A0D14] cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                    filterMode === "humans"
                      ? "bg-[#22418A] text-white shadow-[2px_2px_0px_#0A0D14]"
                      : "bg-[#FAF7EE] text-[#0A0D14] hover:bg-white"
                  }`}
                >
                  Human Visitors ({humanLogs.length})
                </button>
                <button
                  onClick={() => setFilterMode("readers")}
                  className={`px-3 py-1.5 text-xs font-bold border border-[#0A0D14] cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                    filterMode === "readers"
                      ? "bg-[#C9892B] text-white shadow-[2px_2px_0px_#0A0D14]"
                      : "bg-[#FAF7EE] text-[#0A0D14] hover:bg-white"
                  }`}
                >
                  Opened / Read Letters ({readersCount})
                </button>
                <button
                  onClick={() => setFilterMode("flagged")}
                  className={`px-3 py-1.5 text-xs font-bold border border-[#0A0D14] cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                    filterMode === "flagged"
                      ? "bg-[#B8304A] text-white shadow-[2px_2px_0px_#0A0D14]"
                      : "bg-[#FAF7EE] text-[#0A0D14] hover:bg-white"
                  }`}
                >
                  VPN / Screenshot / Copy ({flaggedCount})
                </button>
                <button
                  onClick={() => setFilterMode("bots")}
                  className={`px-3 py-1.5 text-xs font-bold border border-[#0A0D14] cursor-pointer transition-all flex items-center gap-1 whitespace-nowrap shrink-0 ${
                    filterMode === "bots"
                      ? "bg-[#0A0D14] text-[#F2C230] shadow-[2px_2px_0px_#B8304A]"
                      : "bg-[#FAF7EE] text-[#5A6788] hover:bg-white"
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Blocked Bots ({botLogs.length})</span>
                </button>
                <button
                  onClick={() => setFilterMode("all")}
                  className={`px-2.5 py-1.5 text-xs font-bold border border-[#0A0D14] cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                    filterMode === "all"
                      ? "bg-[#22418A] text-white"
                      : "bg-[#FAF7EE] text-[#5A6788] hover:bg-white"
                  }`}
                >
                  All ({logs.length})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#5A6788]" />
                  <input
                    type="text"
                    placeholder="Search IP, city, coords, letter..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-8 pr-3 py-1 bg-[#FAF7EE] border border-[#0A0D14] text-xs font-mono outline-none focus:border-[#22418A]"
                  />
                </div>

                {/* Sort Order Toggle */}
                <button
                  onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
                  className="px-2.5 py-1 bg-[#FAF7EE] hover:bg-[#FFFFFF] border border-[#0A0D14] text-xs font-bold flex items-center gap-1 cursor-pointer shadow-[1px_1px_0px_#0A0D14] whitespace-nowrap shrink-0"
                  title="Toggle Chronological Order"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#22418A]" />
                  <span>{sortOrder === "desc" ? "Latest First" : "From #1 First"}</span>
                </button>

                {/* One-Click Purge Google LLC / Bot Logs */}
                {botLogs.length > 0 && (
                  <button
                    onClick={handlePurgeBotLogs}
                    disabled={purgingBots}
                    className="px-2.5 py-1 bg-[#FDE8EC] hover:bg-[#B8304A] hover:text-white text-[#B8304A] border border-[#B8304A] text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                    title="Delete all Google Cloud / AS396982 / Datacenter Crawler Bot entries"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>{purgingBots ? "Purging Bots..." : `Purge ${botLogs.length} Bots`}</span>
                  </button>
                )}

                {/* Export CSV */}
                <button
                  onClick={exportCsv}
                  disabled={!processedLogs.length}
                  className="px-2.5 py-1 bg-[#FAF7EE] hover:bg-[#FFFFFF] disabled:opacity-40 border border-[#0A0D14] text-xs font-bold flex items-center gap-1 cursor-pointer shadow-[1px_1px_0px_#0A0D14] whitespace-nowrap shrink-0"
                  title="Download Full Intelligence CSV"
                >
                  <Download className="w-3.5 h-3.5 text-[#C9892B]" />
                  <span>Export CSV</span>
                </button>

                <NeoButton
                  variant="secondary"
                  size="sm"
                  onClick={handleClearLogs}
                  className="flex items-center gap-1 text-[#B8304A]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Purge All</span>
                </NeoButton>
              </div>
            </div>

            <div className="mb-3 px-3 py-2 bg-[#FFF6D6] border-2 border-[#0A0D14] shadow-[2px_2px_0px_#0A0D14] text-[11.5px] text-[#1B2A4A] flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>Exact Device Location &amp; Bot Shield Active:</strong> Click any visitor row to view their <strong>Real Map Pin &amp; Exact Coordinates</strong>, or open the desktop <strong>Geo View</strong> tab for full map analytics.
              </span>
              <button
                type="button"
                onClick={() => setActiveTab("geoview")}
                className="px-2.5 py-1 bg-[#22418A] text-[#F2C230] border border-[#0A0D14] shadow-[2px_2px_0px_#0A0D14] text-[10.5px] font-extrabold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              >
                <Compass className="w-3 h-3" />
                <span>Open Geo View Map</span>
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm font-mono text-[#5A6788]">
                Loading visitor intelligence logs...
              </div>
            ) : processedLogs.length === 0 ? (
              <div className="p-8 text-center text-sm font-mono text-[#5A6788]">
                No matching visitor logs in this view.
              </div>
            ) : (
              <div
                className="overflow-x-auto max-h-[680px] overflow-y-auto overscroll-y-contain touch-pan-y"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead className="sticky top-0 bg-[#FFFFFF] z-10">
                    <tr className="border-b-2 border-[#0A0D14] text-[#0A0D14] bg-[#FAF7EE]">
                      <th className="py-2.5 px-2.5">#</th>
                      <th className="py-2.5 px-2.5">Visitor IP, Exact Coords &amp; Network</th>
                      <th className="py-2.5 px-2.5">Dwell</th>
                      <th className="py-2.5 px-2.5">What They Opened</th>
                      <th className="py-2.5 px-2.5">What They Read &amp; Scrolled</th>
                      <th className="py-2.5 px-2.5">Error Code / Security Logs</th>
                      <th className="py-2.5 px-2.5">Time (IST)</th>
                      <th className="py-2.5 px-2.5">Map &amp; Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedLogs.map((log, rowIdx) => {
                      const isExpanded = expandedRowId === log.id;
                      const geo = resolveVisitorGeo(log, rowIdx);
                      const dateStr = geo.timestampStr;

                      const openedSections: string[] = geo.openedSections;
                      const lettersRead: number[] = geo.lettersRead;
                      const likedLetters: number[] = Array.isArray(log.likedLetters)
                        ? log.likedLetters
                        : [];
                      const securityLogs: string[] = geo.securityLogs;
                      const timeline: string[] = Array.isArray(log.activityTimeline)
                        ? log.activityTimeline
                        : [];

                      return (
                        <React.Fragment key={log.id}>
                          <tr
                            onClick={() => setExpandedRowId(isExpanded ? null : log.id)}
                            className={`border-b border-[#0A0D14]/15 hover:bg-[#FAF7EE] transition-colors cursor-pointer align-top ${
                              isExpanded ? "bg-[#FAF7EE]" : ""
                            }`}
                          >
                            {/* # Sequence */}
                            <td className="py-3 px-2.5 font-bold text-[#B8304A] whitespace-nowrap">
                              #{log.sequence}
                            </td>

                            {/* IP, Exact Coords, Location & ISP */}
                            <td className="py-3 px-2.5 min-w-[195px]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-[#0A0D14] text-xs">
                                  {log.ip || "Unknown"}
                                </span>
                                {log.isOwnerComputed && (
                                  <span className="text-[9.5px] font-bold text-[#065F46] bg-[#D1FAE5] px-1.5 py-0.5 border border-[#065F46]/40">
                                    OWNER (KUNAL)
                                  </span>
                                )}
                                {log.isBotComputed && (
                                  <span className="text-[9.5px] font-bold text-[#B8304A] bg-[#FDE8EC] px-1.5 py-0.5 border border-[#B8304A]/40">
                                    BOT / CRAWLER
                                  </span>
                                )}
                              </div>

                              <div className="text-[10.5px] text-[#22418A] font-semibold flex items-center gap-1 mt-0.5">
                                <Globe className="w-3 h-3 shrink-0" />
                                <span>{geo.exactAddress}</span>
                              </div>

                              <div className="text-[10px] text-[#0A0D14] font-bold flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-[#B8304A] shrink-0" />
                                <span>
                                  {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}
                                </span>
                                <span
                                  className={`px-1 py-0.2 text-[8.5px] border border-[#0A0D14] ${
                                    geo.geoSilentTracked
                                      ? "bg-[#D1FAE5] text-[#065F46]"
                                      : "bg-[#FFF6D6] text-[#0A0D14]"
                                  }`}
                                >
                                  {geo.geoSilentTracked
                                    ? `SILENT ±${geo.accuracyMeters}m`
                                    : "LEGACY LOG"}
                                </span>
                              </div>

                              {log.isp && (
                                <div
                                  className="text-[10px] text-[#5A6788] truncate max-w-[190px] mt-0.5"
                                  title={log.isp}
                                >
                                  {log.isp}
                                </div>
                              )}
                              {log.deviceSummary && (
                                <div className="text-[10px] text-[#7B8191] mt-0.5">
                                  {log.deviceSummary}
                                </div>
                              )}
                            </td>

                            {/* Dwell Time */}
                            <td className="py-3 px-2.5 whitespace-nowrap">
                              <span className="px-1.5 py-0.5 bg-[#FAF7EE] border border-[#0A0D14]/25 font-bold text-[#0A0D14]">
                                {formatDuration(log.durationSeconds)}
                              </span>
                            </td>

                            {/* What They Opened */}
                            <td className="py-3 px-2.5 min-w-[170px]">
                              <div className="flex flex-wrap gap-1">
                                {openedSections.map((sec, i) => (
                                  <span
                                    key={i}
                                    className={`px-1.5 py-0.5 text-[10px] font-bold border ${
                                      sec.includes("Letters")
                                        ? "bg-[#FFF6D6] text-[#C9892B] border-[#C9892B]/50"
                                        : sec.includes("Keeper")
                                        ? "bg-[#FDE8EC] text-[#B8304A] border-[#B8304A]/40"
                                        : sec.includes("Chat")
                                        ? "bg-[#E0E7FF] text-[#22418A] border-[#22418A]/30"
                                        : "bg-[#FAF7EE] text-[#1B2A4A] border-[#0A0D14]/20"
                                    }`}
                                  >
                                    {sec}
                                  </span>
                                ))}
                              </div>
                            </td>

                            {/* What They Read & Scrolled */}
                            <td className="py-3 px-2.5 min-w-[200px]">
                              {lettersRead.length > 0 ? (
                                <div className="space-y-1">
                                  <div className="text-[11px] font-bold text-[#22418A]">
                                    Read {lettersRead.length} Letter
                                    {lettersRead.length > 1 ? "s" : ""}:{" "}
                                    <span className="text-[#0A0D14]">
                                      {lettersRead
                                        .slice(0, 8)
                                        .map((n) => `#${n}`)
                                        .join(", ")}
                                      {lettersRead.length > 8
                                        ? ` +${lettersRead.length - 8} more`
                                        : ""}
                                    </span>
                                  </div>
                                  {typeof log.maxScrollPercent === "number" &&
                                    log.maxScrollPercent > 0 && (
                                      <div className="text-[10.5px] font-bold text-[#C9892B]">
                                        Scrolled Letters: {log.maxScrollPercent}%
                                        {log.deepestLetterScrolled
                                          ? ` (up to #${log.deepestLetterScrolled}/101)`
                                          : ""}
                                      </div>
                                    )}
                                  {likedLetters.length > 0 && (
                                    <div className="text-[10.5px] font-bold text-[#B8304A] flex items-center gap-1">
                                      <Heart className="w-3 h-3 fill-[#B8304A]" />
                                      <span>
                                        Bookmarked:{" "}
                                        {likedLetters.map((n) => `#${n}`).join(", ")}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-[10.5px] text-[#5A6788]">
                                  Did not open letters
                                  {typeof log.logSheetScrollPercent === "number" &&
                                  log.logSheetScrollPercent > 0 ? (
                                    <span className="block text-[#22418A] font-bold mt-0.5">
                                      Scrolled Keeper’s Log: {log.logSheetScrollPercent}%
                                    </span>
                                  ) : null}
                                </div>
                              )}
                            </td>

                            {/* Error Code / VPN / Screenshot Logs */}
                            <td className="py-3 px-2.5 min-w-[195px]">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`px-1.5 py-0.5 border border-[#0A0D14] font-extrabold text-[9.5px] ${
                                      geo.lastErrorCode === "OK_200"
                                        ? "bg-[#D1FAE5] text-[#065F46]"
                                        : "bg-[#B8304A] text-white"
                                    }`}
                                  >
                                    {geo.lastErrorCode}
                                  </span>

                                  {log.isBotComputed ? (
                                    <span className="inline-block px-1.5 py-0.5 bg-[#FDE8EC] text-[#B8304A] border border-[#B8304A]/50 font-bold text-[10px]">
                                      🤖 Cloud Bot Blocked
                                    </span>
                                  ) : log.isVpn ? (
                                    <span className="inline-block px-1.5 py-0.5 bg-[#FDE8EC] text-[#B8304A] border border-[#B8304A]/50 font-bold text-[10px]">
                                      ⚠ VPN / Proxy
                                    </span>
                                  ) : (
                                    <span className="inline-block px-1.5 py-0.5 bg-[#D1FAE5] text-[#065F46] border border-[#065F46]/30 font-bold text-[10px]">
                                      ✓ Direct {log.puzzleVerified ? "• Verified" : ""}
                                    </span>
                                  )}
                                </div>

                                {securityLogs.length > 0 ? (
                                  <div className="space-y-0.5 mt-1">
                                    {securityLogs.slice(-3).map((evt, idx) => (
                                      <div
                                        key={idx}
                                        className="text-[10px] font-bold text-[#B8304A] bg-[#FDE8EC]/70 px-1.5 py-0.5 border border-[#B8304A]/30"
                                      >
                                        • {evt}
                                      </div>
                                    ))}
                                    {securityLogs.length > 3 && (
                                      <div className="text-[10px] text-[#B8304A] font-bold">
                                        +{securityLogs.length - 3} more security events
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-[#5A6788]">
                                    No screenshot / copy attempts
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Timestamp */}
                            <td className="py-3 px-2.5 text-[#5A6788] whitespace-nowrap text-[11px]">
                              {dateStr}
                            </td>

                            {/* Expand Toggle */}
                            <td className="py-3 px-2.5 text-center">
                              <button
                                type="button"
                                className="px-2 py-1 bg-[#FAF7EE] border border-[#0A0D14] hover:bg-[#22418A] hover:text-white transition-colors cursor-pointer flex items-center gap-1 mx-auto text-[10px] font-bold shadow-[2px_2px_0px_#0A0D14]"
                                title="View Real Map Pin & Full Activity Timeline"
                              >
                                <MapPin className="w-3 h-3 text-[#B8304A]" />
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Full Session Intelligence Drawer + Real Map Pin View */}
                          {isExpanded && (
                            <tr className="bg-[#FAF7EE] border-b-2 border-[#0A0D14]">
                              <td colSpan={8} className="p-4 sm:p-5 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
                                  {/* Column 1: Network, Device & VPN Profile */}
                                  <div className="p-3.5 bg-white border-2 border-[#0A0D14] shadow-[3px_3px_0px_#0A0D14] space-y-2 text-xs">
                                    <div className="font-extrabold text-[#0A0D14] uppercase tracking-wider text-[11px] border-b-2 border-[#0A0D14]/15 pb-1.5 flex items-center justify-between">
                                      <span>1. Network &amp; Device Fingerprint</span>
                                      <span className="font-mono text-[#22418A]">#{log.sequence}</span>
                                    </div>
                                    <div className="space-y-1 font-mono text-[11px]">
                                      <div>
                                        <strong>IP Address:</strong> {log.ip || "Unknown"}
                                      </div>
                                      {log.ipv6 && (
                                        <div className="break-all">
                                          <strong>IPv6:</strong> {log.ipv6}
                                        </div>
                                      )}
                                      <div>
                                        <strong>Exact Coords:</strong> {geo.lat.toFixed(6)},{" "}
                                        {geo.lng.toFixed(6)} ({geo.geoSource})
                                      </div>
                                      <div>
                                        <strong>Address:</strong> {geo.exactAddress}
                                      </div>
                                      <div>
                                        <strong>ISP / ASN:</strong> {log.isp || "Unknown"}
                                      </div>
                                      <div>
                                        <strong>Timezone:</strong> {log.timezone || "—"}
                                      </div>
                                      <div>
                                        <strong>Status Code:</strong>{" "}
                                        <span
                                          className={
                                            log.isBotComputed || log.isVpn || geo.hasSecurityFlags
                                              ? "text-[#B8304A] font-bold"
                                              : "text-[#065F46] font-bold"
                                          }
                                        >
                                          {geo.lastErrorCode}
                                        </span>
                                      </div>
                                      <div>
                                        <strong>Screen / Device:</strong> {log.deviceSummary || "—"}
                                      </div>
                                      <div className="text-[10px] text-[#5A6788] break-all pt-1">
                                        <strong>Raw UA:</strong> {log.userAgent}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Column 2: Reading, Scrolling & Security Breakdown */}
                                  <div className="p-3.5 bg-white border-2 border-[#0A0D14] shadow-[3px_3px_0px_#0A0D14] space-y-2 text-xs">
                                    <div className="font-extrabold text-[#0A0D14] uppercase tracking-wider text-[11px] border-b-2 border-[#0A0D14]/15 pb-1.5">
                                      2. What They Opened, Read &amp; Scrolled
                                    </div>
                                    <div className="space-y-1.5 text-[11.5px]">
                                      <div>
                                        <strong>Sections Opened:</strong>{" "}
                                        <span className="font-mono text-[#22418A]">
                                          {openedSections.join(" → ")}
                                        </span>
                                      </div>
                                      <div>
                                        <strong>All Letters Read ({lettersRead.length}):</strong>{" "}
                                        <span className="font-mono">
                                          {lettersRead.length > 0
                                            ? lettersRead.map((n) => `#${n}`).join(", ")
                                            : "Did not open letters"}
                                        </span>
                                      </div>
                                      <div>
                                        <strong>Letters Scroll Depth:</strong>{" "}
                                        <span className="font-mono font-bold text-[#C9892B]">
                                          {log.maxScrollPercent || 0}%{" "}
                                          {log.deepestLetterScrolled
                                            ? `(Reached Letter #${log.deepestLetterScrolled} of 101)`
                                            : ""}
                                        </span>
                                      </div>
                                      <div>
                                        <strong>Keeper’s Log Scroll Depth:</strong>{" "}
                                        <span className="font-mono">
                                          {log.logSheetScrollPercent || 0}%
                                        </span>
                                      </div>
                                      <div>
                                        <strong>Bookmarked Letters:</strong>{" "}
                                        <span className="font-mono text-[#B8304A]">
                                          {likedLetters.length > 0
                                            ? likedLetters.map((n) => `#${n}`).join(", ")
                                            : "None"}
                                        </span>
                                      </div>
                                      <div className="pt-1 border-t border-[#0A0D14]/10">
                                        <strong className="text-[#B8304A] block mb-1">
                                          Security / Screenshot / Anomaly Logs ({securityLogs.length}):
                                        </strong>
                                        {securityLogs.length > 0 ? (
                                          <ul className="space-y-1 font-mono text-[10.5px] text-[#B8304A]">
                                            {securityLogs.map((s, idx) => (
                                              <li key={idx}>• {s}</li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <span className="text-[#5A6788] font-mono text-[11px]">
                                            No screenshot, screen-record, or copy attempts in this session.
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Column 3: Step-by-Step Chronological Timeline */}
                                  <div className="p-3.5 bg-white border-2 border-[#0A0D14] shadow-[3px_3px_0px_#0A0D14] space-y-2 text-xs max-h-[260px] overflow-y-auto">
                                    <div className="font-extrabold text-[#0A0D14] uppercase tracking-wider text-[11px] border-b-2 border-[#0A0D14]/15 pb-1.5">
                                      3. Step-by-Step Session Timeline ({timeline.length})
                                    </div>
                                    {timeline.length > 0 ? (
                                      <ol className="space-y-1 font-mono text-[10.5px] text-[#1B2A4A]">
                                        {timeline.map((step, idx) => (
                                          <li key={idx} className="border-b border-[#0A0D14]/10 pb-1">
                                            {step}
                                          </li>
                                        ))}
                                      </ol>
                                    ) : (
                                      <div className="text-[#5A6788] font-mono text-[11px]">
                                        Entered Home Seascape
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Row 2: Real Map View Module & Exact Pin — shown only for visits from now onwards */}
                                {geo.geoSilentTracked ? (
                                  <InlineVisitorMiniMap
                                    geo={geo}
                                    onOpenInGeoView={(id) => {
                                      setSelectedGeoLogId(id);
                                      setActiveTab("geoview");
                                    }}
                                  />
                                ) : (
                                  <div className="p-3 bg-[#FFF6D6] border-2 border-[#0A0D14] shadow-[3px_3px_0px_#0A0D14] text-xs font-mono text-[#0A0D14] flex items-center justify-between">
                                    <span>
                                      <strong>Legacy Log (Recorded Prior to Silent Triangulation Reset):</strong>{" "}
                                      Per Keeper policy, <strong>Real Map &amp; Geo View</strong> only pins new visits from now onwards.
                                    </span>
                                    <span className="px-2 py-0.5 bg-white border border-[#0A0D14] text-[10px] font-extrabold uppercase">
                                      PRE-CUTOFF
                                    </span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </NeoCard>
        )}

        {/* Tab 2: Desktop-Only Geo View & Real Map Analytics Module */}
        {activeTab === "geoview" && (
          <GeoViewModule
            logs={logs}
            selectedLogId={selectedGeoLogId}
            onSelectLogId={setSelectedGeoLogId}
          />
        )}

        {/* Tab 3: Telemetry & Whitelist Controls */}
        {activeTab === "telemetry" && (
          <NeoCard elevation="md" variant="porcelain" className="p-6 bg-[#FFFFFF] space-y-6">
            <div>
              <Typography {...FontVariant.HeadingBold18} color="#0A0D14">
                Beacon Telemetry &amp; Owner IP Whitelist
              </Typography>
              <Typography {...FontVariant.BodyRegular13} color="#5A6788">
                Manage whitelisted Keeper endpoints and global visit counters
              </Typography>
            </div>

            <div className="p-4 bg-[#D1FAE5]/60 border-2 border-[#065F46] space-y-2">
              <Typography {...FontVariant.HeadingBold14} color="#065F46">
                Whitelisted Keeper Owner IPs (Direct &amp; Wi-Fi Extender Enabled)
              </Typography>
              <div className="font-mono text-xs text-[#0A0D14] space-y-1">
                <div>
                  <strong>Registered IPv4:</strong> {OWNER_IPV4_EXACT} (plus Wi-Fi extender subnet 122.177.241.*)
                </div>
                <div>
                  <strong>Registered IPv6:</strong> {OWNER_IPV6_EXACT} (plus /64 Wi-Fi extender prefix 2401:4900:88f7:eec7::)
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#FAF7EE] border-2 border-[#0A0D14] space-y-3">
              <Typography {...FontVariant.HeadingBold14} color="#0A0D14">
                Reset Global Visit Counter
              </Typography>
              <Typography {...FontVariant.BodyRegular12} color="#5A6788">
                This will set the global visit count in Firestore back to 0. Use with caution.
              </Typography>
              <NeoButton
                variant="crimson"
                size="sm"
                onClick={handleResetVisits}
                disabled={resetting}
              >
                {resetting ? "Resetting..." : "Reset Counter to Zero"}
              </NeoButton>
            </div>
          </NeoCard>
        )}
      </div>
    </div>
  );
};
