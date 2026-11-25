import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Upload, ChevronLeft, ChevronRight, Check, ShieldCheck,
  AlertCircle, MapPin, Loader2, CheckCircle2, LocateFixed
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { divIcon } from 'leaflet';
import { useAuth } from '../../context/AuthContext';
import { DonationService } from '../../services/donations';
import { LocationService } from '../../services/location';
import { NGOService } from '../../services/ngo';
import type { CreateFoodListingForm, FoodType } from '../../types';
import styles from './CreateDonationPage.module.css';
import 'leaflet/dist/leaflet.css';
import '../../styles/leaflet-fix.css';

const CATEGORIES = [
  'Rice', 'Roti', 'Sabzi', 'Dal', 'Biryani', 'Curry',
  'Snacks', 'Sweets', 'Fruits', 'Bakery', 'Beverages', 'Other'
];

const FOOD_TYPES: { value: FoodType; label: string }[] = [
  { value: 'veg', label: 'Vegetarian (Pure Veg)' },
  { value: 'non_veg', label: 'Non-Vegetarian' },
  { value: 'vegan', label: 'Vegan (Plant-based)' },
  { value: 'other', label: 'Special / Other' },
];

const QUANTITY_UNITS = [
  { value: 'servings', label: 'Servings / Meals' },
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'boxes', label: 'Meal Boxes / Packets' },
  { value: 'litres', label: 'Litres (L)' },
  { value: 'trays', label: 'Catering Trays' },
];

const STORAGE_TYPES = [
  { value: 'room_temp', label: 'Room Temperature (Ambient)' },
  { value: 'refrigerated', label: 'Refrigerated / Chilled (< 5°C)' },
  { value: 'frozen', label: 'Frozen (Below -18°C)' },
  { value: 'hot_holding', label: 'Hot Holding (Ready-to-eat > 60°C)' },
];

const PACKAGING_TYPES = [
  { value: 'sealed_boxes', label: 'Sealed Individual Meal Boxes' },
  { value: 'cater_trays', label: 'Large Catering / Aluminium Trays' },
  { value: 'packaged_clean', label: 'Food-grade Packaged & Labeled' },
  { value: 'containers_needed', label: 'Bulk / Bring Your Own Containers' },
];

const ALLERGEN_OPTIONS = ['Dairy', 'Gluten', 'Nuts', 'Peanuts', 'Soy', 'Eggs', 'Seafood', 'Mustard', 'None'];

const STEPS = ['Food Details', 'Pickup & Safety', 'Review & Publish'];

function formatLocalDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function createPickupPinIcon() {
  return divIcon({
    className: 'custom-pickup-pin',
    html: `
      <div style="
        position: relative;
        width: 36px;
        height: 36px;
        background: #ea580c;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2.5px solid #ffffff;
        box-shadow: 0 4px 12px rgba(234, 88, 12, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
      ">
        <svg style="transform: rotate(45deg); width: 17px; height: 17px;" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

function MapEventsHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapFlyTo({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords && !isNaN(coords[0]) && !isNaN(coords[1])) {
      map.flyTo(coords, Math.max(map.getZoom(), 15), { duration: 0.8 });
    }
  }, [coords, map]);
  return null;
}

export default function CreateDonationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const [step, setStep] = useState(0);

  // Address, Pickup Date, and Pickup Time remain completely blank by default
  const [form, setForm] = useState<CreateFoodListingForm>({
    title: '',
    description: '',
    category: 'Rice',
    foodType: 'veg',
    servings: 10,
    quantityUnit: 'servings',
    quantityValue: 10,
    preparationDate: '',
    packagingType: 'sealed_boxes',
    packagingNotes: '',
    pickupAddress: '',
    city: '',
    pickupDate: '',
    pickupTime: '',
    contactPhone: user?.phone || '',
    specialInstructions: '',
    directHandover: true,
    availableFrom: '',
    availableUntil: '',
    isUrgent: false,
    storageType: 'room_temp',
    allergens: [],
    safetyDeclarationSigned: false,
    latitude: undefined,
    longitude: undefined,
    locationAccuracyM: undefined,
    locationCapturedAt: undefined,
    notificationRadiusKm: 15,
  });

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const [error, setError] = useState('');

  // Geocoding and map states
  const [geocoding, setGeocoding] = useState(false);
  const [resolvingNext, setResolvingNext] = useState(false);
  const [geocodeError, setGeocodeError] = useState('');
  const [addressResolved, setAddressResolved] = useState(false);
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const [gpsNotice, setGpsNotice] = useState<{ type: 'success' | 'warn'; text: string } | null>(null);
  const [nearbyNgoCount, setNearbyNgoCount] = useState<number | null>(null);
  const hasAutoDetectedGpsRef = useRef(false);

  // Refs for race-condition prevention, edit loading protection, and scroll/focus
  const cardRef = useRef<HTMLDivElement>(null);
  const latestAddressRef = useRef(form.pickupAddress);
  const isInitialLoadRef = useRef(false);

  const buildGeocodeQuery = (address: string, city: string) => {
    const cleanAddr = address.trim();
    const cleanCity = city.trim();
    if (!cleanAddr) return '';
    if (cleanCity && !cleanAddr.toLowerCase().includes(cleanCity.toLowerCase())) {
      return `${cleanAddr}, ${cleanCity}`;
    }
    return cleanAddr;
  };

  useEffect(() => {
    latestAddressRef.current = buildGeocodeQuery(form.pickupAddress, form.city);
  }, [form.pickupAddress, form.city]);

  // Load existing food listing if in edit mode
  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    DonationService.getListingById(id)
      .then((listing) => {
        if (!isMounted || !listing) return;
        isInitialLoadRef.current = true;

        const pDate = listing.availableFrom ? listing.availableFrom.slice(0, 10) : '';
        const pTime = listing.availableFrom ? listing.availableFrom.slice(11, 16) : '';

        setForm({
          title: listing.title || '',
          description: listing.description || '',
          category: listing.category || 'Rice',
          foodType: listing.foodType || 'veg',
          servings: listing.servings || 10,
          quantityUnit: 'servings',
          quantityValue: listing.servings || 10,
          preparationDate: '',
          packagingType: 'sealed_boxes',
          packagingNotes: '',
          pickupAddress: listing.pickupAddress || '',
          city: listing.city || '',
          pickupDate: pDate,
          pickupTime: pTime,
          contactPhone: user?.phone || '',
          specialInstructions: '',
          directHandover: true,
          availableFrom: listing.availableFrom || '',
          availableUntil: listing.availableUntil ? listing.availableUntil.slice(0, 16) : '',
          isUrgent: listing.isUrgent || false,
          storageType: listing.storageType || 'room_temp',
          allergens: listing.allergens || [],
          safetyDeclarationSigned: true,
          latitude: typeof listing.latitude === 'number' && !isNaN(listing.latitude) ? listing.latitude : undefined,
          longitude: typeof listing.longitude === 'number' && !isNaN(listing.longitude) ? listing.longitude : undefined,
        });

        if (listing.imageUrl) {
          setImagePreview(listing.imageUrl);
        }

        if (typeof listing.latitude === 'number' && typeof listing.longitude === 'number') {
          setAddressResolved(true);
        }
      })
      .catch((err) => {
        console.error('Failed to load listing for editing:', err);
        setError('Could not load existing listing details.');
      })
      .finally(() => {
        if (isMounted) setInitialLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id, user]);

  const update = (key: keyof CreateFoodListingForm, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

  const [minDeadline] = useState(() => formatLocalDateTime(new Date(Date.now() + 5 * 60 * 1000)));

  const setQuickDeadline = (hoursFromNow: number) => {
    const now = new Date();
    const target = new Date(now.getTime() + hoursFromNow * 60 * 60 * 1000);
    const targetIsoLocal = formatLocalDateTime(target);
    const nowLocal = formatLocalDateTime(now);
    const [nowDate, nowTime] = nowLocal.split('T');

    setForm((prev) => {
      const nextDate = prev.pickupDate || nowDate;
      const nextTime = prev.pickupTime || nowTime;
      return {
        ...prev,
        pickupDate: nextDate,
        pickupTime: nextTime,
        availableFrom: prev.availableFrom || `${nextDate}T${nextTime}`,
        availableUntil: targetIsoLocal,
      };
    });
    setError('');
  };

  // Debounced geocoding when pickup address or city changes
  useEffect(() => {
    // If this change was triggered by initial edit loading, GPS lock, or map pin placement, preserve existing coordinates
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    const addr = form.pickupAddress.trim();
    if (!addr || addr.length < 3) {
      setGeocoding((prev) => (prev ? false : prev));
      setGeocodeError((prev) => (prev ? '' : prev));
      return;
    }

    const query = buildGeocodeQuery(addr, form.city);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setGeocoding(true);
      setGeocodeError('');

      try {
        let res = await LocationService.geocodeAddress(query, controller.signal);
        if (!res && form.city.trim()) {
          res = await LocationService.geocodeAddress(form.city.trim(), controller.signal);
        }
        if (latestAddressRef.current === query) {
          if (res) {
            isInitialLoadRef.current = true;
            setForm((prev) => ({
              ...prev,
              latitude: res.latitude,
              longitude: res.longitude,
              locationCapturedAt: prev.locationCapturedAt || new Date().toISOString(),
              city: prev.city.trim() ? prev.city : (res.city || prev.city),
            }));
            setAddressResolved(true);
            setGeocodeError('');
          } else {
            setAddressResolved(false);
            setGeocodeError(
              'Unable to resolve this address on the map. Please check spelling, add a city or landmark, or click on the map to pin your location manually.'
            );
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setGeocodeError('Error resolving address. Please click on the map to set the pickup pin.');
        }
      } finally {
        setGeocoding(false);
      }
    }, 750);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.pickupAddress, form.city]);

  // Handle marker drag or map click to manually place pin
  const handlePinPlaced = async (lat: number, lng: number) => {
    if (isNaN(lat) || isNaN(lng)) return;
    setForm((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      locationCapturedAt: new Date().toISOString(),
    }));
    setAddressResolved(true);
    setGeocodeError('');

    try {
      const rev = await LocationService.reverseGeocode(lat, lng);
      if (rev) {
        isInitialLoadRef.current = true;
        setForm((prev) => ({
          ...prev,
          pickupAddress: prev.pickupAddress.trim() ? prev.pickupAddress : (rev.address || prev.pickupAddress),
          city: prev.city.trim() ? prev.city : (rev.city || prev.city),
        }));
      }
    } catch (revErr) {
      console.warn('Reverse geocode error:', revErr);
    }
  };

  // Detect live device GPS coordinates via browser Geolocation API
  const handleDetectGPS = async () => {
    setGpsDetecting(true);
    setGpsNotice(null);
    setGeocodeError('');

    const gps = await LocationService.detectCurrentGPS();
    if (gps.status === 'granted' && gps.latitude !== null && gps.longitude !== null) {
      isInitialLoadRef.current = true;
      setForm((prev) => ({
        ...prev,
        latitude: gps.latitude!,
        longitude: gps.longitude!,
        locationAccuracyM: gps.accuracy ?? undefined,
        locationCapturedAt: gps.timestamp,
      }));
      setAddressResolved(true);
      setGpsNotice({
        type: 'success',
        text: `Live GPS locked${gps.accuracy ? ` (±${gps.accuracy}m accuracy)` : ''}. Drag the pin if you want to fine-tune.`,
      });

      try {
        const rev = await LocationService.reverseGeocode(gps.latitude, gps.longitude);
        if (rev) {
          isInitialLoadRef.current = true;
          setForm((prev) => ({
            ...prev,
            pickupAddress: rev.address || prev.pickupAddress,
            city: rev.city || prev.city,
          }));
        }
      } catch {}
    } else {
      setGpsNotice({
        type: 'warn',
        text: gps.errorMessage || 'GPS permission denied. Please enter your address or click directly on the map to place the pickup pin.',
      });
    }
    setGpsDetecting(false);
  };

  // Auto-detect GPS when donor reaches Step 1 (for new listings without coordinates)
  useEffect(() => {
    if (step === 1 && !isEdit && !hasAutoDetectedGpsRef.current && form.latitude === undefined) {
      hasAutoDetectedGpsRef.current = true;
      handleDetectGPS();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isEdit]);

  // Refresh count of verified NGOs within the configured alert radius
  useEffect(() => {
    if (typeof form.latitude !== 'number' || typeof form.longitude !== 'number') {
      setNearbyNgoCount(null);
      return;
    }
    let active = true;
    NGOService.getNearbyNGOs(form.latitude, form.longitude, form.notificationRadiusKm || 15, true)
      .then((list) => {
        if (active) setNearbyNgoCount(list.length);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [form.latitude, form.longitude, form.notificationRadiusKm]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo exceeds 5MB limit. Please choose a smaller image.');
      return;
    }
    update('imageFile', file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const focusField = (fieldId?: string) => {
    if (!fieldId || typeof document === 'undefined') return;
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof (el as HTMLElement).focus === 'function') {
      try {
        (el as HTMLElement).focus({ preventScroll: true });
      } catch {
        // Non-focusable container (e.g. map section)
      }
    }
  };

  const validateStep = (
    currentStep: number,
    overrideCoords?: { latitude?: number; longitude?: number }
  ): { valid: boolean; focusId?: string } => {
    setError('');
    if (currentStep === 0) {
      if (!form.title.trim()) {
        setError('Please enter a food title.');
        return { valid: false, focusId: 'foodTitle' };
      }
      if (!form.category) {
        setError('Please select a food category.');
        return { valid: false, focusId: 'foodCategory' };
      }
      if (!form.servings || form.servings <= 0) {
        setError('Please enter a valid number of servings (minimum 1).');
        return { valid: false, focusId: 'servings' };
      }
      return { valid: true };
    }

    if (currentStep === 1) {
      if (!form.pickupAddress.trim()) {
        setError('Pickup address is required. Please enter an address or click Use Current GPS Location.');
        return { valid: false, focusId: 'pickupAddress' };
      }
      if (!form.city.trim()) {
        setError('City is required. Please specify a city.');
        return { valid: false, focusId: 'city' };
      }
      if (!form.pickupDate) {
        setError('Pickup date is required.');
        return { valid: false, focusId: 'pickupDate' };
      }
      if (!form.pickupTime) {
        setError('Pickup time is required.');
        return { valid: false, focusId: 'pickupTime' };
      }
      if (!form.availableUntil) {
        setError('Latest collection deadline (expiry) is required.');
        return { valid: false, focusId: 'availableUntil' };
      }
      const untilMs = new Date(form.availableUntil).getTime();
      if (isNaN(untilMs) || untilMs <= Date.now()) {
        const nowFormatted = new Date().toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        setError(
          `Latest collection deadline must be after now (${nowFormatted}). Click "+4 hrs" below or choose a later date & time.`
        );
        return { valid: false, focusId: 'availableUntil' };
      }
      if (form.availableFrom) {
        const fromMs = new Date(form.availableFrom).getTime();
        if (!isNaN(fromMs) && untilMs <= fromMs) {
          setError('Collection deadline must be after the pickup time.');
          return { valid: false, focusId: 'availableUntil' };
        }
      }
      const effectiveLat = overrideCoords?.latitude ?? form.latitude;
      const effectiveLng = overrideCoords?.longitude ?? form.longitude;
      if (
        effectiveLat === undefined ||
        effectiveLng === undefined ||
        isNaN(effectiveLat) ||
        isNaN(effectiveLng)
      ) {
        setError('Please click on the map to pin your pickup location (or click Use Current GPS Location).');
        return { valid: false, focusId: 'pickupMapSection' };
      }
      if (!form.safetyDeclarationSigned) {
        setError('You must tick the Food Safety Certification checkbox before continuing.');
        return { valid: false, focusId: 'safetyDeclaration' };
      }
      return { valid: true };
    }

    return { valid: true };
  };

  const handleNext = async () => {
    if (resolvingNext) return;

    let resolvedCoords: { latitude?: number; longitude?: number } | undefined;

    if (step === 1) {
      const missingCoords =
        form.latitude === undefined ||
        form.longitude === undefined ||
        isNaN(form.latitude) ||
        isNaN(form.longitude);

      if (missingCoords && form.pickupAddress.trim()) {
        setResolvingNext(true);
        setError('');
        try {
          const query = buildGeocodeQuery(form.pickupAddress, form.city);
          let res = query ? await LocationService.geocodeAddress(query) : null;
          if (!res && form.city.trim()) {
            res = await LocationService.geocodeAddress(form.city.trim());
          }
          if (res) {
            isInitialLoadRef.current = true;
            setForm((prev) => ({
              ...prev,
              latitude: res.latitude,
              longitude: res.longitude,
              locationCapturedAt: new Date().toISOString(),
              city: prev.city.trim() ? prev.city : (res.city || prev.city),
            }));
            setAddressResolved(true);
            setGeocodeError('');
            resolvedCoords = { latitude: res.latitude, longitude: res.longitude };
          }
        } catch {
          // Validation below will guide the donor to click the map pin
        } finally {
          setResolvingNext(false);
        }
      }
    }

    const check = validateStep(step, resolvedCoords);
    if (check.valid) {
      setStep((s) => s + 1);
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      focusField(check.focusId);
    }
  };

  const handleSubmit = async () => {
    if (loading) return;
    if (!user) {
      setError('Please sign in as a donor to publish a food donation.');
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const check = validateStep(1);
    if (!check.valid) {
      setStep(1);
      setTimeout(() => focusField(check.focusId), 50);
      return;
    }
    if (!form.safetyDeclarationSigned) {
      setError('You must sign the Food Safety Declaration before publishing.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      if (isEdit && id) {
        await DonationService.updateListing(id, form);
        navigate('/donor-donations');
      } else {
        await DonationService.createListing(user.id, form);
        navigate('/donor-donations');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save food donation listing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className={styles.page} style={{ alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <Loader2 size={36} className="animate-spin" style={{ color: '#ea580c', marginBottom: 12 }} />
        <p style={{ color: '#6b7280', fontSize: 14 }}>Loading donation details...</p>
      </div>
    );
  }

  const hasCoords =
    typeof form.latitude === 'number' &&
    typeof form.longitude === 'number' &&
    !isNaN(form.latitude) &&
    !isNaN(form.longitude);

  const mapCenter: [number, number] = hasCoords
    ? [form.latitude!, form.longitude!]
    : [20.5937, 78.9629];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{isEdit ? 'Edit Food Donation' : 'Donate Surplus Food'}</h1>
        <p className={styles.subtitle}>
          {isEdit
            ? 'Update pickup details, scheduling, and quantity for this food listing'
            : 'List surplus meals quickly to connect with verified NGOs and volunteer riders'}
        </p>
      </div>

      {/* Step Indicator */}
      <div className={styles.steps}>
        {STEPS.map((s, i) => (
          <div
            key={i}
            className={`${styles.step} ${i === step ? styles.stepActive : ''} ${i < step ? styles.stepDone : ''}`}
          >
            <div className={styles.stepBubble}>
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            <span className={styles.stepLabel}>{s}</span>
            {i < STEPS.length - 1 && (
              <div className={`${styles.stepLine} ${i < step ? styles.stepLineDone : ''}`} />
            )}
          </div>
        ))}
      </div>

      <div ref={cardRef} className={styles.card}>
        {error && (
          <div className={styles.errorBanner} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 0: Food Details */}
        {step === 0 && (
          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>1. Food & Dietary Information</h2>

            <div className={styles.field}>
              <label htmlFor="foodTitle" className={styles.label}>Food Title *</label>
              <input
                id="foodTitle"
                className={styles.input}
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="e.g., Vegetable Dum Biryani, Mixed Dal & Roti"
                required
              />
            </div>

            <div className={styles.twoCol}>
              <div className={styles.field}>
                <label htmlFor="foodCategory" className={styles.label}>Category *</label>
                <select
                  id="foodCategory"
                  className={styles.input}
                  value={form.category}
                  onChange={(e) => update('category', e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="foodType" className={styles.label}>Dietary Classification *</label>
                <select
                  id="foodType"
                  className={styles.input}
                  value={form.foodType}
                  onChange={(e) => update('foodType', e.target.value as FoodType)}
                >
                  {FOOD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.twoCol}>
              <div className={styles.field}>
                <label htmlFor="servings" className={styles.label}>Estimated Servings / Meals *</label>
                <input
                  id="servings"
                  className={styles.input}
                  type="number"
                  min={1}
                  value={form.servings}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    update('servings', val);
                    update('quantityValue', val);
                  }}
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="quantityUnit" className={styles.label}>Quantity Unit</label>
                <select
                  id="quantityUnit"
                  className={styles.input}
                  value={form.quantityUnit || 'servings'}
                  onChange={(e) => update('quantityUnit', e.target.value)}
                >
                  {QUANTITY_UNITS.map((q) => (
                    <option key={q.value} value={q.value}>{q.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.twoCol}>
              <div className={styles.field}>
                <label htmlFor="preparationDate" className={styles.label}>Prepared / Cooked Time</label>
                <input
                  id="preparationDate"
                  className={styles.input}
                  type="datetime-local"
                  value={form.preparationDate || ''}
                  onChange={(e) => update('preparationDate', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="storageType" className={styles.label}>Storage & Holding Condition *</label>
                <select
                  id="storageType"
                  className={styles.input}
                  value={form.storageType}
                  onChange={(e) => update('storageType', e.target.value)}
                >
                  {STORAGE_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.twoCol}>
              <div className={styles.field}>
                <label htmlFor="packagingType" className={styles.label}>Packaging Type</label>
                <select
                  id="packagingType"
                  className={styles.input}
                  value={form.packagingType}
                  onChange={(e) => update('packagingType', e.target.value)}
                >
                  {PACKAGING_TYPES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="packagingNotes" className={styles.label}>Packaging Notes (Optional)</label>
                <input
                  id="packagingNotes"
                  className={styles.input}
                  value={form.packagingNotes || ''}
                  onChange={(e) => update('packagingNotes', e.target.value)}
                  placeholder="e.g., Packed in 5 large foil trays with lids"
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Allergens / Dietary Warnings</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {ALLERGEN_OPTIONS.map((a) => {
                  const active = (form.allergens || []).includes(a);
                  return (
                    <button
                      type="button"
                      key={a}
                      onClick={() => {
                        const current = form.allergens || [];
                        const next = active ? current.filter((x) => x !== a) : [...current, a];
                        update('allergens', next);
                      }}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 500,
                        border: `1.5px solid ${active ? '#ea580c' : '#d1d5db'}`,
                        background: active ? '#fff7ed' : '#ffffff',
                        color: active ? '#ea580c' : '#4b5563',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {a} {active && '✓'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="description" className={styles.label}>Description & Ingredients</label>
              <textarea
                id="description"
                className={`${styles.input} ${styles.textarea}`}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Include dish contents, spiciness, heating suggestions, or handling instructions..."
                rows={3}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Food Photograph (Recommended)</label>
              <label className={styles.uploadArea}>
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className={styles.imagePreview} />
                ) : (
                  <div className={styles.uploadPlaceholder}>
                    <Upload size={24} />
                    <span>Click or drag image to upload photo</span>
                    <span className={styles.uploadHint}>JPG, PNG, WEBP up to 5MB</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className={styles.fileInput}
                />
              </label>
            </div>

            <div className={styles.checkRow}>
              <input
                type="checkbox"
                id="urgent"
                checked={form.isUrgent}
                onChange={(e) => update('isUrgent', e.target.checked)}
              />
              <label htmlFor="urgent" className={styles.checkLabel} style={{ fontWeight: 600, color: '#dc2626' }}>
                🚨 Mark as Urgent (Requires rapid pickup within 1-2 hours)
              </label>
            </div>
          </div>
        )}

        {/* STEP 1: Pickup Details & Safety Declaration */}
        {step === 1 && (
          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>2. Pickup Logistics & Safety Declaration</h2>

            {/* Address Field + Live GPS Detection */}
            <div className={styles.field}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <label htmlFor="pickupAddress" className={styles.label} style={{ marginBottom: 0 }}>Pickup Address *</label>
                <button
                  type="button"
                  onClick={handleDetectGPS}
                  disabled={gpsDetecting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #ea580c',
                    background: '#fff7ed',
                    color: '#ea580c',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: gpsDetecting ? 'wait' : 'pointer',
                  }}
                >
                  {gpsDetecting ? <Loader2 size={13} className="animate-spin" /> : <LocateFixed size={13} />}
                  {gpsDetecting ? 'Detecting GPS...' : 'Use Current GPS Location'}
                </button>
              </div>
              <input
                id="pickupAddress"
                className={styles.input}
                value={form.pickupAddress}
                onChange={(e) => update('pickupAddress', e.target.value)}
                placeholder="e.g., 42 Kitchen Garden Road, Bandra West"
                required
              />

              {gpsNotice && (
                <div className={`${styles.addressStatus} ${gpsNotice.type === 'success' ? styles.addressStatusSuccess : styles.addressStatusError}`}>
                  {gpsNotice.type === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />} {gpsNotice.text}
                </div>
              )}

              {geocoding && (
                <div className={`${styles.addressStatus} ${styles.addressStatusLoading}`}>
                  <Loader2 size={13} className="animate-spin" /> Resolving address on map...
                </div>
              )}

              {addressResolved && !geocoding && hasCoords && !gpsNotice && (
                <div className={`${styles.addressStatus} ${styles.addressStatusSuccess}`}>
                  <CheckCircle2 size={13} /> Location verified on map ({form.latitude!.toFixed(4)}, {form.longitude!.toFixed(4)})
                </div>
              )}

              {geocodeError && !geocoding && (
                <div className={`${styles.addressStatus} ${styles.addressStatusError}`}>
                  <AlertCircle size={13} /> {geocodeError}
                </div>
              )}
            </div>

            {/* Configurable NGO & Rider Notification Radius */}
            <div className={styles.field}>
              <label htmlFor="notificationRadiusKm" className={styles.label}>
                Nearby NGO &amp; Rider Alert Radius
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <select
                  id="notificationRadiusKm"
                  className={styles.input}
                  style={{ maxWidth: 220 }}
                  value={form.notificationRadiusKm || 15}
                  onChange={(e) => update('notificationRadiusKm', Number(e.target.value))}
                >
                  <option value={5}>Within 5 KM</option>
                  <option value={10}>Within 10 KM</option>
                  <option value={15}>Within 15 KM</option>
                  <option value={20}>Within 20 KM</option>
                  <option value={30}>Within 30 KM</option>
                </select>
                {nearbyNgoCount !== null && (
                  <span style={{ fontSize: 12, color: nearbyNgoCount > 0 ? '#16a34a' : '#6b7280', fontWeight: 600 }}>
                    {nearbyNgoCount} verified NGO{nearbyNgoCount === 1 ? '' : 's'} within {form.notificationRadiusKm || 15} km will be notified immediately
                  </span>
                )}
              </div>
            </div>

            {/* City & Contact Phone */}
            <div className={styles.twoCol}>
              <div className={styles.field}>
                <label htmlFor="city" className={styles.label}>City *</label>
                <input
                  id="city"
                  className={styles.input}
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                  placeholder="e.g., Mumbai"
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="contactPhone" className={styles.label}>Contact Phone for Rider Coordination</label>
                <input
                  id="contactPhone"
                  className={styles.input}
                  value={form.contactPhone || ''}
                  onChange={(e) => update('contactPhone', e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            {/* Pickup Date & Pickup Time */}
            <div className={styles.twoCol}>
              <div className={styles.field}>
                <label htmlFor="pickupDate" className={styles.label}>Pickup Date *</label>
                <input
                  id="pickupDate"
                  className={styles.input}
                  type="date"
                  value={form.pickupDate || ''}
                  onChange={(e) => {
                    const d = e.target.value;
                    setForm((f) => {
                      const next = { ...f, pickupDate: d };
                      if (d && f.pickupTime) {
                        const fromStr = `${d}T${f.pickupTime}`;
                        next.availableFrom = fromStr;
                        const fromMs = new Date(fromStr).getTime();
                        const currentUntilMs = f.availableUntil ? new Date(f.availableUntil).getTime() : 0;
                        if (!f.availableUntil || isNaN(currentUntilMs) || currentUntilMs <= Math.max(fromMs, Date.now())) {
                          const baseMs = !isNaN(fromMs) ? Math.max(fromMs, Date.now()) : Date.now();
                          next.availableUntil = formatLocalDateTime(new Date(baseMs + 4 * 60 * 60 * 1000));
                        }
                      } else if (!d) {
                        next.availableFrom = '';
                      }
                      return next;
                    });
                  }}
                  required
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="pickupTime" className={styles.label}>Pickup Time *</label>
                <input
                  id="pickupTime"
                  className={styles.input}
                  type="time"
                  value={form.pickupTime || ''}
                  onChange={(e) => {
                    const t = e.target.value;
                    setForm((f) => {
                      const next = { ...f, pickupTime: t };
                      if (f.pickupDate && t) {
                        const fromStr = `${f.pickupDate}T${t}`;
                        next.availableFrom = fromStr;
                        const fromMs = new Date(fromStr).getTime();
                        const currentUntilMs = f.availableUntil ? new Date(f.availableUntil).getTime() : 0;
                        if (!f.availableUntil || isNaN(currentUntilMs) || currentUntilMs <= Math.max(fromMs, Date.now())) {
                          const baseMs = !isNaN(fromMs) ? Math.max(fromMs, Date.now()) : Date.now();
                          next.availableUntil = formatLocalDateTime(new Date(baseMs + 4 * 60 * 60 * 1000));
                        }
                      } else if (!t) {
                        next.availableFrom = '';
                      }
                      return next;
                    });
                  }}
                  required
                />
              </div>
            </div>

            {/* Expiry Deadline with 1-click Future Quick-Pick */}
            <div className={styles.field}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <label htmlFor="availableUntil" className={styles.label} style={{ marginBottom: 0 }}>
                  Latest Collection Deadline (Expiry) *
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {[2, 4, 6, 12].map((hrs) => (
                    <button
                      key={hrs}
                      type="button"
                      onClick={() => setQuickDeadline(hrs)}
                      style={{
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        border: '1.5px solid #ea580c',
                        background: '#fff7ed',
                        color: '#ea580c',
                        cursor: 'pointer',
                      }}
                    >
                      +{hrs} hrs
                    </button>
                  ))}
                </div>
              </div>
              <input
                id="availableUntil"
                className={styles.input}
                type="datetime-local"
                min={minDeadline}
                value={form.availableUntil || ''}
                onChange={(e) => {
                  update('availableUntil', e.target.value);
                  if (error) setError('');
                }}
                required
              />
            </div>

            {/* Interactive Pickup Location Map */}
            <div id="pickupMapSection" className={styles.field}>
              <label className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={15} color="#ea580c" />
                <span>Pickup Location Map (Draggable Marker) *</span>
              </label>

              <div className={styles.mapWrap}>
                {!hasCoords && (
                  <div className={styles.mapHintOverlay}>
                    📍 Enter pickup address above or click on map to set your location pin
                  </div>
                )}

                <MapContainer
                  center={mapCenter}
                  zoom={hasCoords ? 15 : 5}
                  style={{ width: '100%', height: '100%' }}
                  zoomControl={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <MapEventsHandler onMapClick={handlePinPlaced} />

                  {hasCoords && (
                    <>
                      <MapFlyTo coords={[form.latitude!, form.longitude!]} />
                      <Marker
                        position={[form.latitude!, form.longitude!]}
                        draggable={true}
                        icon={createPickupPinIcon()}
                        eventHandlers={{
                          dragend: (e) => {
                            const latlng = e.target.getLatLng();
                            handlePinPlaced(latlng.lat, latlng.lng);
                          },
                        }}
                      />
                    </>
                  )}
                </MapContainer>

                {hasCoords && (
                  <div className={styles.mapCoordsBadge}>
                    Lat: {form.latitude!.toFixed(4)}, Lng: {form.longitude!.toFixed(4)}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="specialInstructions" className={styles.label}>Special Pickup Instructions</label>
              <input
                id="specialInstructions"
                className={styles.input}
                value={form.specialInstructions || ''}
                onChange={(e) => update('specialInstructions', e.target.value)}
                placeholder="e.g., Ask for Chef Rohan at kitchen door #2, call when 5 mins away"
              />
            </div>

            <div className={styles.checkRow} style={{ marginTop: 6 }}>
              <input
                type="checkbox"
                id="directHandover"
                checked={form.directHandover}
                onChange={(e) => update('directHandover', e.target.checked)}
              />
              <label htmlFor="directHandover" className={styles.checkLabel}>
                Staff will be on-site to hand over food directly to the rider or NGO representative
              </label>
            </div>

            {/* MANDATORY FOOD SAFETY DECLARATION */}
            <div style={{
              marginTop: 18,
              padding: 18,
              background: '#fef2f2',
              borderRadius: 12,
              border: '1.5px solid #fecaca',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <ShieldCheck size={22} color="#dc2626" />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#991b1b' }}>
                  Mandatory Food Safety Certification
                </h3>
              </div>
              <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#7f1d1d', lineHeight: 1.5 }}>
                ShareBite connects donors directly with communities in need. To ensure consumer safety, all donors must verify that surplus food meets health & sanitation standards.
              </p>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: '#1f2937',
              }}>
                <input
                  type="checkbox"
                  id="safetyDeclaration"
                  checked={!!form.safetyDeclarationSigned}
                  onChange={(e) => update('safetyDeclarationSigned', e.target.checked)}
                  style={{ marginTop: 3, width: 17, height: 17, accentColor: '#ea580c' }}
                />
                <span>
                  I declare under penalty of platform suspension that this food has been prepared hygienically, stored at appropriate temperatures, is not expired, and is safe and fit for human consumption. *
                </span>
              </label>
            </div>
          </div>
        )}

        {/* STEP 2: Review & Submit */}
        {step === 2 && (
          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>3. Review Your Food Donation</h2>
            <div className={styles.reviewGrid}>
              {imagePreview && (
                <img src={imagePreview} alt="Food" className={styles.reviewImage} />
              )}
              <div className={styles.reviewDetails}>
                <div className={styles.reviewRow}>
                  <span>Title</span>
                  <strong>{form.title}</strong>
                </div>
                <div className={styles.reviewRow}>
                  <span>Category</span>
                  <strong>{form.category}</strong>
                </div>
                <div className={styles.reviewRow}>
                  <span>Dietary Type</span>
                  <strong style={{ textTransform: 'capitalize' }}>
                    {FOOD_TYPES.find((t) => t.value === form.foodType)?.label || form.foodType}
                  </strong>
                </div>
                <div className={styles.reviewRow}>
                  <span>Total Servings</span>
                  <strong>{form.servings} portions ({form.quantityUnit})</strong>
                </div>
                <div className={styles.reviewRow}>
                  <span>Storage Condition</span>
                  <strong>
                    {STORAGE_TYPES.find((s) => s.value === form.storageType)?.label || form.storageType}
                  </strong>
                </div>
                <div className={styles.reviewRow}>
                  <span>Packaging</span>
                  <strong>
                    {PACKAGING_TYPES.find((p) => p.value === form.packagingType)?.label || form.packagingType}
                  </strong>
                </div>
                {form.allergens && form.allergens.length > 0 && (
                  <div className={styles.reviewRow}>
                    <span>Allergens</span>
                    <strong style={{ color: '#ea580c' }}>{form.allergens.join(', ')}</strong>
                  </div>
                )}
                <div className={styles.reviewRow}>
                  <span>Pickup Location</span>
                  <strong>{form.pickupAddress}, {form.city}</strong>
                </div>
                {hasCoords && (
                  <div className={styles.reviewRow}>
                    <span>Map Coordinates</span>
                    <strong style={{ fontFamily: 'monospace', color: '#059669' }}>
                      {form.latitude!.toFixed(5)}, {form.longitude!.toFixed(5)}
                    </strong>
                  </div>
                )}
                <div className={styles.reviewRow}>
                  <span>Pickup Schedule</span>
                  <strong>
                    {form.pickupDate} {form.pickupTime ? `at ${form.pickupTime}` : ''}
                  </strong>
                </div>
                <div className={styles.reviewRow}>
                  <span>Collection Deadline</span>
                  <strong>{form.availableUntil ? new Date(form.availableUntil).toLocaleString() : 'Not set'}</strong>
                </div>
                {form.isUrgent && (
                  <div className={styles.urgentTag}>⚠️ Urgent Listing (Priority Pickup)</div>
                )}
                <div style={{
                  marginTop: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#16a34a',
                  fontSize: 13,
                  fontWeight: 600,
                }}>
                  <ShieldCheck size={16} /> Food Safety Declaration Signed
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className={styles.errorBanner} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 0 }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className={styles.navBtns}>
          {step > 0 && (
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => {
                setError('');
                setStep((s) => s - 1);
              }}
              disabled={resolvingNext || loading}
            >
              <ChevronLeft size={16} /> Back
            </button>
          )}

          {step < 2 ? (
            <button
              type="button"
              className={styles.nextBtn}
              onClick={handleNext}
              disabled={resolvingNext}
            >
              {resolvingNext ? 'Verifying location...' : 'Continue'} {!resolvingNext && <ChevronRight size={16} />}
            </button>
          ) : (
            <button
              type="button"
              className={styles.nextBtn}
              onClick={handleSubmit}
              disabled={loading || !form.safetyDeclarationSigned}
              style={{
                background: '#ea580c',
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading
                ? (isEdit ? 'Updating Listing...' : 'Publishing to Network...')
                : (isEdit ? 'Update Food Listing' : 'Publish Food Donation')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
