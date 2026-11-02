import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Upload, ChevronLeft, ChevronRight, Check, ShieldCheck,
  AlertCircle, MapPin, Loader2, CheckCircle2
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { divIcon } from 'leaflet';
import { useAuth } from '../../context/AuthContext';
import { DonationService } from '../../services/donations';
import { LocationService } from '../../services/location';
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
  });

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const [error, setError] = useState('');

  // Geocoding and map states
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState('');
  const [addressResolved, setAddressResolved] = useState(false);

  // Refs for race-condition prevention and edit loading protection
  const latestAddressRef = useRef(form.pickupAddress);
  const isInitialLoadRef = useRef(false);

  useEffect(() => {
    latestAddressRef.current = form.pickupAddress;
  }, [form.pickupAddress]);

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

  // Debounced geocoding when pickup address changes
  useEffect(() => {
    // If this change was triggered by initial edit form loading, preserve existing coordinates
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    const addr = form.pickupAddress.trim();
    if (!addr || addr.length < 3) {
      setGeocoding((prev) => (prev ? false : prev));
      setAddressResolved((prev) => (prev ? false : prev));
      setGeocodeError((prev) => (prev ? '' : prev));
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setGeocoding(true);
      setGeocodeError('');

      try {
        const res = await LocationService.geocodeAddress(addr, controller.signal);
        if (latestAddressRef.current.trim() === addr) {
          if (res) {
            setForm((prev) => ({
              ...prev,
              latitude: res.latitude,
              longitude: res.longitude,
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
  }, [form.pickupAddress]);

  // Handle marker drag or map click to manually place pin
  const handlePinPlaced = async (lat: number, lng: number) => {
    if (isNaN(lat) || isNaN(lng)) return;
    update('latitude', lat);
    update('longitude', lng);
    setAddressResolved(true);
    setGeocodeError('');

    try {
      const rev = await LocationService.reverseGeocode(lat, lng);
      if (rev) {
        if (!form.pickupAddress.trim()) {
          update('pickupAddress', rev.address);
        }
        if (!form.city.trim() && rev.city) {
          update('city', rev.city);
        }
      }
    } catch (revErr) {
      console.warn('Reverse geocode error:', revErr);
    }
  };

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

  const validateStep = (currentStep: number): boolean => {
    setError('');
    if (currentStep === 0) {
      if (!form.title.trim()) {
        setError('Please enter a food title.');
        return false;
      }
      if (!form.category) {
        setError('Please select a food category.');
        return false;
      }
      if (!form.servings || form.servings <= 0) {
        setError('Please enter a valid number of servings (minimum 1).');
        return false;
      }
      return true;
    }

    if (currentStep === 1) {
      if (!form.pickupAddress.trim()) {
        setError('Pickup address is required. Please enter an address.');
        return false;
      }
      if (!form.city.trim()) {
        setError('City is required. Please specify a city.');
        return false;
      }
      if (!form.pickupDate) {
        setError('Pickup date is required.');
        return false;
      }
      if (!form.pickupTime) {
        setError('Pickup time is required.');
        return false;
      }
      if (!form.availableUntil) {
        setError('Latest collection deadline (expiry) is required.');
        return false;
      }
      const untilMs = new Date(form.availableUntil).getTime();
      if (isNaN(untilMs) || untilMs <= Date.now()) {
        setError('Latest collection deadline must be in the future.');
        return false;
      }
      if (form.availableFrom) {
        const fromMs = new Date(form.availableFrom).getTime();
        if (!isNaN(fromMs) && untilMs <= fromMs) {
          setError('Collection deadline must be after the pickup time.');
          return false;
        }
      }
      if (
        form.latitude === undefined ||
        form.longitude === undefined ||
        isNaN(form.latitude) ||
        isNaN(form.longitude)
      ) {
        setError('Please verify your pickup location on the map or click the map to place a pin.');
        return false;
      }
      if (!form.safetyDeclarationSigned) {
        setError('You must sign the Food Safety Declaration before continuing.');
        return false;
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((s) => s + 1);
    }
  };

  const handleSubmit = async () => {
    if (!user || loading) return;
    if (!validateStep(1)) {
      setStep(1);
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

      <div className={styles.card}>
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

            {/* Address Field: Completely blank by default */}
            <div className={styles.field}>
              <label htmlFor="pickupAddress" className={styles.label}>Pickup Address *</label>
              <input
                id="pickupAddress"
                className={styles.input}
                value={form.pickupAddress}
                onChange={(e) => update('pickupAddress', e.target.value)}
                placeholder="e.g., 42 Kitchen Garden Road, Bandra West"
                required
              />

              {geocoding && (
                <div className={`${styles.addressStatus} ${styles.addressStatusLoading}`}>
                  <Loader2 size={13} className="animate-spin" /> Resolving address on map...
                </div>
              )}

              {addressResolved && !geocoding && hasCoords && (
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

            {/* Pickup Date & Pickup Time: Completely blank by default */}
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
                      if (d && f.pickupTime) next.availableFrom = `${d}T${f.pickupTime}`;
                      else if (!d) next.availableFrom = '';
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
                      if (f.pickupDate && t) next.availableFrom = `${f.pickupDate}T${t}`;
                      else if (!t) next.availableFrom = '';
                      return next;
                    });
                  }}
                  required
                />
              </div>
            </div>

            {/* Expiry Deadline: Completely blank by default */}
            <div className={styles.field}>
              <label htmlFor="availableUntil" className={styles.label}>Latest Collection Deadline (Expiry) *</label>
              <input
                id="availableUntil"
                className={styles.input}
                type="datetime-local"
                value={form.availableUntil || ''}
                onChange={(e) => update('availableUntil', e.target.value)}
                required
              />
            </div>

            {/* Interactive Pickup Location Map */}
            <div className={styles.field}>
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

        {/* Navigation Buttons */}
        <div className={styles.navBtns}>
          {step > 0 && (
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => setStep((s) => s - 1)}
            >
              <ChevronLeft size={16} /> Back
            </button>
          )}

          {step < 2 ? (
            <button
              type="button"
              className={styles.nextBtn}
              onClick={handleNext}
            >
              Continue <ChevronRight size={16} />
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
