import React, { useState, useRef, useEffect } from 'react';
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

// Simple rule-based responses (no fake RAG data)
function getSimpleResponse(input: string): string {
  const q = input.trim().toLowerCase();

  if (/^(hi|hello|hey|hii+|helo|yo)[\s!.]*$/.test(q)) {
    return `Hello! 👋 I'm Campus Desk. How can I help you today?\n\nYou can ask me about:\n• Exam schedules\n• Attendance\n• Fees\n• Scholarships\n• College notices`;
  }
  if (/how are you|how r u/.test(q)) {
    return "I'm doing great and ready to help! What would you like to know about your college? 😊";
  }
  if (/thank|thanks|ty/.test(q)) {
    return "You're welcome! Let me know if you need anything else. 🙂";
  }
  if (/bye|goodbye|see you/.test(q)) {
    return "Goodbye! Have a great day! 👋";
  }
  if (/your name|who are you|what are you/.test(q)) {
    return "I'm **Campus Desk**, your college help desk. I read the college notices, rules and circulars to give you a short answer.";
  }
  if (/help|what can you do/.test(q)) {
    return "Here's what I can help you with:\n\n• 📅 Exams & Fees\n• 📋 Attendance\n• 🏠 Hostel rules\n• 🏆 Scholarships\n• 📜 Certificates\n\nJust type your question the way you would ask a friend!";
  }
  // Default for anything else — honest about limitations
  return "I understand your question! The knowledge base is not connected in this demo, but normally I would search through official college documents to give you an exact answer.\n\nFor now, please contact your college office. 📋";
}

export const AIAssistantPage: React.FC<AIAssistantPageProps> = ({ user }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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

    // Simulate thinking delay (0.6–1.2s)
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));

    let responseText: string;
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
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
    { title: 'Attendance', desc: 'How much is needed?' },
    { title: 'Fees', desc: 'Last date to pay' },
    { title: 'Exams', desc: 'Form and hall ticket' },
    { title: 'Hostel', desc: 'Timings and leave' },
    { title: 'Scholarship', desc: 'How to apply' },
    { title: 'Certificates', desc: 'Bonafide and TC' },
  ];

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#f4f7ff] pt-[64px]">
      <div className="max-w-[800px] w-full mx-auto px-4 md:px-6 flex flex-col flex-1">

        {/* Page Header */}
        <div className="pt-8 pb-5 border-b border-[#bfc9c3]/25">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#003527] flex items-center justify-center
                            shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[22px] text-[#80bea6]">smart_toy</span>
            </div>
            <div>
              <h1 className="font-headline font-bold text-xl text-[#0b1c30] flex items-center gap-2">
                Ask about notices, rules and circulars
              </h1>
              <p className="text-xs text-[#9ca8a3]">
                Answers come only from your college's official files
              </p>
            </div>
          </div>
        </div>

        {/* Conversation */}
        <div className="flex-1 overflow-y-auto py-6 space-y-5">

          {/* Welcome state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center text-center pt-8 pb-4">
              <p className="text-xs text-[#003527] font-semibold mb-2 uppercase tracking-wide">
                Welcome, {user.name.split(' ')[0]}
              </p>
              <h2 className="font-headline font-bold text-3xl text-[#0b1c30] mb-4">
                Ask anything about your college.
              </h2>
              <p className="text-sm text-[#5a6672] max-w-xl leading-relaxed mb-10">
                Type your question the way you would ask a friend. Campus Desk reads
                the college notices, rules and circulars, gives a short answer,
                and shows exactly which file it came from.
              </p>

              <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {quickPrompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(`What about ${p.title.toLowerCase()}? ${p.desc}`)}
                    className="text-left p-4 bg-white rounded-xl border border-[#bfc9c3]/30
                               hover:border-[#003527]/30 hover:bg-[#eff4ff]
                               transition-all flex flex-col gap-1 shadow-sm group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-[#fbbc04]"></div>
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
                  <div className="w-8 h-8 rounded-full bg-[#003527] flex items-center justify-center
                                  shrink-0 mt-1 shadow-sm">
                    <span className="material-symbols-outlined text-[16px] text-[#80bea6]">school</span>
                  </div>
                )}

                <div className={`max-w-[78%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line
                                ${isUser
                                  ? 'bg-[#003527] text-white rounded-tr-sm shadow-sm font-medium'
                                  : 'bg-white text-[#0b1c30] rounded-tl-sm shadow-sm border border-[#bfc9c3]/25'
                                }`}
                  >
                    {msg.text}
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
              <div className="bg-white border border-[#bfc9c3]/25 rounded-2xl rounded-tl-sm
                              px-4 py-3 shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#003527] animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-[#003527] animate-bounce [animation-delay:0.15s]" />
                <span className="w-2 h-2 rounded-full bg-[#003527] animate-bounce [animation-delay:0.3s]" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar — sticky at bottom */}
        <div className="sticky bottom-0 pb-6 pt-3 bg-[#f4f7ff]">
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-3 bg-white rounded-2xl border border-[#bfc9c3]/30
                       px-4 py-2.5 shadow-md"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question here, for example: What is the last date to pay fees?"
              className="flex-1 bg-transparent border-none outline-none text-sm text-[#0b1c30]
                         placeholder:text-[#bfc9c3] font-inter"
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
            Campus Desk may make mistakes. Always verify important information with official sources.
          </p>
        </div>

      </div>
    </div>
  );
};
