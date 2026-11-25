import { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle, ShieldAlert, Truck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { normalizeRole } from '../../services/auth';
import { ClaimsService, type RiderProfileRecord } from '../../services/claims';
import { supabase } from '../../lib/supabase';
import styles from './ProfilePage.module.css';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const isRider = normalizeRole(user?.role) === 'rider';
  const [riderRec, setRiderRec] = useState<RiderProfileRecord | null>(null);
  const [vehicleType, setVehicleType] = useState('bike');
  const [vehicleNumber, setVehicleNumber] = useState('');

  useEffect(() => {
    if (!isRider || !user?.id) return;
    ClaimsService.getOrEnsureRiderProfile(user.id, user.name, user.phone).then((r) => {
      if (r) {
        setRiderRec(r);
        setVehicleType(r.vehicleType || 'bike');
        setVehicleNumber(r.vehicleNumber || '');
      }
    });
  }, [isRider, user?.id, user?.name, user?.phone]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [city, setCity] = useState(user?.location?.city || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
      if (!upErr) {
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
        await updateProfile({ avatar: pub.publicUrl });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        return;
      }
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        await updateProfile({ avatar: dataUrl });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Failed to update avatar:', err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ name, bio, phone, location: { ...user?.location, city, address: user?.location?.address || '', latitude: (user?.location?.latitude ?? 0) as number, longitude: (user?.location?.longitude ?? 0) as number } });
      if (isRider && user?.id) {
        await supabase
          .from('riders')
          .update({
            name,
            phone,
            vehicle_type: vehicleType,
            vehicle_number: vehicleNumber,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
        const updated = await ClaimsService.getOrEnsureRiderProfile(user.id, name, phone);
        if (updated) setRiderRec(updated);
      }
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    finally { setSaving(false); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Profile</h1>
        <p className={styles.subtitle}>Manage your ShareBite profile</p>
      </div>

      <div className={styles.layout}>
        <div className={styles.avatarCard}>
          <div className={styles.avatarWrap}>
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className={styles.avatarImg} />
            ) : (
              <div className={styles.avatarFallback}>
                {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarFile}
            />
            <button
              className={styles.cameraBtn}
              aria-label="Change photo"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
            >
              <Camera size={14} />
            </button>
          </div>
          <h2 className={styles.profileName}>{user?.name}</h2>
          <span className={styles.roleBadge}>{user?.role}</span>
          {user?.isVerified || riderRec?.idVerified ? (
            <div className={styles.verifiedBadge}>
              <CheckCircle size={14} /> Verified
            </div>
          ) : isRider ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#d97706', background: '#fef3c7', padding: '4px 10px', borderRadius: 999, marginTop: 6 }}>
              <ShieldAlert size={13} /> Verification Pending
            </div>
          ) : null}
          {isRider && riderRec && (
            <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: riderRec.isOnline ? '#15803d' : '#64748b' }}>
              ● {riderRec.isOnline ? (riderRec.isAvailable ? 'Online & Available' : 'Online · On Active Delivery') : 'Offline'}
            </div>
          )}
          <div className={styles.profileStats}>
            <div className={styles.stat}>
              <span className={styles.statVal}>
                {isRider ? (riderRec?.totalDeliveries ?? 0) : (user?.totalDonations || 0)}
              </span>
              <span className={styles.statLbl}>{isRider ? 'Deliveries' : 'Donations'}</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statVal}>{user?.totalRescues || 0}</span>
              <span className={styles.statLbl}>Rescues</span>
            </div>
          </div>
        </div>

        <div className={styles.detailsCard}>
          {saved && <div className={styles.savedBanner}>Profile updated successfully!</div>}

          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Profile Details</h3>
            {!editing ? (
              <button className={styles.editBtn} onClick={() => setEditing(true)}>Edit</button>
            ) : (
              <div className={styles.editActions}>
                <button className={styles.cancelBtn} onClick={() => setEditing(false)}>Cancel</button>
                <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>

          <div className={styles.fields}>
            <div className={styles.field}>
              <label className={styles.label}>Full name</label>
              {editing ? (
                <input className={styles.input} value={name} onChange={e => setName(e.target.value)} />
              ) : <p className={styles.value}>{user?.name}</p>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <p className={styles.value}>{user?.email}</p>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Phone</label>
              {editing ? (
                <input className={styles.input} value={phone} onChange={e => setPhone(e.target.value)} />
              ) : <p className={styles.value}>{user?.phone || 'Not set'}</p>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>City</label>
              {editing ? (
                <input className={styles.input} value={city} onChange={e => setCity(e.target.value)} placeholder="Your city" />
              ) : <p className={styles.value}>{user?.location?.city || 'Not set'}</p>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Role</label>
              <p className={styles.value} style={{ textTransform: 'capitalize' }}>{user?.role}</p>
            </div>
            {isRider && (
              <>
                <div className={styles.field}>
                  <label className={styles.label}><Truck size={12} style={{ display: 'inline', marginRight: 4 }} /> Vehicle Type</label>
                  {editing ? (
                    <select className={styles.input} value={vehicleType} onChange={e => setVehicleType(e.target.value)}>
                      <option value="bike">Bike</option>
                      <option value="scooter">Scooter</option>
                      <option value="motorcycle">Motorcycle</option>
                      <option value="bicycle">Bicycle</option>
                      <option value="car">Car / Van</option>
                    </select>
                  ) : (
                    <p className={styles.value} style={{ textTransform: 'capitalize' }}>{vehicleType}</p>
                  )}
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Vehicle Number</label>
                  {editing ? (
                    <input className={styles.input} value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="e.g. DL 01 AB 1234" />
                  ) : (
                    <p className={styles.value}>{vehicleNumber || 'Not set'}</p>
                  )}
                </div>
              </>
            )}
            <div className={styles.fieldFull}>
              <label className={styles.label}>Bio</label>
              {editing ? (
                <textarea className={`${styles.input} ${styles.textarea}`} value={bio} onChange={e => setBio(e.target.value)} placeholder="A short bio about yourself or your organization" rows={3} />
              ) : <p className={styles.value}>{user?.bio || 'No bio added yet.'}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
