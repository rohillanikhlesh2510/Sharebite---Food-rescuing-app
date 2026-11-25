// ShareBite — Notifications Service (Web)
import { supabase } from '../lib/supabase';
import { isValidUUID } from '../lib/uuid';
import type { AppNotification, NotificationType } from '../types';

function mapNotification(item: any): AppNotification {
  return {
    id: item.id,
    userId: item.user_id,
    type: item.type as NotificationType,
    title: item.title,
    body: item.message,
    data: item.data && typeof item.data === 'object' ? item.data : undefined,
    actionUrl: item.action_url || undefined,
    relatedFoodId: item.related_food_id || item.data?.food_listing_id || undefined,
    relatedDeliveryId: item.related_delivery_id || item.data?.delivery_task_id || undefined,
    isRead: !!item.is_read,
    createdAt: item.created_at,
  };
}

export const NotificationsService = {
  async getNotifications(userId: string): Promise<AppNotification[]> {
    if (!isValidUUID(userId)) return [];
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60);

    if (error || !data) return [];
    return data.map(mapNotification);
  },

  async getUnreadCount(userId: string): Promise<number> {
    if (!isValidUUID(userId)) return 0;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    return count || 0;
  },

  async markAsRead(notificationId: string): Promise<void> {
    if (!isValidUUID(notificationId)) return;
    await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
  },

  async markAllAsRead(userId: string): Promise<void> {
    if (!isValidUUID(userId)) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
  },

  async requestBrowserPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try {
      return await Notification.requestPermission();
    } catch {
      return 'denied';
    }
  },

  showBrowserNotification(title: string, body: string, onClick?: () => void) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      const notif = new Notification(title, {
        body,
        icon: '/favicon.svg',
      });
      if (onClick) {
        notif.onclick = () => {
          window.focus();
          onClick();
          notif.close();
        };
      }
    } catch {}
  },

  subscribeToNotifications(
    userId: string,
    onNotification: (n: AppNotification) => void,
    onReconnect?: () => void
  ) {
    if (!isValidUUID(userId)) {
      return { unsubscribe: () => {} };
    }
    const channelName = `notifs_${userId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onNotification(mapNotification(payload.new));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          onReconnect?.();
        }
      });

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  },
};
