// ShareBite — Notifications Service (Web)
import { supabase } from '../lib/supabase';
import { toSafeUUID, DEMO_RECORD_UUIDS } from '../lib/uuid';
import type { AppNotification, NotificationType } from '../types';

export const NotificationsService = {
  async getNotifications(userId: string): Promise<AppNotification[]> {
    const safeUserId = toSafeUUID(userId, DEMO_RECORD_UUIDS.donor);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', safeUserId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((item: any) => ({
      id: item.id,
      userId: item.user_id,
      type: item.type as NotificationType,
      title: item.title,
      body: item.message,
      isRead: item.is_read,
      createdAt: item.created_at,
    }));
  },

  async getUnreadCount(userId: string): Promise<number> {
    const safeUserId = toSafeUUID(userId, DEMO_RECORD_UUIDS.donor);
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', safeUserId)
      .eq('is_read', false);
    return count || 0;
  },

  async markAsRead(notificationId: string): Promise<void> {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
  },

  async markAllAsRead(userId: string): Promise<void> {
    const safeUserId = toSafeUUID(userId, DEMO_RECORD_UUIDS.donor);
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', safeUserId).eq('is_read', false);
  },

  subscribeToNotifications(userId: string, onNotification: (n: AppNotification) => void) {
    const safeUserId = toSafeUUID(userId, DEMO_RECORD_UUIDS.donor);
    const channelName = `notifs_${safeUserId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${safeUserId}`,
      }, (payload) => {
        const item = payload.new as any;
        onNotification({
          id: item.id,
          userId: item.user_id,
          type: item.type as NotificationType,
          title: item.title,
          body: item.message,
          isRead: item.is_read,
          createdAt: item.created_at,
        });
      })
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      }
    };
  },
};
