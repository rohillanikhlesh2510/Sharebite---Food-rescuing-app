
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { divIcon } from 'leaflet';
import type { FoodListing } from '../../types';
import 'leaflet/dist/leaflet.css';
import '../../styles/leaflet-fix.css';

interface Props {
  listings: FoodListing[];
  onMarkerClick?: (id: string) => void;
}

function createFoodMarker(isUrgent: boolean) {
  return divIcon({
    html: `<div style="
      width:36px;height:36px;
      background:${isUrgent ? '#dc2626' : '#c17b3f'};
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.25);
      display:flex;align-items:center;justify-content:center;
    "><div style="transform:rotate(45deg);color:white;font-size:14px;">🍱</div></div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

export default function FoodMap({ listings, onMarkerClick }: Props) {
  const validListings = listings.filter(
    (l) =>
      typeof l.latitude === 'number' &&
      typeof l.longitude === 'number' &&
      !isNaN(l.latitude) &&
      !isNaN(l.longitude)
  );

  const center: [number, number] = validListings.length > 0
    ? [validListings[0].latitude!, validListings[0].longitude!]
    : [20.5937, 78.9629]; // India center

  return (
    <MapContainer
      center={center}
      zoom={validListings.length > 0 ? 13 : 5}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {validListings.map((l) => (
        <Marker
          key={l.id}
          position={[l.latitude!, l.longitude!]}
          icon={createFoodMarker(l.isUrgent)}
          eventHandlers={{ click: () => onMarkerClick?.(l.id) }}
        >
          <Popup>
            <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 180 }}>
              <strong style={{ fontSize: 14, color: '#1c1a17' }}>{l.title}</strong>
              <p style={{ fontSize: 12, color: '#8b7355', margin: '4px 0' }}>
                {l.availableServings} servings · {l.city || 'Local area'}
              </p>
              <button
                onClick={() => onMarkerClick?.(l.id)}
                style={{ fontSize: 12, color: '#c17b3f', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
              >
                View details →
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
