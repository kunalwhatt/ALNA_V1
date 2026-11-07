import React, { useState, useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import {
  MapPin,
  Navigation,
  Compass,
  ShieldAlert,
  BookOpen,
  Monitor,
  Layers,
  ExternalLink,
  Crosshair,
  Globe,
  Clock,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { NeoCard } from "./neopop/NeoCard";
import { NeoButton } from "./neopop/NeoButton";
import { Typography } from "./neopop/Typography";
import { FontVariant } from "./neopop/primitives";

export interface ResolvedVisitorGeo {
  id: string;
  sequence: number;
  ip: string;
  ipv4?: string;
  ipv6?: string;
  lat: number;
  lng: number;
  accuracyMeters: number;
  geoSource: "EXACT_DEVICE_GPS" | "IP_NETWORK" | "CITY_RESOLVED";
  exactAddress: string;
  city: string;
  region: string;
  country: string;
  isp: string;
  durationSeconds: number;
  isOwner: boolean;
  isBot: boolean;
  isVpn: boolean;
  hasSecurityFlags: boolean;
  lastErrorCode: string;
  lettersReadCount: number;
  lettersRead: number[];
  maxScrollPercent: number;
  openedSections: string[];
  securityLogs: string[];
  deviceSummary: string;
  timestampStr: string;
  rawLog: any;
}

// Known city coordinate dictionary for older logs that stored city/country text before exact lat/lng
const KNOWN_LOCATION_COORDS: Array<{ match: string; lat: number; lng: number; label: string }> = [
  { match: "hyderabad", lat: 17.385044, lng: 78.486671, label: "Hyderabad, Telangana, India" },
  { match: "secunderabad", lat: 17.4399, lng: 78.4983, label: "Secunderabad, Telangana, India" },
  { match: "telangana", lat: 17.4065, lng: 78.4772, label: "Telangana, India" },
  { match: "visakhapatnam", lat: 17.6868, lng: 83.2185, label: "Visakhapatnam, Andhra Pradesh, India" },
  { match: "vijayawada", lat: 16.5062, lng: 80.648, label: "Vijayawada, Andhra Pradesh, India" },
  { match: "guntur", lat: 16.3067, lng: 80.4365, label: "Guntur, Andhra Pradesh, India" },
  { match: "tirupati", lat: 13.6288, lng: 79.4192, label: "Tirupati, Andhra Pradesh, India" },
  { match: "andhra", lat: 16.5062, lng: 80.648, label: "Andhra Pradesh, India" },
  { match: "bengaluru", lat: 12.971599, lng: 77.594566, label: "Bengaluru, Karnataka, India" },
  { match: "bangalore", lat: 12.971599, lng: 77.594566, label: "Bengaluru, Karnataka, India" },
  { match: "chennai", lat: 13.08268, lng: 80.270718, label: "Chennai, Tamil Nadu, India" },
  { match: "mumbai", lat: 19.075984, lng: 72.877656, label: "Mumbai, Maharashtra, India" },
  { match: "pune", lat: 18.5204, lng: 73.8567, label: "Pune, Maharashtra, India" },
  { match: "delhi", lat: 28.613939, lng: 77.209021, label: "New Delhi, Delhi, India" },
  { match: "noida", lat: 28.5355, lng: 77.391, label: "Noida, Uttar Pradesh, India" },
  { match: "gurgaon", lat: 28.4595, lng: 77.0266, label: "Gurugram, Haryana, India" },
  { match: "gurugram", lat: 28.4595, lng: 77.0266, label: "Gurugram, Haryana, India" },
  { match: "kolkata", lat: 22.5726, lng: 88.3639, label: "Kolkata, West Bengal, India" },
  { match: "ahmedabad", lat: 23.0225, lng: 72.5714, label: "Ahmedabad, Gujarat, India" },
  { match: "jaipur", lat: 26.9124, lng: 75.7873, label: "Jaipur, Rajasthan, India" },
  { match: "kochi", lat: 9.9312, lng: 76.2673, label: "Kochi, Kerala, India" },
  { match: "council bluffs", lat: 41.2619, lng: -95.8608, label: "Council Bluffs, Iowa, USA" },
  { match: "kane", lat: 41.2619, lng: -95.8608, label: "Kane / Council Bluffs, Iowa, USA" },
  { match: "iowa", lat: 41.5868, lng: -93.625, label: "Iowa, USA" },
  { match: "ashburn", lat: 39.0438, lng: -77.4874, label: "Ashburn, Virginia, USA" },
  { match: "singapore", lat: 1.3521, lng: 103.8198, label: "Singapore" },
  { match: "london", lat: 51.5074, lng: -0.1278, label: "London, United Kingdom" },
  { match: "india", lat: 17.385044, lng: 78.486671, label: "India" },
];

// Deterministic micro-offset so multiple visits from the same city don't stack on the exact same pixel
function getDeterministicJitter(seedStr: string, index: number): { dLat: number; dLng: number } {
  let hash = index * 131;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) % 100000;
  }
  const angle = ((hash % 360) * Math.PI) / 180;
  const radius = 0.0025 + ((hash % 17) * 0.0006);
  return {
    dLat: Math.sin(angle) * radius,
    dLng: Math.cos(angle) * radius,
  };
}

export function resolveVisitorGeo(log: any, idx: number): ResolvedVisitorGeo {
  const hasExactCoords =
    typeof log.latitude === "number" &&
    typeof log.longitude === "number" &&
    !Number.isNaN(log.latitude) &&
    !Number.isNaN(log.longitude) &&
    (log.latitude !== 0 || log.longitude !== 0);

  let lat = hasExactCoords ? Number(log.latitude) : 17.385044;
  let lng = hasExactCoords ? Number(log.longitude) : 78.486671;
  let geoSource: "EXACT_DEVICE_GPS" | "IP_NETWORK" | "CITY_RESOLVED" =
    log.geoSource === "EXACT_DEVICE_GPS"
      ? "EXACT_DEVICE_GPS"
      : hasExactCoords
      ? "IP_NETWORK"
      : "CITY_RESOLVED";

  const locLower = `${log.exactAddress || ""} ${log.location || ""} ${log.city || ""} ${
    log.region || ""
  } ${log.ip || ""}`.toLowerCase();

  if (!hasExactCoords) {
    if (log.isOwnerComputed || String(log.ip || "").startsWith("122.177.")) {
      lat = 17.385044;
      lng = 78.486671;
    } else if (
      log.isBotComputed ||
      String(log.ip || "").startsWith("34.") ||
      String(log.ip || "").startsWith("35.")
    ) {
      lat = 41.2619;
      lng = -95.8608;
    } else {
      const matched = KNOWN_LOCATION_COORDS.find((k) => locLower.includes(k.match));
      if (matched) {
        lat = matched.lat;
        lng = matched.lng;
      }
    }
    const jitter = getDeterministicJitter(String(log.id || log.ip || idx), idx);
    lat = Number((lat + jitter.dLat).toFixed(6));
    lng = Number((lng + jitter.dLng).toFixed(6));
  }

  const securityLogs: string[] = Array.isArray(log.securityLogs)
    ? log.securityLogs
    : log.securityAlert
    ? [log.securityAlert]
    : [];

  const hasSecurityFlags = Boolean(
    log.isVpn ||
      log.securityAlert ||
      securityLogs.length > 0 ||
      (log.securityEvents && log.securityEvents > 0)
  );

  const lastErrorCode =
    log.lastErrorCode ||
    (log.isBotComputed
      ? "ERR_BOT_429"
      : log.isVpn
      ? "ERR_VPN_403"
      : hasSecurityFlags
      ? "ERR_CAPTURE_401"
      : "OK_200");

  const lettersRead: number[] = Array.isArray(log.lettersRead) ? log.lettersRead : [];
  const openedSections: string[] = Array.isArray(log.openedSections)
    ? log.openedSections
    : ["Home Seascape"];

  const timestampStr = log.timestamp
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
    : "Live Session";

  const city =
    log.city ||
    (log.location ? String(log.location).split(",")[0]?.trim() : "") ||
    (log.isBotComputed ? "Council Bluffs" : "Hyderabad");
  const region =
    log.region ||
    (log.location ? String(log.location).split(",")[1]?.trim() : "") ||
    (log.isBotComputed ? "Iowa" : "Telangana");
  const country =
    log.country ||
    (log.location ? String(log.location).split(",")[2]?.trim() : "") ||
    (log.isBotComputed ? "USA" : "India");

  return {
    id: log.id || `geo-${idx}`,
    sequence: log.sequence || idx + 1,
    ip: log.ip || "Unknown",
    ipv4: log.ipv4,
    ipv6: log.ipv6,
    lat,
    lng,
    accuracyMeters:
      typeof log.accuracyMeters === "number"
        ? log.accuracyMeters
        : geoSource === "EXACT_DEVICE_GPS"
        ? 14
        : 650,
    geoSource,
    exactAddress:
      log.exactAddress ||
      log.location ||
      [city, region, country].filter(Boolean).join(", ") ||
      `${lat}, ${lng}`,
    city,
    region,
    country,
    isp: log.isp || "Direct ISP",
    durationSeconds: log.durationSeconds || 0,
    isOwner: Boolean(log.isOwnerComputed),
    isBot: Boolean(log.isBotComputed),
    isVpn: Boolean(log.isVpn),
    hasSecurityFlags,
    lastErrorCode,
    lettersReadCount: lettersRead.length,
    lettersRead,
    maxScrollPercent: log.maxScrollPercent || 0,
    openedSections,
    securityLogs,
    deviceSummary: log.deviceSummary || "Browser",
    timestampStr,
    rawLog: log,
  };
}

// Inline Mini Real Map Card for Expanded Row inside Visitor Intelligence Table
export const InlineVisitorMiniMap: React.FC<{
  geo: ResolvedVisitorGeo;
  onOpenInGeoView?: (id: string) => void;
}> = ({ geo, onOpenInGeoView }) => {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapNodeRef.current) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapNodeRef.current, {
      center: [geo.lat, geo.lng],
      zoom: geo.geoSource === "EXACT_DEVICE_GPS" ? 16 : 13,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    const pinColor = geo.isOwner
      ? "#065F46"
      : geo.isBot || geo.hasSecurityFlags
      ? "#B8304A"
      : geo.lettersReadCount > 0
      ? "#C9892B"
      : "#22418A";

    const icon = L.divIcon({
      className: "alna-neopop-mini-pin",
      html: `<div style="
        width: 28px;
        height: 28px;
        background: ${pinColor};
        color: #FFFFFF;
        border: 2px solid #0A0D14;
        box-shadow: 3px 3px 0px #0A0D14;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Outfit', sans-serif;
        font-weight: 900;
        font-size: 10px;
      ">#${geo.sequence}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    L.marker([geo.lat, geo.lng], { icon }).addTo(map);

    L.circle([geo.lat, geo.lng], {
      radius: Math.max(30, Math.min(1200, geo.accuracyMeters)),
      color: pinColor,
      fillColor: pinColor,
      fillOpacity: 0.14,
      weight: 2,
    }).addTo(map);

    mapInstanceRef.current = map;
    setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [geo]);

  return (
    <div className="p-3.5 bg-white border-2 border-[#0A0D14] shadow-[4px_4px_0px_#0A0D14] space-y-2.5 text-xs font-['Outfit','Plus_Jakarta_Sans',sans-serif]">
      <div className="flex items-center justify-between border-b-2 border-[#0A0D14]/15 pb-1.5">
        <span className="font-extrabold text-[#0A0D14] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#B8304A]" />
          <span>4. Exact Device Location &amp; Real Map Pin</span>
        </span>
        <span
          className={`px-2 py-0.5 text-[9.5px] font-extrabold border border-[#0A0D14] uppercase ${
            geo.geoSource === "EXACT_DEVICE_GPS"
              ? "bg-[#D1FAE5] text-[#065F46]"
              : "bg-[#FFF6D6] text-[#0A0D14]"
          }`}
        >
          {geo.geoSource === "EXACT_DEVICE_GPS"
            ? `EXACT GPS (±${geo.accuracyMeters}m)`
            : `NETWORK GEO (±${geo.accuracyMeters}m)`}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
        <div
          ref={mapNodeRef}
          className="sm:col-span-2 w-full h-[185px] border-2 border-[#0A0D14] shadow-[3px_3px_0px_#0A0D14] bg-[#EEF5F3] z-0"
        />

        <div className="space-y-1.5 font-mono text-[11px] bg-[#FAF7EE] p-3 border-2 border-[#0A0D14] shadow-[2px_2px_0px_#0A0D14]">
          <div>
            <strong className="text-[#22418A]">Coordinates:</strong>{" "}
            <span className="font-extrabold text-[#0A0D14]">
              {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}
            </span>
          </div>
          <div>
            <strong className="text-[#22418A]">Exact Address:</strong>{" "}
            <span className="text-[#0A0D14] font-semibold">{geo.exactAddress}</span>
          </div>
          <div>
            <strong className="text-[#22418A]">Precision:</strong>{" "}
            <span>
              {geo.geoSource} (±{geo.accuracyMeters}m)
            </span>
          </div>
          <div className="pt-2 flex flex-wrap gap-1.5">
            {onOpenInGeoView && (
              <button
                type="button"
                onClick={() => onOpenInGeoView(geo.id)}
                className="px-2.5 py-1 bg-[#22418A] text-[#F2C230] border border-[#0A0D14] shadow-[2px_2px_0px_#0A0D14] text-[10px] font-extrabold uppercase tracking-wider cursor-pointer flex items-center gap-1"
              >
                <Compass className="w-3 h-3" />
                <span>Inspect in Geo View</span>
              </button>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${geo.lat},${geo.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 bg-[#FFF6D6] text-[#0A0D14] border border-[#0A0D14] shadow-[2px_2px_0px_#0A0D14] text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3 text-[#C9892B]" />
              <span>Google Maps</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

interface GeoViewModuleProps {
  logs: any[];
  selectedLogId?: string | null;
  onSelectLogId?: (id: string) => void;
}

export const GeoViewModule: React.FC<GeoViewModuleProps> = ({
  logs,
  selectedLogId,
  onSelectLogId,
}) => {
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true
  );
  const [pinFilter, setPinFilter] = useState<
    "all" | "humans" | "gps" | "readers" | "flagged" | "bots"
  >("humans");
  const [mapStyle, setMapStyle] = useState<"warm" | "street" | "satellite">("warm");
  const [activePinId, setActivePinId] = useState<string | null>(selectedLogId || null);
  const [liveAdminGps, setLiveAdminGps] = useState<{
    lat: number;
    lng: number;
    acc: number;
  } | null>(null);
  const [locatingAdmin, setLocatingAdmin] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Enforce Desktop-Only Viewport Listener (>= 1024px)
  useEffect(() => {
    const checkViewport = () => {
      const ua = navigator.userAgent || "";
      const isHandset = /iPhone|iPod|Android.*Mobile/i.test(ua);
      setIsDesktopViewport(window.innerWidth >= 1024 && !isHandset);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  useEffect(() => {
    if (selectedLogId) {
      setActivePinId(selectedLogId);
    }
  }, [selectedLogId]);

  const allGeoItems = useMemo(
    () => logs.map((l, idx) => resolveVisitorGeo(l, idx)).reverse(),
    [logs]
  );

  const filteredGeoItems = useMemo(() => {
    return allGeoItems.filter((item) => {
      if (pinFilter === "humans") return !item.isBot;
      if (pinFilter === "gps") return item.geoSource === "EXACT_DEVICE_GPS";
      if (pinFilter === "readers") return !item.isBot && item.lettersReadCount > 0;
      if (pinFilter === "flagged") return !item.isBot && item.hasSecurityFlags;
      if (pinFilter === "bots") return item.isBot;
      return true;
    });
  }, [allGeoItems, pinFilter]);

  const selectedPin = useMemo(() => {
    if (!filteredGeoItems.length) return allGeoItems[0] || null;
    if (activePinId) {
      const found =
        filteredGeoItems.find((g) => g.id === activePinId) ||
        allGeoItems.find((g) => g.id === activePinId);
      if (found) return found;
    }
    return filteredGeoItems[0];
  }, [filteredGeoItems, allGeoItems, activePinId]);

  // Compute NeoPOP Geo Analytics Metrics
  const geoAnalytics = useMemo(() => {
    const humanGeo = allGeoItems.filter((g) => !g.isBot);
    const exactGpsCount = allGeoItems.filter(
      (g) => g.geoSource === "EXACT_DEVICE_GPS"
    ).length;
    const flaggedGeoCount = allGeoItems.filter(
      (g) => g.hasSecurityFlags || g.isBot
    ).length;

    // Group by City + Region
    const cityMap = new Map<
      string,
      {
        city: string;
        region: string;
        country: string;
        visits: number;
        totalDwell: number;
        readers: number;
        anomalies: number;
        lat: number;
        lng: number;
      }
    >();

    for (const g of humanGeo) {
      const key = `${g.city || "Unknown"}, ${g.region || g.country || ""}`;
      const existing = cityMap.get(key) || {
        city: g.city || "Unknown",
        region: g.region || "",
        country: g.country || "",
        visits: 0,
        totalDwell: 0,
        readers: 0,
        anomalies: 0,
        lat: g.lat,
        lng: g.lng,
      };
      existing.visits += 1;
      existing.totalDwell += g.durationSeconds || 0;
      if (g.lettersReadCount > 0) existing.readers += 1;
      if (g.hasSecurityFlags) existing.anomalies += 1;
      cityMap.set(key, existing);
    }

    const cityBreakdown = Array.from(cityMap.values()).sort(
      (a, b) => b.visits - a.visits
    );

    // Group by Error Code
    const errorMap = new Map<string, number>();
    for (const g of allGeoItems) {
      if (g.lastErrorCode && g.lastErrorCode !== "OK_200") {
        errorMap.set(g.lastErrorCode, (errorMap.get(g.lastErrorCode) || 0) + 1);
      }
    }
    const errorBreakdown = Array.from(errorMap.entries()).sort((a, b) => b[1] - a[1]);

    return {
      totalPinned: allGeoItems.length,
      humanPinned: humanGeo.length,
      exactGpsCount,
      flaggedGeoCount,
      uniqueCities: cityBreakdown.length,
      topCity: cityBreakdown[0]?.city || "Hyderabad",
      cityBreakdown: cityBreakdown.slice(0, 8),
      errorBreakdown,
    };
  }, [allGeoItems]);

  // Initialize Leaflet Interactive Map on Desktop
  useEffect(() => {
    if (!isDesktopViewport || mapStyle === "satellite" || !mapContainerRef.current) {
      return;
    }

    if (!leafletMapRef.current) {
      const initialCenter: [number, number] = selectedPin
        ? [selectedPin.lat, selectedPin.lng]
        : [17.385044, 78.486671];

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 5,
        zoomControl: true,
        attributionControl: false,
      });

      const tileUrl =
        mapStyle === "warm"
          ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

      tileLayerRef.current = L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map);
      markersLayerRef.current = L.layerGroup().addTo(map);
      leafletMapRef.current = map;

      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    } else if (tileLayerRef.current) {
      const tileUrl =
        mapStyle === "warm"
          ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
      tileLayerRef.current.setUrl(tileUrl);
    }
  }, [isDesktopViewport, mapStyle, selectedPin]);

  // Cleanup map when unmounting or switching to satellite iframe
  useEffect(() => {
    if (mapStyle === "satellite" && leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
      markersLayerRef.current = null;
      tileLayerRef.current = null;
    }
  }, [mapStyle]);

  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Render NeoPOP Pins onto Leaflet Map whenever filtered items or selectedPin changes
  useEffect(() => {
    const map = leafletMapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer || mapStyle === "satellite") return;

    layer.clearLayers();

    filteredGeoItems.forEach((item) => {
      const isSelected = selectedPin?.id === item.id;
      const bg = item.isOwner
        ? "#065F46"
        : item.isBot || item.hasSecurityFlags
        ? "#B8304A"
        : item.lettersReadCount > 0
        ? "#C9892B"
        : "#22418A";

      const size = isSelected ? 36 : 28;
      const zOffset = isSelected ? 1000 : 100;

      const icon = L.divIcon({
        className: "alna-geo-pin",
        html: `<div style="
          width: ${size}px;
          height: ${size}px;
          background: ${bg};
          color: ${isSelected ? "#F2C230" : "#FFFFFF"};
          border: ${isSelected ? "3px" : "2px"} solid #0A0D14;
          box-shadow: ${isSelected ? "4px 4px 0px #0A0D14" : "2px 2px 0px #0A0D14"};
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Outfit', sans-serif;
          font-weight: 900;
          font-size: ${isSelected ? "11px" : "10px"};
          transform: ${isSelected ? "scale(1.08)" : "scale(1)"};
          transition: all 0.15s ease;
          cursor: pointer;
        ">#${item.sequence}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([item.lat, item.lng], {
        icon,
        zIndexOffset: zOffset,
      });

      marker.on("click", () => {
        setActivePinId(item.id);
        if (onSelectLogId) onSelectLogId(item.id);
        map.flyTo([item.lat, item.lng], item.geoSource === "EXACT_DEVICE_GPS" ? 15 : 12, {
          duration: 0.8,
        });
      });

      marker.addTo(layer);

      if (isSelected) {
        L.circle([item.lat, item.lng], {
          radius: Math.max(35, Math.min(1500, item.accuracyMeters)),
          color: bg,
          fillColor: bg,
          fillOpacity: 0.15,
          weight: 2,
        }).addTo(layer);
      }
    });

    if (liveAdminGps) {
      const adminIcon = L.divIcon({
        className: "alna-admin-live-gps",
        html: `<div style="
          padding: 3px 6px;
          background: #F2C230;
          color: #0A0D14;
          border: 2px solid #0A0D14;
          box-shadow: 3px 3px 0px #0A0D14;
          font-family: 'Outfit', sans-serif;
          font-weight: 900;
          font-size: 9px;
          white-space: nowrap;
        ">★ KEEPER LIVE GPS</div>`,
        iconSize: [110, 24],
        iconAnchor: [55, 12],
      });
      L.marker([liveAdminGps.lat, liveAdminGps.lng], {
        icon: adminIcon,
        zIndexOffset: 2000,
      }).addTo(layer);
    }
  }, [filteredGeoItems, selectedPin, mapStyle, liveAdminGps, onSelectLogId]);

  const handleFlyToPin = (item: ResolvedVisitorGeo) => {
    setActivePinId(item.id);
    if (onSelectLogId) onSelectLogId(item.id);
    if (leafletMapRef.current && mapStyle !== "satellite") {
      leafletMapRef.current.flyTo(
        [item.lat, item.lng],
        item.geoSource === "EXACT_DEVICE_GPS" ? 15 : 12,
        { duration: 0.85 }
      );
    }
  };

  const handlePingMyExactGps = () => {
    if (!("geolocation" in navigator)) return;
    setLocatingAdmin(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const acc = Math.round(pos.coords.accuracy || 10);
        setLiveAdminGps({ lat, lng, acc });
        setLocatingAdmin(false);
        if (leafletMapRef.current && mapStyle !== "satellite") {
          leafletMapRef.current.flyTo([lat, lng], 16, { duration: 0.9 });
        }
      },
      () => {
        setLocatingAdmin(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // DESKTOP-ONLY GATE: Centered 75% NeoPOP Error Module (ERR_GEO_DESKTOP_405) if opened on Mobile/Tablet (<1024px)
  if (!isDesktopViewport) {
    return (
      <div className="fixed inset-0 z-[9200] bg-[#1B2A4A]/45 backdrop-blur-md flex items-center justify-center select-none font-['Outfit','Plus_Jakarta_Sans',sans-serif]">
        <div className="w-[75vw] max-w-[350px] max-h-[75dvh] mx-auto my-auto flex items-center justify-center">
          <NeoCard
            elevation="lg"
            variant="porcelain"
            className="w-full p-5 bg-[#FAF7EE] border-2 border-[#0A0D14] shadow-[6px_6px_0px_#0A0D14] flex flex-col items-center text-center"
          >
            <div className="w-full flex items-center justify-between pb-2 mb-2.5 border-b-2 border-[#0A0D14]/15">
              <span className="px-2 py-0.5 bg-[#B8304A] text-white border border-[#0A0D14] text-[9.5px] font-extrabold uppercase tracking-wider shadow-[2px_2px_0px_#0A0D14]">
                ERR_GEO_DESKTOP_405
              </span>
              <span className="px-2 py-0.5 bg-[#FFF6D6] text-[#0A0D14] border border-[#0A0D14] text-[9.5px] font-extrabold uppercase tracking-wider">
                DESKTOP ONLY
              </span>
            </div>

            <div className="w-10 h-10 bg-[#22418A] text-[#F2C230] border-2 border-[#0A0D14] shadow-[3px_3px_0px_#0A0D14] flex items-center justify-center mb-2.5">
              <Monitor className="w-5 h-5" />
            </div>

            <Typography {...FontVariant.CapsBold10} color="#B8304A" className="mb-0.5">
              VIEWPORT RESTRICTED
            </Typography>

            <Typography {...FontVariant.HeadingBold18} color="#0A0D14" className="mb-1.5">
              Geo View Requires Desktop
            </Typography>

            <Typography {...FontVariant.BodyRegular12} color="#5A6788" className="mb-3">
              The <strong>Geo View &amp; Real Map Analytics</strong> module is exclusively
              engineered for Desktop Keeper terminals (≥1024px). Please open on your MacBook
              or desktop display.
            </Typography>
          </NeoCard>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 font-['Outfit','Plus_Jakarta_Sans',sans-serif]">
      {/* 1. NeoPOP Geo Analytics KPI Strip */}
      <div className="grid grid-cols-4 gap-4">
        <NeoCard
          elevation="md"
          variant="porcelain"
          className="p-4 bg-[#FAF7EE] border-2 border-[#0A0D14] shadow-[4px_4px_0px_#0A0D14]"
        >
          <div className="flex items-center justify-between pb-2 border-b-2 border-[#0A0D14]/15">
            <Typography {...FontVariant.CapsBold10} color="#22418A">
              PINNED LOCATIONS
            </Typography>
            <MapPin className="w-4 h-4 text-[#22418A]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#0A0D14] tabular-nums">
              {geoAnalytics.totalPinned} Pins
            </span>
            <span className="px-2 py-0.5 bg-[#FFF6D6] border border-[#0A0D14] text-[10px] font-extrabold text-[#0A0D14]">
              {geoAnalytics.uniqueCities} Cities
            </span>
          </div>
        </NeoCard>

        <NeoCard
          elevation="md"
          variant="porcelain"
          className="p-4 bg-[#FAF7EE] border-2 border-[#0A0D14] shadow-[4px_4px_0px_#0A0D14]"
        >
          <div className="flex items-center justify-between pb-2 border-b-2 border-[#0A0D14]/15">
            <Typography {...FontVariant.CapsBold10} color="#065F46">
              EXACT GPS vs IP GEO
            </Typography>
            <Crosshair className="w-4 h-4 text-[#065F46]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#065F46] tabular-nums">
              {geoAnalytics.exactGpsCount} Exact GPS
            </span>
            <span className="px-2 py-0.5 bg-[#D1FAE5] border border-[#0A0D14] text-[10px] font-extrabold text-[#065F46]">
              ±5m–25m
            </span>
          </div>
        </NeoCard>

        <NeoCard
          elevation="md"
          variant="porcelain"
          className="p-4 bg-[#FAF7EE] border-2 border-[#0A0D14] shadow-[4px_4px_0px_#0A0D14]"
        >
          <div className="flex items-center justify-between pb-2 border-b-2 border-[#0A0D14]/15">
            <Typography {...FontVariant.CapsBold10} color="#C9892B">
              TOP VISITOR HUB
            </Typography>
            <Globe className="w-4 h-4 text-[#C9892B]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-[#0A0D14] truncate">
              {geoAnalytics.topCity}
            </span>
            <span className="px-2 py-0.5 bg-[#FFF6D6] border border-[#0A0D14] text-[10px] font-extrabold text-[#C9892B]">
              ACTIVE
            </span>
          </div>
        </NeoCard>

        <NeoCard
          elevation="md"
          variant="porcelain"
          className="p-4 bg-[#FAF7EE] border-2 border-[#0A0D14] shadow-[4px_4px_0px_#0A0D14]"
        >
          <div className="flex items-center justify-between pb-2 border-b-2 border-[#0A0D14]/15">
            <Typography {...FontVariant.CapsBold10} color="#B8304A">
              GEO ANOMALY PINS
            </Typography>
            <ShieldAlert className="w-4 h-4 text-[#B8304A]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#B8304A] tabular-nums">
              {geoAnalytics.flaggedGeoCount} Flagged
            </span>
            <span className="px-2 py-0.5 bg-[#FDE8EC] border border-[#0A0D14] text-[10px] font-extrabold text-[#B8304A]">
              ERR CODES
            </span>
          </div>
        </NeoCard>
      </div>

      {/* 2. NeoPOP Map Controls & Filter Toolbar */}
      <NeoCard
        elevation="md"
        variant="porcelain"
        className="p-4 bg-[#FFFFFF] border-2 border-[#0A0D14] shadow-[6px_6px_0px_#0A0D14]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b-2 border-[#0A0D14]">
          {/* Pin Category Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "humans", label: `Human Pins (${geoAnalytics.humanPinned})` },
                { id: "all", label: `All Pins (${geoAnalytics.totalPinned})` },
                { id: "gps", label: `Exact Device GPS (${geoAnalytics.exactGpsCount})` },
                { id: "readers", label: "Letters Readers" },
                { id: "flagged", label: `Anomaly / Flagged (${geoAnalytics.flaggedGeoCount})` },
                { id: "bots", label: "Blocked Cloud Bots" },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setPinFilter(btn.id)}
                className={`px-3 py-1.5 text-xs font-extrabold border-2 border-[#0A0D14] cursor-pointer transition-all ${
                  pinFilter === btn.id
                    ? "bg-[#22418A] text-[#F2C230] shadow-[3px_3px_0px_#0A0D14]"
                    : "bg-[#FAF7EE] text-[#0A0D14] hover:bg-[#FFF6D6]"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Map Layer Switcher & Live GPS Ping */}
          <div className="flex items-center gap-2">
            <div className="flex items-center border-2 border-[#0A0D14] bg-[#FAF7EE] shadow-[2px_2px_0px_#0A0D14]">
              <button
                type="button"
                onClick={() => setMapStyle("warm")}
                className={`px-2.5 py-1 text-[11px] font-extrabold cursor-pointer ${
                  mapStyle === "warm" ? "bg-[#22418A] text-white" : "text-[#0A0D14]"
                }`}
              >
                Neo Warm Map
              </button>
              <button
                type="button"
                onClick={() => setMapStyle("street")}
                className={`px-2.5 py-1 text-[11px] font-extrabold border-l-2 border-[#0A0D14] cursor-pointer ${
                  mapStyle === "street" ? "bg-[#22418A] text-white" : "text-[#0A0D14]"
                }`}
              >
                OSM Street
              </button>
              <button
                type="button"
                onClick={() => setMapStyle("satellite")}
                className={`px-2.5 py-1 text-[11px] font-extrabold border-l-2 border-[#0A0D14] cursor-pointer ${
                  mapStyle === "satellite" ? "bg-[#C9892B] text-white" : "text-[#0A0D14]"
                }`}
              >
                Google Satellite Pin
              </button>
            </div>

            <button
              type="button"
              onClick={handlePingMyExactGps}
              disabled={locatingAdmin}
              className="px-3 py-1.5 bg-[#FFF6D6] hover:bg-[#F2C230] text-[#0A0D14] border-2 border-[#0A0D14] shadow-[2px_2px_0px_#0A0D14] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5 text-[#22418A]" />
              <span>{locatingAdmin ? "Locating..." : "Ping My Exact GPS"}</span>
            </button>
          </div>
        </div>

        {/* Main Split Layout: Left 8 Columns Interactive Map | Right 4 Columns Pin Intelligence Inspector */}
        <div className="grid grid-cols-12 gap-4 items-stretch">
          {/* Interactive Map Canvas */}
          <div className="col-span-8 flex flex-col gap-2">
            <div className="relative w-full h-[520px] border-2 border-[#0A0D14] shadow-[5px_5px_0px_#0A0D14] bg-[#EEF5F3] overflow-hidden">
              {mapStyle === "satellite" && selectedPin ? (
                <iframe
                  title="Google Maps Exact Pin View"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${selectedPin.lat},${selectedPin.lng}&t=k&z=16&ie=UTF8&iwloc=&output=embed`}
                />
              ) : (
                <div ref={mapContainerRef} className="w-full h-full z-0" />
              )}

              {/* Floating NeoPOP Legend inside Map */}
              <div className="absolute bottom-3 left-3 z-[500] bg-[#FAF7EE]/95 border-2 border-[#0A0D14] shadow-[3px_3px_0px_#0A0D14] p-2.5 flex flex-wrap items-center gap-3 text-[10.5px] font-extrabold">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-[#065F46] border border-[#0A0D14] inline-block" />
                  <span>Owner (Kunal)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-[#22418A] border border-[#0A0D14] inline-block" />
                  <span>Direct Human</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-[#C9892B] border border-[#0A0D14] inline-block" />
                  <span>Read Letters</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-[#B8304A] border border-[#0A0D14] inline-block" />
                  <span>Anomaly / VPN / Bot</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Selected Pin Intelligence Inspector + Scrollable Pin Roster */}
          <div className="col-span-4 flex flex-col gap-3 h-[520px]">
            {selectedPin ? (
              <div className="p-3.5 bg-[#FAF7EE] border-2 border-[#0A0D14] shadow-[4px_4px_0px_#0A0D14] space-y-2 text-xs shrink-0">
                <div className="flex items-center justify-between pb-2 border-b-2 border-[#0A0D14]/15">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 bg-[#22418A] text-[#F2C230] border border-[#0A0D14] font-black text-xs">
                      #{selectedPin.sequence}
                    </span>
                    <span className="font-extrabold text-[#0A0D14] text-sm">
                      {selectedPin.ip}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 border border-[#0A0D14] text-[9.5px] font-extrabold uppercase ${
                      selectedPin.lastErrorCode === "OK_200"
                        ? "bg-[#D1FAE5] text-[#065F46]"
                        : "bg-[#B8304A] text-white"
                    }`}
                  >
                    {selectedPin.lastErrorCode}
                  </span>
                </div>

                <div className="space-y-1 font-mono text-[11px] text-[#0A0D14]">
                  <div>
                    <strong className="text-[#22418A]">Exact Coords:</strong>{" "}
                    <span className="font-extrabold">
                      {selectedPin.lat.toFixed(6)}, {selectedPin.lng.toFixed(6)}
                    </span>
                  </div>
                  <div>
                    <strong className="text-[#22418A]">Geo Source:</strong>{" "}
                    <span
                      className={`font-extrabold ${
                        selectedPin.geoSource === "EXACT_DEVICE_GPS"
                          ? "text-[#065F46]"
                          : "text-[#C9892B]"
                      }`}
                    >
                      {selectedPin.geoSource} (±{selectedPin.accuracyMeters}m)
                    </span>
                  </div>
                  <div>
                    <strong className="text-[#22418A]">Address:</strong>{" "}
                    <span className="font-semibold">{selectedPin.exactAddress}</span>
                  </div>
                  <div>
                    <strong className="text-[#22418A]">ISP / Org:</strong> {selectedPin.isp}
                  </div>
                  <div>
                    <strong className="text-[#22418A]">Device:</strong>{" "}
                    {selectedPin.deviceSummary}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <div className="p-1.5 bg-white border border-[#0A0D14]">
                      <span className="text-[9.5px] text-[#5A6788] block uppercase font-bold">
                        Dwell Time
                      </span>
                      <span className="font-extrabold text-xs text-[#0A0D14]">
                        {selectedPin.durationSeconds}s
                      </span>
                    </div>
                    <div className="p-1.5 bg-white border border-[#0A0D14]">
                      <span className="text-[9.5px] text-[#5A6788] block uppercase font-bold">
                        Letters Read
                      </span>
                      <span className="font-extrabold text-xs text-[#22418A]">
                        {selectedPin.lettersReadCount} ({selectedPin.maxScrollPercent}% scroll)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between gap-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${selectedPin.lat},${selectedPin.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1.5 px-2.5 bg-[#22418A] text-[#F2C230] border-2 border-[#0A0D14] shadow-[2px_2px_0px_#0A0D14] text-[10.5px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open Exact Pin in Google Maps</span>
                  </a>
                </div>
              </div>
            ) : null}

            {/* Scrollable Pin Roster */}
            <div className="flex-1 bg-[#FAF7EE] border-2 border-[#0A0D14] shadow-[4px_4px_0px_#0A0D14] flex flex-col min-h-0">
              <div className="px-3 py-2 bg-[#FFF6D6] border-b-2 border-[#0A0D14] text-[11px] font-extrabold uppercase tracking-wider text-[#0A0D14] flex items-center justify-between">
                <span>Pinned Devices Roster ({filteredGeoItems.length})</span>
                <span className="text-[10px] text-[#22418A]">Click to Fly</span>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-[#0A0D14]/15">
                {filteredGeoItems.map((item) => {
                  const active = selectedPin?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleFlyToPin(item)}
                      className={`w-full text-left px-3 py-2 transition-colors flex items-start justify-between gap-2 cursor-pointer ${
                        active ? "bg-[#FFF6D6]" : "hover:bg-white"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-[11px] text-[#B8304A]">
                            #{item.sequence}
                          </span>
                          <span className="font-mono font-bold text-xs text-[#0A0D14] truncate">
                            {item.ip}
                          </span>
                          {item.geoSource === "EXACT_DEVICE_GPS" && (
                            <span className="px-1 py-0.2 bg-[#D1FAE5] border border-[#065F46] text-[8.5px] font-extrabold text-[#065F46]">
                              GPS
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] text-[#22418A] font-semibold truncate">
                          {item.city}, {item.region || item.country}
                        </div>
                        <div className="text-[9.5px] font-mono text-[#5A6788]">
                          {item.lat.toFixed(4)}, {item.lng.toFixed(4)} • {item.timestampStr}
                        </div>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 border border-[#0A0D14] text-[9px] font-extrabold shrink-0 ${
                          item.isOwner
                            ? "bg-[#D1FAE5] text-[#065F46]"
                            : item.isBot || item.hasSecurityFlags
                            ? "bg-[#FDE8EC] text-[#B8304A]"
                            : "bg-[#FFFFFF] text-[#0A0D14]"
                        }`}
                      >
                        {item.lastErrorCode}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </NeoCard>

      {/* 3. NeoPOP Geo Analytics Breakdown Grid (City Distribution & Error Code Hotspots) */}
      <div className="grid grid-cols-12 gap-4">
        {/* City & Region Engagement Analytics */}
        <NeoCard
          elevation="md"
          variant="porcelain"
          className="col-span-7 p-4 bg-[#FFFFFF] border-2 border-[#0A0D14] shadow-[5px_5px_0px_#0A0D14]"
        >
          <div className="flex items-center justify-between pb-2.5 mb-3 border-b-2 border-[#0A0D14]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C9892B]" />
              <Typography {...FontVariant.HeadingBold16} color="#0A0D14">
                Geo Analytics • Visitor Cities &amp; Reading Depth
              </Typography>
            </div>
            <span className="px-2 py-0.5 bg-[#FFF6D6] border border-[#0A0D14] text-[10px] font-extrabold text-[#0A0D14]">
              REAL-TIME REGIONAL BREAKDOWN
            </span>
          </div>

          <div className="space-y-2.5">
            {geoAnalytics.cityBreakdown.length === 0 ? (
              <div className="text-xs text-[#5A6788] py-4 text-center">
                No human city telemetry recorded yet.
              </div>
            ) : (
              geoAnalytics.cityBreakdown.map((c, idx) => {
                const maxVisits = Math.max(1, geoAnalytics.cityBreakdown[0]?.visits || 1);
                const widthPct = Math.max(12, Math.round((c.visits / maxVisits) * 100));
                const avgDwell = Math.round(c.totalDwell / Math.max(1, c.visits));
                return (
                  <div
                    key={idx}
                    className="p-2.5 bg-[#FAF7EE] border-2 border-[#0A0D14] shadow-[2px_2px_0px_#0A0D14] space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs font-extrabold">
                      <span className="text-[#0A0D14] flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#22418A]" />
                        <span>
                          {c.city}
                          {c.region ? `, ${c.region}` : ""} ({c.country})
                        </span>
                      </span>
                      <div className="flex items-center gap-2 text-[10.5px] font-mono">
                        <span className="px-1.5 py-0.5 bg-[#22418A] text-[#F2C230] border border-[#0A0D14]">
                          {c.visits} {c.visits === 1 ? "Visit" : "Visits"}
                        </span>
                        <span className="px-1.5 py-0.5 bg-[#FFF6D6] text-[#0A0D14] border border-[#0A0D14] flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-[#C9892B]" />
                          <span>Avg {avgDwell}s</span>
                        </span>
                        <span className="px-1.5 py-0.5 bg-white text-[#22418A] border border-[#0A0D14] flex items-center gap-1">
                          <BookOpen className="w-2.5 h-2.5 text-[#22418A]" />
                          <span>{c.readers} Readers</span>
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2.5 bg-white border border-[#0A0D14] overflow-hidden">
                      <div
                        style={{ width: `${widthPct}%` }}
                        className="h-full bg-[#22418A] border-r border-[#0A0D14]"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </NeoCard>

        {/* Security Anomaly & Error Code Telemetry by Geo */}
        <NeoCard
          elevation="md"
          variant="porcelain"
          className="col-span-5 p-4 bg-[#FFFFFF] border-2 border-[#0A0D14] shadow-[5px_5px_0px_#0A0D14] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b-2 border-[#0A0D14]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#B8304A]" />
                <Typography {...FontVariant.HeadingBold16} color="#0A0D14">
                  Security &amp; Anomaly Error Codes
                </Typography>
              </div>
              <span className="px-2 py-0.5 bg-[#FDE8EC] border border-[#0A0D14] text-[10px] font-extrabold text-[#B8304A]">
                NEOPOP MATRIX
              </span>
            </div>

            <div className="space-y-2">
              {[
                {
                  code: "ERR_CAPTURE_401",
                  desc: "Screenshot / PrintScreen / Multi-Touch Gesture",
                  color: "#B8304A",
                },
                {
                  code: "ERR_RECORD_402",
                  desc: "Screen Recording / MediaStream / PiP / Recorder Bar",
                  color: "#B8304A",
                },
                {
                  code: "ERR_VPN_403",
                  desc: "VPN / Proxy / Anonymizer Routing Mismatch",
                  color: "#C9892B",
                },
                {
                  code: "ERR_DEVTOOLS_406",
                  desc: "Developer Tools / Source Inspection Attempt",
                  color: "#22418A",
                },
                {
                  code: "ERR_COPY_407",
                  desc: "Clipboard Copy / Right-Click Context Attempt",
                  color: "#C9892B",
                },
                {
                  code: "ERR_FOCUS_408",
                  desc: "Window Focus Switch / Capture Shade Opened",
                  color: "#22418A",
                },
                {
                  code: "ERR_ANOMALY_409",
                  desc: "Rapid Clicking / Behavioral Scraping Anomaly",
                  color: "#B8304A",
                },
                {
                  code: "ERR_BOT_429",
                  desc: "Automated Google Cloud / Datacenter Scanner",
                  color: "#0A0D14",
                },
              ].map((item) => {
                const count =
                  geoAnalytics.errorBreakdown.find(([k]) => k === item.code)?.[1] || 0;
                return (
                  <div
                    key={item.code}
                    className="p-2 bg-[#FAF7EE] border border-[#0A0D14] flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span
                        style={{ backgroundColor: item.color }}
                        className="px-1.5 py-0.5 text-white border border-[#0A0D14] font-mono text-[9.5px] font-extrabold mr-2"
                      >
                        {item.code}
                      </span>
                      <span className="text-[11px] font-bold text-[#0A0D14]">
                        {item.desc}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 bg-white border border-[#0A0D14] font-mono text-[11px] font-black text-[#0A0D14] shrink-0">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 p-2.5 bg-[#FFF6D6] border-2 border-[#0A0D14] text-[11px] font-semibold text-[#0A0D14]">
            <strong className="text-[#B8304A]">Live Anomaly Gate Active:</strong> Any visitor
            triggering an error code above is immediately locked into the centered 75% NeoPOP
            Human Verification CAPTCHA with the exact cause displayed.
          </div>
        </NeoCard>
      </div>
    </div>
  );
};
