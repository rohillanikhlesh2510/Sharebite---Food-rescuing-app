import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, MessageSquare, Phone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ChatService } from '../../services/chat';
import type { Conversation, ChatMessage } from '../../types';
import styles from './ChatPage.module.css';

// Fallback high-fidelity sample conversations
const SAMPLE_CONVERSATIONS: Conversation[] = [
  {
    id: 'sample-conv-1',
    type: 'donation',
    title: 'Vegetable Rice + Dal Pickup',
    lastMessageAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    participants: [
      {
        id: 'p1',
        conversationId: 'sample-conv-1',
        userId: 'ngo-user-1',
        user: {
          id: 'ngo-user-1',
          name: 'Bhopal Food Seva NGO',
          fullName: 'Bhopal Food Seva NGO',
          role: 'ngo',
          email: 'contact@bhopalfoodseva.org',
          phone: '+91 98260 12345',
          isVerified: true,
          totalDonations: 0,
          totalRescues: 48,
          createdAt: '',
          updatedAt: '',
        } as any,
      },
    ],
    lastMessage: {
      id: 'm1',
      conversationId: 'sample-conv-1',
      senderId: 'ngo-user-1',
      content: 'Our volunteer is on the way to collect the 25 servings of rice.',
      messageType: 'text',
      isRead: true,
      createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
    },
  },
  {
    id: 'sample-conv-2',
    type: 'delivery',
    title: 'Rider Delivery Coordination',
    lastMessageAt: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    participants: [
      {
        id: 'p2',
        conversationId: 'sample-conv-2',
        userId: 'rider-user-1',
        user: {
          id: 'rider-user-1',
          name: 'Rahul Sharma (Rider)',
          fullName: 'Rahul Sharma',
          role: 'rider',
          email: 'rahul@sharebite.app',
          phone: '+91 98930 54321',
          isVerified: true,
          totalDonations: 0,
          totalRescues: 120,
          createdAt: '',
          updatedAt: '',
        } as any,
      },
    ],
    lastMessage: {
      id: 'm2',
      conversationId: 'sample-conv-2',
      senderId: 'rider-user-1',
      content: 'Arrived at the pickup location. Waiting outside gate 2.',
      messageType: 'text',
      isRead: false,
      createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
    },
  },
];

const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {
  'sample-conv-1': [
    {
      id: 'sm1',
      conversationId: 'sample-conv-1',
      senderId: 'system',
      content: 'Claim confirmed. Food donation reserved for Bhopal Food Seva NGO.',
      messageType: 'system',
      isRead: true,
      createdAt: new Date(Date.now() - 40 * 60000).toISOString(),
    },
    {
      id: 'sm2',
      conversationId: 'sample-conv-1',
      senderId: 'ngo-user-1',
      content: 'Hello! Thank you for the generous donation. Is everything packaged in containers?',
      messageType: 'text',
      isRead: true,
      createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
    },
    {
      id: 'sm3',
      conversationId: 'sample-conv-1',
      senderId: 'current-user',
      content: 'Yes, 25 meal boxes packed fresh and warm ready for pickup.',
      messageType: 'text',
      isRead: true,
      createdAt: new Date(Date.now() - 18 * 60000).toISOString(),
    },
    {
      id: 'sm4',
      conversationId: 'sample-conv-1',
      senderId: 'ngo-user-1',
      content: 'Our volunteer is on the way to collect the 25 servings of rice.',
      messageType: 'text',
      isRead: true,
      createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
    },
  ],
  'sample-conv-2': [
    {
      id: 'sm5',
      conversationId: 'sample-conv-2',
      senderId: 'system',
      content: 'Rider Rahul Sharma assigned to pickup task.',
      messageType: 'system',
      isRead: true,
      createdAt: new Date(Date.now() - 50 * 60000).toISOString(),
    },
    {
      id: 'sm6',
      conversationId: 'sample-conv-2',
      senderId: 'rider-user-1',
      content: 'Arrived at the pickup location. Waiting outside gate 2.',
      messageType: 'text',
      isRead: true,
      createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
    },
  ],
};

export default function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch conversations
  useEffect(() => {
    async function loadConversations() {
      if (!user) return;
      try {
        const dbConvs = await ChatService.getUserConversations(user.id);
        if (dbConvs.length > 0) {
          setConversations(dbConvs);
          setActiveConvId(conversationId || dbConvs[0].id);
        } else {
          setConversations(SAMPLE_CONVERSATIONS);
          setActiveConvId(conversationId || SAMPLE_CONVERSATIONS[0].id);
        }
      } catch {
        setConversations(SAMPLE_CONVERSATIONS);
        setActiveConvId(conversationId || SAMPLE_CONVERSATIONS[0].id);
      }
    }
    loadConversations();
  }, [user, conversationId]);

  // 2. Fetch messages for active conversation
  useEffect(() => {
    if (!activeConvId) return;

    // Check if it's sample conversation
    if (INITIAL_MESSAGES[activeConvId]) {
      setMessages(INITIAL_MESSAGES[activeConvId]);
      return;
    }

    ChatService.getMessages(activeConvId).then(setMessages);

    // Subscribe to realtime incoming messages
    const sub = ChatService.subscribeToMessages(activeConvId, (newMsg) => {
      setMessages((prev) => [...prev, newMsg]);
    });

    return () => {
      sub.unsubscribe();
    };
  }, [activeConvId]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeConv = conversations.find((c) => c.id === activeConvId);
  const otherParticipant = activeConv?.participants?.find(
    (p) => p.userId !== user?.id
  )?.user;

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !activeConvId || !user) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    const optimisticMsg: ChatMessage = {
      id: `opt-${Date.now()}`,
      conversationId: activeConvId,
      senderId: user.id,
      content: text,
      messageType: 'text',
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      if (!activeConvId.startsWith('sample-')) {
        await ChatService.sendMessage({
          conversationId: activeConvId,
          senderId: user.id,
          content: text,
        });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleQuickReply = (text: string) => {
    setInputText(text);
  };

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatWrapper}>
        {/* Left Sidebar: Conversations */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2 className={styles.sidebarTitle}>Messages</h2>
          </div>
          <div className={styles.convList}>
            {conversations.map((c) => {
              const other = c.participants?.find((p) => p.userId !== user?.id)?.user;
              const title = c.title || other?.name || (other as any)?.fullName || 'Conversation';
              const lastText = c.lastMessage?.content || 'No messages yet';
              const isSelected = c.id === activeConvId;

              return (
                <div
                  key={c.id}
                  className={`${styles.convItem} ${isSelected ? styles.convItemActive : ''}`}
                  onClick={() => {
                    setActiveConvId(c.id);
                    navigate(`/chat/${c.id}`);
                  }}
                >
                  <div className={styles.avatarWrap}>
                    {other?.avatar ? (
                      <img src={other.avatar} alt={title} className={styles.avatarImg} />
                    ) : (
                      <span>{title.charAt(0)}</span>
                    )}
                  </div>
                  <div className={styles.convMeta}>
                    <div className={styles.convTopRow}>
                      <span className={styles.convName}>{title}</span>
                      <span className={styles.convTime}>
                        {new Date(c.lastMessageAt || c.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className={styles.convBottomRow}>
                      <p className={styles.convSnippet}>{lastText}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Main Chat Thread */}
        <div className={styles.chatMain}>
          {activeConv ? (
            <>
              {/* Header */}
              <div className={styles.chatHeader}>
                <div className={styles.headerUserInfo}>
                  <div className={styles.avatarWrap}>
                    {otherParticipant?.avatar ? (
                      <img
                        src={otherParticipant.avatar}
                        alt="Contact"
                        className={styles.avatarImg}
                      />
                    ) : (
                      <span>{otherParticipant?.name?.charAt(0) || 'C'}</span>
                    )}
                  </div>
                  <div>
                    <h3 className={styles.headerName}>
                      {activeConv.title || otherParticipant?.name || 'ShareBite Coordinator'}
                    </h3>
                    <span className={styles.headerRole}>
                      {otherParticipant?.role || 'Verified Partner'}
                    </span>
                  </div>
                </div>

                {otherParticipant?.phone && (
                  <a
                    href={`tel:${otherParticipant.phone}`}
                    className={styles.quickReplyBtn}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Phone size={14} /> Call Contact
                  </a>
                )}
              </div>

              {/* Messages feed */}
              <div className={styles.messagesFeed}>
                {messages.map((m) => {
                  if (m.messageType === 'system') {
                    return (
                      <div key={m.id} className={styles.systemMsg}>
                        {m.content}
                      </div>
                    );
                  }

                  const isMine =
                    m.senderId === user?.id || m.senderId === 'current-user';

                  return (
                    <div
                      key={m.id}
                      className={`${styles.msgRow} ${
                        isMine ? styles.msgRowMine : styles.msgRowOther
                      }`}
                    >
                      <div
                        className={`${styles.msgBubble} ${
                          isMine ? styles.msgBubbleMine : styles.msgBubbleOther
                        }`}
                      >
                        {m.content}
                      </div>
                      <span className={styles.msgTime}>
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Replies row */}
              <div className={styles.quickReplies}>
                <button
                  type="button"
                  className={styles.quickReplyBtn}
                  onClick={() => handleQuickReply('Food is packed and ready for pickup.')}
                >
                  📦 Food is packed
                </button>
                <button
                  type="button"
                  className={styles.quickReplyBtn}
                  onClick={() => handleQuickReply('Volunteer is on the way.')}
                >
                  🛵 On the way
                </button>
                <button
                  type="button"
                  className={styles.quickReplyBtn}
                  onClick={() => handleQuickReply('Arrived at the pickup point.')}
                >
                  📍 Arrived at pickup
                </button>
              </div>

              {/* Input Form */}
              <form className={styles.inputForm} onSubmit={handleSend}>
                <input
                  type="text"
                  className={styles.msgInput}
                  placeholder="Type a message..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
                <button
                  type="submit"
                  className={styles.sendBtn}
                  disabled={!inputText.trim() || sending}
                >
                  <Send size={18} />
                </button>
              </form>
            </>
          ) : (
            <div className={styles.emptyState}>
              <MessageSquare size={48} />
              <p>Select a conversation to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
