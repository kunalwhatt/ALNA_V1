import React, { useState, useEffect, useMemo } from "react";
import {
  Key,
  Trash2,
  ArrowLeft,
  Users,
  AlertTriangle,
  Eye,
  ShieldCheck,
  ShieldAlert,
  Download,
  ArrowUpDown,
  Search,
  BookOpen,
  ScrollText,
  Wifi,
  CameraOff,
  ChevronDown,
  ChevronUp,
  Clock,
  Globe,
  Heart,
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

interface AdminAuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
  onFailedAttempt?: (attemptedKey: string) => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  onClose,
  onSuccess,
  onFailedAttempt,
}) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = password.trim().replace(/^<|>$/g, "").trim();
    // Strictly accept 1811! or <1811!>
    if (cleanKey === "1811!" || password.trim() === "<1811!>" || password.trim() === "1811!") {
      onSuccess();
    } else {
      if (onFailedAttempt) {
        onFailedAttempt(password);
      }
      setError("Incorrect authorization key. Access denied.");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#1B2A4A]/50 backdrop-blur-md">
      <div className="w-full max-w-sm">
        <NeoCard
          elevation="lg"
          variant="porcelain"
          className="p-6 bg-[#FAF7EE] border-2 border-[#0A0D14] shadow-[6px_6px_0px_#0A0D14] flex flex-col items-center"
        >
          {/* Header Icon */}
          <div className="w-12 h-12 bg-[#22418A] text-[#F2C230] border-2 border-[#0A0D14] flex items-center justify-center mb-4 shadow-[3px_3px_0px_#0A0D14]">
            <Key className="w-6 h-6" />
          </div>

          <Typography {...FontVariant.HeadingBold20} color="#0A0D14" className="text-center mb-1">
            Lighthouse Keeper Terminal
          </Typography>

          <Typography {...FontVariant.BodyRegular13} color="#5A6788" className="text-center mb-6">
            Authenticate to view all visitor activity, reading, scrolling &amp; security logs
          </Typography>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
            <div className="relative w-full">
              <input
                type="password"
                autoFocus
                placeholder="Enter Authorization Key"
                value={password}
                onChange={(e) => {
                  setError("");
                  setPassword(e.target.value);
                }}
                className="w-full bg-[#FFFFFF] border-2 border-[#0A0D14] px-4 py-3 text-sm text-[#0A0D14] placeholder-[#7B8191] outline-none focus:border-[#22418A] text-center font-mono font-bold tracking-widest shadow-[2px_2px_0px_#0A0D14]"
              />
            </div>

            {error && (
              <div className="p-2.5 bg-[#FDE8EC] border border-[#B8304A] flex items-center justify-center gap-1.5 text-xs text-[#B8304A] font-bold">
                <AlertTriangle className="w-4 h-4 flex-none" />
                <span>{error}</span>
              </div>
            )}

            <NeoButton type="submit" variant="primary" size="md" fullWidth className="mt-1">
              Verify &amp; Unlock
            </NeoButton>

            <button
              type="button"
              onClick={onClose}
              className="text-xs text-[#5A6788] hover:text-[#0A0D14] transition-colors py-1 cursor-pointer font-sans"
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
  const [activeTab, setActiveTab] = useState<"visitors" | "telemetry">("visitors");
  const [filterMode, setFilterMode] = useState<"all" | "readers" | "flagged">("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [searchFilter, setSearchFilter] = useState("");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Subscribe to visitor logs & global stats (fetching ALL logs from the start)
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
        const fetched = snap.docs.map((docSnap, idx) => ({
          id: docSnap.id,
          sequence: idx + 1,
          ...docSnap.data(),
        }));
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

  // Sorted and filtered logs
  const processedLogs = useMemo(() => {
    let result = [...logs];
    if (sortOrder === "desc") {
      result.reverse();
    }

    if (filterMode === "readers") {
      result = result.filter(
        (l) =>
          (Array.isArray(l.lettersRead) && l.lettersRead.length > 0) ||
          (Array.isArray(l.openedSections) && l.openedSections.length > 1) ||
          (l.maxScrollPercent && l.maxScrollPercent > 0)
      );
    } else if (filterMode === "flagged") {
      result = result.filter(
        (l) =>
          l.isVpn ||
          l.securityAlert ||
          (Array.isArray(l.securityLogs) && l.securityLogs.length > 0) ||
          (l.securityEvents && l.securityEvents > 0)
      );
    }

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      result = result.filter(
        (l) =>
          (l.ip && l.ip.toLowerCase().includes(q)) ||
          (l.location && l.location.toLowerCase().includes(q)) ||
          (l.isp && l.isp.toLowerCase().includes(q)) ||
          (l.userAgent && l.userAgent.toLowerCase().includes(q)) ||
          (Array.isArray(l.openedSections) && l.openedSections.join(" ").toLowerCase().includes(q)) ||
          (Array.isArray(l.securityLogs) && l.securityLogs.join(" ").toLowerCase().includes(q))
      );
    }
    return result;
  }, [logs, sortOrder, filterMode, searchFilter]);

  const flaggedCount = useMemo(
    () =>
      logs.filter(
        (l) =>
          l.isVpn ||
          l.securityAlert ||
          (Array.isArray(l.securityLogs) && l.securityLogs.length > 0) ||
          (l.securityEvents && l.securityEvents > 0)
      ).length,
    [logs]
  );

  const readersCount = useMemo(
    () =>
      logs.filter(
        (l) =>
          (Array.isArray(l.lettersRead) && l.lettersRead.length > 0) ||
          (l.maxScrollPercent && l.maxScrollPercent > 0)
      ).length,
    [logs]
  );

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

  const handleClearLogs = async () => {
    if (confirm("Purge visitor log history?")) {
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
    if (!logs.length) return;
    const headers = [
      "Index",
      "IP Address",
      "Location",
      "ISP / Org",
      "VPN Detected",
      "VPN Reason",
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
    const rows = logs.map((l) => [
      l.sequence,
      l.ip || "Unknown",
      `"${(l.location || "").replace(/"/g, '""')}"`,
      `"${(l.isp || "").replace(/"/g, '""')}"`,
      l.isVpn ? "YES" : "NO",
      `"${(l.vpnReason || "Direct").replace(/"/g, '""')}"`,
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
    ]);
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
    <div className="w-full min-h-screen bg-[#FAF7EE] text-[#0A0D14] p-3 sm:p-8 font-['Plus_Jakarta_Sans',sans-serif] select-text">
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
                Keeper Silent Intelligence &amp; Activity Terminal
              </Typography>
              <Typography {...FontVariant.BodyRegular13} color="#5A6788">
                Silent real-time tracking of what every visitor opened, read, scrolled, plus VPN &amp; screenshot attempts
              </Typography>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NeoButton
              variant={activeTab === "visitors" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setActiveTab("visitors")}
            >
              Visitor Intelligence ({logs.length})
            </NeoButton>
            <NeoButton
              variant={activeTab === "telemetry" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setActiveTab("telemetry")}
            >
              Counter Controls
            </NeoButton>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <NeoCard elevation="md" variant="porcelain" className="p-4 bg-[#FFFFFF]">
            <div className="flex items-center justify-between pb-2 border-b border-[#0A0D14]/15">
              <Typography {...FontVariant.CapsBold11} color="#5A6788">
                TOTAL VISITS
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
                LOGGED SESSIONS
              </Typography>
              <Users className="w-4 h-4 text-[#22418A]" />
            </div>
            <div className="mt-2.5 font-mono font-bold text-xl sm:text-2xl text-[#0A0D14]">
              {logs.length} Visitors
            </div>
          </NeoCard>

          <NeoCard elevation="md" variant="porcelain" className="p-4 bg-[#FFFFFF]">
            <div className="flex items-center justify-between pb-2 border-b border-[#0A0D14]/15">
              <Typography {...FontVariant.CapsBold11} color="#5A6788">
                LETTERS READERS
              </Typography>
              <BookOpen className="w-4 h-4 text-[#C9892B]" />
            </div>
            <div className="mt-2.5 font-mono font-bold text-xl sm:text-2xl text-[#22418A]">
              {readersCount} Read/Scrolled
            </div>
          </NeoCard>

          <NeoCard elevation="md" variant="porcelain" className="p-4 bg-[#FFFFFF]">
            <div className="flex items-center justify-between pb-2 border-b border-[#0A0D14]/15">
              <Typography {...FontVariant.CapsBold11} color="#5A6788">
                VPN / SCREENSHOTS
              </Typography>
              <CameraOff className="w-4 h-4 text-[#B8304A]" />
            </div>
            <div className="mt-2.5 font-mono font-bold text-xl sm:text-2xl text-[#B8304A]">
              {flaggedCount} Flagged
            </div>
          </NeoCard>
        </div>

        {/* Tab 1: Visitor Intelligence Table */}
        {activeTab === "visitors" && (
          <NeoCard elevation="md" variant="porcelain" className="p-4 sm:p-5 bg-[#FFFFFF]">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b-2 border-[#0A0D14] mb-4">
              {/* Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setFilterMode("all")}
                  className={`px-3 py-1.5 text-xs font-bold border border-[#0A0D14] cursor-pointer transition-all ${
                    filterMode === "all"
                      ? "bg-[#22418A] text-white shadow-[2px_2px_0px_#0A0D14]"
                      : "bg-[#FAF7EE] text-[#0A0D14] hover:bg-white"
                  }`}
                >
                  All Visitors ({logs.length})
                </button>
                <button
                  onClick={() => setFilterMode("readers")}
                  className={`px-3 py-1.5 text-xs font-bold border border-[#0A0D14] cursor-pointer transition-all ${
                    filterMode === "readers"
                      ? "bg-[#C9892B] text-white shadow-[2px_2px_0px_#0A0D14]"
                      : "bg-[#FAF7EE] text-[#0A0D14] hover:bg-white"
                  }`}
                >
                  Opened / Read Letters ({readersCount})
                </button>
                <button
                  onClick={() => setFilterMode("flagged")}
                  className={`px-3 py-1.5 text-xs font-bold border border-[#0A0D14] cursor-pointer transition-all ${
                    filterMode === "flagged"
                      ? "bg-[#B8304A] text-white shadow-[2px_2px_0px_#0A0D14]"
                      : "bg-[#FAF7EE] text-[#0A0D14] hover:bg-white"
                  }`}
                >
                  VPN / Screenshot / Copy ({flaggedCount})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#5A6788]" />
                  <input
                    type="text"
                    placeholder="Search IP, city, ISP, letter..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-8 pr-3 py-1 bg-[#FAF7EE] border border-[#0A0D14] text-xs font-mono outline-none focus:border-[#22418A]"
                  />
                </div>

                {/* Sort Order Toggle */}
                <button
                  onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
                  className="px-2.5 py-1 bg-[#FAF7EE] hover:bg-[#FFFFFF] border border-[#0A0D14] text-xs font-bold flex items-center gap-1 cursor-pointer shadow-[1px_1px_0px_#0A0D14]"
                  title="Toggle Chronological Order"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#22418A]" />
                  <span>{sortOrder === "desc" ? "Latest First" : "From #1 First"}</span>
                </button>

                {/* Export CSV */}
                <button
                  onClick={exportCsv}
                  disabled={!logs.length}
                  className="px-2.5 py-1 bg-[#FAF7EE] hover:bg-[#FFFFFF] disabled:opacity-40 border border-[#0A0D14] text-xs font-bold flex items-center gap-1 cursor-pointer shadow-[1px_1px_0px_#0A0D14]"
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
                  <span>Purge</span>
                </NeoButton>
              </div>
            </div>

            <div className="mb-3 px-3 py-2 bg-[#FFF6D6] border border-[#C9892B] text-[11.5px] text-[#1B2A4A] flex items-center justify-between">
              <span>
                <strong>Silent Mode Active:</strong> Visitors are not notified that their VPN, screenshots, opened tabs,
                letters read, or scroll depth are being logged here. Click any row to expand the full step-by-step
                session timeline.
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm font-mono text-[#5A6788]">
                Loading visitor intelligence logs...
              </div>
            ) : processedLogs.length === 0 ? (
              <div className="p-8 text-center text-sm font-mono text-[#5A6788]">
                No matching visitor logs found.
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
                      <th className="py-2.5 px-2.5">Visitor IP &amp; Network</th>
                      <th className="py-2.5 px-2.5">Dwell</th>
                      <th className="py-2.5 px-2.5">What They Opened</th>
                      <th className="py-2.5 px-2.5">What They Read &amp; Scrolled</th>
                      <th className="py-2.5 px-2.5">VPN / Screenshot / Access Logs</th>
                      <th className="py-2.5 px-2.5">Time (IST)</th>
                      <th className="py-2.5 px-2.5">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedLogs.map((log) => {
                      const isExpanded = expandedRowId === log.id;
                      const dateStr = log.timestamp
                        ? new Date(
                            log.timestamp.toDate ? log.timestamp.toDate() : log.timestamp
                          ).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })
                        : "Live Now";

                      const openedSections: string[] = Array.isArray(log.openedSections)
                        ? log.openedSections
                        : ["Home Seascape"];
                      const lettersRead: number[] = Array.isArray(log.lettersRead) ? log.lettersRead : [];
                      const likedLetters: number[] = Array.isArray(log.likedLetters) ? log.likedLetters : [];
                      const securityLogs: string[] = Array.isArray(log.securityLogs)
                        ? log.securityLogs
                        : log.securityAlert
                        ? [log.securityAlert]
                        : [];
                      const timeline: string[] = Array.isArray(log.activityTimeline) ? log.activityTimeline : [];

                      const hasSecurityFlags = Boolean(log.isVpn || securityLogs.length > 0);

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

                            {/* IP, Location & ISP */}
                            <td className="py-3 px-2.5 min-w-[165px]">
                              <div className="font-bold text-[#0A0D14] text-xs">{log.ip || "Unknown"}</div>
                              {log.location && (
                                <div className="text-[10.5px] text-[#22418A] font-semibold flex items-center gap-1 mt-0.5">
                                  <Globe className="w-3 h-3 shrink-0" />
                                  <span>{log.location}</span>
                                </div>
                              )}
                              {log.isp && (
                                <div className="text-[10px] text-[#5A6788] truncate max-w-[180px]" title={log.isp}>
                                  {log.isp}
                                </div>
                              )}
                              {log.deviceSummary && (
                                <div className="text-[10px] text-[#7B8191] mt-0.5">{log.deviceSummary}</div>
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
                                    Read {lettersRead.length} Letter{lettersRead.length > 1 ? "s" : ""}:{" "}
                                    <span className="text-[#0A0D14]">
                                      {lettersRead
                                        .slice(0, 8)
                                        .map((n) => `#${n}`)
                                        .join(", ")}
                                      {lettersRead.length > 8 ? ` +${lettersRead.length - 8} more` : ""}
                                    </span>
                                  </div>
                                  {typeof log.maxScrollPercent === "number" && log.maxScrollPercent > 0 && (
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
                                      <span>Bookmarked: {likedLetters.map((n) => `#${n}`).join(", ")}</span>
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

                            {/* VPN / Screenshot / Security Logs */}
                            <td className="py-3 px-2.5 min-w-[190px]">
                              <div className="space-y-1">
                                {log.isVpn ? (
                                  <span className="inline-block px-1.5 py-0.5 bg-[#FDE8EC] text-[#B8304A] border border-[#B8304A]/50 font-bold text-[10px]">
                                    ⚠ VPN / Proxy ({log.vpnReason || "Flagged"})
                                  </span>
                                ) : (
                                  <span className="inline-block px-1.5 py-0.5 bg-[#D1FAE5] text-[#065F46] border border-[#065F46]/30 font-bold text-[10px]">
                                    ✓ Direct ISP (No VPN)
                                  </span>
                                )}

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
                                        +{securityLogs.length - 3} more security events (click to view)
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
                                className="p-1 bg-[#FAF7EE] border border-[#0A0D14]/30 hover:bg-[#22418A] hover:text-white transition-colors cursor-pointer"
                                title="View Full Activity Timeline"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Full Session Intelligence Drawer */}
                          {isExpanded && (
                            <tr className="bg-[#FAF7EE] border-b-2 border-[#0A0D14]">
                              <td colSpan={8} className="p-4 sm:p-5">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
                                  {/* Column 1: Network, Device & VPN Profile */}
                                  <div className="p-3.5 bg-white border border-[#0A0D14] space-y-2 text-xs">
                                    <div className="font-bold text-[#0A0D14] uppercase tracking-wider text-[11px] border-b border-[#0A0D14]/15 pb-1.5 flex items-center justify-between">
                                      <span>1. Network &amp; Device Fingerprint</span>
                                      <span className="font-mono text-[#22418A]">#{log.sequence}</span>
                                    </div>
                                    <div className="space-y-1 font-mono text-[11px]">
                                      <div>
                                        <strong>IP Address:</strong> {log.ip || "Unknown"}
                                      </div>
                                      <div>
                                        <strong>Location:</strong> {log.location || "Unknown"}
                                      </div>
                                      <div>
                                        <strong>ISP / ASN:</strong> {log.isp || "Unknown"}
                                      </div>
                                      <div>
                                        <strong>Timezone:</strong> {log.timezone || "—"}
                                      </div>
                                      <div>
                                        <strong>VPN / Proxy Status:</strong>{" "}
                                        <span className={log.isVpn ? "text-[#B8304A] font-bold" : "text-[#065F46] font-bold"}>
                                          {log.isVpn ? `YES (${log.vpnReason})` : "No VPN Detected (Direct)"}
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
                                  <div className="p-3.5 bg-white border border-[#0A0D14] space-y-2 text-xs">
                                    <div className="font-bold text-[#0A0D14] uppercase tracking-wider text-[11px] border-b border-[#0A0D14]/15 pb-1.5">
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
                                        <span className="font-mono">{log.logSheetScrollPercent || 0}%</span>
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
                                          Security / Screenshot / Access Logs ({securityLogs.length}):
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
                                  <div className="p-3.5 bg-white border border-[#0A0D14] space-y-2 text-xs max-h-[260px] overflow-y-auto">
                                    <div className="font-bold text-[#0A0D14] uppercase tracking-wider text-[11px] border-b border-[#0A0D14]/15 pb-1.5">
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

        {/* Tab 2: Telemetry Controls */}
        {activeTab === "telemetry" && (
          <NeoCard elevation="md" variant="porcelain" className="p-6 bg-[#FFFFFF] space-y-6">
            <div>
              <Typography {...FontVariant.HeadingBold18} color="#0A0D14">
                Beacon Telemetry Management
              </Typography>
              <Typography {...FontVariant.BodyRegular13} color="#5A6788">
                Reset or modify live Firestore counters
              </Typography>
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
