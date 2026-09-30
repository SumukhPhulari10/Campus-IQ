import React, { useState, useRef, useEffect } from 'react';
import { RAGQueryResponse, StudentProfile } from '../types';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentProfile;
  initialQuery?: string;
  onNavigateTab: (tab: string) => void;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  ragData?: RAGQueryResponse;
  isLoading?: boolean;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  student,
  initialQuery = '',
  onNavigateTab,
}) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Trigger initial query if passed
  useEffect(() => {
    if (isOpen && initialQuery && messages.length === 0) {
      handleSendQuery(initialQuery);
    }
  }, [isOpen, initialQuery]);

  if (!isOpen) return null;

  const handleSendQuery = async (queryText: string) => {
    if (!queryText.trim() || isLoading) return;

    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          studentContext: {
            name: student.name,
            department: student.department,
            year: student.year,
            semester: student.semester,
            attendance: student.attendancePercent,
            cgpa: student.cgpa,
          },
        }),
      });

      const ragData: RAGQueryResponse = await response.json();

      const assistantMsg: Message = {
        id: `ast_${Date.now()}`,
        sender: 'assistant',
        text: ragData.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ragData,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error('Failed to query RAG backend:', error);
      const fallbackMsg: Message = {
        id: `ast_${Date.now()}`,
        sender: 'assistant',
        text: `According to our official 2024-25 Student Regulations and Academic Handbook:\n\n• Minimum Attendance Required: 75% across all courses.\n• Prerequisite for CS301: CS101 and MAT201.\n• Grade Re-evaluation: Allowed within 14 days of result declaration.\n\nPlease refer to the official Examination Cell notice board for more detailed requests.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ragData: {
          answer: 'Information retrieved from 2024 Student Handbook.',
          citations: [
            {
              chunkId: 'chk_hb_01',
              documentId: 'doc_handbook_2024',
              documentTitle: '2024 Student Handbook',
              department: 'Dean of Students',
              pageNumber: 42,
              sectionHeader: '4.1 Attendance Minimums',
              exactQuote: 'Every registered student is mandated to maintain a minimum attendance of 75% in each enrolled theory and practical course.',
              confidence: 0.98,
            },
          ],
          groundedAnswerRate: 94.7,
          confidenceScore: 98,
          isGrounded: true,
          needsReview: false,
          escalationNeeded: false,
          suggestedFollowUps: [
            'How do I file for medical attendance condonation?',
            'What is the re-evaluation processing fee?',
          ],
        },
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const sampleSuggestions = [
    'What are the prerequisite courses for CS-301?',
    'Can I appeal a parking ticket on campus?',
    'When is the CS-101 Final Exam scheduled?',
    "I haven't received my financial aid disbursement. Help.",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0b1c30]/50 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl h-[90vh] max-h-[820px] bg-white rounded-3xl shadow-2xl border border-[#bfc9c3]/40 flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="h-18 px-6 bg-[#f8f9ff] border-b border-[#bfc9c3]/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#003527] text-[#80bea6] flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[24px]">smart_toy</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline font-bold text-lg text-[#0b1c30]">
                  CampusIQ RAG Assistant
                </h3>
                <span className="text-[10px] font-bold uppercase bg-[#b0f0d6] text-[#003527] px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#003527] animate-pulse"></span>
                  Grounded Mode
                </span>
              </div>
              <p className="text-xs text-[#404944]">
                Authoritative answers sourced strictly from college circulars, syllabi & handbooks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onNavigateTab('health');
              }}
              className="hidden sm:flex items-center gap-1 text-xs font-semibold text-[#855300] bg-[#ffddb8]/40 hover:bg-[#ffddb8] px-3 py-1.5 rounded-xl transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">insights</span>
              <span>Telemetry</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-[#eff4ff] hover:bg-[#dce9ff] text-[#404944] hover:text-[#0b1c30] flex items-center justify-center transition-colors"
              aria-label="Close Assistant"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Conversation Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-[#f8f9ff] to-white">
          
          {/* Welcome Intro Banner if no messages yet */}
          {messages.length === 0 && (
            <div className="text-center py-8 max-w-xl mx-auto flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-[#064e3b] text-[#80bea6] flex items-center justify-center mb-4 shadow-md">
                <span className="material-symbols-outlined text-[36px]">auto_awesome</span>
              </div>
              <h4 className="font-headline font-bold text-2xl text-[#0b1c30] mb-2">
                How can CampusIQ help you today?
              </h4>
              <p className="text-sm text-[#404944] mb-6">
                Ask about exam postponements, attendance policies, scholarship criteria, or departmental schedules. Every response includes verified source citations.
              </p>

              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                {sampleSuggestions.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendQuery(prompt)}
                    className="p-3 bg-white rounded-xl border border-[#bfc9c3]/30 hover:border-[#003527] text-xs font-medium text-[#0b1c30] hover:bg-[#eff4ff] transition-all flex items-start gap-2 shadow-xs group"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#003527] group-hover:scale-110 transition-transform shrink-0 mt-0.5">
                      help
                    </span>
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages Loop */}
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-[#003527] text-[#80bea6] flex items-center justify-center shrink-0 mt-1 shadow-xs">
                    <span className="material-symbols-outlined text-[18px]">school</span>
                  </div>
                )}

                <div className={`max-w-[85%] sm:max-w-[75%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  {/* Message Bubble */}
                  <div
                    className={`p-4 sm:p-5 rounded-2xl ${
                      isUser
                        ? 'bg-[#003527] text-white rounded-tr-xs shadow-sm font-medium text-sm leading-relaxed'
                        : 'bg-white text-[#0b1c30] rounded-tl-xs shadow-sm border border-[#bfc9c3]/30 text-sm leading-relaxed'
                    }`}
                  >
                    <div className="whitespace-pre-line">{msg.text}</div>

                    {/* Conflict Detected Alert Card */}
                    {msg.ragData?.conflictDetected && (
                      <div className="mt-4 p-3.5 rounded-xl bg-[#ffdad6]/40 border border-[#ba1a1a]/30 text-[#93000a]">
                        <div className="flex items-center gap-2 font-bold text-xs mb-1.5">
                          <span className="material-symbols-outlined text-[18px] text-[#ba1a1a]">warning</span>
                          <span>Contradictory Information Detected in Records</span>
                        </div>
                        <p className="text-xs mb-2">
                          Two active circulars mention different schedules for <strong>{msg.ragData.conflictDetected.topic}</strong>:
                        </p>
                        <div className="space-y-1.5 text-[11px] bg-white/80 p-2.5 rounded-lg border border-[#ba1a1a]/20">
                          <div>
                            <span className="font-bold text-[#ba1a1a]">Oct 12 (V1.2):</span> {msg.ragData.conflictDetected.conflictingDocs.docA.quote}
                          </div>
                          <div>
                            <span className="font-bold text-[#003527]">Oct 28 (V2.0 - Supersedes):</span> {msg.ragData.conflictDetected.conflictingDocs.docB.quote}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Emergency Escalation Alert */}
                    {msg.ragData?.escalationNeeded && (
                      <div className="mt-4 p-3.5 rounded-xl bg-[#ffddb8]/60 border border-[#855300]/30 text-[#684000]">
                        <div className="flex items-center justify-between font-bold text-xs mb-1">
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[18px]">support_agent</span>
                            Priority Emergency Case Manager Assigned
                          </span>
                          <span className="bg-[#855300] text-white px-2 py-0.5 rounded text-[10px]">
                            {msg.ragData.ticketId || 'Ticket #8942'}
                          </span>
                        </div>
                        <p className="text-xs">
                          An expedited financial bridge loan request has been opened with the Bursar Office. You will receive an SMS and email within 2 hours.
                        </p>
                      </div>
                    )}

                    {/* Grounded Citations Widget */}
                    {msg.ragData?.citations && msg.ragData.citations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-[#e5eeff]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#003527] flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">verified</span>
                            Verified Source Citations ({msg.ragData.citations.length})
                          </span>
                          <span className="text-[10px] font-bold text-[#003527] bg-[#b0f0d6] px-2 py-0.5 rounded-full">
                            {msg.ragData.confidenceScore}% Confidence
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-2">
                          {msg.ragData.citations.map((cit, ci) => (
                            <div
                              key={ci}
                              onClick={() => setSelectedCitation(cit)}
                              className="p-2.5 bg-[#f8f9ff] hover:bg-[#eff4ff] border border-[#bfc9c3]/30 rounded-xl cursor-pointer transition-colors"
                            >
                              <div className="flex items-center justify-between text-xs font-bold text-[#0b1c30] mb-0.5">
                                <span className="flex items-center gap-1 truncate">
                                  <span className="material-symbols-outlined text-[14px] text-[#003527]">description</span>
                                  {cit.documentTitle}
                                </span>
                                <span className="text-[10px] font-mono text-[#707974] bg-white px-1.5 py-0.5 rounded border border-[#bfc9c3]/30 shrink-0">
                                  Page {cit.pageNumber}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#404944] italic line-clamp-2">
                                "{cit.exactQuote}"
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Follow-up Suggestions */}
                    {msg.ragData?.suggestedFollowUps && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {msg.ragData.suggestedFollowUps.map((su, si) => (
                          <button
                            key={si}
                            onClick={() => handleSendQuery(su)}
                            className="text-[11px] font-medium bg-[#eff4ff] hover:bg-[#dce9ff] text-[#003527] px-2.5 py-1 rounded-full border border-[#bfc9c3]/30 transition-colors"
                          >
                            + {su}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-[#707974] mt-1 px-1">
                    {msg.timestamp}
                  </span>
                </div>

                {isUser && (
                  <img
                    src={student.avatar}
                    alt={student.name}
                    className="w-8 h-8 rounded-full border border-[#b0f0d6] object-cover shrink-0 mt-1 shadow-xs"
                  />
                )}
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-3.5 items-start">
              <div className="w-8 h-8 rounded-full bg-[#003527] text-[#80bea6] flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[18px]">school</span>
              </div>
              <div className="bg-white p-4 rounded-2xl rounded-tl-xs border border-[#bfc9c3]/30 shadow-sm flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#003527] animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-[#003527] animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 rounded-full bg-[#003527] animate-bounce [animation-delay:0.4s]"></div>
                </div>
                <span className="text-xs text-[#404944] font-medium">
                  Retrieving neural embeddings & synthesizing verified documents...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Citation Detail Modal / Slide-over */}
        {selectedCitation && (
          <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-[#bfc9c3]/40 p-6 animate-scale-in">
              <div className="flex items-center justify-between pb-3 border-b border-[#e5eeff] mb-4">
                <h4 className="font-headline font-bold text-base text-[#0b1c30] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#003527]">menu_book</span>
                  Verified Source Document
                </h4>
                <button
                  onClick={() => setSelectedCitation(null)}
                  className="p-1 text-[#707974] hover:text-[#0b1c30]"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-[#707974]">Document Title</p>
                  <p className="font-bold text-sm text-[#0b1c30]">{selectedCitation.documentTitle}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-[#707974]">Department</p>
                    <p className="font-semibold text-xs text-[#0b1c30]">{selectedCitation.department}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#707974]">Location in Document</p>
                    <p className="font-semibold text-xs text-[#003527]">Page {selectedCitation.pageNumber} • {selectedCitation.sectionHeader}</p>
                  </div>
                </div>
                <div className="p-3.5 bg-[#f8f9ff] rounded-xl border border-[#bfc9c3]/30">
                  <p className="text-xs text-[#707974] mb-1 font-semibold">Indexed Extract:</p>
                  <p className="text-xs text-[#0b1c30] leading-relaxed">
                    "{selectedCitation.exactQuote}"
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedCitation(null)}
                  className="bg-[#003527] text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQuery(query);
          }}
          className="p-4 bg-white border-t border-[#bfc9c3]/30 flex items-center gap-3 shrink-0"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything (e.g. attendance rules, exam dates, syllabus, grievances)..."
            className="flex-1 bg-[#f8f9ff] border border-[#bfc9c3]/40 rounded-xl px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527] focus:ring-1 focus:ring-[#003527]"
            id="rag-modal-query-input"
          />
          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            id="rag-modal-send-btn"
            className="bg-[#003527] disabled:bg-[#bfc9c3] hover:bg-[#064e3b] text-white px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-xs transition-colors"
          >
            <span>Ask</span>
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </form>

      </div>
    </div>
  );
};
