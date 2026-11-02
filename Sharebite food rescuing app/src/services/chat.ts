import { supabase } from '../lib/supabase';
import { isValidUUID, toSafeUUID, DEMO_RECORD_UUIDS } from '../lib/uuid';
import type { Conversation, ChatMessage, User } from '../types';

function mapProfileToUser(p: any): User {
  return {
    id: p.id,
    name: p.full_name || p.name || 'User',
    email: p.email || '',
    phone: p.phone || '',
    role: p.role || 'receiver',
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
    const type = options?.type || 'direct';
    const safeCurrentUserId = toSafeUUID(currentUserId, DEMO_RECORD_UUIDS.donor);
    const safeRecipientUserId = toSafeUUID(recipientUserId, DEMO_RECORD_UUIDS.ngo);
    const relatedListingId = isValidUUID(options?.relatedListingId) ? options.relatedListingId : null;
    const relatedTaskId = isValidUUID(options?.relatedTaskId) ? options.relatedTaskId : null;

    // 1. Check if a conversation with these participants already exists
    const { data: userConvs } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', safeCurrentUserId);

    if (userConvs && userConvs.length > 0) {
      const convIds = userConvs.map((c) => c.conversation_id);

      const { data: sharedConvs } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', safeRecipientUserId)
        .in('conversation_id', convIds);

      if (sharedConvs && sharedConvs.length > 0) {
        // Find one matching the listing/task criteria if specified
        for (const s of sharedConvs) {
          const { data: conv } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', s.conversation_id)
            .single();

          if (conv) {
            if (relatedListingId && conv.related_listing_id === relatedListingId) {
              return this.enrichConversation(conv);
            }
            if (relatedTaskId && conv.related_task_id === relatedTaskId) {
              return this.enrichConversation(conv);
            }
            if (!relatedListingId && !relatedTaskId && conv.type === 'direct') {
              return this.enrichConversation(conv);
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
      })
      .select()
      .single();

    if (convErr || !newConv) {
      throw new Error(convErr?.message || 'Failed to create conversation');
    }

    // 3. Add participants
    await supabase.from('conversation_participants').insert([
      { conversation_id: newConv.id, user_id: safeCurrentUserId },
      { conversation_id: newConv.id, user_id: safeRecipientUserId },
    ]);

    return this.enrichConversation(newConv);
  }

  /**
   * Enrich conversation record with participants & last message
   */
  private static async enrichConversation(
    conv: any
  ): Promise<Conversation> {
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('*, profiles:user_id(id, full_name, role, avatar_url, phone)')
      .eq('conversation_id', conv.id);

    const { data: lastMsg } = await supabase
      .from('messages')
      .select('*, sender:sender_id(id, full_name, avatar_url, role)')
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
   * Fetch all conversations for a user
   */
  static async getUserConversations(userId: string): Promise<Conversation[]> {
    const safeUserId = toSafeUUID(userId, DEMO_RECORD_UUIDS.donor);
    const { data: participantRows, error } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', safeUserId);

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

    const enriched = await Promise.all(
      convs.map((c) => this.enrichConversation(c))
    );

    return enriched;
  }

  /**
   * Get all messages in a conversation
   */
  static async getMessages(conversationId: string): Promise<ChatMessage[]> {
    if (!isValidUUID(conversationId)) return [];

    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:sender_id(id, full_name, avatar_url, role)')
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
   * Send a new message
   */
  static async sendMessage(params: {
    conversationId: string;
    senderId: string;
    content: string;
    messageType?: 'text' | 'image' | 'location' | 'system';
    metadata?: Record<string, any>;
  }): Promise<ChatMessage> {
    if (!isValidUUID(params.conversationId)) {
      throw new Error('Invalid conversation ID');
    }
    const safeSenderId = toSafeUUID(params.senderId, DEMO_RECORD_UUIDS.donor);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: params.conversationId,
        sender_id: safeSenderId,
        content: params.content,
        message_type: params.messageType || 'text',
        metadata: params.metadata || {},
      })
      .select('*, sender:sender_id(id, full_name, avatar_url, role)')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to send message');
    }

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
   * Subscribe to new incoming messages for a conversation
   */
  static subscribeToMessages(
    conversationId: string,
    onMessage: (msg: ChatMessage) => void
  ) {
    const channel = supabase
      .channel(`chat:${conversationId}`)
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
          // Fetch sender details
          const { data: sender } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, role')
            .eq('id', row.sender_id)
            .single();

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
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }
}
