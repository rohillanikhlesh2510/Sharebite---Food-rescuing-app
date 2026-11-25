import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, MapPin, Phone, Globe, Mail, Heart, Navigation,
  Filter, X, ChevronDown, SlidersHorizontal, Building2,
  ExternalLink, Loader2, RotateCcw, Map, List, AlertCircle,
  CheckCircle, Info, Handshake,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { divIcon } from "leaflet";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { LocationService } from "../../services/location";
import { NGODiscoveryService, type NGOSearchParams } from "../../services/ngoDiscovery";
import type { IndiaNGO, NGOCategory } from "../../types";
import styles from "./NGODiscoveryPage.module.css";
import "leaflet/dist/leaflet.css";
import "../../styles/leaflet-fix.css";

// ─── Map helpers ──────────────────────────────────────────────────────────────

function createNGOMarker(status: string, selected: boolean) {
  const color =
    status === "sharebite_verified" ? "#6b8e3e" :
    status === "contact_available" ? "#c17b3f" : "#64748b";
  const scale = selected ? "scale(1.2)" : "scale(1)";
  return divIcon({
    className: "",
    html: `<div style="width:32px;height:32px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg) ${scale};border:2.5px solid #fff;box-shadow:0 4px 12px ${color}66;display:flex;align-items:center;justify-content:center;transition:transform 0.2s"><svg style="transform:rotate(45deg);width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

function createUserMarker() {
  return divIcon({
    className: "",
    html: `<div style="width:20px;height:20px;background:#2563eb;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,0.2),0 4px 12px rgba(0,0,0,0.2)"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function MapFlyTo({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 14, { duration: 0.8 });
  }, [coords, map]);
  return null;
}

// ─── Verification badge ───────────────────────────────────────────────────────

function VerificationBadge({ status }: { status: string }) {
  const config = {
    sharebite_verified: { label: "ShareBite Verified", color: "#6b8e3e", bg: "#f0f7e9", icon: CheckCircle },
    contact_available: { label: "Contact Available", color: "#c17b3f", bg: "#fdf6f0", icon: Info },
    source_listed: { label: "Source Listed", color: "#64748b", bg: "#f1f5f9", icon: Info },
    unverified: { label: "Unverified", color: "#94a3b8", bg: "#f8fafc", icon: AlertCircle },
  }[status] || { label: "Listed", color: "#64748b", bg: "#f1f5f9", icon: Info };

  const Icon = config.icon;
  return (
    <span className={styles.badge} style={{ color: config.color, background: config.bg }}>
      <Icon size={11} />
      {config.label}
    </span>
  );
}

// ─── NGO Card ─────────────────────────────────────────────────────────────────

function NGOCard({
  ngo, selected, saved, onSelect, onOffer, onDirections, onSave,
}: {
  ngo: IndiaNGO;
  selected: boolean;
  saved?: boolean;
  onSelect: () => void;
  onOffer: () => void;
  onDirections: () => void;
  onSave: () => void;
}) {
  const catLabels = NGODiscoveryService.NGO_CATEGORIES
    .filter((c) => ngo.categories.includes(c.value))
    .slice(0, 2);

  return (
    <div
      id={`ngo-card-${ngo.id}`}
      className={`${styles.ngoCard} ${selected ? styles.ngoCardSelected : ""}`}
      onClick={onSelect}
    >
      {/* Header row */}
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}>
          <Building2 size={20} />
        </div>
        <div className={styles.cardMeta}>
          <h3 className={styles.cardName}>{ngo.name}</h3>
          <div className={styles.cardTagRow}>
            {catLabels.map((c) => (
              <span key={c.value} className={styles.catTag}>
                {c.emoji} {c.label}
              </span>
            ))}
          </div>
        </div>
        <button
          className={`${styles.saveBtn} ${saved ? styles.saveBtnActive : ""}`}
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          title={saved ? "Remove from saved" : "Save NGO"}
        >
          <Heart size={16} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Location + distance */}
      <div className={styles.cardInfo}>
        {(ngo.city || ngo.state) && (
          <div className={styles.infoRow}>
            <MapPin size={13} />
            <span>
              {[ngo.address, ngo.city, ngo.state, ngo.pincode].filter(Boolean).join(", ")}
            </span>
          </div>
        )}
        {ngo.distanceKm != null && (
          <div className={styles.infoRow}>
            <Navigation size={13} />
            <span>{ngo.distanceKm} km away</span>
          </div>
        )}
        {ngo.phone && (
          <div className={styles.infoRow}>
            <Phone size={13} />
            <a href={`tel:${ngo.phone}`} onClick={(e) => e.stopPropagation()}>{ngo.phone}</a>
          </div>
        )}
        {ngo.email && (
          <div className={styles.infoRow}>
            <Mail size={13} />
            <a href={`mailto:${ngo.email}`} onClick={(e) => e.stopPropagation()}>{ngo.email}</a>
          </div>
        )}
        {ngo.website && (
          <div className={styles.infoRow}>
            <Globe size={13} />
            <a href={ngo.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              {ngo.website.replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 40)}
              <ExternalLink size={10} style={{ marginLeft: 3 }} />
            </a>
          </div>
        )}
      </div>

      {/* Status pills */}
      <div className={styles.cardStatusRow}>
        <VerificationBadge status={ngo.verificationStatus} />
        {ngo.acceptsFoodDonations && (
          <span className={styles.badge} style={{ color: "#6b8e3e", background: "#f0f7e9" }}>
            🍱 Accepts Food
          </span>
        )}
        {ngo.acceptsVolunteers && (
          <span className={styles.badge} style={{ color: "#2563eb", background: "#eff6ff" }}>
            🤝 Volunteers OK
          </span>
        )}
      </div>

      {/* Source */}
      <div className={styles.cardSource}>
        Source: {ngo.sourceName}
        {ngo.updatedAt && ` · ${new Date(ngo.updatedAt).toLocaleDateString("en-IN", { year: "numeric", month: "short" })}`}
      </div>

      {/* Actions */}
      <div className={styles.cardActions}>
        <button
          className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
          onClick={(e) => { e.stopPropagation(); onOffer(); }}
        >
          <Handshake size={14} />
          Offer Food
        </button>
        <button
          className={styles.actionBtn}
          onClick={(e) => { e.stopPropagation(); onDirections(); }}
        >
          <Navigation size={14} />
          Directions
        </button>
        {ngo.phone && (
          <a
            href={`tel:${ngo.phone}`}
            className={styles.actionBtn}
            onClick={(e) => e.stopPropagation()}
          >
            <Phone size={14} />
            Call
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function NGOSkeleton() {
  return (
    <div className={styles.skeletonCard}>
      <div className={styles.skeletonRow}>
        <div className={`${styles.skeleton} ${styles.skeletonIcon}`} />
        <div className={styles.skeletonLines}>
          <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
          <div className={`${styles.skeleton} ${styles.skeletonSub}`} />
        </div>
      </div>
      <div className={`${styles.skeleton} ${styles.skeletonBody}`} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const RADII = [
  { label: "5 km", value: 5 },
  { label: "10 km", value: 10 },
  { label: "25 km", value: 25 },
  { label: "50 km", value: 50 },
  { label: "100 km", value: 100 },
  { label: "All India", value: 9999 },
];

export default function NGODiscoveryPage() {
  const navigate = useNavigate();
  const { user: _user } = useAuth();

  // Search state
  const [searchInput, setSearchInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<NGOCategory[]>([]);
  const [radiusKm, setRadiusKm] = useState(25);
  const [sortBy, setSortBy] = useState<"nearest" | "name" | "updated">("nearest");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  // Location state
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [searchCoords, setSearchCoords] = useState<{ lat: number; lng: number; city: string } | null>(null);
  const [locPermission, setLocPermission] = useState<"unknown" | "granted" | "denied">("unknown");

  // Results state
  const [ngos, setNgos] = useState<IndiaNGO[]>([]);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const searchRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Effective coords for search: prefer explicit search, then user location
  const effectiveCoords = searchCoords
    ? { lat: searchCoords.lat, lng: searchCoords.lng }
    : userCoords
    ? { lat: userCoords.latitude, lng: userCoords.longitude }
    : null;

  // ── Get user location on mount ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const coords = await LocationService.getCurrentCoordinates();
        if (coords.latitude !== 20.5937) { // not default center
          setUserCoords({ latitude: coords.latitude, longitude: coords.longitude });
          setLocPermission("granted");
        } else {
          setLocPermission("denied");
        }
      } catch {
        setLocPermission("denied");
      }
    })();
  }, []);

  // ── Main search function ───────────────────────────────────────────────────
  const runSearch = useCallback(
    async (query: string, coords: typeof effectiveCoords, cats: NGOCategory[], state: string, radius: number, sort: string) => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      setError(null);

      const params: NGOSearchParams = {
        query: query || undefined,
        lat: coords?.lat,
        lng: coords?.lng,
        radiusKm: radius,
        state: state || undefined,
        categories: cats.length > 0 ? cats : undefined,
        sortBy: sort as any,
      };

      try {
        const result = await NGODiscoveryService.searchNGOs(params, abortRef.current.signal);
        setNgos(result.ngos);
        setSources(result.sources);
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setError("Search failed. Please check your connection and try again.");
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ── Auto-search when state/category/radius/sort changes ───────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(activeQuery, effectiveCoords, selectedCategories, selectedState, radiusKm, sortBy);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuery, effectiveCoords?.lat, effectiveCoords?.lng, selectedCategories, selectedState, radiusKm, sortBy]);

  // ── Geocode and search by typed text ──────────────────────────────────────
  const handleSearch = async (overrideQuery?: string) => {
    const q = (overrideQuery !== undefined ? overrideQuery : searchInput).trim();
    if (!q) {
      setActiveQuery("");
      setSearchCoords(null);
      return;
    }

    setActiveQuery(q);

    // Check if it looks like a location (city, state, PIN)
    const isPincode = /^\d{6}$/.test(q);
    const isLikelyLocation =
      isPincode ||
      NGODiscoveryService.INDIA_STATES.some((s) => q.toLowerCase().includes(s.toLowerCase())) ||
      q.split(",").length >= 2 ||
      ["delhi", "mumbai", "bengaluru", "bangalore", "kolkata", "chennai", "hyderabad", "pune", "ahmedabad", "jaipur", "lucknow", "bhopal", "patna", "chandigarh", "najafgarh", "noida", "gurugram"].some((c) => q.toLowerCase().includes(c));

    if (isLikelyLocation || isPincode) {
      setGeocoding(true);
      const geo = await NGODiscoveryService.geocodeSearchQuery(q);
      setGeocoding(false);
      if (geo) {
        setSearchCoords({ lat: geo.lat, lng: geo.lng, city: geo.city });
      }
    }
  };

  // ── Map center ─────────────────────────────────────────────────────────────
  const mapCenter: [number, number] = effectiveCoords
    ? [effectiveCoords.lat, effectiveCoords.lng]
    : [20.5937, 78.9629];

  const selectedNGO = ngos.find((n) => n.id === selectedId);
  const flyToCoord: [number, number] | null =
    selectedNGO?.latitude && selectedNGO?.longitude
      ? [selectedNGO.latitude, selectedNGO.longitude]
      : null;

  // ── Category toggle ────────────────────────────────────────────────────────
  const toggleCategory = (cat: NGOCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleReset = () => {
    setSearchInput("");
    setActiveQuery("");
    setSearchCoords(null);
    setSelectedState("");
    setSelectedCategories([]);
    setRadiusKm(25);
    setSortBy("nearest");
  };

  const isFilterActive = selectedState || selectedCategories.length > 0 || radiusKm !== 25 || sortBy !== "nearest";

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerBadge}>
          <Building2 size={12} />
          <span>INDIA NGO DISCOVERY</span>
        </div>
        <h1 className={styles.title}>
          Find NGOs <span className={styles.titleAccent}>across India</span>
        </h1>
        <p className={styles.subtitle}>
          Search food banks, shelters, orphanages & charities — by city, PIN, state, or cause.
          Results powered by ShareBite database and OpenStreetMap.
        </p>
      </div>

      {/* ── Search Bar ── */}
      <div className={styles.searchSection}>
        <div className={styles.searchBar}>
          <Search size={18} className={styles.searchIcon} />
          <input
            ref={searchRef}
            className={styles.searchInput}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search NGOs in Najafgarh Delhi, Mumbai, 110042, or by name..."
            id="ngo-search-input"
          />
          {geocoding && <Loader2 size={16} className={styles.searchSpinner} />}
          {searchInput && (
            <button className={styles.clearBtn} onClick={() => { setSearchInput(""); setActiveQuery(""); setSearchCoords(null); }}>
              <X size={15} />
            </button>
          )}
          <button className={styles.searchBtn} onClick={() => handleSearch()} disabled={geocoding}>
            Search
          </button>
        </div>

        {/* Quick searches */}
        <div className={styles.quickSearches}>
          <span className={styles.quickLabel}>Try:</span>
          {["Najafgarh Delhi", "Mumbai", "Bengaluru", "Bhopal", "Chennai", "110001"].map((q) => (
            <button
              key={q}
              className={styles.quickChip}
              onClick={() => {
                setSearchInput(q);
                handleSearch(q);
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter + View toggle bar ── */}
      <div className={styles.controlBar}>
        <div className={styles.controlLeft}>
          <button
            className={`${styles.filterToggle} ${showFilters ? styles.filterToggleActive : ""}`}
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal size={15} />
            Filters
            {isFilterActive && <span className={styles.filterDot} />}
          </button>

          {/* Radius */}
          <div className={styles.pillSelect}>
            <Navigation size={13} />
            <select
              className={styles.nativeSelect}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              id="ngo-radius-select"
            >
              {RADII.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <ChevronDown size={13} />
          </div>

          {/* Sort */}
          <div className={styles.pillSelect}>
            <Filter size={13} />
            <select
              className={styles.nativeSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              id="ngo-sort-select"
            >
              <option value="nearest">Nearest First</option>
              <option value="name">Name A–Z</option>
              <option value="updated">Recently Updated</option>
            </select>
            <ChevronDown size={13} />
          </div>

          {isFilterActive && (
            <button className={styles.resetBtn} onClick={handleReset}>
              <RotateCcw size={13} /> Reset
            </button>
          )}
        </div>

        <div className={styles.controlRight}>
          {/* Location permission hint */}
          {locPermission === "denied" && !searchCoords && (
            <div className={styles.locHint}>
              <AlertCircle size={13} />
              <span>Search a city to discover NGOs</span>
            </div>
          )}

          {/* View toggle */}
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${viewMode === "list" ? styles.viewBtnActive : ""}`}
              onClick={() => setViewMode("list")}
              id="ngo-list-view-btn"
            >
              <List size={15} /> List
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === "map" ? styles.viewBtnActive : ""}`}
              onClick={() => setViewMode("map")}
              id="ngo-map-view-btn"
            >
              <Map size={15} /> Map
            </button>
          </div>
        </div>
      </div>

      {/* ── Expandable Filter Panel ── */}
      {showFilters && (
        <div className={styles.filterPanel}>
          {/* Category grid */}
          <div className={styles.filterSection}>
            <p className={styles.filterLabel}>Category</p>
            <div className={styles.categoryGrid}>
              {NGODiscoveryService.NGO_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  className={`${styles.catBtn} ${selectedCategories.includes(cat.value) ? styles.catBtnActive : ""}`}
                  onClick={() => toggleCategory(cat.value)}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* State filter */}
          <div className={styles.filterSection}>
            <p className={styles.filterLabel}>State / UT</p>
            <select
              className={styles.stateSelect}
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              id="ngo-state-select"
            >
              <option value="">All India</option>
              {NGODiscoveryService.INDIA_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── Data transparency notice ── */}
      <div className={styles.dataNotice}>
        <Info size={14} />
        <span>
          Results depend on available data sources.{" "}
          {sources.length > 0 ? <>Showing data from: <strong>{sources.join(" + ")}</strong>.</> : null}
          {" "}Not all NGOs in India may be listed.
        </span>
      </div>

      {/* ── Main Content: Split or Full Map ── */}
      {viewMode === "map" ? (
        <div className={styles.fullMapWrap}>
          <MapContainer center={mapCenter} zoom={effectiveCoords ? 12 : 5} className={styles.fullMap} zoomControl={true}>
            <MapFlyTo coords={flyToCoord} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
            {userCoords && (
              <Marker position={[userCoords.latitude, userCoords.longitude]} icon={createUserMarker()}>
                <Popup><strong>Your Location</strong></Popup>
              </Marker>
            )}
            {ngos.map((ngo) =>
              ngo.latitude && ngo.longitude ? (
                <Marker
                  key={ngo.id}
                  position={[ngo.latitude, ngo.longitude]}
                  icon={createNGOMarker(ngo.verificationStatus, ngo.id === selectedId)}
                  eventHandlers={{ click: () => setSelectedId(ngo.id) }}
                >
                  <Popup>
                    <div style={{ minWidth: 180 }}>
                      <strong>{ngo.name}</strong>
                      <p style={{ fontSize: 12, marginTop: 4, color: "#64748b" }}>
                        {ngo.city}{ngo.state ? `, ${ngo.state}` : ""}
                        {ngo.distanceKm != null ? ` · ${ngo.distanceKm} km` : ""}
                      </p>
                      {ngo.phone && <p style={{ fontSize: 12 }}><Phone size={10} style={{ display: "inline" }} /> {ngo.phone}</p>}
                      <button
                        style={{ marginTop: 8, fontSize: 12, padding: "4px 10px", background: "#c17b3f", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
                        onClick={() => { setSelectedId(ngo.id); setViewMode("list"); }}
                      >
                        View Details
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ) : null
            )}
          </MapContainer>
          <button className={styles.backToList} onClick={() => setViewMode("list")}>
            <List size={15} /> Back to List
          </button>
        </div>
      ) : (
        <div className={styles.splitLayout}>
          {/* ── Left: Map ── */}
          <div className={styles.mapCol}>
            <MapContainer center={mapCenter} zoom={effectiveCoords ? 12 : 5} className={styles.sideMap} zoomControl={true}>
              <MapFlyTo coords={flyToCoord} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />
              {userCoords && (
                <Marker position={[userCoords.latitude, userCoords.longitude]} icon={createUserMarker()}>
                  <Popup><strong>Your Location</strong></Popup>
                </Marker>
              )}
              {ngos.map((ngo) =>
                ngo.latitude && ngo.longitude ? (
                  <Marker
                    key={ngo.id}
                    position={[ngo.latitude, ngo.longitude]}
                    icon={createNGOMarker(ngo.verificationStatus, ngo.id === selectedId)}
                    eventHandlers={{
                      click: () => {
                        setSelectedId(ngo.id);
                        document.getElementById(`ngo-card-${ngo.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      },
                    }}
                  >
                    <Popup>
                      <div style={{ minWidth: 180 }}>
                        <strong>{ngo.name}</strong>
                        <p style={{ fontSize: 12, marginTop: 4, color: "#64748b" }}>
                          {ngo.city}{ngo.state ? `, ${ngo.state}` : ""}
                        </p>
                        {ngo.phone && <p style={{ fontSize: 12 }}>{ngo.phone}</p>}
                      </div>
                    </Popup>
                  </Marker>
                ) : null
              )}
            </MapContainer>
            {/* Map legend */}
            <div className={styles.mapLegend}>
              <span><span className={styles.dot} style={{ background: "#6b8e3e" }} /> ShareBite Verified</span>
              <span><span className={styles.dot} style={{ background: "#c17b3f" }} /> Contact Available</span>
              <span><span className={styles.dot} style={{ background: "#64748b" }} /> Source Listed</span>
            </div>
          </div>

          {/* ── Right: List ── */}
          <div className={styles.listCol}>
            <div className={styles.listHeader}>
              <div>
                <h2 className={styles.listTitle}>
                  {searchCoords ? `NGOs near ${searchCoords.city}` : activeQuery ? `Results for "${activeQuery}"` : "NGOs Near You"}
                </h2>
                <p className={styles.listCount}>
                  {loading ? "Searching..." : `${ngos.length} organisation${ngos.length !== 1 ? "s" : ""} found`}
                </p>
              </div>
              <button
                className={styles.mapViewMobileBtn}
                onClick={() => setViewMode("map")}
              >
                <Map size={14} /> Full Map
              </button>
            </div>

            <div className={styles.cardsList}>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <NGOSkeleton key={i} />)
              ) : error ? (
                <div className={styles.emptyState}>
                  <AlertCircle size={32} color="#dc2626" />
                  <p>{error}</p>
                  <button className={styles.retryBtn} onClick={() => runSearch(activeQuery, effectiveCoords, selectedCategories, selectedState, radiusKm, sortBy)}>
                    Retry
                  </button>
                </div>
              ) : ngos.length === 0 ? (
                <div className={styles.emptyState}>
                  <Building2 size={36} color="#c4b49e" />
                  <h3>No NGOs found</h3>
                  <p>
                    {locPermission === "denied" && !searchCoords
                      ? "Search a city name or PIN code to discover NGOs."
                      : "Try expanding the radius or searching All India."}
                  </p>
                  {radiusKm < 9999 && (
                    <button className={styles.retryBtn} onClick={() => setRadiusKm(9999)}>
                      Search All India
                    </button>
                  )}
                </div>
              ) : (
                ngos.map((ngo) => (
                  <NGOCard
                    key={ngo.id}
                    ngo={ngo}
                    selected={ngo.id === selectedId}
                    saved={savedIds.has(ngo.id)}
                    onSelect={() => setSelectedId(ngo.id === selectedId ? null : ngo.id)}
                    onOffer={() => navigate("/donations/new")}
                    onDirections={() => {
                      if (ngo.latitude && ngo.longitude) {
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${ngo.latitude},${ngo.longitude}`, "_blank");
                      } else if (ngo.address) {
                        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${ngo.name} ${ngo.address}`)}`, "_blank");
                      }
                    }}
                    onSave={() => {
                      setSavedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(ngo.id)) next.delete(ngo.id);
                        else next.add(ngo.id);
                        return next;
                      });
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
