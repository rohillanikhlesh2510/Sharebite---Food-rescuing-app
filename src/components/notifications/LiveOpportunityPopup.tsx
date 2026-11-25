import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Clock, MapPin, Package, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { normalizeRole } from '../../services/auth';
import { NotificationsService } from '../../services/notifications';
import { ClaimsService } from '../../services/claims';
import type { AppNotification } from '../../types';

export default function LiveOpportunityPopup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  const [queue, setQueue] = useState<AppNotification[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const userId = user?.id;
  const canonicalRole = normalizeRole(user?.role);

  useEffect(() => {
    if (!userId || !canonicalRole) return;
    const isNGO = canonicalRole === 'ngo';
    const isRider = canonicalRole === 'rider';

    const sub = NotificationsService.subscribeToNotifications(userId, (notif) => {
      // Trigger browser notification if user granted permission
      NotificationsService.showBrowserNotification(notif.title, notif.body, () => {
        if (notif.actionUrl) navigateRef.current(notif.actionUrl);
      });

      const isOpportunity =
        (isNGO && (notif.type === 'food_nearby' || notif.type === 'new_donation')) ||
        (isRider && notif.type === 'pickup_nearby');

      if (isOpportunity) {
        setQueue((prev) => {
          if (prev.some((p) => p.id === notif.id)) return prev;
          return [notif, ...prev].slice(0, 3);
        });
      }

      // If a donation was claimed by someone else, automatically remove any matching popup card
      if (notif.type === 'donation_already_claimed' && notif.relatedFoodId) {
        setQueue((prev) => prev.filter((p) => p.relatedFoodId !== notif.relatedFoodId));
      }
    });

    return () => {
      sub.unsubscribe();
    };
  }, [userId, canonicalRole]);

  const dismiss = (id: string) => {
    setQueue((prev) => prev.filter((n) => n.id !== id));
    setStatusMsg(null);
  };

  const handleAccept = async (notif: AppNotification) => {
    setAcceptingId(notif.id);
    setStatusMsg(null);
    try {
      const oppType = notif.data?.opportunity_type;
      const taskId = notif.data?.delivery_task_id || notif.relatedDeliveryId;
      const foodId = notif.data?.food_listing_id || notif.relatedFoodId;

      if (oppType === 'delivery_task' && taskId) {
        await ClaimsService.acceptDeliveryJob(taskId);
        setStatusMsg({ type: 'success', text: 'Delivery job assigned to you! Opening Rider Dashboard...' });
        setTimeout(() => {
          dismiss(notif.id);
          navigate('/rider-dashboard');
        }, 900);
      } else if (foodId) {
        const res = await ClaimsService.acceptDonation(foodId);
        setStatusMsg({
          type: 'success',
          text:
            res.acceptedBy === 'ngo'
              ? 'Food claimed successfully! Opening My Claims...'
              : 'Pickup accepted! Opening Rider Dashboard...',
        });
        setTimeout(() => {
          dismiss(notif.id);
          navigate(res.acceptedBy === 'ngo' ? '/my-claims' : '/rider-dashboard');
        }, 900);
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err?.message || 'Already claimed by another user.',
      });
    } finally {
      setAcceptingId(null);
    }
  };

  if (queue.length === 0) return null;

  const current = queue[0];
  const d = current.data || {};
  const isRider = ['rider', 'volunteer'].includes(user?.role || '');
  const deadlineText = d.available_until
    ? new Date(d.available_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 76,
        right: 20,
        zIndex: 2000,
        width: 'min(370px, calc(100vw - 32px))',
        background: '#ffffff',
        border: '1.5px solid #fdba74',
        borderRadius: 14,
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.16)',
        padding: 16,
        fontFamily: 'inherit',
      }}
      role="dialog"
      aria-label="Live Food Opportunity"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ea580c', fontWeight: 700, fontSize: 13 }}>
          <Bell size={16} />
          <span>{isRider ? 'NEW FOOD PICKUP AVAILABLE!' : 'NEW FOOD AVAILABLE!'}</span>
        </div>
        <button
          onClick={() => dismiss(current.id)}
          aria-label="Dismiss notification"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 2 }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        {d.image_url && (
          <img
            src={d.image_url}
            alt={d.title || 'Food'}
            style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
          />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 4 }}>
            {d.title || current.title}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: '#4b5563' }}>
            {d.servings && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Package size={12} /> {d.servings} {d.quantity_unit || 'servings'}
              </span>
            )}
            {d.distance_km != null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#0284c7', fontWeight: 600 }}>
                <MapPin size={12} /> {d.distance_km} KM
              </span>
            )}
            {deadlineText && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} /> Until {deadlineText}
              </span>
            )}
          </div>
          {d.approximate_area && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>Area: {d.approximate_area}</div>
          )}
        </div>
      </div>

      {statusMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 10px',
            borderRadius: 8,
            fontSize: 12,
            marginBottom: 10,
            background: statusMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: statusMsg.type === 'success' ? '#166534' : '#991b1b',
          }}
        >
          {statusMsg.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => {
            const target = d.food_listing_id ? `/donations/${d.food_listing_id}` : current.actionUrl || '/discover';
            dismiss(current.id);
            navigate(target);
          }}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #d1d5db',
            background: '#ffffff',
            color: '#374151',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {isRider ? 'View Pickup' : 'View Details'}
        </button>
        <button
          onClick={() => handleAccept(current)}
          disabled={acceptingId === current.id}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            border: 'none',
            background: '#ea580c',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: 13,
            cursor: acceptingId === current.id ? 'wait' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {acceptingId === current.id && <Loader2 size={14} className="animate-spin" />}
          {isRider ? 'Accept Pickup' : 'Accept Food'}
        </button>
      </div>
    </div>
  );
}
