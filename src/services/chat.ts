import { supabase } from '../lib/supabase';
import { isValidUUID } from '../lib/uuid';
import type { Conversation, ChatMessage, User } from '../types';

function mapProfileToUser(p: any): User {
  return {
    id: p.id,
    name: p.full_name || p.organization_name || p.name || 'Partner',
    email: p.email || '',
    phone: p.phone || '',
    role: p.role || 'donor',
    avatar: p.avatar_url || p.avatar,
    isVerified: !!p.is_verified,
    totalDonations: p.total_donations || 0,
    totalRescues: p.total_rescues || 0,
    createdAt: p.created_at || new Date().toISOString(),
    updatedAt: p.updated_at || new Date().toISOString(),
  };
}

export class ChatService {
  /**
   * Securely get or create the dedicated Donor <-> Assigned Rider conversation
   * for a specific food donation / delivery task.
   */
  static async openDeliveryConversation(
    currentUserId: string,
    recipientUserId: string,
    options: {
      relatedListingId?: string;
      relatedTaskId?: string;
      title?: string;
    }
  ): Promise<Conversation> {
    if (!isValidUUID(currentUserId)) {
      throw new Error('Authentication required');
    }

    if (options.relatedListingId && isValidUUID(options.relatedListingId)) {
      const { data: rpcConvId, error: rpcErr } = await supabase.rpc(
        'get_or_create_delivery_conversation',
        {
          p_food_listing_id: options.relatedListingId,
          p_delivery_task_id: isValidUUID(options.relatedTaskId) ? options.relatedTaskId : null,
        }
      );

      if (!rpcErr && rpcConvId && isValidUUID(rpcConvId)) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', rpcConvId)
          .maybeSingle();
        if (conv) {
          return this.enrichConversation(conv, currentUserId);
        }
      }

      if (rpcErr && rpcErr.code !== 'PGRST202' && /Unauthorized/i.test(rpcErr.message || '')) {
        throw new Error(rpcErr.message);
      }
    }

    return this.getOrCreateDirectConversation(currentUserId, recipientUserId, {
      type: 'delivery',
      relatedListingId: options.relatedListingId,
      relatedTaskId: options.relatedTaskId,
      title: options.title,
    });
  }

  /**
   * Find an existing conversation between participants or create a new one
   */
  static async getOrCreateDirectConversation(
    currentUserId: string,
    recipientUserId: string,
    options?: {
      type?: 'direct' | 'donation' | 'delivery';
      relatedListingId?: string;
      relatedTaskId?: string;
      title?: string;
    }
  ): Promise<Conversation> {
    if (!isValidUUID(currentUserId) || !isValidUUID(recipientUserId)) {
      throw new Error('Valid participant IDs are required to start a conversation');
    }

    const type = options?.type || 'direct';
    const relatedListingId = isValidUUID(options?.relatedListingId) ? options?.relatedListingId : null;
    const relatedTaskId = isValidUUID(options?.relatedTaskId) ? options?.relatedTaskId : null;

    // 1. Check if a conversation with these participants already exists
    const { data: userConvs } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', currentUserId);

    if (userConvs && userConvs.length > 0) {
      const convIds = userConvs.map((c) => c.conversation_id).filter(isValidUUID);

      if (convIds.length > 0) {
        const { data: sharedConvs } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', recipientUserId)
          .in('conversation_id', convIds);

        if (sharedConvs && sharedConvs.length > 0) {
          for (const s of sharedConvs) {
            const { data: conv } = await supabase
              .from('conversations')
              .select('*')
              .eq('id', s.conversation_id)
              .maybeSingle();

            if (conv) {
              if (relatedTaskId && conv.related_task_id === relatedTaskId) {
                return this.enrichConversation(conv, currentUserId);
              }
              if (relatedListingId && conv.related_listing_id === relatedListingId) {
                return this.enrichConversation(conv, currentUserId);
              }
              if (!relatedListingId && !relatedTaskId && conv.type === 'direct') {
                return this.enrichConversation(conv, currentUserId);
              }
            }
          }
        }
      }
    }

    // 2. Create new conversation
    const { data: newConv, error: convErr } = await supabase
      .from('conversations')
      .insert({
        type,
        related_listing_id: relatedListingId,
        related_task_id: relatedTaskId,
        title: options?.title || null,
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (convErr || !newConv) {
      throw new Error(convErr?.message || 'Failed to create conversation');
    }

    // 3. Add strictly the two authorized participants
    const { error: partErr } = await supabase.from('conversation_participants').insert([
      { conversation_id: newConv.id, user_id: currentUserId },
      { conversation_id: newConv.id, user_id: recipientUserId },
    ]);

    if (partErr) {
      throw new Error(partErr.message || 'Failed to register conversation participants');
    }

    return this.enrichConversation(newConv, currentUserId);
  }

  /**
   * Enrich conversation record with participants, unread count for viewer & last message
   */
  private static async enrichConversation(conv: any, viewerUserId?: string): Promise<Conversation> {
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('*, profiles:user_id(id, full_name, organization_name, role, avatar_url, phone)')
      .eq('conversation_id', conv.id);

    const { data: lastMsg } = await supabase
      .from('messages')
      .select('*, sender:sender_id(id, full_name, organization_name, avatar_url, role)')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const mappedParticipants = (participants || []).map((p: any) => ({
      id: p.id,
      conversationId: p.conversation_id,
      userId: p.user_id,
      role: p.role,
      lastReadAt: p.last_read_at,
      user: p.profiles ? mapProfileToUser(p.profiles) : undefined,
    }));

    let unreadQuery = supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conv.id)
      .eq('is_read', false);

    if (viewerUserId && isValidUUID(viewerUserId)) {
      unreadQuery = unreadQuery.neq('sender_id', viewerUserId);
    }

    const { count: unreadCount } = await unreadQuery;

    return {
      id: conv.id,
      type: conv.type,
      relatedListingId: conv.related_listing_id,
      relatedTaskId: conv.related_task_id,
      title: conv.title,
      lastMessageAt: conv.last_message_at,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
      participants: mappedParticipants,
      unreadCount: unreadCount || 0,
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            conversationId: lastMsg.conversation_id,
            senderId: lastMsg.sender_id,
            content: lastMsg.content,
            messageType: lastMsg.message_type,
            metadata: lastMsg.metadata,
            isRead: lastMsg.is_read,
            createdAt: lastMsg.created_at,
          }
        : undefined,
    };
  }

  /**
   * Fetch all conversations for an authenticated user
   */
  static async getUserConversations(userId: string): Promise<Conversation[]> {
    if (!isValidUUID(userId)) return [];

    const { data: participantRows, error } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId);

    if (error || !participantRows || participantRows.length === 0) {
      return [];
    }

    const convIds = participantRows.map((r) => r.conversation_id).filter(isValidUUID);
    if (convIds.length === 0) return [];

    const { data: convs, error: convsErr } = await supabase
      .from('conversations')
      .select('*')
      .in('id', convIds)
      .order('last_message_at', { ascending: false });

    if (convsErr || !convs) return [];

    return Promise.all(convs.map((c) => this.enrichConversation(c, userId)));
  }

  /**
   * Get all messages in an authorized conversation
   */
  static async getMessages(conversationId: string): Promise<ChatMessage[]> {
    if (!isValidUUID(conversationId)) return [];

    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:sender_id(id, full_name, organization_name, avatar_url, role)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    return data.map((m: any) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      content: m.content,
      messageType: m.message_type || 'text',
      metadata: m.metadata || {},
      isRead: m.is_read,
      createdAt: m.created_at,
      sender: m.sender ? mapProfileToUser(m.sender) : undefined,
    }));
  }

  /**
   * Send a new message & update conversation timestamp
   */
  static async sendMessage(params: {
    conversationId: string;
    senderId: string;
    content: string;
    messageType?: 'text' | 'image' | 'location' | 'system';
    metadata?: Record<string, any>;
  }): Promise<ChatMessage> {
    if (!isValidUUID(params.conversationId) || !isValidUUID(params.senderId)) {
      throw new Error('Invalid conversation or sender ID');
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: params.conversationId,
        sender_id: params.senderId,
        content: params.content,
        message_type: params.messageType || 'text',
        metadata: params.metadata || {},
      })
      .select('*, sender:sender_id(id, full_name, organization_name, avatar_url, role)')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to send message');
    }

    // Best-effort timestamp update (also handled by DB trigger when applied)
    try {
      await supabase
        .from('conversations')
        .update({ last_message_at: data.created_at, updated_at: data.created_at })
        .eq('id', params.conversationId);
    } catch {}

    return {
      id: data.id,
      conversationId: data.conversation_id,
      senderId: data.sender_id,
      content: data.content,
      messageType: data.message_type,
      metadata: data.metadata,
      isRead: data.is_read,
      createdAt: data.created_at,
      sender: data.sender ? mapProfileToUser(data.sender) : undefined,
    };
  }

  /**
   * Mark incoming messages in a conversation as read
   */
  static async markMessagesAsRead(conversationId: string, currentUserId: string): Promise<void> {
    if (!isValidUUID(conversationId) || !isValidUUID(currentUserId)) return;
    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', currentUserId)
        .eq('is_read', false);

      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', currentUserId);
    } catch {}
  }

  /**
   * Subscribe to new incoming messages and read-status updates for a conversation
   */
  static subscribeToMessages(
    conversationId: string,
    onMessage: (msg: ChatMessage) => void,
    onMessageUpdated?: (msg: { id: string; isRead: boolean }) => void
  ) {
    if (!isValidUUID(conversationId)) {
      return { unsubscribe: () => {} };
    }

    const channel = supabase
      .channel(`chat:${conversationId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const row = payload.new as any;
          const { data: sender } = await supabase
            .from('profiles')
            .select('id, full_name, organization_name, avatar_url, role')
            .eq('id', row.sender_id)
            .maybeSingle();

          onMessage({
            id: row.id,
            conversationId: row.conversation_id,
            senderId: row.sender_id,
            content: row.content,
            messageType: row.message_type,
            metadata: row.metadata,
            isRead: row.is_read,
            createdAt: row.created_at,
            sender: sender ? mapProfileToUser(sender) : undefined,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (onMessageUpdated && row?.id) {
            onMessageUpdated({ id: row.id, isRead: !!row.is_read });
          }
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }

  /**
   * Subscribe to conversation updates so sidebar snippets & unread badges refresh
   */
  static subscribeToUserConversations(userId: string, onRefresh: () => void) {
    if (!isValidUUID(userId)) {
      return { unsubscribe: () => {} };
    }

    let timer: any = null;
    const debounced = () => {
      clearTimeout(timer);
      timer = setTimeout(onRefresh, 400);
    };

    const channel = supabase
      .channel(`conv_list:${userId}:${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, debounced)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${userId}` },
        debounced
      )
      .subscribe();

    return {
      unsubscribe: () => {
        clearTimeout(timer);
        supabase.removeChannel(channel);
      },
    };
  }
}
