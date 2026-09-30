import React, { useState } from 'react';
import { AuthUser, CollegeDocument, Notice } from '../types';
import { UploadDocument } from '../components/UploadDocument';

interface TeacherDashboardProps {
  user: AuthUser;
  documents: CollegeDocument[];
  notices: Notice[];
  onDocumentAdded: (doc: CollegeDocument) => void;
  onNoticeAdded: (notice: Notice) => void;
  onDocumentDeleted?: (docId: string) => void;
  onNavigate: (tab: string) => void;
}

type TeacherTab = 'overview' | 'upload' | 'post-notice' | 'my-materials';

const NOTICE_CATEGORIES = ['Events', 'Circular', 'Exams', 'Academic', 'Scholarships', 'Placements', 'Hostels', 'General'] as const;
type NoticeCategory = typeof NOTICE_CATEGORIES[number];

// ── Metric Card ───────────────────────────────────────────────
const MetricCard: React.FC<{
  icon: string;
  label: string;
  value: string;
  detail: string;
  tone: 'blue' | 'green' | 'amber' | 'purple';
}> = ({ icon, label, value, detail, tone }) => {
  const tones = {
    blue:   'bg-[#dbeafe] text-[#1d4ed8]',
    green:  'bg-[#003527] text-[#80bea6]',
    amber:  'bg-[#fff4df] text-[#a76700]',
    purple: 'bg-[#ede9fe] text-[#6d28d9]',
  };
  return (
    <div className="card p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tones[tone]}`}>
        <span className="material-symbols-outlined text-[21px]">{icon}</span>
      </div>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-[#7a868f]">{label}</p>
      <p className="mt-1 text-3xl font-headline font-extrabold text-[#0b1c30]">{value}</p>
      <p className="mt-1.5 text-xs text-[#66737d]">{detail}</p>
    </div>
  );
};

// ── Tab Button ────────────────────────────────────────────────
const TabBtn: React.FC<{
  id: TeacherTab;
  active: TeacherTab;
  icon: string;
  label: string;
  onClick: (id: TeacherTab) => void;
}> = ({ id, active, icon, label, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all
                ${active === id
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'text-[#5a6672] hover:bg-[#eff4ff] hover:text-[#1d4ed8]'}`}
  >
    <span className="material-symbols-outlined text-[17px]">{icon}</span>
    {label}
  </button>
);

// ── Post Notice Form ──────────────────────────────────────────
const PostNoticeForm: React.FC<{
  user: AuthUser;
  onNoticeAdded: (n: Notice) => void;
}> = ({ user, onNoticeAdded }) => {
  const [title, setTitle]       = useState('');
  const [category, setCategory] = useState<NoticeCategory>('Events');
  const [urgency, setUrgency]   = useState<Notice['urgency']>('normal');
  const [content, setContent]   = useState('');
  const [posterImage, setPosterImage] = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPosterImage(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const notice: Notice = {
      id:          `not_t_${Date.now()}`,
      title:       title.trim(),
      category,
      urgency,
      publishDate: 'Just now',
      department:  user.department || 'General',
      aiSummary:   content.trim().slice(0, 160) + (content.length > 160 ? '…' : ''),
      fullContent: content.trim(),
      imageUrl:    posterImage || undefined,
      fileUrl:     posterImage || undefined,
      tags:        ['Teacher Notice', category, user.name],
    };

    onNoticeAdded(notice);
    setTitle(''); setContent(''); setCategory('Events'); setUrgency('normal'); setPosterImage(null);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const urgencyOptions: { value: Notice['urgency']; label: string; color: string }[] = [
    { value: 'urgent', label: '🔴 Urgent',  color: 'text-red-600' },
    { value: 'high',   label: '🟠 High',    color: 'text-orange-500' },
    { value: 'normal', label: '🟢 Normal',  color: 'text-[#003527]' },
    { value: 'info',   label: '🔵 Info',    color: 'text-blue-500' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {success && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-[#f0f9f6] border border-[#b0f0d6] animate-fade-in">
          <span className="material-symbols-outlined text-[18px] text-[#003527]">check_circle</span>
          <p className="text-sm font-bold text-[#003527]">Notice posted successfully! Students can now see it.</p>
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-[11px] font-bold text-[#5a6672] uppercase tracking-wide mb-1.5">
          Notice Title *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. AITHON 2.0 Hackathon or Exam Time Table"
          className="w-full px-4 py-3 rounded-xl border border-[#bfc9c3]/40 bg-[#f8fafe]
                     text-sm text-[#0b1c30] placeholder:text-[#c8d0cc]
                     focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]/15"
        />
      </div>

      {/* Category + Urgency */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-bold text-[#5a6672] uppercase tracking-wide mb-1.5">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as NoticeCategory)}
            className="w-full px-4 py-3 rounded-xl border border-[#bfc9c3]/40 bg-[#f8fafe]
                       text-sm text-[#0b1c30] focus:outline-none focus:border-[#2563eb]"
          >
            {NOTICE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[#5a6672] uppercase tracking-wide mb-1.5">
            Urgency
          </label>
          <select
            value={urgency}
            onChange={(e) => setUrgency(e.target.value as Notice['urgency'])}
            className="w-full px-4 py-3 rounded-xl border border-[#bfc9c3]/40 bg-[#f8fafe]
                       text-sm text-[#0b1c30] focus:outline-none focus:border-[#2563eb]"
          >
            {urgencyOptions.map(u => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Optional Poster Image upload */}
      <div>
        <label className="block text-[11px] font-bold text-[#5a6672] uppercase tracking-wide mb-1.5">
          Event Poster / Banner Image (Optional)
        </label>
        <div className="flex items-center gap-3">
          <label className="px-4 py-2.5 bg-[#eff4ff] hover:bg-[#dbeafe] text-[#2563eb] text-xs font-bold rounded-xl cursor-pointer border border-[#2563eb]/20 flex items-center gap-1.5 transition-colors">
            <span className="material-symbols-outlined text-[16px]">add_photo_alternate</span>
            <span>{posterImage ? 'Change Poster Image' : 'Attach Poster Image'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </label>
          {posterImage && (
            <button
              type="button"
              onClick={() => setPosterImage(null)}
              className="text-xs text-red-500 font-bold hover:underline"
            >
              Remove Poster
            </button>
          )}
        </div>
        {posterImage && (
          <div className="mt-3 p-2 bg-[#f8fafe] rounded-xl border border-[#bfc9c3]/30 inline-block">
            <img src={posterImage} alt="Poster preview" className="max-h-32 rounded-lg object-contain" />
          </div>
        )}
      </div>

      {/* Content */}
      <div>
        <label className="block text-[11px] font-bold text-[#5a6672] uppercase tracking-wide mb-1.5">
          Notice Content *
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder="Write the full notice content here. Be clear and concise for students."
          className="w-full px-4 py-3 rounded-xl border border-[#bfc9c3]/40 bg-[#f8fafe]
                     text-sm text-[#0b1c30] placeholder:text-[#c8d0cc]
                     focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]/15
                     resize-none"
        />
        <p className="text-[10px] text-[#9ca8a3] mt-1">{content.length} characters</p>
      </div>

      {/* Department badge */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-[#eff4ff] border border-[#bfdbfe]">
        <span className="material-symbols-outlined text-[16px] text-[#2563eb]">apartment</span>
        <p className="text-xs text-[#1d4ed8] font-semibold">
          This notice will be posted for <strong>{user.department || 'All Departments'}</strong>
        </p>
      </div>

      <button
        type="submit"
        disabled={!title.trim() || !content.trim()}
        className="w-full py-3.5 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:bg-[#9ca8a3]
                   text-white font-bold text-sm rounded-xl shadow-md transition-all
                   flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-[18px]">campaign</span>
        Publish Notice
      </button>
    </form>
  );
};

// ── My Materials List ─────────────────────────────────────────
const MyMaterialsList: React.FC<{
  documents: CollegeDocument[];
  onNavigate: (tab: string) => void;
}> = ({ documents, onNavigate }) => {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#eff4ff] flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-[32px] text-[#2563eb]">folder_open</span>
        </div>
        <p className="font-headline font-bold text-lg text-[#0b1c30] mb-1">No materials uploaded yet</p>
        <p className="text-sm text-[#9ca8a3] mb-5 max-w-xs">
          Upload course materials, notes, assignments or syllabi for your students.
        </p>
        <button
          onClick={() => onNavigate('upload')}
          className="px-5 py-2.5 bg-[#2563eb] text-white text-sm font-bold rounded-xl hover:bg-[#1d4ed8] transition-colors"
        >
          Upload First Material
        </button>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#edf1ef]">
      {documents.map((doc) => (
        <div key={doc.id} className="p-4 flex items-center gap-3 hover:bg-[#f8fafe] transition-colors rounded-xl">
          <div className="w-10 h-10 rounded-xl bg-[#eff4ff] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#2563eb]">
              {doc.fileType === 'pdf' ? 'picture_as_pdf' : 'description'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#17283a] truncate">{doc.title}</p>
            <p className="text-xs text-[#7a868f] mt-0.5">
              {doc.department} · {doc.category} · {doc.publishedDate}
            </p>
          </div>
          <span className={`badge text-[9px] shrink-0 ${doc.status === 'indexed' ? 'badge-primary' : 'badge-secondary'}`}>
            {doc.status === 'indexed' ? '✓ Indexed' : 'Processing'}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Main Teacher Dashboard ────────────────────────────────────
export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  user, documents, notices, onDocumentAdded, onNoticeAdded, onDocumentDeleted, onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<TeacherTab>('overview');

  // In a real app, this would filter by uploaded_by. For the demo, we show all materials
  // so the teacher can see their successful uploads even if the department string is mismatched (e.g. 'CSE' vs 'Computer Science & Engineering').
  const myDocuments = documents;
  const myNotices   = notices;
  const recentDocs  = myDocuments.slice(0, 5);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <section className="max-w-[1200px] mx-auto px-4 md:px-6 pt-24 pb-12 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-7">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#2563eb]/12 px-3 py-1.5
                          text-[11px] font-bold tracking-wide uppercase text-[#1d4ed8]">
            <span className="material-symbols-outlined text-[15px]">person_book</span>
            Teacher workspace
          </div>
          <h1 className="mt-3 font-headline text-3xl md:text-4xl font-extrabold text-[#0b1c30]">
            {greeting}, {user.name.split(' ')[0]}.
          </h1>
          <p className="mt-2 text-sm text-[#66737d]">
            {user.subject
              ? `Teaching ${user.subject} · ${user.department || 'All Departments'}`
              : `Upload materials, post notices, and manage your course content.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setActiveTab('post-notice')}
            className="btn btn-secondary"
          >
            <span className="material-symbols-outlined text-[17px]">campaign</span>
            Post Notice
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className="btn btn-primary"
            style={{ background: '#2563eb' }}
          >
            <span className="material-symbols-outlined text-[17px]">upload_file</span>
            Upload Material
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <MetricCard
          icon="upload_file" label="Materials Uploaded"
          value={String(myDocuments.length).padStart(2, '0')}
          detail="In the campus knowledge base" tone="blue"
        />
        <MetricCard
          icon="campaign" label="Notices Posted"
          value={String(myNotices.length).padStart(2, '0')}
          detail={`${myNotices.filter(n => n.urgency === 'urgent').length} urgent`} tone="amber"
        />
        <MetricCard
          icon="apartment" label="Department"
          value={user.department?.slice(0, 4).toUpperCase() || 'ALL'}
          detail={user.department || 'All departments'} tone="green"
        />
        <MetricCard
          icon="school" label="Students Reached"
          value="1,248"
          detail="Across all enrolled students" tone="purple"
        />
      </div>

      {/* ── Inner Tab Navigation ── */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <TabBtn id="overview"      active={activeTab} icon="space_dashboard" label="Overview"        onClick={setActiveTab} />
        <TabBtn id="upload"        active={activeTab} icon="upload_file"     label="Upload Material" onClick={setActiveTab} />
        <TabBtn id="post-notice"   active={activeTab} icon="campaign"        label="Post Notice"     onClick={setActiveTab} />
        <TabBtn id="my-materials"  active={activeTab} icon="folder_open"     label="My Materials"   onClick={setActiveTab} />
      </div>

      {/* ── Tab: Overview ── */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Recent Materials */}
          <div className="card lg:col-span-3 overflow-hidden">
            <div className="p-5 border-b border-[#e5ece8] flex items-center justify-between">
              <div>
                <h2 className="font-headline font-extrabold text-lg text-[#0b1c30]">Recent Materials</h2>
                <p className="text-xs text-[#7a868f] mt-0.5">Your uploads in the campus knowledge base</p>
              </div>
              <button
                onClick={() => setActiveTab('my-materials')}
                className="text-xs font-bold text-[#2563eb] hover:underline"
              >
                View all
              </button>
            </div>
            <MyMaterialsList documents={recentDocs} onNavigate={() => setActiveTab('upload')} />
          </div>

          {/* Quick Actions */}
          <div className="card lg:col-span-2 p-5">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-9 h-9 rounded-xl bg-[#eff4ff] text-[#2563eb] flex items-center justify-center">
                <span className="material-symbols-outlined text-[19px]">bolt</span>
              </div>
              <div>
                <h2 className="font-headline font-extrabold text-lg text-[#0b1c30]">Quick Actions</h2>
                <p className="text-xs text-[#7a868f]">Common teacher tasks</p>
              </div>
            </div>
            <div className="grid gap-3">
              {[
                { icon: 'upload_file', label: 'Upload course material', sub: 'Add to AI knowledge base', tab: 'upload' as TeacherTab },
                { icon: 'campaign',    label: 'Post a notice',           sub: 'Notify students instantly', tab: 'post-notice' as TeacherTab },
                { icon: 'folder_open', label: 'View my materials',       sub: 'Manage your uploads',       tab: 'my-materials' as TeacherTab },
              ].map((item) => (
                <button
                  key={item.tab}
                  onClick={() => setActiveTab(item.tab)}
                  className="flex items-center gap-3 rounded-xl border border-[#d9e4dd] p-3.5
                             text-left hover:bg-[#eff4ff] hover:border-[#bfdbfe] transition-colors"
                >
                  <span className="material-symbols-outlined text-[#2563eb]">{item.icon}</span>
                  <span>
                    <span className="block text-sm font-bold text-[#17283a]">{item.label}</span>
                    <span className="block text-xs text-[#7a868f] mt-0.5">{item.sub}</span>
                  </span>
                </button>
              ))}
              <button
                onClick={() => onNavigate('assistant')}
                className="flex items-center gap-3 rounded-xl border border-[#d9e4dd] p-3.5
                           text-left hover:bg-[#f6faf8] transition-colors"
              >
                <span className="material-symbols-outlined text-[#003527]">smart_toy</span>
                <span>
                  <span className="block text-sm font-bold text-[#17283a]">Test AI Assistant</span>
                  <span className="block text-xs text-[#7a868f] mt-0.5">Check how your materials answer</span>
                </span>
              </button>
            </div>
          </div>

          {/* Recent Notices */}
          {myNotices.length > 0 && (
            <div className="card lg:col-span-5 overflow-hidden">
              <div className="p-5 border-b border-[#e5ece8]">
                <h2 className="font-headline font-extrabold text-lg text-[#0b1c30]">Recent Notices</h2>
                <p className="text-xs text-[#7a868f] mt-0.5">Notices in your department</p>
              </div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#edf1ef]">
                {myNotices.slice(0, 3).map((n) => (
                  <div key={n.id} className="p-5">
                    <span className={`badge text-[9px] ${n.urgency === 'urgent' || n.urgency === 'high' ? 'badge-secondary' : 'badge-primary'}`}>
                      {n.category}
                    </span>
                    <p className="mt-3 text-sm font-bold leading-snug text-[#17283a] line-clamp-2">{n.title}</p>
                    <p className="mt-2 text-xs text-[#7a868f]">{n.publishDate} · {n.department}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Upload Material ── */}
      {activeTab === 'upload' && (
        <div className="animate-fade-in">
          <div className="mb-5 p-4 rounded-xl bg-[#eff4ff] border border-[#bfdbfe] flex items-start gap-3">
            <span className="material-symbols-outlined text-[20px] text-[#2563eb] mt-0.5">info</span>
            <div>
              <p className="text-sm font-bold text-[#1d4ed8]">Uploading as Teacher</p>
              <p className="text-xs text-[#2563eb]/80 mt-0.5">
                Your uploads will be indexed into the AI knowledge base and available to students in your department.
                {user.department && ` Department pre-filled: ${user.department}.`}
              </p>
            </div>
          </div>
          <UploadDocument
            onDocumentAdded={onDocumentAdded}
            onDocumentDeleted={onDocumentDeleted}
            onNavigateTab={(tab) => {
              if (tab === 'dashboard') setActiveTab('overview');
              else onNavigate(tab);
            }}
          />
        </div>
      )}

      {/* ── Tab: Post Notice ── */}
      {activeTab === 'post-notice' && (
        <div className="animate-fade-in">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#2563eb] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px] text-white">campaign</span>
                </div>
                <div>
                  <h2 className="font-headline font-extrabold text-lg text-[#0b1c30]">Post a Notice</h2>
                  <p className="text-xs text-[#7a868f]">Notify students in your department instantly</p>
                </div>
              </div>
              <PostNoticeForm user={user} onNoticeAdded={onNoticeAdded} />
            </div>
            {/* Tips */}
            <div className="card p-5 h-fit">
              <h3 className="font-headline font-bold text-sm text-[#0b1c30] mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#fea619]">tips_and_updates</span>
                Tips for good notices
              </h3>
              <ul className="space-y-3">
                {[
                  { icon: 'title',       text: 'Keep the title short and action-oriented' },
                  { icon: 'schedule',    text: 'Include specific dates and deadlines' },
                  { icon: 'priority_high', text: 'Use "Urgent" only for time-critical matters' },
                  { icon: 'short_text', text: 'Write content clearly in simple language' },
                  { icon: 'apartment',  text: 'Specify room/venue details when relevant' },
                ].map((tip) => (
                  <li key={tip.icon} className="flex items-start gap-2 text-xs text-[#5a6672]">
                    <span className="material-symbols-outlined text-[14px] text-[#2563eb] mt-0.5 shrink-0">{tip.icon}</span>
                    {tip.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: My Materials ── */}
      {activeTab === 'my-materials' && (
        <div className="animate-fade-in card overflow-hidden">
          <div className="p-5 border-b border-[#e5ece8] flex items-center justify-between">
            <div>
              <h2 className="font-headline font-extrabold text-lg text-[#0b1c30]">My Materials</h2>
              <p className="text-xs text-[#7a868f] mt-0.5">
                {myDocuments.length} document{myDocuments.length !== 1 ? 's' : ''} in the knowledge base
              </p>
            </div>
            <button
              onClick={() => setActiveTab('upload')}
              className="btn btn-primary text-xs"
              style={{ background: '#2563eb' }}
            >
              <span className="material-symbols-outlined text-[15px]">add</span>
              Upload New
            </button>
          </div>
          <MyMaterialsList documents={myDocuments} onNavigate={() => setActiveTab('upload')} />
        </div>
      )}

    </section>
  );
};
