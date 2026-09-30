import React, { useEffect, useRef } from 'react';

interface LandingPageProps {
  onGetStarted: (mode?: 'login' | 'signup') => void;
}

/* ── tiny reusable pieces ─────────────────────────────── */
const Badge: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px]
                    font-bold tracking-wide border ${className}`}>
    {children}
  </span>
);

/* ── floating hero mockup cards ──────────────────────────
   These simulate the real app UI as a visual preview       */
const HeroMockup: React.FC = () => (
  <div className="relative w-full h-full min-h-[480px] select-none pointer-events-none">

    {/* Main dashboard card */}
    <div className="absolute top-0 right-0 w-[340px] bg-white rounded-2xl shadow-2xl border
                    border-[#e0e9e4] overflow-hidden"
         style={{ boxShadow: '0 24px 80px rgba(0,53,39,0.15)' }}>

      {/* Mini header bar */}
      <div className="bg-[#003527] px-4 py-3 flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-[14px] text-[#80bea6]">school</span>
        </div>
        <span className="text-white text-xs font-bold">CampusIQ Dashboard</span>
        <div className="ml-auto flex gap-1">
          <div className="w-2 h-2 rounded-full bg-[#80bea6]" />
          <div className="w-2 h-2 rounded-full bg-[#fea619]" />
          <div className="w-2 h-2 rounded-full bg-white/30" />
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Greeting row */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#003527] to-[#064e3b]
                          flex items-center justify-center text-[#80bea6] text-[11px] font-bold">
            SR
          </div>
          <div>
            <p className="text-[11px] font-bold text-[#0b1c30]">Good morning, Sumukh 👋</p>
            <p className="text-[9px] text-[#9ca8a3]">4th Year · CSE · Semester 7</p>
          </div>
        </div>

        {/* Stat mini-cards row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Attendance', value: '87%', color: 'text-[#003527]', bg: 'bg-[#e8f5ef]' },
            { label: 'CGPA',       value: '8.4',  color: 'text-[#855300]', bg: 'bg-[#fff4e0]' },
            { label: 'Notices',    value: '3 New', color: 'text-[#1a4fcf]', bg: 'bg-[#eff4ff]' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-2.5 text-center`}>
              <p className={`text-sm font-extrabold ${s.color}`}>{s.value}</p>
              <p className="text-[9px] text-[#9ca8a3] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Next class */}
        <div className="bg-[#003527] rounded-xl p-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[16px] text-[#80bea6]">class</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[10px] font-bold truncate">Machine Learning · CS-401</p>
            <p className="text-[#80bea6] text-[9px]">10:30 AM · Lab 204 · Dr. Reddy</p>
          </div>
          <span className="bg-[#fea619] text-[#684000] text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
            Soon
          </span>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-[9px] text-[#9ca8a3] mb-1">
            <span>Semester Progress</span><span>68%</span>
          </div>
          <div className="w-full h-1.5 bg-[#f0f4ff] rounded-full">
            <div className="w-[68%] h-full bg-gradient-to-r from-[#003527] to-[#0cc8b3] rounded-full" />
          </div>
        </div>
      </div>
    </div>

    {/* AI Chat card — floats bottom-left */}
    <div className="absolute bottom-8 left-0 w-[220px] bg-white rounded-2xl shadow-xl
                    border border-[#e0e9e4] p-3"
         style={{ boxShadow: '0 12px 40px rgba(0,53,39,0.12)', animation: 'float 6s ease-in-out infinite' }}>
      <div className="flex items-center gap-1.5 mb-2.5">
        <div className="w-5 h-5 rounded-lg bg-[#003527] flex items-center justify-center">
          <span className="material-symbols-outlined text-[11px] text-[#80bea6]">smart_toy</span>
        </div>
        <span className="text-[10px] font-bold text-[#003527]">AI Assistant</span>
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#003527] animate-pulse" />
      </div>
      <div className="bg-[#f4f7ff] rounded-xl rounded-tl-sm p-2.5 mb-2">
        <p className="text-[10px] text-[#0b1c30] leading-relaxed">
          What's the min. attendance required for CS-401?
        </p>
      </div>
      <div className="bg-[#003527] rounded-xl rounded-bl-sm p-2.5">
        <p className="text-[10px] text-[#d0f0e4] leading-relaxed">
          75% attendance is mandatory. You currently have <span className="text-white font-bold">87%</span> — you're good! ✓
        </p>
      </div>
    </div>

    {/* Notice badge — floats top-left */}
    <div className="absolute top-12 left-4 bg-white rounded-2xl shadow-lg border border-red-100 p-3 w-[180px]"
         style={{ animation: 'float 7s ease-in-out infinite 1s' }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="material-symbols-outlined text-[14px] text-red-500">campaign</span>
        <span className="text-[9px] font-bold text-red-600 uppercase tracking-wide">Urgent Notice</span>
      </div>
      <p className="text-[10px] font-semibold text-[#0b1c30] leading-snug">
        Exam rescheduled to Nov 12 — check your timetable
      </p>
      <p className="text-[9px] text-[#9ca8a3] mt-1">Exam Cell · 2 min ago</p>
    </div>

    {/* Grounded badge */}
    <div className="absolute top-[240px] left-8 bg-[#b0f0d6] rounded-full px-3 py-1.5
                    flex items-center gap-1.5 shadow-md"
         style={{ animation: 'float 8s ease-in-out infinite 0.5s' }}>
      <span className="material-symbols-outlined text-[13px] text-[#003527]">verified</span>
      <span className="text-[10px] font-bold text-[#003527]">94.7% Answer Accuracy</span>
    </div>
  </div>
);

/* ── Feature card ─────────────────────────────────────── */
const FeatureCard: React.FC<{
  icon: string; title: string; desc: string;
  accent: string; iconBg: string; iconText: string;
  tag?: string;
}> = ({ icon, title, desc, accent, iconBg, iconText, tag }) => (
  <div className={`relative bg-white rounded-2xl p-6 border border-[#e8eef0]
                   hover:shadow-xl hover:-translate-y-1 transition-all duration-300
                   overflow-hidden group`}>
    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity
                     bg-gradient-to-br ${accent}`} />
    <div className="relative z-10">
      <div className={`w-11 h-11 rounded-xl ${iconBg} ${iconText} flex items-center justify-center mb-4`}>
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </div>
      <div className="flex items-center gap-2 mb-1.5">
        <h3 className="font-headline font-bold text-base text-[#0b1c30]">{title}</h3>
        {tag && (
          <span className="text-[9px] font-bold bg-[#003527] text-white px-1.5 py-0.5 rounded-md uppercase">
            {tag}
          </span>
        )}
      </div>
      <p className="text-sm text-[#5a6672] leading-relaxed">{desc}</p>
    </div>
  </div>
);

/* ── Main component ──────────────────────────────────── */
export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-white text-[#0b1c30] overflow-x-hidden font-inter">

      {/* ── Grid background overlay (hero section only) ── */}
      <div className="pointer-events-none fixed inset-0 -z-10"
           style={{
             backgroundImage: `
               linear-gradient(rgba(0,53,39,0.03) 1px, transparent 1px),
               linear-gradient(90deg, rgba(0,53,39,0.03) 1px, transparent 1px)`,
             backgroundSize: '48px 48px',
           }} />

      {/* Gradient top-right blob */}
      <div className="pointer-events-none fixed -z-10 top-0 right-0 w-[700px] h-[700px] rounded-full
                      bg-gradient-radial from-[#b0f0d6]/20 to-transparent blur-[100px]" />
      <div className="pointer-events-none fixed -z-10 bottom-0 left-0 w-[500px] h-[500px] rounded-full
                      bg-gradient-radial from-[#fea619]/6 to-transparent blur-[80px]" />

      {/* ══ NAVBAR ══════════════════════════════════════════ */}
      <nav className="w-full border-b border-[#e8eef0] bg-white/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 h-[62px] flex items-center justify-between">

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#003527] flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[18px] text-[#80bea6]">school</span>
            </div>
            <span className="font-headline font-extrabold text-[1.05rem] text-[#003527]">CampusIQ</span>
            <Badge className="bg-[#e8f5ef] text-[#003527] border-[#b0f0d6] hidden sm:inline-flex">
              <span className="w-1.5 h-1.5 rounded-full bg-[#003527] animate-pulse" />
              RAG AI
            </Badge>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-[#5a6672]">
            {[
              { label: 'Features', id: '#features' },
              { label: 'How It Works', id: '#how-it-works' },
              { label: 'For Students', id: '#for-students' },
              { label: 'For Admins', id: '#for-admins' }
            ].map(l => (
              <a key={l.label} href={l.id} className="hover:text-[#003527] cursor-pointer transition-colors">
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onGetStarted('login')}
              className="text-sm font-semibold text-[#003527] hover:text-[#064e3b] transition-colors
                         px-4 py-2 rounded-xl hover:bg-[#f0f9f6]"
            >
              Sign In
            </button>
            <button
              onClick={() => onGetStarted('signup')}
              className="bg-[#003527] hover:bg-[#064e3b] text-white text-sm font-bold
                         px-5 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
              Get Started Free
            </button>
          </div>
        </div>
      </nav>

      {/* ══ HERO ═════════════════════════════════════════════ */}
      <section className="max-w-[1200px] mx-auto px-4 md:px-6 pt-20 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[520px]">

          {/* Left — copy */}
          <div className="flex flex-col gap-7">
            <div>
              <Badge className="bg-[#e8f5ef] text-[#003527] border-[#b0f0d6] mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#003527] animate-pulse" />
                Grounded RAG Intelligence · Now Live
              </Badge>

              <h1 className="font-headline text-[2.75rem] md:text-[3.5rem] font-extrabold
                             text-[#0b1c30] leading-[1.08] tracking-tight mb-5">
                Your College<br />
                Knowledge,{' '}
                <span style={{
                  background: 'linear-gradient(135deg, #003527 0%, #0cc8b3 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  Intelligently<br />Connected.
                </span>
              </h1>

              <p className="text-[#5a6672] text-lg leading-relaxed max-w-lg">
                The AI-powered campus assistant that answers questions, tracks notices,
                and keeps you on top of every deadline — verified from official college documents.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start gap-3">
              <button
                onClick={() => onGetStarted('signup')}
                className="bg-[#003527] hover:bg-[#064e3b] text-white font-bold text-sm
                           px-7 py-4 rounded-2xl shadow-lg transition-all flex items-center gap-2.5
                           hover:shadow-[0_8px_30px_rgba(0,53,39,0.3)]"
              >
                <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                Create Free Account
              </button>
              <button
                onClick={() => onGetStarted('login')}
                className="bg-white hover:bg-[#f4f7ff] text-[#003527] font-bold text-sm
                           px-7 py-4 rounded-2xl border-2 border-[#003527]/15 hover:border-[#003527]/30
                           transition-all flex items-center gap-2.5"
              >
                <span className="material-symbols-outlined text-[20px]">login</span>
                Sign In
              </button>
            </div>

            {/* Social proof avatars */}
            <div className="flex items-center gap-3 pt-2">
              <div className="flex -space-x-2">
                {['SR','PK','AM','RN','VT'].map((initials, i) => (
                  <div key={i}
                       className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center
                                  text-[9px] font-bold text-white shadow-sm"
                       style={{ background: ['#003527','#064e3b','#854d0e','#1d4ed8','#7c3aed'][i] }}>
                    {initials}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  {[0,1,2,3,4].map(i => (
                    <span key={i} className="material-symbols-outlined text-[13px] text-[#fea619]"
                          style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  ))}
                </div>
                <p className="text-xs text-[#5a6672] mt-0.5">
                  Trusted by <span className="font-bold text-[#003527]">5,000+</span> students
                </p>
              </div>
            </div>
          </div>

          {/* Right — floating mockup */}
          <div className="hidden lg:block relative h-[480px]">
            <HeroMockup />
          </div>
        </div>
      </section>

      {/* ══ STATS BAR ════════════════════════════════════════ */}
      <section className="border-y border-[#e8eef0] bg-[#f8fafe] py-10">
        <div className="max-w-[1200px] mx-auto px-4 md:px-6
                        grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '12,482', label: 'Documents Indexed',  icon: 'dataset'        },
            { value: '94.7%',  label: 'Answer Accuracy',    icon: 'verified'       },
            { value: '5,000+', label: 'Active Students',    icon: 'groups'         },
            { value: '< 2s',   label: 'Avg. Response Time', icon: 'bolt'           },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-[#003527]/8 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] text-[#003527]">{s.icon}</span>
              </div>
              <p className="font-headline text-3xl font-extrabold text-[#003527]">{s.value}</p>
              <p className="text-sm text-[#5a6672] font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FEATURES ═════════════════════════════════════════ */}
      <section id="features" className="max-w-[1200px] mx-auto px-4 md:px-6 py-24">
        <div className="text-center mb-14">
          <Badge className="bg-[#e8f5ef] text-[#003527] border-[#b0f0d6] mb-4">
            Built for campus life
          </Badge>
          <h2 className="font-headline text-3xl md:text-4xl font-extrabold text-[#0b1c30] mb-3">
            Everything in one intelligent platform
          </h2>
          <p className="text-[#5a6672] text-base max-w-xl mx-auto">
            Designed for students who want clarity, and administrators who want control.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <FeatureCard
            icon="smart_toy" title="AI Assistant" tag="RAG"
            desc="Ask anything about exams, syllabus, or policies. Get instant, cited answers from official documents."
            accent="from-[#e8f5ef]/60 to-transparent" iconBg="bg-[#003527]" iconText="text-[#80bea6]" />
          <FeatureCard
            icon="campaign" title="Live Notices"
            desc="Never miss a deadline. All exam alerts, scholarship drives, and campus events in one live feed."
            accent="from-[#fff8e8]/60 to-transparent" iconBg="bg-[#fea619]" iconText="text-[#684000]" />
          <FeatureCard
            icon="calendar_today" title="Smart Timeline"
            desc="Visual academic calendar tailored to your semester — assignments, exams, and milestones."
            accent="from-[#e8f4ff]/60 to-transparent" iconBg="bg-[#1d4ed8]" iconText="text-white" />
          <FeatureCard
            icon="upload_file" title="Document Hub"
            desc="All official syllabi, handbooks, and regulations — always searchable, always up to date."
            accent="from-[#f3eeff]/60 to-transparent" iconBg="bg-[#7c3aed]" iconText="text-white" />
        </div>
      </section>

      {/* ══ HOW IT WORKS ══════════════════════════════════════ */}
      <section id="how-it-works" className="bg-[#f8fafe] border-y border-[#e8eef0] py-24">
        <div className="max-w-[1200px] mx-auto px-4 md:px-6">
          <div className="text-center mb-14">
            <Badge className="bg-[#e8f5ef] text-[#003527] border-[#b0f0d6] mb-4">
              Simple onboarding
            </Badge>
            <h2 className="font-headline text-3xl md:text-4xl font-extrabold text-[#0b1c30] mb-3">
              Get started in 3 steps
            </h2>
            <p className="text-[#5a6672] text-base">No training needed. Just sign up and start asking.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* connector line */}
            <div className="hidden md:block absolute top-[52px] left-[16.66%] right-[16.66%]
                            h-px bg-gradient-to-r from-transparent via-[#b0f0d6] to-transparent" />

            {[
              { step: '1', icon: 'person_add', title: 'Create your account',
                desc: 'Sign up as a student or admin with your university email. Takes under a minute.' },
              { step: '2', icon: 'dashboard', title: 'See your dashboard',
                desc: 'Instantly view attendance, CGPA, upcoming classes, and the latest college notices.' },
              { step: '3', icon: 'smart_toy', title: 'Ask your AI assistant',
                desc: 'Type any question — exam rules, scholarship deadlines — and get instant, sourced answers.' },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center text-center gap-4">
                <div className="relative z-10">
                  <div className="w-[104px] h-[104px] rounded-3xl bg-white border-2 border-[#e0f0e8]
                                  shadow-lg flex items-center justify-center group hover:border-[#003527]
                                  hover:shadow-xl transition-all">
                    <span className="material-symbols-outlined text-[40px] text-[#003527]">{item.icon}</span>
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#003527]
                                   text-white text-xs font-extrabold flex items-center justify-center shadow-md">
                    {item.step}
                  </span>
                </div>
                <div>
                  <h3 className="font-headline font-bold text-base text-[#0b1c30] mb-1.5">{item.title}</h3>
                  <p className="text-sm text-[#5a6672] leading-relaxed max-w-xs mx-auto">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIALS ══════════════════════════════════════ */}
      <section id="for-students" className="max-w-[1200px] mx-auto px-4 md:px-6 py-24">
        <div className="text-center mb-14">
          <Badge className="bg-[#e8f5ef] text-[#003527] border-[#b0f0d6] mb-4">
            Student voices
          </Badge>
          <h2 className="font-headline text-3xl md:text-4xl font-extrabold text-[#0b1c30]">
            Loved by students across campus
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { name: 'Priya Nair',    dept: '3rd Year · Electronics',    initial: 'PN', color: '#003527',
              text: 'CampusIQ told me about the exam reschedule before any WhatsApp group. The AI answered my attendance question in seconds with an actual citation from the handbook.' },
            { name: 'Arjun Mehta',  dept: '2nd Year · Mech Engineering', initial: 'AM', color: '#1d4ed8',
              text: 'The scholarship notice feature alone is worth it. I applied for a ₹50,000 grant I would have completely missed. The notice showed up right on my dashboard.' },
            { name: 'Sneha Rao',    dept: '4th Year · CS Engineering',   initial: 'SR', color: '#7c3aed',
              text: 'I use the AI assistant daily. It explained our semester grade calculation better than any advisor ever did — and it showed me exactly which regulation it was quoting.' },
          ].map((t) => (
            <div key={t.name}
                 className="bg-white rounded-2xl p-6 border border-[#e8eef0] shadow-sm hover:shadow-lg transition-all">
              <div className="flex gap-0.5 mb-4">
                {[0,1,2,3,4].map(i => (
                  <span key={i} className="material-symbols-outlined text-[16px] text-[#fea619]"
                        style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                ))}
              </div>
              <p className="text-sm text-[#404944] leading-relaxed italic mb-5">"{t.text}"</p>
              <div className="flex items-center gap-3 pt-4 border-t border-[#f0f4f8]">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white
                                text-xs font-bold shadow-sm shrink-0"
                     style={{ background: t.color }}>
                  {t.initial}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0b1c30]">{t.name}</p>
                  <p className="text-[11px] text-[#9ca8a3]">{t.dept}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ CTA BANNER ════════════════════════════════════════ */}
      <section id="for-admins" className="max-w-[1200px] mx-auto px-4 md:px-6 pb-24">
        <div className="relative bg-[#003527] rounded-3xl px-8 md:px-16 py-16 overflow-hidden"
             style={{ boxShadow: '0 24px 80px rgba(0,53,39,0.25)' }}>

          {/* Pattern */}
          <div className="absolute inset-0 pointer-events-none"
               style={{
                 backgroundImage: `url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1.5' fill='%23ffffff' fill-opacity='0.07'/%3E%3C/svg%3E")`,
               }} />

          {/* Decorative rings */}
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full border border-white/10" />
          <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full border border-[#fea619]/20" />
          <div className="absolute top-1/2 right-16 -translate-y-1/2 w-32 h-32 rounded-full
                          bg-gradient-radial from-[#fea619]/20 to-transparent blur-[30px]" />

          <div className="relative z-10 text-center">
            <Badge className="bg-white/10 text-white border-white/20 mb-6">
              🎓 Free for all enrolled students
            </Badge>
            <h2 className="font-headline text-3xl md:text-5xl font-extrabold text-white
                           mb-4 leading-tight">
              Ready to get smarter<br />about your campus?
            </h2>
            <p className="text-[#80bea6] text-base md:text-lg mb-8 max-w-lg mx-auto leading-relaxed">
              Join thousands of students using CampusIQ every day to stay
              informed, prepared, and one step ahead.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => onGetStarted('signup')}
                className="bg-white text-[#003527] font-bold text-sm px-8 py-4 rounded-2xl
                           hover:bg-[#f0f9f6] transition-all shadow-lg flex items-center gap-2.5
                           hover:shadow-xl"
              >
                <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                Create Free Account
              </button>
              <button
                onClick={() => onGetStarted('login')}
                className="bg-white/10 text-white font-semibold text-sm px-8 py-4 rounded-2xl
                           hover:bg-white/20 border border-white/20 transition-all flex items-center gap-2.5"
              >
                <span className="material-symbols-outlined text-[18px]">login</span>
                Sign In
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════ */}
      <footer className="border-t border-[#e8eef0] bg-white py-8">
        <div className="max-w-[1200px] mx-auto px-4 md:px-6
                        flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-[#003527] flex items-center justify-center">
              <span className="material-symbols-outlined text-[15px] text-[#80bea6]">school</span>
            </div>
            <span className="font-headline font-bold text-sm text-[#003527]">CampusIQ</span>
            <span className="text-[#c0c8c4] text-xs">·</span>
            <span className="text-xs text-[#9ca8a3]">Scholarly Intelligence Platform</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-[#9ca8a3]">
            {['Privacy Policy', 'Terms of Service', 'Contact'].map(l => (
              <span key={l} className="hover:text-[#003527] cursor-pointer transition-colors">{l}</span>
            ))}
          </div>
          <p className="text-xs text-[#9ca8a3]">© 2026 CampusIQ · Made by Fantastic Four</p>
        </div>
      </footer>
    </div>
  );
};
