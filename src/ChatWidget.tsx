import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Check,
  CheckCheck,
  Send,
  Trash2,
  Feather,
  Volume2,
  VolumeX,
  Sparkles,
  Compass,
  User,
  MessageCircle,
} from "lucide-react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
  Firestore,
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import { playGoldChime, playPorcelainClick } from "./utils/audio";

interface ChatMessage {
  id: string;
  text: string;
  timestamp: any;
  seen?: boolean;
  seenAt?: any;
  senderIp: string;
  isAdmin?: boolean;
}

interface ChatWidgetProps {
  isAdmin: boolean;
  db: Firestore;
  onTrackChatActivity?: (action: string, sectionOpened?: string) => void;
}

function toDate(ts: any): Date {
  if (!ts) return new Date();
  if (typeof ts.toDate === "function") return ts.toDate();
  if (typeof ts.toMillis === "function") return new Date(ts.toMillis());
  return new Date(ts);
}

function formatDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRelativeTime(date: Date): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 45) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({ isAdmin, db, onTrackChatActivity }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentIp, setCurrentIp] = useState("Unknown");
  const [activeTypers, setActiveTypers] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [closeAfterSend, setCloseAfterSend] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen && onTrackChatActivity) {
      onTrackChatActivity("Opened Live Chat Box", "Live Chat Box");
    }
  }, [isOpen, onTrackChatActivity]);

  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then((res) => res.json())
      .then((data) => setCurrentIp(data.ip || "Unknown"))
      .catch(() => {
        fetch("https://ipinfo.io/json")
          .then((r) => r.json())
          .then((d) => setCurrentIp(d.ip || "Unknown"))
          .catch(() => setCurrentIp("Visitor"));
      });
  }, []);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, "chat_meta", "typing"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const typers: string[] = [];
        Object.keys(data).forEach((ip) => {
          const info = data[ip];
          if (ip !== currentIp && info.isTyping) {
            if (isAdmin && !info.isAdmin) typers.push("Sender");
            if (!isAdmin && info.isAdmin) typers.push("The Keeper");
          }
        });
        setActiveTypers(typers);
      }
    });
    return () => unsub();
  }, [isAdmin, currentIp, db]);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "chat_messages"), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const msg: ChatMessage = { id: docSnap.id, ...data };
        msgs.push(msg);

        if (isOpen) {
          if (!isAdmin && (msg.isAdmin || msg.senderIp !== currentIp) && !msg.seen) {
            updateDoc(doc(db, "chat_messages", docSnap.id), {
              seen: true,
              seenAt: new Date(),
            }).catch(() => {});
          } else if (isAdmin && !msg.isAdmin && msg.senderIp !== currentIp && !msg.seen) {
            updateDoc(doc(db, "chat_messages", docSnap.id), {
              seen: true,
              seenAt: new Date(),
            }).catch(() => {});
          }
        }
      });
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [isAdmin, currentIp, isOpen, db]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 140);
    }
  }, [messages, isOpen]);

  const handleTyping = (val: string) => {
    setNewMessage(val);
    if (!db) return;

    setDoc(
      doc(db, "chat_meta", "typing"),
      {
        [currentIp]: {
          isTyping: true,
          isAdmin,
          timestamp: serverTimestamp(),
        },
      },
      { merge: true }
    ).catch(() => {});

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setDoc(
        doc(db, "chat_meta", "typing"),
        {
          [currentIp]: {
            isTyping: false,
            isAdmin,
            timestamp: serverTimestamp(),
          },
        },
        { merge: true }
      ).catch(() => {});
    }, 2000);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !db) return;
    const textToSend = newMessage.trim();
    setNewMessage("");

    if (soundEnabled) {
      playGoldChime();
    }

    if (onTrackChatActivity) {
      onTrackChatActivity(`Sent Chat Message: "${textToSend.slice(0, 60)}"`, "Live Chat Box");
    }

    try {
      await addDoc(collection(db, "chat_messages"), {
        text: textToSend,
        timestamp: serverTimestamp(),
        seen: false,
        senderIp: currentIp,
        isAdmin: isAdmin,
      });

      setDoc(
        doc(db, "chat_meta", "typing"),
        {
          [currentIp]: {
            isTyping: false,
            isAdmin,
            timestamp: serverTimestamp(),
          },
        },
        { merge: true }
      ).catch(() => {});

      if (closeAfterSend) {
        setIsOpen(false);
      }
    } catch (e) {
      console.error("Message send error:", e);
    }
  };

  const handleDeleteMessage = async (id: string) => {
    if (!isAdmin || !db) return;
    try {
      await deleteDoc(doc(db, "chat_messages", id));
    } catch (e) {
      console.error("Delete warning:", e);
    }
  };

  const groupedMessages = useMemo(() => {
    const groups: { dateLabel: string; items: ChatMessage[] }[] = [];
    messages.forEach((msg) => {
      const msgDate = toDate(msg.timestamp);
      const label = formatDateLabel(msgDate);
      const existing = groups.find((g) => g.dateLabel === label);
      if (existing) {
        existing.items.push(msg);
      } else {
        groups.push({ dateLabel: label, items: [msg] });
      }
    });
    return groups;
  }, [messages]);

  const unreadCount = messages.filter((m) => {
    if (m.seen) return false;
    const isSelf = isAdmin ? m.isAdmin : m.senderIp === currentIp;
    return !isSelf;
  }).length;

  return (
    <>
      {/* Small Floating Message Icon Only — Positioned directly below the "nights the light stayed on" panel */}
      <div className="mt-1.5 flex justify-end pointer-events-auto font-['Outfit','Plus_Jakarta_Sans',sans-serif]">
        <AnimatePresence>
          {!isOpen && (
            <motion.button
              initial={{ scale: 0.85, opacity: 0, y: -4 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: -4 }}
              whileHover={{ y: -1.5, scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                playPorcelainClick();
                setIsOpen(true);
              }}
              className="group relative w-8 h-8 rounded-full bg-[#FCF9F0]/90 hover:bg-[#FFFFFF] backdrop-blur-xl border border-white/85 shadow-[0_6px_18px_-3px_rgba(27,42,74,0.28)] flex items-center justify-center text-[#22418A] transition-all cursor-pointer"
              aria-label="Open Messages"
              title="Messages"
            >
              <MessageCircle className="w-4 h-4 stroke-[2.2] text-[#22418A] transition-transform group-hover:scale-105" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#10B981] ring-1.5 ring-[#FCF9F0]" />

              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -left-1.5 flex h-4 min-w-4 px-1 items-center justify-center bg-[#B8304A] text-white text-[9px] font-bold rounded-full shadow-xs">
                  {unreadCount}
                </span>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Luminous Warm Glass Chat Dialog — Center-to-Left Aligned 60% on Mobile (Never Full Screen) */}
      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-start pl-3 sm:pl-6 bg-[#0A0D14]/20 backdrop-blur-[2px] pointer-events-auto font-['Outfit','Plus_Jakarta_Sans',sans-serif]"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, x: -18, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -18, scale: 0.96 }}
              transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
              className="w-[64vw] min-w-[255px] max-w-[330px] sm:w-[375px] sm:max-w-[390px] h-[60dvh] max-h-[60dvh] sm:h-[62dvh] sm:max-h-[500px] rounded-[24px] bg-[#FCF9F0]/95 backdrop-blur-2xl border border-white/85 shadow-[0_24px_60px_-14px_rgba(27,42,74,0.38)] flex flex-col overflow-hidden select-none"
            >
              {/* Header */}
              <div className="px-3.5 py-2.5 bg-white/80 backdrop-blur-md border-b border-[#22418A]/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FFF6D6] to-[#F7E3A0] border border-[#C9892B]/25 flex items-center justify-center text-[#22418A] shadow-2xs">
                      <Compass className="w-4 h-4 text-[#22418A]" />
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#10B981] ring-2 ring-white" />
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-[12.5px] sm:text-[13.5px] font-bold text-[#1B2A4A] tracking-tight leading-none truncate">
                      {isAdmin ? "Keeper’s Log & Replies" : "Whisper to the Lighthouse"}
                    </h3>
                    <p className="text-[10px] font-medium text-[#5A6788] mt-0.5 truncate">
                      {isAdmin ? "Reader & Sender View" : "Sender & Reader"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => setSoundEnabled((prev) => !prev)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[#5A6788] hover:text-[#1B2A4A] hover:bg-[#22418A]/8 transition-colors cursor-pointer"
                    title={soundEnabled ? "Mute chimes" : "Enable chimes"}
                  >
                    {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => {
                      playPorcelainClick();
                      setIsOpen(false);
                    }}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[#5A6788] hover:text-[#1B2A4A] hover:bg-[#22418A]/8 transition-colors cursor-pointer"
                    aria-label="Close chat"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4 bg-gradient-to-b from-[#F7FAF6]/50 to-[#FCF9F0]/80 scroll-smooth">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-6 py-8">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FFF6D6] to-[#F7E3A0] border border-[#C9892B]/20 flex items-center justify-center mb-3 text-[#C9892B] shadow-2xs">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-bold text-[#1B2A4A]">The horizon is calm</p>
                  <p className="text-xs text-[#5A6788] mt-1 max-w-[220px] leading-relaxed">
                    Write a message below. Every note is kept safe inside the lighthouse.
                  </p>
                </div>
              )}

              {groupedMessages.map((group) => (
                <div key={group.dateLabel} className="space-y-3.5">
                  {/* Date Frame Divider */}
                  <div className="flex items-center gap-3 my-1">
                    <div className="h-px flex-1 bg-[#22418A]/10" />
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase text-[#5A6788] bg-white/80 border border-[#22418A]/10">
                      {group.dateLabel}
                    </span>
                    <div className="h-px flex-1 bg-[#22418A]/10" />
                  </div>

                  {group.items.map((msg) => {
                    const isSender = isAdmin ? !!msg.isAdmin : msg.senderIp === currentIp;
                    const dateObj = toDate(msg.timestamp);
                    const timeStr = formatClockTime(dateObj);
                    const relStr = formatRelativeTime(dateObj);

                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2 ${
                          isSender ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        {/* Role Avatar */}
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-4 text-[10px] font-bold ${
                            isSender
                              ? "bg-[#22418A] text-white"
                              : "bg-[#FFF6D6] text-[#C9892B] border border-[#C9892B]/30"
                          }`}
                        >
                          {isSender ? (
                            <User className="w-3 h-3" />
                          ) : (
                            <Feather className="w-3 h-3" />
                          )}
                        </div>

                        <div
                          className={`flex flex-col max-w-[78%] ${
                            isSender ? "items-end" : "items-start"
                          }`}
                        >
                          {/* Sender / Reader Role Header */}
                          <div className="flex items-center gap-1.5 mb-1 px-1">
                            <span className="text-[10px] font-bold tracking-wide text-[#5A6788]">
                              {isSender
                                ? "You · Sender"
                                : msg.isAdmin
                                ? "The Keeper · Reader"
                                : "Visitor · Sender"}
                            </span>
                          </div>

                          {/* Message Bubble */}
                          <div
                            className={`relative group px-3.5 py-2.5 text-[13px] leading-relaxed ${
                              isSender
                                ? "bg-gradient-to-br from-[#22418A] to-[#1B2A4A] text-white rounded-2xl rounded-br-xs shadow-[0_4px_14px_-4px_rgba(34,65,138,0.35)]"
                                : "bg-white text-[#1B2A4A] border border-[#22418A]/10 rounded-2xl rounded-bl-xs shadow-[0_2px_10px_-3px_rgba(27,42,74,0.08)]"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words font-normal">
                              {msg.text}
                            </p>

                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteMessage(msg.id)}
                                className={`absolute top-1.5 ${
                                  isSender ? "-left-7" : "-right-7"
                                } opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-500 hover:bg-red-50 rounded-full cursor-pointer`}
                                title="Delete message"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Timestamp, Relative Time Frame & Seen Status */}
                          <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] font-medium text-[#5A6788]/85">
                            <span className="tabular-nums">{timeStr}</span>
                            <span>·</span>
                            <span>{relStr}</span>
                            {isSender && (
                              <span className="inline-flex items-center gap-0.5 ml-0.5">
                                {msg.seen ? (
                                  <>
                                    <CheckCheck className="w-3.5 h-3.5 text-[#22418A]" />
                                    <span className="text-[9.5px] font-semibold text-[#22418A]">
                                      Read
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-3 h-3 text-[#8C9AA8]" />
                                    <span className="text-[9.5px] text-[#8C9AA8]">Sent</span>
                                  </>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {activeTypers.length > 0 && (
                <div className="flex items-center gap-2 px-2 py-1 text-xs text-[#5A6788] font-medium">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22418A] animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22418A] animate-bounce [animation-delay:0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22418A] animate-bounce [animation-delay:0.3s]" />
                  </span>
                  <span>{activeTypers[0]} is writing...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Clean Composer Footer */}
            <div className="px-3 py-2.5 bg-white/90 backdrop-blur-md border-t border-[#22418A]/10 shrink-0 space-y-1.5">
              <div className="flex items-center justify-between px-1 text-[10px] text-[#5A6788]">
                <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-[#1B2A4A] transition-colors">
                  <input
                    type="checkbox"
                    checked={closeAfterSend}
                    onChange={(e) => setCloseAfterSend(e.target.checked)}
                    className="w-3 h-3 rounded accent-[#22418A] cursor-pointer"
                  />
                  <span className="font-medium">Auto-close on send</span>
                </label>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-[10px] font-semibold text-[#22418A] hover:underline cursor-pointer"
                >
                  Minimize
                </button>
              </div>

              <div className="flex items-center gap-1.5 bg-[#F7FAF6] border border-[#22418A]/15 rounded-full pl-3.5 pr-1 py-1 focus-within:border-[#22418A]/45 focus-within:bg-white transition-all shadow-2xs">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Write a message..."
                  value={newMessage}
                  onChange={(e) => handleTyping(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="flex-1 min-w-0 bg-transparent text-[12.5px] text-[#1B2A4A] placeholder-[#8C9AA8] font-medium outline-none py-0.5"
                />

                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim()}
                  className="h-7 px-3 rounded-full bg-[#22418A] hover:bg-[#1B2A4A] text-white text-[11px] font-semibold flex items-center gap-1 disabled:opacity-35 transition-all cursor-pointer shrink-0 shadow-xs"
                  aria-label="Send message"
                >
                  <span>Send</span>
                  <Send className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
