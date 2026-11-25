import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, MessageSquare, Phone, Check, CheckCheck, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { normalizeRole } from '../../services/auth';
import { ChatService } from '../../services/chat';
import type { Conversation, ChatMessage } from '../../types';
import styles from './ChatPage.module.css';

const RIDER_QUICK_MESSAGES = [
  'I am reaching your location.',
  'Please confirm pickup location.',
  'I have arrived.',
  'Please share pickup instructions.',
  'Food has been collected.',
  'I am facing a delay.',
];

const DONOR_QUICK_MESSAGES = [
  'Food is packed and ready for pickup.',
  'Please share your ETA.',
  'Pickup location confirmed — come to main entrance.',
  'Please confirm pickup location.',
  'I am reaching your location.',
  'Thank you for rescuing this food!',
];

export default function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;
  const userRole = normalizeRole(user?.role);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(conversationId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [mobileShowThread, setMobileShowThread] = useState(Boolean(conversationId));

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    if (!userId) return;
    try {
      const dbConvs = await ChatService.getUserConversations(userId);
      setConversations(dbConvs);
      if (conversationId && dbConvs.some((c) => c.id === conversationId)) {
        setActiveConvId(conversationId);
        setMobileShowThread(true);
      } else {
        setActiveConvId((prev) => {
          if (prev && dbConvs.some((c) => c.id === prev)) return prev;
          return dbConvs.length > 0 ? dbConvs[0].id : null;
        });
      }
    } catch {
      setConversations([]);
      setActiveConvId(null);
    }
  }, [userId, conversationId]);

  useEffect(() => {
    loadConversations();
    if (!userId) return;
    const sub = ChatService.subscribeToUserConversations(userId, loadConversations);
    return () => {
      sub.unsubscribe();
    };
  }, [userId, loadConversations]);

  // Fetch messages & subscribe to realtime incoming messages + read receipts
  useEffect(() => {
    if (!activeConvId || !userId) {
      return;
    }

    let active = true;
    ChatService.getMessages(activeConvId).then((msgs) => {
      if (!active) return;
      setMessages(msgs);
      ChatService.markMessagesAsRead(activeConvId, userId).then(() => {
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConvId ? { ...c, unreadCount: 0 } : c))
        );
      });
    });

    const sub = ChatService.subscribeToMessages(
      activeConvId,
      (newMsg) => {
        if (!active) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        if (newMsg.senderId !== userId) {
          ChatService.markMessagesAsRead(activeConvId, userId);
        }
      },
      (updated) => {
        if (!active) return;
        setMessages((prev) =>
          prev.map((m) => (m.id === updated.id ? { ...m, isRead: updated.isRead } : m))
        );
      }
    );

    return () => {
      active = false;
      sub.unsubscribe();
    };
  }, [activeConvId, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeConv = conversations.find((c) => c.id === activeConvId);
  const otherParticipant = activeConv?.participants?.find(
    (p) => p.userId !== userId
  )?.user;

  const dispatchMessage = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || !activeConvId || !userId || sending) return;

    setSendError('');
    setSending(true);

    const optId = `opt-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: optId,
      conversationId: activeConvId,
      senderId: userId,
      content: text,
      messageType: 'text',
      isRead: false,
      createdAt: new Date().toISOString(),
      sender: user || undefined,
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const saved = await ChatService.sendMessage({
        conversationId: activeConvId,
        senderId: userId,
        content: text,
      });
      setMessages((prev) => {
        const withoutOpt = prev.filter((m) => m.id !== optId);
        if (withoutOpt.some((m) => m.id === saved.id)) return withoutOpt;
        return [...withoutOpt, saved];
      });
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvId
            ? { ...c, lastMessage: saved, lastMessageAt: saved.createdAt }
            : c
        )
      );
    } catch (err: any) {
      setSendError(err?.message || 'Could not send message.');
      setMessages((prev) => prev.filter((m) => m.id !== optId));
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    const msg = inputText;
    setInputText('');
    await dispatchMessage(msg);
  };

  const quickOptions = userRole === 'donor' ? DONOR_QUICK_MESSAGES : RIDER_QUICK_MESSAGES;

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatWrapper}>
        {/* Left Sidebar: Conversations */}
        <div className={`${styles.sidebar} ${mobileShowThread ? styles.hideOnMobile : ''}`}>
          <div className={styles.sidebarHeader}>
            <div>
              <h2 className={styles.sidebarTitle}>Pickup & Delivery Chat</h2>
              <p className={styles.sidebarSub}>Direct private channel between Donor & assigned Rider</p>
            </div>
          </div>
          <div className={styles.convList}>
            {conversations.length === 0 ? (
              <div className={styles.emptyConvList}>
                <MessageSquare size={28} />
                <p>No active pickup conversations yet.</p>
                <span>When a rider accepts a donation, your private coordination chat appears here automatically.</span>
              </div>
            ) : (
              conversations.map((c) => {
                const other = c.participants?.find((p) => p.userId !== userId)?.user;
                const partnerName = other?.name || 'ShareBite Partner';
                const title = c.title ? `${c.title} · ${partnerName}` : partnerName;
                const lastText = c.lastMessage?.content || 'Pickup channel ready';
                const isSelected = c.id === activeConvId;

                return (
                  <div
                    key={c.id}
                    className={`${styles.convItem} ${isSelected ? styles.convItemActive : ''}`}
                    onClick={() => {
                      setActiveConvId(c.id);
                      setMobileShowThread(true);
                      navigate(`/chat/${c.id}`);
                    }}
                  >
                    <div className={styles.avatarWrap}>
                      {other?.avatar ? (
                        <img src={other.avatar} alt={partnerName} className={styles.avatarImg} />
                      ) : (
                        <span>{(partnerName || 'P').charAt(0).toUpperCase()}</span>
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
                        {(c.unreadCount ?? 0) > 0 && (
                          <span className={styles.unreadBadge}>{c.unreadCount}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Main Chat Thread */}
        <div className={`${styles.chatMain} ${!mobileShowThread ? styles.hideOnMobile : ''}`}>
          {activeConv ? (
            <>
              {/* Header */}
              <div className={styles.chatHeader}>
                <div className={styles.headerUserInfo}>
                  <button
                    type="button"
                    className={styles.mobileBackBtn}
                    onClick={() => setMobileShowThread(false)}
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div className={styles.avatarWrap}>
                    {otherParticipant?.avatar ? (
                      <img
                        src={otherParticipant.avatar}
                        alt="Contact"
                        className={styles.avatarImg}
                      />
                    ) : (
                      <span>{otherParticipant?.name?.charAt(0) || 'P'}</span>
                    )}
                  </div>
                  <div>
                    <h3 className={styles.headerName}>
                      {otherParticipant?.name || 'Assigned Partner'}
                      {activeConv.title ? ` — ${activeConv.title}` : ''}
                    </h3>
                    <span className={styles.headerRole}>
                      <ShieldCheck size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4, color: '#16a34a' }} />
                      {otherParticipant?.role ? `${otherParticipant.role} · Encrypted Pickup Chat` : 'Verified Pickup Participant'}
                    </span>
                  </div>
                </div>

                {otherParticipant?.phone && (
                  <a
                    href={`tel:${otherParticipant.phone}`}
                    className={styles.quickReplyBtn}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                  >
                    <Phone size={14} /> Call
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

                  const isMine = m.senderId === userId;
                  const senderLabel = isMine
                    ? 'You'
                    : m.sender?.name || otherParticipant?.name || 'Partner';

                  return (
                    <div
                      key={m.id}
                      className={`${styles.msgRow} ${isMine ? styles.msgRowMine : styles.msgRowOther}`}
                    >
                      <span className={styles.senderTag}>{senderLabel}</span>
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
                        {isMine && (
                          <span className={styles.readReceipt} title={m.isRead ? 'Read' : 'Sent'}>
                            {m.isRead ? (
                              <>
                                <CheckCheck size={12} style={{ color: '#16a34a' }} /> Read
                              </>
                            ) : (
                              <>
                                <Check size={12} /> Sent
                              </>
                            )}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {sendError && <div className={styles.errorBanner}>{sendError}</div>}

              {/* Quick Messages Bar */}
              <div className={styles.quickReplies} aria-label="Quick messages">
                {quickOptions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className={styles.quickReplyBtn}
                    disabled={sending}
                    onClick={() => dispatchMessage(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <form className={styles.inputForm} onSubmit={handleSend}>
                <input
                  type="text"
                  className={styles.msgInput}
                  placeholder="Type a message to coordinate pickup..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
                <button
                  type="submit"
                  className={styles.sendBtn}
                  disabled={!inputText.trim() || sending}
                  aria-label="Send message"
                >
                  <Send size={18} />
                </button>
              </form>
            </>
          ) : (
            <div className={styles.emptyState}>
              <MessageSquare size={48} />
              <p style={{ margin: 0, fontWeight: 600, color: '#475569' }}>Select a pickup conversation</p>
              <span style={{ fontSize: 13 }}>Only the Donor and the assigned Rider can view or message in a delivery thread.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
