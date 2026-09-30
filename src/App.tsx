import React, { useState, useEffect } from 'react';
import { AuthUser, CollegeDocument, Notice, NoticeCategory, DeadlineItem } from './types';
import { Header }           from './components/Header';
import { Footer }           from './components/Footer';
import { StudentDashboard } from './components/StudentDashboard';
import { CollegeNotices }   from './components/CollegeNotices';
import { UploadDocument }   from './components/UploadDocument';
import { LandingPage }      from './pages/LandingPage';
import { AuthPage }         from './pages/AuthPage';
import { ProfilePage }      from './pages/ProfilePage';
import { AIAssistantPage }  from './pages/AIAssistantPage';
import { AdminDashboard }   from './pages/AdminDashboard';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { GlobalSearch }     from './components/GlobalSearch';

import {
  INITIAL_STUDENT,
  INITIAL_NOTICES,
  INITIAL_DEADLINES,
  INITIAL_DOCUMENTS,
} from './data/knowledgeBase';

type AppView = 'landing' | 'auth' | 'app';

export default function App() {
  // Restore user from localStorage
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('campusiq_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  // If already logged in, skip landing/auth
  const [view, setView] = useState<AppView>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlView = params.get('view') as AppView;
    if (urlView && ['landing', 'auth', 'app'].includes(urlView)) {
      if (urlView === 'app' && !user) return 'landing';
      return urlView;
    }
    return user ? 'app' : 'landing';
  });

  const handleViewChange = (newView: AppView) => {
    setView(newView);
    window.history.pushState({ view: newView }, '', `?view=${newView}`);
  };

  useEffect(() => {
    window.history.replaceState({ view }, '', `?view=${view}`);
    const onPopState = (e: PopStateEvent) => {
      if (e.state && e.state.view) {
        const poppedView = e.state.view;
        if ((poppedView === 'auth' || poppedView === 'landing') && user) {
          // Prevent back navigation to login if already authenticated
          window.history.forward();
        } else {
          setView(poppedView);
        }
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [user]);

  // Which auth mode to open (login or signup)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // Track if user just verified their email via link
  const [emailJustVerified, setEmailJustVerified] = useState(false);

  // On mount: detect ?verified=true in URL → auto-open login with success banner
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verified = params.get('verified');
    if ((verified === 'true' || verified === 'already') && !user) {
      setEmailJustVerified(true);
      setAuthMode('login');
      setView('auth');
      // Clean URL so refreshing doesn't re-trigger this
      window.history.replaceState({}, '', window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGetStarted = (mode: 'login' | 'signup' = 'login') => {
    setAuthMode(mode);
    handleViewChange('auth');
  };

  const handleLogin = (u: AuthUser) => {
    setUser(u);
    handleViewChange('app');
  };

  const handleLogout = () => {
    localStorage.removeItem('campusiq_token');
    localStorage.removeItem('campusiq_user');
    setUser(null);
    handleViewChange('landing');
  };

  const handleUpdateUser = (u: AuthUser) => setUser(u);

  useEffect(() => {
    const token = localStorage.getItem('campusiq_token');
    if (!token) return;

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.id) {
          setUser(data);
          localStorage.setItem('campusiq_user', JSON.stringify(data));
        } else {
          // Token invalid/expired
          localStorage.removeItem('campusiq_token');
          localStorage.removeItem('campusiq_user');
          setUser(null);
          handleViewChange('landing');
        }
      })
      .catch(() => { /* offline — use cached user */ });
  }, []);

  // ── Route: Landing ────────────────────────────────────────
  if (view === 'landing') {
    return <LandingPage onGetStarted={handleGetStarted} />;
  }

  // ── Route: Auth ───────────────────────────────────────────
  if (view === 'auth') {
    return (
      <AuthPage
        initialMode={authMode}
        onLogin={handleLogin}
        onBack={() => handleViewChange('landing')}
        emailJustVerified={emailJustVerified}
      />
    );
  }

  // ── Route: App (logged in) ────────────────────────────────
  if (!user) return null; // safety guard
  return (
    <AppShell
      user={user}
      onLogout={handleLogout}
      onUpdateUser={handleUpdateUser}
    />
  );
}

// ── Inner shell — hooks only run once user is confirmed ──────
function AppShell({
  user,
  onLogout,
  onUpdateUser,
}: {
  user: AuthUser;
  onLogout: () => void;
  onUpdateUser: (u: AuthUser) => void;
}) {
  const [currentTab,  setCurrentTab]  = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'dashboard';
  });

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    window.history.pushState({ tab, view: 'app' }, '', `?view=app&tab=${tab}`);
  };

  useEffect(() => {
    window.history.replaceState({ tab: currentTab, view: 'app' }, '', `?view=app&tab=${currentTab}`);
    const onPopState = (e: PopStateEvent) => {
      if (e.state && e.state.tab) setCurrentTab(e.state.tab);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [notices,     setNotices]     = useState<Notice[]>(INITIAL_NOTICES);
  const [documents,   setDocuments]   = useState<CollegeDocument[]>(INITIAL_DOCUMENTS);
  const [calendarExams, setCalendarExams] = useState<any[]>([]);

  // ── Derive dynamic deadlines: real notices (excluding academic calendar) + official exam deadlines ──
  const deadlines = React.useMemo(() => {
    const list: DeadlineItem[] = [];
    const seenTitles = new Set<string>();

    const calcDaysAndUrgency = (dateStr: string, manualUrgency?: string) => {
      let daysRemaining = 5;
      try {
        const targetDate = new Date(dateStr);
        if (!isNaN(targetDate.getTime())) {
          const now = new Date();
          const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
          const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const diffMs = targetMidnight.getTime() - nowMidnight.getTime();
          daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));
        }
      } catch {
        daysRemaining = 5;
      }

      let calculatedUrgency: 'high' | 'medium' | 'normal' = 'normal';
      if (daysRemaining <= 3 || manualUrgency === 'urgent') {
        calculatedUrgency = 'high';
      } else if (daysRemaining <= 7 || manualUrgency === 'high') {
        calculatedUrgency = 'medium';
      } else {
        calculatedUrgency = 'normal';
      }

      return { daysRemaining, calculatedUrgency };
    };

    // 1. Process notices with real action dates (STRICTLY filter out generic academic calendar document)
    for (const n of notices) {
      if (!n.actionRequiredDate || n.actionRequiredDate.trim().length === 0) continue;
      const t = n.title.toLowerCase();
      if (t.includes('academic calendar') || t.includes('academic calender')) continue;

      const cleanTitle = n.title.replace(/^([📢🎉📅]\s*)+/, '').trim();
      const normKey = cleanTitle.toLowerCase();
      if (!seenTitles.has(normKey)) {
        seenTitles.add(normKey);
        const { daysRemaining, calculatedUrgency } = calcDaysAndUrgency(n.actionRequiredDate, n.urgency);
        list.push({
          id: `dl_${n.id}`,
          title: cleanTitle,
          dateStr: n.actionRequiredDate,
          daysRemaining,
          urgency: calculatedUrgency,
          category: n.category,
          description: n.aiSummary || n.title,
        });
      }
    }

    // 2. Process exam deadlines from calendar (ONLY exam deadlines, no general academic calendar events)
    for (const ex of calendarExams) {
      const cleanTitle = (ex.title || '').replace(/^([📢🎉📅]\s*)+/, '').trim();
      const normKey = cleanTitle.toLowerCase();
      if (!seenTitles.has(normKey)) {
        const { daysRemaining, calculatedUrgency } = calcDaysAndUrgency(ex.eventDate || ex.dateStr);
        // Only include upcoming / current exams
        if (daysRemaining >= 0) {
          seenTitles.add(normKey);
          list.push({
            id: `dl_exam_${ex.id}`,
            title: cleanTitle,
            dateStr: ex.dateStr || ex.eventDate,
            daysRemaining,
            urgency: calculatedUrgency,
            category: 'Exams',
            description: ex.description || cleanTitle,
          });
        }
      }
    }

    return list.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [notices, calendarExams]);

  // ── Load saved documents, notices & calendar exams from database on startup ─────────
  useEffect(() => {
    fetch('/api/documents')
      .then(r => r.json())
      .then(data => {
        if (data.documents && data.documents.length > 0) {
          setDocuments(prev => {
            const existingIds = new Set(prev.map(d => d.id));
            const newDocs = data.documents.filter((d: CollegeDocument) => !existingIds.has(d.id));
            return [...newDocs, ...prev];
          });
        }
      })
      .catch(() => { /* offline — use initial docs */ });

    fetch('/api/notices')
      .then(r => r.json())
      .then(data => {
        if (data.notices && data.notices.length > 0) {
          setNotices(data.notices);
        }
      })
      .catch(() => { /* offline — use initial notices */ });

    fetch('/api/calendar-events')
      .then(r => r.json())
      .then(data => {
        if (data.events) {
          // Strictly only include exam events from the calendar
          const exams = data.events.filter((e: any) =>
            e.category === 'Exams' ||
            e.title.toLowerCase().includes('mid-sem') ||
            e.title.toLowerCase().includes('periodic test') ||
            e.title.toLowerCase().includes('practical examination') ||
            e.title.toLowerCase().includes('theory examination')
          );
          setCalendarExams(exams);
        }
      })
      .catch(() => { /* offline */ });
  }, []);

  // Merge live user data over static profile defaults
  const studentProfile = {
    ...INITIAL_STUDENT,
    name:       user.name,
    avatar:     user.avatar,
    department: user.department  ?? INITIAL_STUDENT.department,
    year:       user.year        ?? INITIAL_STUDENT.year,
    semester:   user.semester    ?? INITIAL_STUDENT.semester,
    rollNumber: user.rollNumber  ?? INITIAL_STUDENT.rollNumber,
    section:    user.section     ?? '',
  };

  // Ctrl+K → open global search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Real timetable extraction ─────────────────────────────
  const extractTimetableData = (doc: CollegeDocument): { code: string; name: string; time: string; room: string; instructor: string } | null => {
    const rawContent = doc.contentRaw || '';
    const content = rawContent.toLowerCase();

    const codeMatch = rawContent.match(/\b([A-Z]{2,5}[-\s]?\d{3,4})\b/);
    const code = codeMatch ? codeMatch[1].replace(/\s/g, '') : null;

    const timeMatch = rawContent.match(/(\d{1,2}[:.]?\d{2}\s*(?:AM|PM|am|pm)?)\s*[-\u2013to]+\s*(\d{1,2}[:.]?\d{2}\s*(?:AM|PM|am|pm)?)/i);
    const time = timeMatch ? `${timeMatch[1]} - ${timeMatch[2]}` : null;

    const roomMatch = rawContent.match(/(?:Room|Lab|Hall|Auditorium|CR|LH)\s*[#:]?\s*([\w,\s]+?)(?=\s*[\n|;]|$)/i);
    const room = roomMatch ? roomMatch[0].trim() : null;

    const instrMatch = rawContent.match(/(?:Prof\.?|Dr\.?|Mr\.?|Ms\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/i);
    const instructor = instrMatch ? instrMatch[0].trim() : null;

    let name: string | null = null;
    if (content.includes('data science') || content.includes('data analytics')) name = 'Data Science & Analytics';
    else if (content.includes('machine learning')) name = 'Machine Learning Lab';
    else if (content.includes('cloud') || content.includes('distributed')) name = 'Cloud & Distributed Systems';
    else if (content.includes('network security') || content.includes('cyber')) name = 'Network Security';
    else if (content.includes('database') || content.includes(' sql ')) name = 'Database Management Systems';
    else if (content.includes('operating system')) name = 'Operating Systems';

    // Only return if we have at least a code or name AND a time slot
    if (!(code || name) || !time) return null;

    return { code: code || '\u2014', name: name || code || 'Class', time, room: room || '\u2014', instructor: instructor || '\u2014' };
  };


  const handleDocumentAdded = (doc: CollegeDocument) => {
    setDocuments((prev) => [doc, ...prev]);

    // ── Check if this is a timetable upload ─────────────────
    const isTimetable =
      doc.category === 'Timetable' ||
      doc.title.toLowerCase().includes('timetable') ||
      doc.title.toLowerCase().includes('schedule') ||
      doc.title.toLowerCase().includes('time table');

    if (isTimetable) {
      // 1. Extract schedule data from the uploaded timetable
      const extracted = extractTimetableData(doc);

      // 2. Generate an urgent notice alerting students
      const timetableNotice: Notice = {
        id:          `not_tt_${Date.now()}`,
        title:       `📅 New Timetable Published: ${doc.title}`,
        category:    'Academic',
        urgency:     'urgent',
        publishDate: 'Just now',
        department:  doc.department,
        aiSummary:   extracted
          ? `A new timetable has been uploaded. Your next class: ${extracted.code}: ${extracted.name} at ${extracted.time}. Please check the full schedule.`
          : `A new timetable has been uploaded by a teacher. Please check the schedule tab for your classes.`,
        fullContent: doc.contentRaw,
        imageUrl:    doc.imageUrl || doc.fileUrl,
        fileUrl:     doc.fileUrl || doc.imageUrl,
        tags:        ['Timetable', 'Schedule Update', 'Real-time Sync', doc.department],
        readByStudent: false,
      };
      setNotices((prev) => [timetableNotice, ...prev]);
    } else {
      // Normal document/event upload notice
      const isEvent = doc.category === 'Events' || doc.fileType === 'image';
      const validCategories: Notice['category'][] = ['Events', 'Circular', 'Exams', 'Academic', 'Scholarships', 'Placements', 'Hostels', 'General'];
      const noticeCategory: Notice['category'] = validCategories.includes(doc.category as any)
        ? (doc.category as Notice['category'])
        : (isEvent ? 'Events' : 'Academic');

      const notice: Notice = {
        id:          `not_${doc.id || Date.now()}`,
        title:       `${isEvent && !doc.title.startsWith('🎉') ? '🎉 ' : ''}${doc.title}`,
        category:    noticeCategory,
        urgency:     isEvent ? 'urgent' : 'normal',
        publishDate: doc.publishedDate || 'Just now',
        department:  doc.department,
        actionRequiredDate: (doc as any).actionRequiredDate || undefined,
        aiSummary:   doc.summary,
        fullContent: doc.contentRaw,
        imageUrl:    doc.imageUrl || doc.fileUrl,
        fileUrl:     doc.fileUrl || doc.imageUrl,
        tags:        ['New Document', doc.category, doc.department, ...(isEvent ? ['Events', 'Hackathon'] : [])],
      };
      setNotices((prev) => [notice, ...prev.filter(n => n.id !== notice.id)]);

      // Sync with server notices
      fetch('/api/notices')
        .then(r => r.json())
        .then(data => {
          if (data.notices && data.notices.length > 0) setNotices(data.notices);
        })
        .catch(() => {});
    }
  };

  const handleNoticeAdded = (notice: Notice) => {
    setNotices((prev) => [notice, ...prev]);
  };

  const handleDocumentDeleted = (docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    setNotices((prev) => prev.filter((n) => n.sourceDocId !== docId && n.id !== docId && n.id !== `not_${docId}`));
    fetch('/api/documents').then(r => r.json()).then(data => { if (data.documents) setDocuments(data.documents); }).catch(() => {});
    fetch('/api/notices').then(r => r.json()).then(data => { if (data.notices) setNotices(data.notices); }).catch(() => {});
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f7ff] text-[#0b1c30]
                    selection:bg-[#80bea6]/30 selection:text-[#003527]">

      <Header
        currentTab={currentTab}
        setCurrentTab={handleTabChange}
        user={user}
        onOpenSearch={() => setSearchOpen(true)}
        onLogout={onLogout}
        unreadCount={notices.filter((n) => !n.readByStudent).length}
      />

      <GlobalSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        notices={notices}
        documents={documents}
        deadlines={deadlines}
        onNavigateTab={(tab) => { handleTabChange(tab); setSearchOpen(false); }}
      />

      <main className="flex-1">
        {currentTab === 'dashboard' && (
          user.role === 'admin' ? (
            <AdminDashboard
              user={user}
              documents={documents}
              notices={notices}
              onNavigate={handleTabChange}
              onDocumentDeleted={handleDocumentDeleted}
            />
          ) : user.role === 'teacher' ? (
            <TeacherDashboard
              user={user}
              documents={documents}
              notices={notices}
              onDocumentAdded={handleDocumentAdded}
              onNoticeAdded={handleNoticeAdded}
              onDocumentDeleted={handleDocumentDeleted}
              onNavigate={handleTabChange}
            />
          ) : (
            <StudentDashboard
              student={studentProfile}
              notices={notices}
              deadlines={deadlines}
              documents={documents}
              onOpenAIQuery={() => handleTabChange('assistant')}
              onViewNotice={() => handleTabChange('notices')}
              onNavigateTab={handleTabChange}
            />
          )
        )}

        {currentTab === 'assistant' && (
          <AIAssistantPage user={user} />
        )}

        {currentTab === 'notices' && (
          <CollegeNotices
            notices={notices}
            deadlines={deadlines}
            onOpenAIQuery={() => handleTabChange('assistant')}
          />
        )}

        {currentTab === 'upload' && (user.role === 'admin' || user.role === 'teacher') && (
          <UploadDocument
            onDocumentAdded={handleDocumentAdded}
            onDocumentDeleted={handleDocumentDeleted}
            onNavigateTab={handleTabChange}
            user={user}
          />
        )}

        {currentTab === 'profile' && (
          <ProfilePage
            user={user}
            onLogout={onLogout}
            onUpdate={onUpdateUser}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
