import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L, { divIcon } from 'leaflet';
import { Navigation, Plus, Minus } from 'lucide-react';
import type { FoodListing, NearbyNGO } from '../../types';
import styles from './DiscoverFoodMap.module.css';
import 'leaflet/dist/leaflet.css';
import '../../styles/leaflet-fix.css';

interface Props {
  listings: FoodListing[];
  ngos?: NearbyNGO[];
  userCoords?: { latitude: number; longitude: number } | null;
  selectedListingId?: string | null;
  onSelectListing?: (id: string) => void;
  onSelectNGO?: (id: string) => void;
}

// Custom Leaflet Icons styled like the screenshot
function createFreshFoodIcon(isActive: boolean) {
  return divIcon({
    className: 'custom-pin-fresh',
    html: `
      <div style="
        position: relative;
        width: 34px;
        height: 34px;
        background: #16a34a;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2.5px solid #ffffff;
        box-shadow: 0 4px 10px rgba(22, 163, 74, ${isActive ? '0.7' : '0.4'});
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease;
        ${isActive ? 'transform: rotate(-45deg) scale(1.15);' : ''}
      ">
        <svg style="transform: rotate(45deg); width: 16px; height: 16px;" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
          <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
        </svg>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  });
}

function createUrgentFoodIcon(isActive: boolean) {
  return divIcon({
    className: 'custom-pin-urgent',
    html: `
      <div style="
        position: relative;
        width: 34px;
        height: 34px;
        background: #e06d28;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2.5px solid #ffffff;
        box-shadow: 0 4px 10px rgba(224, 109, 40, ${isActive ? '0.7' : '0.4'});
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease;
        ${isActive ? 'transform: rotate(-45deg) scale(1.15);' : ''}
      ">
        <svg style="transform: rotate(45deg); width: 16px; height: 16px;" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  });
}

function createUserLocationIcon() {
  return divIcon({
    className: 'custom-pin-user',
    html: `
      <div style="
        position: relative;
        width: 20px;
        height: 20px;
        background: #2563eb;
        border-radius: 50%;
        border: 3px solid #ffffff;
        box-shadow: 0 0 0 5px rgba(37, 99, 235, 0.35), 0 4px 12px rgba(0,0,0,0.25);
      ">
        <div style="
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          border: 1.5px solid rgba(37, 99, 235, 0.4);
          animation: leaflet-pulse 2s infinite ease-out;
        "></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function createNGOIcon(isActive: boolean) {
  return divIcon({
    className: 'custom-pin-ngo',
    html: `
      <div style="
        position: relative;
        width: 32px;
        height: 32px;
        background: #7c3aed;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2.5px solid #ffffff;
        box-shadow: 0 4px 10px rgba(124, 58, 237, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        ${isActive ? 'transform: rotate(-45deg) scale(1.15);' : ''}
      ">
        <svg style="transform: rotate(45deg); width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

// Controller component to handle programatic map pans and zoom
function MapController({
  selectedCoord,
}: {
  selectedCoord?: [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedCoord) {
      map.flyTo(selectedCoord, 14, { duration: 0.8 });
    }
  }, [selectedCoord, map]);

  return null;
}

export default function DiscoverFoodMap({
  listings,
  ngos = [],
  userCoords,
  selectedListingId,
  onSelectListing,
  onSelectNGO,
}: Props) {
  const [mapType, setMapType] = useState<'map' | 'satellite'>('map');
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Center logic: prioritize valid user coordinates, then first valid listing, fallback to India center
  const firstWithLocation = listings.find(
    (l) =>
      typeof l.latitude === 'number' &&
      typeof l.longitude === 'number' &&
      !isNaN(l.latitude) &&
      !isNaN(l.longitude)
  );

  const centerLat =
    typeof userCoords?.latitude === 'number' && !isNaN(userCoords.latitude)
      ? userCoords.latitude
      : (firstWithLocation?.latitude ?? 20.5937);

  const centerLng =
    typeof userCoords?.longitude === 'number' && !isNaN(userCoords.longitude)
      ? userCoords.longitude
      : (firstWithLocation?.longitude ?? 78.9629);

  const center: [number, number] = [centerLat, centerLng];

  // Selected item position
  const selectedListing = listings.find((l) => l.id === selectedListingId);
  const selectedCoord: [number, number] | null =
    selectedListing &&
    typeof selectedListing.latitude === 'number' &&
    typeof selectedListing.longitude === 'number' &&
    !isNaN(selectedListing.latitude) &&
    !isNaN(selectedListing.longitude)
      ? [selectedListing.latitude, selectedListing.longitude]
      : null;

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(center, 13, { duration: 0.7 });
    }
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  return (
    <div className={styles.mapWrapper}>
      {/* Top Left: Map / Satellite Switch */}
      <div className={styles.layerToggle}>
        <button
          className={`${styles.layerBtn} ${mapType === 'map' ? styles.layerBtnActive : ''}`}
          onClick={() => setMapType('map')}
        >
          Map
        </button>
        <button
          className={`${styles.layerBtn} ${mapType === 'satellite' ? styles.layerBtnActive : ''}`}
          onClick={() => setMapType('satellite')}
        >
          Satellite
        </button>
      </div>

      {/* Bottom Left Legend Box */}
      <div className={styles.legendBox}>
        <div className={styles.legendItem}>
          <div className={`${styles.legendDot} ${styles.legendDotFresh}`} />
          <span>Fresh Donation</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendDot} ${styles.legendDotUrgent}`} />
          <span>Expiring Soon</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendDot} ${styles.legendDotUser}`} />
          <span>Your Location</span>
        </div>
        {ngos.length > 0 && (
          <div className={styles.legendItem}>
            <div className={`${styles.legendDot} ${styles.legendDotNgo}`} />
            <span>Verified NGO</span>
          </div>
        )}
      </div>

      {/* Bottom Right Control Buttons */}
      <div className={styles.controlsGroup}>
        <button
          className={styles.controlBtn}
          onClick={handleRecenter}
          title="Center on my location"
          aria-label="Center on my location"
        >
          <Navigation size={18} />
        </button>
        <div className={styles.zoomStack}>
          <button className={styles.zoomBtn} onClick={handleZoomIn} aria-label="Zoom in">
            <Plus size={16} />
          </button>
          <div className={styles.zoomDivider} />
          <button className={styles.zoomBtn} onClick={handleZoomOut} aria-label="Zoom out">
            <Minus size={16} />
          </button>
        </div>
      </div>

      {/* Google-like logo watermark in bottom left */}
      <div className={styles.mapBrand}>ShareBite Maps</div>

      {/* Leaflet Map Container */}
      <MapContainer
        center={center}
        zoom={13}
        className={styles.mapContainer}
        zoomControl={false}
        ref={(map) => {
          if (map) mapInstanceRef.current = map;
        }}
      >
        <MapController selectedCoord={selectedCoord} />

        {/* Dynamic Tile Layer based on Map vs Satellite */}
        {mapType === 'map' ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        ) : (
          <TileLayer
            attribution='&copy; Esri, Maxar, Earthstar Geographics'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={18}
          />
        )}

        {/* User Location Pulse Marker */}
        {userCoords && (
          <Marker
            position={[userCoords.latitude, userCoords.longitude]}
            icon={createUserLocationIcon()}
          >
            <Popup>
              <div className={styles.popupWrap}>
                <p className={styles.popupTitle}>Your Current Location</p>
                <p className={styles.popupMeta}>Within active rescue radius</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Food Listings Markers */}
        {listings.map((item) => {
          if (!item.latitude || !item.longitude) return null;
          const isSelected = item.id === selectedListingId;
          const isExpiring = item.isUrgent;

          return (
            <Marker
              key={item.id}
              position={[item.latitude, item.longitude]}
              icon={isExpiring ? createUrgentFoodIcon(isSelected) : createFreshFoodIcon(isSelected)}
              eventHandlers={{
                click: () => onSelectListing?.(item.id),
              }}
            >
              <Popup>
                <div className={styles.popupWrap}>
                  <p className={styles.popupTitle}>{item.title}</p>
                  <p className={styles.popupMeta}>
                    {item.availableServings} servings · {item.city || 'Local area'}
                  </p>
                  <button
                    className={styles.popupAction}
                    onClick={() => onSelectListing?.(item.id)}
                  >
                    View Details
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* NGO Markers */}
        {ngos.map((ngo) => {
          if (!ngo.latitude || !ngo.longitude) return null;
          return (
            <Marker
              key={ngo.id}
              position={[ngo.latitude, ngo.longitude]}
              icon={createNGOIcon(false)}
              eventHandlers={{
                click: () => onSelectNGO?.(ngo.id),
              }}
            >
              <Popup>
                <div className={styles.popupWrap}>
                  <p className={styles.popupTitle}>{ngo.organizationName || ngo.fullName}</p>
                  <p className={styles.popupMeta}>
                    Verified NGO · {ngo.distanceKm ? `${ngo.distanceKm} km away` : ngo.city}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
