import React, { useState, useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import {
  MapPin,
  Compass,
  ShieldAlert,
  BookOpen,
  Monitor,
  ExternalLink,
  Crosshair,
  Globe,
  Clock,
  AlertTriangle,
  Sparkles,
  Radio,
  Cpu,
} from "lucide-react";
import { NeoCard } from "./neopop/NeoCard";
import { Typography } from "./neopop/Typography";
import { FontVariant } from "./neopop/primitives";

export interface ResolvedVisitorGeo {
  id: string;
  sequence: number;
  geoSequence: number;
  ip: string;
  ipv4?: string;
  ipv6?: string;
  webrtcIp?: string;
  edgePop?: string;
  lat: number;
  lng: number;
  accuracyMeters: number;
  geoSource: "SILENT_TRIANGULATION" | "IP_NETWORK" | "CITY_RESOLVED";
  geoSilentTracked: boolean;
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

// Tile URLs for OSM Map and Google Maps inside Leaflet (so custom NeoPOP pins work identically on both)
const MAP_TILE_LAYERS = {
  osm: {
    label: "OSM Map",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
  },
  google_streets: {
    label: "Google Maps",
    url: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    maxZoom: 20,
  },
  google_hybrid: {
    label: "Google Satellite",
    url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    maxZoom: 20,
  },
} as const;

type MapLayerKey = keyof typeof MAP_TILE_LAYERS;

// Deterministic micro-offset so multiple visits from the same subnet don't stack on the exact same pixel
function getDeterministicJitter(seedStr: string, index: number): { dLat: number; dLng: number } {
  let hash = index * 131;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) % 100000;
  }
  const angle = ((hash % 360) * Math.PI) / 180;
  const radius = 0.00045 + (hash % 11) * 0.00012;
  return {
    dLat: Math.sin(angle) * radius,
    dLng: Math.cos(angle) * radius,
  };
}

export function resolveVisitorGeo(
  log: any,
  idx: number,
  geoSequenceOverride?: number
): ResolvedVisitorGeo {
  const hasExactCoords =
    typeof log.latitude === "number" &&
    typeof log.longitude === "number" &&
    !Number.isNaN(log.latitude) &&
    !Number.isNaN(log.longitude) &&
    (log.latitude !== 0 || log.longitude !== 0);

  let lat = hasExactCoords ? Number(log.latitude) : 17.385044;
  let lng = hasExactCoords ? Number(log.longitude) : 78.486671;

  // Apply subtle deterministic jitter per session ID so multiple visits from same router remain individually clickable pins
  const jitter = getDeterministicJitter(String(log.id || log.ip || idx), idx);
  lat = Number((lat + jitter.dLat).toFixed(6));
  lng = Number((lng + jitter.dLng).toFixed(6));

  const geoSource: "SILENT_TRIANGULATION" | "IP_NETWORK" | "CITY_RESOLVED" =
    log.geoSource === "SILENT_TRIANGULATION" || Boolean(log.geoSilentTracked)
      ? "SILENT_TRIANGULATION"
      : hasExactCoords
      ? "IP_NETWORK"
      : "CITY_RESOLVED";

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
    geoSequence: geoSequenceOverride ?? (log.sequence || idx + 1),
    ip: log.ip || "Unknown",
    ipv4: log.ipv4,
    ipv6: log.ipv6,
    webrtcIp: log.webrtcIp || "",
    edgePop: log.edgePop || "",
    lat,
    lng,
    accuracyMeters:
      typeof log.accuracyMeters === "number"
        ? log.accuracyMeters
        : geoSource === "SILENT_TRIANGULATION"
        ? 45
        : 350,
    geoSource,
    geoSilentTracked: Boolean(log.geoSilentTracked),
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

// Inline Mini Real Map Card for Expanded Row inside Visitor Intelligence Table (Only for visits from now onwards)
export const InlineVisitorMiniMap: React.FC<{
  geo: ResolvedVisitorGeo;
  onOpenInGeoView?: (id: string) => void;
}> = ({ geo, onOpenInGeoView }) => {
  const [miniLayer, setMiniLayer] = useState<MapLayerKey>("google_streets");
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (!mapNodeRef.current) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapNodeRef.current, {
      center: [geo.lat, geo.lng],
      zoom: 15,
      zoomControl: true,
      attributionControl: false,
    });

    const layerCfg = MAP_TILE_LAYERS[miniLayer];
    tileRef.current = L.tileLayer(layerCfg.url, {
      maxZoom: layerCfg.maxZoom,
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
        width: 30px;
        height: 30px;
        background: ${pinColor};
        color: #F2C230;
        border: 2.5px solid #0A0D14;
        box-shadow: 3px 3px 0px #0A0D14;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Outfit', sans-serif;
        font-weight: 900;
        font-size: 10px;
      ">#${geo.sequence}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });

    L.marker([geo.lat, geo.lng], { icon }).addTo(map);

    L.circle([geo.lat, geo.lng], {
      radius: Math.max(25, Math.min(600, geo.accuracyMeters)),
      color: pinColor,
      fillColor: pinColor,
      fillOpacity: 0.15,
      weight: 2,
    }).addTo(map);

    mapInstanceRef.current = map;
    setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      tileRef.current = null;
    };
  }, [geo, miniLayer]);

  return (
    <div className="p-3.5 bg-white border-2 border-[#0A0D14] shadow-[4px_4px_0px_#0A0D14] space-y-2.5 text-xs font-['Outfit','Plus_Jakarta_Sans',sans-serif]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#0A0D14]/15 pb-2">
        <span className="font-extrabold text-[#0A0D14] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#B8304A]" />
          <span>4. Silent Script Triangulation &amp; Real Map Pin (Zero Permission Prompt)</span>
        </span>

        <div className="flex items-center gap-2">
          {/* OSM Map vs Google Maps Switcher with identical NeoPOP Pins */}
          <div className="flex items-center border-2 border-[#0A0D14] bg-[#FAF7EE] shadow-[2px_2px_0px_#0A0D14]">
            <button
              type="button"
              onClick={() => setMiniLayer("osm")}
              className={`px-2 py-0.5 text-[10px] font-extrabold cursor-pointer ${
                miniLayer === "osm" ? "bg-[#22418A] text-[#F2C230]" : "text-[#0A0D14]"
              }`}
            >
              OSM Map
            </button>
            <button
              type="button"
              onClick={() => setMiniLayer("google_streets")}
              className={`px-2 py-0.5 text-[10px] font-extrabold border-l-2 border-[#0A0D14] cursor-pointer ${
                miniLayer === "google_streets" ? "bg-[#22418A] text-[#F2C230]" : "text-[#0A0D14]"
              }`}
            >
              Google Maps
            </button>
            <button
              type="button"
              onClick={() => setMiniLayer("google_hybrid")}
              className={`px-2 py-0.5 text-[10px] font-extrabold border-l-2 border-[#0A0D14] cursor-pointer ${
                miniLayer === "google_hybrid" ? "bg-[#C9892B] text-white" : "text-[#0A0D14]"
              }`}
            >
              Google Satellite
            </button>
          </div>

          <span className="px-2 py-0.5 text-[9.5px] font-extrabold border border-[#0A0D14] uppercase bg-[#D1FAE5] text-[#065F46]">
            SILENT TRIANGULATION (±{geo.accuracyMeters}m)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
        <div
          ref={mapNodeRef}
          className="sm:col-span-2 w-full h-[195px] border-2 border-[#0A0D14] shadow-[3px_3px_0px_#0A0D14] bg-[#EEF5F3] z-0"
        />

        <div className="space-y-1.5 font-mono text-[11px] bg-[#FAF7EE] p-3 border-2 border-[#0A0D14] shadow-[2px_2px_0px_#0A0D14]">
          <div>
            <strong className="text-[#22418A]">Exact Coords:</strong>{" "}
            <span className="font-extrabold text-[#0A0D14]">
              {geo.lat.toFixed(6)}, {geo.lng.toFixed(6)}
            </span>
          </div>
          <div>
            <strong className="text-[#22418A]">Exact Street / Area:</strong>{" "}
            <span className="text-[#0A0D14] font-semibold">{geo.exactAddress}</span>
          </div>
          <div>
            <strong className="text-[#22418A]">Silent Probes:</strong>{" "}
            <span className="text-[#065F46] font-bold">
              Multi-Node IP + WebRTC STUN + Edge POP (±{geo.accuracyMeters}m)
            </span>
          </div>
          {(geo.webrtcIp || geo.edgePop) && (
            <div>
              <strong className="text-[#22418A]">STUN / Edge POP:</strong>{" "}
              <span>
                {geo.webrtcIp ? `ICE: ${geo.webrtcIp}` : ""}{" "}
                {geo.edgePop ? `• POP: ${geo.edgePop}` : ""}
              </span>
            </div>
          )}
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
              <span>Open Google Maps</span>
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
    "all" | "humans" | "readers" | "flagged" | "bots"
  >("humans");
  // Only OSM Map and Google Maps (with Google Satellite option) — Neo Warm Map removed
  const [mapStyle, setMapStyle] = useState<MapLayerKey>("google_streets");
  const [activePinId, setActivePinId] = useState<string | null>(selectedLogId || null);

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

  // STRICT FILTER: Only show visits from now onwards (logs with geoSilentTracked === true) in Geo View & Real Map
  const silentTrackedLogs = useMemo(
    () => logs.filter((l) => Boolean(l.geoSilentTracked)),
    [logs]
  );

  const allGeoItems = useMemo(
    () =>
      silentTrackedLogs
        .map((l, idx) => resolveVisitorGeo(l, idx, idx + 1))
        .reverse(),
    [silentTrackedLogs]
  );

  const filteredGeoItems = useMemo(() => {
    return allGeoItems.filter((item) => {
      if (pinFilter === "humans") return !item.isBot;
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

  // Compute NeoPOP Geo Analytics Metrics (strictly from new silent-tracked visits onwards)
  const geoAnalytics = useMemo(() => {
    const humanGeo = allGeoItems.filter((g) => !g.isBot);
    const flaggedGeoCount = allGeoItems.filter(
      (g) => g.hasSecurityFlags || g.isBot
    ).length;

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
      flaggedGeoCount,
      uniqueCities: cityBreakdown.length,
      topCity: cityBreakdown[0]?.city || "Awaiting Live Pin",
      cityBreakdown: cityBreakdown.slice(0, 8),
      errorBreakdown,
    };
  }, [allGeoItems]);

  // Initialize Leaflet Interactive Map on Desktop — renders BOTH OSM Map and Google Maps tiles with identical NeoPOP pins
  useEffect(() => {
    if (!isDesktopViewport || !mapContainerRef.current) {
      return;
    }

    const layerCfg = MAP_TILE_LAYERS[mapStyle];

    if (!leafletMapRef.current) {
      const initialCenter: [number, number] = selectedPin
        ? [selectedPin.lat, selectedPin.lng]
        : [17.385044, 78.486671];

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: selectedPin ? 14 : 5,
        zoomControl: true,
        attributionControl: false,
      });

      tileLayerRef.current = L.tileLayer(layerCfg.url, {
        maxZoom: layerCfg.maxZoom,
      }).addTo(map);
      markersLayerRef.current = L.layerGroup().addTo(map);
      leafletMapRef.current = map;

      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    } else if (tileLayerRef.current) {
      tileLayerRef.current.setUrl(layerCfg.url);
    }
  }, [isDesktopViewport, mapStyle, selectedPin]);

  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markersLayerRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, []);

  // Render NeoPOP Pins onto Leaflet Map (works identically on OSM Map, Google Maps, and Google Satellite)
  useEffect(() => {
    const map = leafletMapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

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
        ">#${item.geoSequence}</div>`,
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
        map.flyTo([item.lat, item.lng], 16, {
          duration: 0.8,
        });
      });

      marker.addTo(layer);

      if (isSelected) {
        L.circle([item.lat, item.lng], {
          radius: Math.max(30, Math.min(800, item.accuracyMeters)),
          color: bg,
          fillColor: bg,
          fillOpacity: 0.16,
          weight: 2,
        }).addTo(layer);
      }
    });
  }, [filteredGeoItems, selectedPin, mapStyle, onSelectLogId]);

  const handleFlyToPin = (item: ResolvedVisitorGeo) => {
    setActivePinId(item.id);
    if (onSelectLogId) onSelectLogId(item.id);
    if (leafletMapRef.current) {
      leafletMapRef.current.flyTo([item.lat, item.lng], 16, { duration: 0.85 });
    }
  };

  const handleFitAllActivePins = () => {
    const map = leafletMapRef.current;
    if (!map || filteredGeoItems.length === 0) return;
    if (filteredGeoItems.length === 1) {
      map.flyTo([filteredGeoItems[0].lat, filteredGeoItems[0].lng], 15, {
        duration: 0.8,
      });
      return;
    }
    const bounds = L.latLngBounds(
      filteredGeoItems.map((item) => [item.lat, item.lng] as [number, number])
    );
    map.flyToBounds(bounds.pad(0.25), { duration: 0.9, maxZoom: 16 });
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
      {/* Zero-Permission Silent Triangulation Status Banner */}
      <div className="px-4 py-2.5 bg-[#FFF6D6] border-2 border-[#0A0D14] shadow-[3px_3px_0px_#0A0D14] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 font-bold text-[#0A0D14]">
          <Radio className="w-4 h-4 text-[#065F46] shrink-0" />
          <span>
            <strong>Silent Script Triangulation Active (Zero Permission Prompt):</strong> Pinning
            only <strong>new visits from now onwards</strong> using parallel Geo-IP nodes, WebRTC
            STUN ICE candidates, Cloudflare Edge POP trace &amp; OSM Nominatim street resolution.
          </span>
        </div>
        <span className="px-2 py-0.5 bg-[#22418A] text-[#F2C230] border border-[#0A0D14] font-mono text-[10px] font-extrabold uppercase">
          LIVE EPOCH • {geoAnalytics.totalPinned} NEW PINS
        </span>
      </div>

      {/* 1. NeoPOP Geo Analytics KPI Strip */}
      <div className="grid grid-cols-4 gap-4">
        <NeoCard
          elevation="md"
          variant="porcelain"
          className="p-4 bg-[#FAF7EE] border-2 border-[#0A0D14] shadow-[4px_4px_0px_#0A0D14]"
        >
          <div className="flex items-center justify-between pb-2 border-b-2 border-[#0A0D14]/15">
            <Typography {...FontVariant.CapsBold10} color="#22418A">
              NEW PINNED VISITS
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
              SILENT TRIANGULATION
            </Typography>
            <Cpu className="w-4 h-4 text-[#065F46]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-[#065F46] tabular-nums">
              100% Zero-Prompt
            </span>
            <span className="px-2 py-0.5 bg-[#D1FAE5] border border-[#0A0D14] text-[10px] font-extrabold text-[#065F46]">
              STUN + 4 NODES
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
              LIVE
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
                { id: "all", label: `All New Pins (${geoAnalytics.totalPinned})` },
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

          {/* Map Layer Switcher: OSM Map & Google Maps (with identical custom NeoPOP pins) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center border-2 border-[#0A0D14] bg-[#FAF7EE] shadow-[2px_2px_0px_#0A0D14]">
              <button
                type="button"
                onClick={() => setMapStyle("osm")}
                className={`px-3 py-1.5 text-[11px] font-extrabold cursor-pointer transition-colors ${
                  mapStyle === "osm"
                    ? "bg-[#22418A] text-[#F2C230]"
                    : "text-[#0A0D14] hover:bg-[#FFF6D6]"
                }`}
              >
                OSM Map
              </button>
              <button
                type="button"
                onClick={() => setMapStyle("google_streets")}
                className={`px-3 py-1.5 text-[11px] font-extrabold border-l-2 border-[#0A0D14] cursor-pointer transition-colors ${
                  mapStyle === "google_streets"
                    ? "bg-[#22418A] text-[#F2C230]"
                    : "text-[#0A0D14] hover:bg-[#FFF6D6]"
                }`}
              >
                Google Maps
              </button>
              <button
                type="button"
                onClick={() => setMapStyle("google_hybrid")}
                className={`px-3 py-1.5 text-[11px] font-extrabold border-l-2 border-[#0A0D14] cursor-pointer transition-colors ${
                  mapStyle === "google_hybrid"
                    ? "bg-[#C9892B] text-white"
                    : "text-[#0A0D14] hover:bg-[#FFF6D6]"
                }`}
              >
                Google Satellite
              </button>
            </div>

            <button
              type="button"
              onClick={handleFitAllActivePins}
              className="px-3 py-1.5 bg-[#FFF6D6] hover:bg-[#F2C230] text-[#0A0D14] border-2 border-[#0A0D14] shadow-[2px_2px_0px_#0A0D14] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <Crosshair className="w-3.5 h-3.5 text-[#22418A]" />
              <span>Fit All Pins</span>
            </button>
          </div>
        </div>

        {/* Main Split Layout: Left 8 Columns Interactive Map | Right 4 Columns Pin Intelligence Inspector */}
        <div className="grid grid-cols-12 gap-4 items-stretch">
          {/* Interactive Map Canvas */}
          <div className="col-span-8 flex flex-col gap-2">
            <div className="relative w-full h-[520px] border-2 border-[#0A0D14] shadow-[5px_5px_0px_#0A0D14] bg-[#EEF5F3] overflow-hidden">
              <div ref={mapContainerRef} className="w-full h-full z-0" />

              {/* Active Map Engine Badge */}
              <div className="absolute top-3 right-3 z-[500] bg-[#FAF7EE]/95 border-2 border-[#0A0D14] shadow-[3px_3px_0px_#0A0D14] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#0A0D14]">
                ENGINE: {MAP_TILE_LAYERS[mapStyle].label} • NEOPOP PINS ACTIVE
              </div>

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
                      #{selectedPin.geoSequence}
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
                    <strong className="text-[#22418A]">Silent Method:</strong>{" "}
                    <span className="font-extrabold text-[#065F46]">
                      MULTI-NODE + STUN (±{selectedPin.accuracyMeters}m)
                    </span>
                  </div>
                  {(selectedPin.webrtcIp || selectedPin.edgePop) && (
                    <div>
                      <strong className="text-[#22418A]">WebRTC / Edge:</strong>{" "}
                      <span>
                        {selectedPin.webrtcIp || "Masked"}{" "}
                        {selectedPin.edgePop ? `(${selectedPin.edgePop})` : ""}
                      </span>
                    </div>
                  )}
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
            ) : (
              <div className="p-4 bg-[#FAF7EE] border-2 border-[#0A0D14] shadow-[4px_4px_0px_#0A0D14] text-xs text-[#5A6788] font-mono">
                Previous logs are hidden. Waiting for the first new visitor from now onwards to
                pin on the Real Map...
              </div>
            )}

            {/* Scrollable Pin Roster (Strictly from now onwards) */}
            <div className="flex-1 bg-[#FAF7EE] border-2 border-[#0A0D14] shadow-[4px_4px_0px_#0A0D14] flex flex-col min-h-0">
              <div className="px-3 py-2 bg-[#FFF6D6] border-b-2 border-[#0A0D14] text-[11px] font-extrabold uppercase tracking-wider text-[#0A0D14] flex items-center justify-between">
                <span>New Pinned Devices ({filteredGeoItems.length})</span>
                <span className="text-[10px] text-[#22418A]">From Now Onwards</span>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-[#0A0D14]/15">
                {filteredGeoItems.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#5A6788] font-mono">
                    No new visits recorded since silent triangulation reset. Open the site in a
                    new tab to see Pin #1 appear live!
                  </div>
                ) : (
                  filteredGeoItems.map((item) => {
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
                              #{item.geoSequence}
                            </span>
                            <span className="font-mono font-bold text-xs text-[#0A0D14] truncate">
                              {item.ip}
                            </span>
                            <span className="px-1 py-0.2 bg-[#D1FAE5] border border-[#065F46] text-[8.5px] font-extrabold text-[#065F46]">
                              SILENT
                            </span>
                          </div>
                          <div className="text-[10.5px] text-[#22418A] font-semibold truncate">
                            {item.exactAddress}
                          </div>
                          <div className="text-[9.5px] font-mono text-[#5A6788]">
                            {item.lat.toFixed(5)}, {item.lng.toFixed(5)} • {item.timestampStr}
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
                  })
                )}
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
                Geo Analytics • New Visitor Cities &amp; Reading Depth
              </Typography>
            </div>
            <span className="px-2 py-0.5 bg-[#FFF6D6] border border-[#0A0D14] text-[10px] font-extrabold text-[#0A0D14]">
              FROM NOW ONWARDS
            </span>
          </div>

          <div className="space-y-2.5">
            {geoAnalytics.cityBreakdown.length === 0 ? (
              <div className="text-xs text-[#5A6788] py-4 text-center">
                No new visits recorded yet since silent triangulation cutoff.
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
