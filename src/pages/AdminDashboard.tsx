import React from 'react';
import { AuthUser, CollegeDocument, Notice } from '../types';

interface AdminDashboardProps {
  user: AuthUser;
  documents: CollegeDocument[];
  notices: Notice[];
  onNavigate: (tab: string) => void;
}

const MetricCard: React.FC<{ icon: string; label: string; value: string; detail: string; tone: 'green' | 'amber' | 'blue' }> = ({ icon, label, value, detail, tone }) => {
  const tones = {
    green: 'bg-[#003527] text-[#80bea6]',
    amber: 'bg-[#fff4df] text-[#a76700]',
    blue: 'bg-[#e7f0ff] text-[#285b9f]',
  };

  return (
    <div className="card p-5 relative overflow-hidden">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tones[tone]}`}>
        <span className="material-symbols-outlined text-[21px]">{icon}</span>
      </div>
      <p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-[#7a868f]">{label}</p>
      <p className="mt-1 text-3xl font-headline font-extrabold text-[#0b1c30]">{value}</p>
      <p className="mt-2 text-xs text-[#66737d]">{detail}</p>
    </div>
  );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, documents, notices, onNavigate }) => {
  const pendingDocuments = documents.filter((document) => document.status !== 'indexed').length;
  const urgentNotices = notices.filter((notice) => notice.urgency === 'urgent' || notice.urgency === 'high').length;
  const recentDocuments = documents.slice(0, 4);
  const recentNotices = notices.slice(0, 4);

  return (
    <section className="max-w-[1200px] mx-auto px-4 md:px-6 pt-24 pb-12 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-7">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#fea619]/15 px-3 py-1.5 text-[11px] font-bold tracking-wide uppercase text-[#855300]">
            <span className="material-symbols-outlined text-[15px]">admin_panel_settings</span>
            Administrator workspace
          </div>
          <h1 className="mt-3 font-headline text-3xl md:text-4xl font-extrabold text-[#0b1c30]">Good morning, {user.name.split(' ')[0]}.</h1>
          <p className="mt-2 text-sm text-[#66737d]">Manage campus information, publish notices, and keep the knowledge base current.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => onNavigate('notices')} className="btn btn-secondary">
            <span className="material-symbols-outlined text-[17px]">campaign</span>
            Review notices
          </button>
          <button onClick={() => onNavigate('upload')} className="btn btn-primary">
            <span className="material-symbols-outlined text-[17px]">upload_file</span>
            Upload document
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <MetricCard icon="description" label="Knowledge documents" value={String(documents.length).padStart(2, '0')} detail="Available in the assistant" tone="green" />
        <MetricCard icon="campaign" label="Published notices" value={String(notices.length).padStart(2, '0')} detail={`${urgentNotices} need attention`} tone="amber" />
        <MetricCard icon="pending_actions" label="Review queue" value={String(pendingDocuments).padStart(2, '0')} detail="Documents pending processing" tone="blue" />
        <MetricCard icon="school" label="Active audience" value="1,248" detail="Students across departments" tone="green" />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="card lg:col-span-3 overflow-hidden">
          <div className="p-5 border-b border-[#e5ece8] flex items-center justify-between gap-3">
            <div>
              <h2 className="font-headline font-extrabold text-lg text-[#0b1c30]">Recent documents</h2>
              <p className="text-xs text-[#7a868f] mt-0.5">Latest entries in the campus knowledge base</p>
            </div>
            <button onClick={() => onNavigate('upload')} className="text-xs font-bold text-[#003527] hover:underline">Manage library</button>
          </div>
          <div className="divide-y divide-[#edf1ef]">
            {recentDocuments.map((document) => (
              <div key={document.id} className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#eff7f3] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#003527]">description</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#17283a] truncate">{document.title}</p>
                  <p className="text-xs text-[#7a868f] mt-0.5">{document.department} · {document.publishedDate}</p>
                </div>
                <span className={`badge text-[9px] ${document.status === 'indexed' ? 'badge-primary' : 'badge-secondary'}`}>
                  {document.status === 'indexed' ? 'Indexed' : 'Review'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card lg:col-span-2 p-5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#fff4df] text-[#a76700] flex items-center justify-center">
              <span className="material-symbols-outlined text-[19px]">bolt</span>
            </div>
            <div>
              <h2 className="font-headline font-extrabold text-lg text-[#0b1c30]">Quick actions</h2>
              <p className="text-xs text-[#7a868f]">Common administrator tasks</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            <button onClick={() => onNavigate('upload')} className="flex items-center gap-3 rounded-xl border border-[#d9e4dd] p-3.5 text-left hover:bg-[#f6faf8] transition-colors">
              <span className="material-symbols-outlined text-[#003527]">upload_file</span>
              <span><span className="block text-sm font-bold text-[#17283a]">Upload a document</span><span className="block text-xs text-[#7a868f] mt-0.5">Add it to AI search</span></span>
            </button>
            <button onClick={() => onNavigate('notices')} className="flex items-center gap-3 rounded-xl border border-[#d9e4dd] p-3.5 text-left hover:bg-[#f6faf8] transition-colors">
              <span className="material-symbols-outlined text-[#003527]">visibility</span>
              <span><span className="block text-sm font-bold text-[#17283a]">Check student notices</span><span className="block text-xs text-[#7a868f] mt-0.5">Review what students see</span></span>
            </button>
            <button onClick={() => onNavigate('assistant')} className="flex items-center gap-3 rounded-xl border border-[#d9e4dd] p-3.5 text-left hover:bg-[#f6faf8] transition-colors">
              <span className="material-symbols-outlined text-[#003527]">smart_toy</span>
              <span><span className="block text-sm font-bold text-[#17283a]">Test the AI assistant</span><span className="block text-xs text-[#7a868f] mt-0.5">Verify document answers</span></span>
            </button>
          </div>
        </div>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="p-5 border-b border-[#e5ece8]">
          <h2 className="font-headline font-extrabold text-lg text-[#0b1c30]">Notice board overview</h2>
          <p className="text-xs text-[#7a868f] mt-0.5">The most recent announcements visible to students</p>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#edf1ef]">
          {recentNotices.map((notice) => (
            <div key={notice.id} className="p-5">
              <span className={`badge text-[9px] ${notice.urgency === 'urgent' || notice.urgency === 'high' ? 'badge-secondary' : 'badge-primary'}`}>{notice.category}</span>
              <p className="mt-3 text-sm font-bold leading-snug text-[#17283a] line-clamp-2">{notice.title}</p>
              <p className="mt-2 text-xs text-[#7a868f]">{notice.publishDate} · {notice.department}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
