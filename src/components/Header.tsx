import React, { useState, useRef, useEffect } from 'react';
import { AuthUser } from '../types';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  user: AuthUser;
  onOpenSearch: () => void;
  onLogout: () => void;
  unreadCount?: number;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',   icon: 'space_dashboard' },
  { id: 'assistant', label: 'AI Assistant', icon: 'smart_toy'       },
  { id: 'notices',   label: 'Notices',      icon: 'campaign'        },
  { id: 'upload',    label: 'Upload',       icon: 'upload_file'     },
];

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  user,
  onOpenSearch,
  onLogout,
  unreadCount = 0,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu,   setShowProfileMenu]   = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="fixed top-0 w-full z-50 glass-header border-b border-[#bfc9c3]/25"
      style={{ boxShadow: 'var(--header-shadow)' }}>
      <div className="h-[64px] w-full max-w-[1200px] px-4 md:px-6 flex items-center justify-between mx-auto gap-4">

        {/* ── Brand ── */}
        <button
          onClick={() => setCurrentTab('dashboard')}
          id="header-brand-logo"
          className="flex items-center gap-2.5 shrink-0 group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#003527] flex items-center justify-center shadow-sm
                          group-hover:scale-105 transition-transform duration-200">
            <span className="material-symbols-outlined text-[20px] text-[#80bea6]">school</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-headline font-extrabold text-[1.1rem] text-[#003527] tracking-tight
                             flex items-center gap-1.5">
              CampusIQ
              <span className="hidden sm:inline-flex badge badge-primary text-[9px] tracking-widest ml-0.5">
                RAG AI
              </span>
            </span>
            <span className="hidden md:block text-[10px] text-[#9ca8a3] font-medium mt-0.5">
              Scholarly Intelligence Platform
            </span>
          </div>
        </button>

        {/* ── Navigation ── */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
          {NAV_ITEMS.filter(item => item.id !== 'upload' || user.role === 'admin' || user.role === 'teacher').map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => setCurrentTab(item.id)}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl
                            text-[0.8125rem] font-semibold transition-all duration-200 group
                            ${isActive
                              ? 'text-[#003527] bg-[#003527]/8'
                              : 'text-[#5a6672] hover:text-[#003527] hover:bg-[#003527]/5'
                            }`}
              >
                <span className={`material-symbols-outlined text-[17px] transition-colors
                                  ${isActive ? 'text-[#003527]' : 'text-[#9ca8a3] group-hover:text-[#003527]'}`}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {isActive && <span className="nav-indicator" />}
              </button>
            );
          })}
        </nav>

        {/* ── Right Controls ── */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Search Pill */}
          <button
            id="global-search-btn"
            onClick={onOpenSearch}
            className="hidden lg:flex items-center gap-2.5 bg-white hover:bg-[#f4f7ff]
                       px-3.5 py-2 rounded-xl border border-[#bfc9c3]/40 text-[#5a6672]
                       text-xs font-medium transition-all shadow-sm group"
          >
            <span className="material-symbols-outlined text-[16px] text-[#003527]
                             group-hover:scale-110 transition-transform">
              search
            </span>
            <span>Search…</span>
            <kbd className="ml-1 text-[9px] opacity-50 bg-[#e5eeff] px-1.5 py-0.5 rounded font-mono">
              Ctrl K
            </kbd>
          </button>

          {/* Mobile search icon */}
          <button
            onClick={onOpenSearch}
            className="lg:hidden p-2 rounded-xl text-[#5a6672] hover:bg-[#eff4ff] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">search</span>
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              id="notifications-bell-btn"
              onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false); }}
              className="relative p-2 rounded-xl text-[#5a6672] hover:text-[#003527]
                         hover:bg-[#eff4ff] transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full
                                 ring-2 ring-white animate-pulse" />
              )}
            </button>

            {showNotifications && (
              <div
                id="notifications-popover"
                className="absolute right-0 mt-2 w-[22rem] bg-white rounded-2xl
                           shadow-2xl border border-[#bfc9c3]/20 p-4 z-50 animate-fade-slide-up"
                style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.1)' }}
              >
                <div className="flex items-center justify-between pb-3 border-b border-[#f0f4ff]">
                  <h4 className="font-headline font-bold text-sm text-[#0b1c30] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#fea619]">campaign</span>
                    Active Alerts
                  </h4>
                  {unreadCount > 0 && (
                    <span className="badge badge-primary">{unreadCount} New</span>
                  )}
                </div>

                <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
                  {[
                    { label: 'Urgent · Exam Notice', color: 'text-red-600', bg: 'bg-red-50', time: 'Just now',
                      title: 'Revised Mid-Semester Examination Schedule for Fall 2024' },
                    { label: 'Scholarship Grant',    color: 'text-[#855300]', bg: 'bg-[#fafbff]', time: 'Yesterday',
                      title: 'Global Excellence $5,000 Undergraduate Scholarship open' },
                  ].map((n, i) => (
                    <div
                      key={i}
                      onClick={() => { setCurrentTab('notices'); setShowNotifications(false); }}
                      className={`p-3 rounded-xl ${n.bg} hover:bg-[#eff4ff] cursor-pointer transition-colors`}
                    >
                      <div className={`flex items-center justify-between text-[11px] font-bold ${n.color} mb-1`}>
                        <span>{n.label}</span>
                        <span className="text-[10px] text-[#9ca8a3] font-medium">{n.time}</span>
                      </div>
                      <p className="text-xs font-semibold text-[#0b1c30] leading-snug">{n.title}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => { setCurrentTab('notices'); setShowNotifications(false); }}
                  className="w-full mt-3 py-2.5 text-xs font-bold text-[#003527]
                             hover:bg-[#eff4ff] rounded-xl transition-colors"
                >
                  View All Notices →
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-[#bfc9c3]/40 mx-1" />

          {/* Profile Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              id="user-profile-btn"
              onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false); }}
              className="flex items-center gap-2.5 group"
            >
              <div className="text-right hidden sm:block">
                <p className="text-[0.8125rem] font-bold text-[#0b1c30] leading-tight">{user.name}</p>
                <p className="text-[10px] text-[#9ca8a3] font-medium mt-0.5">
                  {user.role === 'admin'
                    ? 'Administrator'
                    : user.role === 'teacher'
                    ? `${user.subject ?? 'Teacher'} · ${user.department ?? ''}`
                    : `${user.year ?? ''} · ${user.semester ?? ''}`}
                </p>
              </div>
              <div className="relative">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border-2 border-[#b0f0d6] object-cover
                             group-hover:ring-2 group-hover:ring-[#003527]/30 transition-all"
                />
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full
                                  ring-2 ring-white
                                  ${user.role === 'admin' ? 'bg-[#fea619]' : user.role === 'teacher' ? 'bg-[#2563eb]' : 'bg-[#003527]'}`} />
              </div>
              <span className="material-symbols-outlined text-[16px] text-[#9ca8a3]
                               group-hover:text-[#003527] transition-colors">
                expand_more
              </span>
            </button>

            {showProfileMenu && (
              <div
                className="absolute right-0 mt-2 w-52 bg-white rounded-2xl
                           shadow-2xl border border-[#bfc9c3]/20 py-2 z-50 animate-fade-slide-up"
                style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.1)' }}
              >
                {/* User info row */}
                <div className="px-4 pb-2.5 mb-1 border-b border-[#f0f4ff]">
                  <p className="text-xs font-bold text-[#0b1c30] truncate">{user.name}</p>
                  <p className="text-[10px] text-[#9ca8a3] truncate">{user.email}</p>
                  <span className={`badge text-[9px] mt-1.5
                                    ${user.role === 'admin' ? 'badge-secondary' : user.role === 'teacher' ? 'bg-[#dbeafe] text-[#1d4ed8]' : 'badge-primary'}`}>
                    {user.role === 'admin' ? 'Administrator' : user.role === 'teacher' ? 'Teacher' : 'Student'}
                  </span>
                </div>

                <button
                  onClick={() => { setCurrentTab('profile'); setShowProfileMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#0b1c30]
                             hover:bg-[#f4f7ff] transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#003527]">
                    person
                  </span>
                  View Profile
                </button>

                <button
                  onClick={() => { setCurrentTab('dashboard'); setShowProfileMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#0b1c30]
                             hover:bg-[#f4f7ff] transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#5a6672]">
                    settings
                  </span>
                  Settings
                </button>

                <div className="border-t border-[#f0f4ff] mt-1 pt-1">
                  <button
                    onClick={() => { onLogout(); setShowProfileMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500
                               hover:bg-red-50 transition-colors text-left font-semibold"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
