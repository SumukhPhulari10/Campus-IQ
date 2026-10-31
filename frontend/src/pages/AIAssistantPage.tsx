import React, { useState, useRef, useEffect } from 'react';
import { apiFetch as fetch } from '../lib/api';
import { AuthUser } from '../types';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface AIAssistantPageProps {
  user: AuthUser;
}

// ── Render inline markdown: **bold**, *italic*, `code`
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Split on **bold**, *italic*, `code` patterns
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const raw = match[0];
    if (raw.startsWith('**')) {
      parts.push(<strong key={key++} className="font-bold text-[#0b1c30]">{raw.slice(2, -2)}</strong>);
    } else if (raw.startsWith('*')) {
      parts.push(<em key={key++}>{raw.slice(1, -1)}</em>);
    } else {
      parts.push(<code key={key++} className="bg-[#f0f4f0] px-1 rounded text-[#003527] text-[12px] font-mono">{raw.slice(1, -1)}</code>);
    }
    last = match.index + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// ── Render a full AI message with proper structure
function renderMessage(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line = spacer
    if (!trimmed) {
      elements.push(<div key={key++} className="h-1" />);
      continue;
    }

    // Source line (📄 Source: or [Source:)
    if (/^📄\s*Source:|^\[Source:/i.test(trimmed)) {
      const clean = trimmed
        .replace(/^📄\s*Source:\s*/i, '')
        .replace(/^\[Source:\s*/, '')
        .replace(/\]$/, '');
      elements.push(
        <p key={key++} className="text-[11px] text-[#9ca8a3] mt-2 pt-2 border-t border-[#eef0ee] italic flex items-center gap-1">
          <span className="text-[13px]">📄</span> {clean}
        </p>
      );
      continue;
    }

    // Bullet point lines (•, -, *)
    if (/^[•\-\*]\s+/.test(trimmed)) {
      const content = trimmed.replace(/^[•\-\*]\s+/, '');
      elements.push(
        <div key={key++} className="flex gap-2 items-start">
          <span className="text-[#003527] shrink-0 mt-[1px] text-[16px] leading-snug">•</span>
          <span className="leading-snug">{renderInline(content)}</span>
        </div>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const num = trimmed.match(/^(\d+)\.\s+/)?.[1];
      const content = trimmed.replace(/^\d+\.\s+/, '');
      elements.push(
        <div key={key++} className="flex gap-2 items-start">
          <span className="text-[#003527] shrink-0 font-bold text-[12px] min-w-[16px]">{num}.</span>
          <span className="leading-snug">{renderInline(content)}</span>
        </div>
      );
      continue;
    }

    // Normal paragraph
    elements.push(
      <p key={key++} className="leading-snug">{renderInline(trimmed)}</p>
    );
  }

  return <div className="space-y-1.5 text-sm">{elements}</div>;
}

// Simple rule-based fallback (when server is completely offline)
function getSimpleResponse(input: string): string {
  const q = input.trim().toLowerCase();
  if (/^(hi|hello|hey|hii+|helo|yo)[\s!.]*$/.test(q))
    return "Hey! 👋 What do you wanna know about college? Ask me anything!";
  if (/how are you|how r u/.test(q))
    return "Doing great! What can I help you with? 😊";
  if (/thank|thanks|ty/.test(q))
    return "No problem! Let me know if you need anything else 🙂";
  if (/bye|goodbye|see you/.test(q))
    return "Take care! 👋";
  if (/your name|who are you|what are you/.test(q))
    return "I'm **Campus Desk** — your college AI assistant. Ask me about notices, exams, deadlines and more!";
  return "Hmm, couldn't find that in the notices. Try asking your teacher or check the notice board! 📋";
}

export const AIAssistantPage: React.FC<AIAssistantPageProps> = ({ user }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ── Load past conversations from PostgreSQL on mount ──
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem('campusiq_token');
        const url = `/api/chat/history?userId=${encodeURIComponent(user.id || '')}&email=${encodeURIComponent(user.email || '')}`;
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(
              data.messages.map((m: any) => ({
                id: m.id || `msg_${Date.now()}_${Math.random()}`,
                sender: m.sender === 'user' ? 'user' : 'assistant',
                text: m.text,
                timestamp: m.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              }))
            );
          }
        }
      } catch (err) {
        console.warn('Failed to load chat history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [user.id, user.email]);

  const handleClearHistory = async () => {
    if (!window.confirm('Do you want to clear your conversation history?')) return;
    try {
      const token = localStorage.getItem('campusiq_token');
      await fetch('/api/chat/history', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      });
      setMessages([]);
    } catch (err) {
      console.warn('Failed to clear chat history:', err);
    }
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Small thinking delay for natural feel
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));

    let responseText: string;
    try {
      const token = localStorage.getItem('campusiq_token');
      // Pass previous turns for multi-turn conversational intelligence
      const conversationHistory = messages.slice(-6).map((m) => ({
        role: m.sender,
        text: m.text,
      }));

      const res = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          query: trimmed,
          conversationHistory,
          studentContext: {
            id: user.id,
            email: user.email,
            name: user.name,
            department: user.department,
            year: user.year,
            semester: user.semester,
          },
        }),
      });
      const data = await res.json();
      responseText = data.answer || getSimpleResponse(trimmed);
    } catch {
      responseText = getSimpleResponse(trimmed);
    }

    const assistantMsg: Message = {
      id: `a_${Date.now()}`,
      sender: 'assistant',
      text: responseText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setIsTyping(false);
    setMessages((prev) => [...prev, assistantMsg]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const quickPrompts = [
    { icon: '📅', title: 'Exam dates', desc: 'When are the next exams?' },
    { icon: '💰', title: 'Fee details', desc: 'tuition fees for open category' },
    { icon: '📋', title: 'Attendance', desc: 'What % attendance is needed?' },
    { icon: '🏆', title: 'Scholarships', desc: 'How to apply for TFWS?' },
    { icon: '📜', title: 'Certificates', desc: 'How to get bonafide / TC?' },
    { icon: '📢', title: 'Latest notices', desc: 'What\'s new on notice board?' },
  ];

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#f4f7ff] pt-[64px]">
      <div className="max-w-[800px] w-full mx-auto px-4 md:px-6 flex flex-col flex-1">

        {/* Page Header */}
        <div className="pt-8 pb-5 border-b border-[#bfc9c3]/25 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#003527] flex items-center justify-center shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[22px] text-[#80bea6]">smart_toy</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-headline font-bold text-xl text-[#0b1c30]">
                  Campus Desk AI
                </h1>
                <span className="text-[10px] bg-[#eef8f4] text-[#003527] font-bold px-2 py-0.5 rounded-full border border-[#80bea6]/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
                  Stored in DB
                </span>
              </div>
              <p className="text-xs text-[#9ca8a3]">
                Powered by Gemini · Reads from your college's official documents
              </p>
            </div>
          </div>

          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              title="Clear conversation history from database"
              className="flex items-center gap-1.5 text-xs font-semibold text-[#707974] hover:text-[#d32f2f] bg-white px-3 py-1.5 rounded-xl border border-[#bfc9c3]/30 hover:border-[#d32f2f]/30 transition-all shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
              <span className="hidden sm:inline">Clear Chat</span>
            </button>
          )}
        </div>

        {/* Conversation */}
        <div className="flex-1 overflow-y-auto py-6 space-y-5">

          {/* Welcome state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center text-center pt-8 pb-4">
              <p className="text-xs text-[#003527] font-semibold mb-2 uppercase tracking-wide">
                Hey {user.name.split(' ')[0]}! 👋
              </p>
              <h2 className="font-headline font-bold text-3xl text-[#0b1c30] mb-3">
                What do you wanna know?
              </h2>
              <p className="text-sm text-[#5a6672] max-w-xl leading-relaxed mb-10">
                Ask anything — short or long, Hindi-English mix, whatever. I'll look it up from the official college notices and give you a quick answer.
              </p>

              <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {quickPrompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(p.desc)}
                    className="text-left p-4 bg-white rounded-xl border border-[#bfc9c3]/30
                               hover:border-[#003527]/30 hover:bg-[#eff4ff]
                               transition-all flex flex-col gap-1 shadow-sm group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[18px]">{p.icon}</span>
                      <span className="text-sm font-bold text-[#0b1c30] group-hover:text-[#003527] transition-colors">
                        {p.title}
                      </span>
                    </div>
                    <span className="text-xs text-[#5a6672]">
                      {p.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-[#003527] flex items-center justify-center shrink-0 mt-1 shadow-sm">
                    <span className="material-symbols-outlined text-[16px] text-[#80bea6]">school</span>
                  </div>
                )}

                <div className={`max-w-[78%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`px-4 py-3 rounded-2xl
                                ${isUser
                                  ? 'bg-[#003527] text-white rounded-tr-sm shadow-sm font-medium text-sm'
                                  : 'bg-white text-[#0b1c30] rounded-tl-sm shadow-sm border border-[#bfc9c3]/25'
                                }`}
                  >
                    {isUser ? (
                      <span className="text-sm">{msg.text}</span>
                    ) : (
                      renderMessage(msg.text)
                    )}
                  </div>
                  <span className="text-[10px] text-[#9ca8a3] mt-1 px-1">{msg.timestamp}</span>
                </div>

                {isUser && (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-8 h-8 rounded-full border-2 border-[#b0f0d6] object-cover shrink-0 mt-1"
                  />
                )}
              </div>
            );
          })}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-3 justify-start animate-fade-in">
              <div className="w-8 h-8 rounded-full bg-[#003527] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px] text-[#80bea6]">school</span>
              </div>
              <div className="bg-white border border-[#bfc9c3]/25 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#003527] animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-[#003527] animate-bounce [animation-delay:0.15s]" />
                <span className="w-2 h-2 rounded-full bg-[#003527] animate-bounce [animation-delay:0.3s]" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="sticky bottom-0 pb-6 pt-3 bg-[#f4f7ff]">
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-3 bg-white rounded-2xl border border-[#bfc9c3]/30 px-4 py-2.5 shadow-md"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything — exam dates, fees, notices…"
              className="flex-1 bg-transparent border-none outline-none text-sm text-[#0b1c30] placeholder:text-[#bfc9c3] font-inter"
              id="ai-page-input"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              id="ai-page-send"
              className="w-9 h-9 rounded-xl bg-[#003527] disabled:bg-[#bfc9c3] hover:bg-[#064e3b]
                         text-white flex items-center justify-center transition-all shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          </form>
          <p className="text-[10px] text-[#9ca8a3] text-center mt-2">
            Answers are based on official college documents · Always verify with your department
          </p>
        </div>

      </div>
    </div>
  );
};
