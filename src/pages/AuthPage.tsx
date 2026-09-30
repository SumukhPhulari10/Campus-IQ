import React, { useState, useEffect, useRef } from 'react';
import { AuthUser } from '../types';

interface AuthPageProps {
  initialMode?: 'login' | 'signup';
  onLogin: (user: AuthUser) => void;
  onBack: () => void;
  emailJustVerified?: boolean;
}

type Mode =
  | 'login'
  | 'signup'
  | 'verify-pending'   // After signup — "check your inbox"
  | 'forgot-password'  // Enter email to get OTP
  | 'otp-verify'       // Enter 6-digit OTP
  | 'reset-password';  // Enter new password

type Role = 'student' | 'teacher' | 'admin';

// ── Decorative right panel ──────────────────────────────────
const panelFeatures = [
  { icon: 'smart_toy',      text: 'AI-powered campus assistant'               },
  { icon: 'campaign',       text: 'Real-time notices & circulars'              },
  { icon: 'verified',       text: 'Grounded, cited answers from official docs' },
  { icon: 'calendar_today', text: 'Personalised academic timeline'             },
  { icon: 'upload_file',    text: 'Searchable document library'                },
];

const DOT_PATTERN = `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1.5' fill='%23ffffff' fill-opacity='0.12'/%3E%3C/svg%3E")`;

const RightPanel: React.FC<{ mode: Mode }> = ({ mode }) => (
  <div className="hidden lg:flex flex-col relative overflow-hidden bg-gradient-to-br
                  from-[#003527] via-[#054237] to-[#002117] rounded-r-3xl">
    <div className="absolute inset-0" style={{ backgroundImage: DOT_PATTERN }} />
    <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full border border-white/10 pointer-events-none" />
    <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full border border-white/8 pointer-events-none" />
    <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full border border-[#fea619]/15 pointer-events-none" />
    <div className="absolute bottom-16 -left-6 w-48 h-48 rounded-full
                    bg-gradient-radial from-[#fea619]/15 to-transparent blur-[60px] pointer-events-none" />
    <div className="absolute top-1/3 right-0 w-40 h-40 rounded-full
                    bg-gradient-radial from-[#3cddc7]/10 to-transparent blur-[50px] pointer-events-none" />

    <div className="relative z-10 flex flex-col justify-between h-full p-10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
          <span className="material-symbols-outlined text-[22px] text-[#80bea6]">school</span>
        </div>
        <div>
          <p className="font-headline font-extrabold text-white text-lg leading-tight">CampusIQ</p>
          <p className="text-[10px] text-[#80bea6] tracking-wide">Scholarly Intelligence Platform</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <p className="text-[#80bea6] text-xs font-semibold uppercase tracking-widest mb-3">
            {mode === 'signup' ? 'Join thousands of students' : 'Welcome back'}
          </p>
          <h2 className="font-headline text-3xl font-extrabold text-white leading-tight">
            {mode === 'signup'
              ? <><br className="hidden" />Your smarter<br />campus starts here.</>
              : <>Everything you need,<br />right where you left off.</>
            }
          </h2>
        </div>
        <ul className="flex flex-col gap-3.5">
          {panelFeatures.map((f) => (
            <li key={f.icon} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px] text-[#3cddc7]">{f.icon}</span>
              </div>
              <span className="text-sm text-white/80 font-medium">{f.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white/8 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
        <p className="text-sm text-white/90 leading-relaxed italic mb-3">
          "CampusIQ saved me during exam week — I got the reschedule notice before anyone else
          and the AI explained the attendance condonation process in seconds."
        </p>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#fea619]/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-[16px] text-[#fea619]">person</span>
          </div>
          <div>
            <p className="text-xs font-bold text-white">Priya Nair</p>
            <p className="text-[10px] text-[#80bea6]">3rd Year · Electronics & Comm.</p>
          </div>
          <div className="ml-auto flex gap-0.5">
            {[0,1,2,3,4].map(i => (
              <span key={i} className="material-symbols-outlined text-[14px] text-[#fea619]"
                    style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ── Input helper ────────────────────────────────────────────
const Field: React.FC<{
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  accent?: 'green' | 'amber';
  autoFocus?: boolean;
}> = ({ label, type = 'text', value, onChange, placeholder, hint, accent = 'green', autoFocus }) => {
  const [showPwd, setShowPwd] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPwd ? 'text' : 'password') : type;

  return (
    <div>
      <label className="block text-[11px] font-bold text-[#5a6672] uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`w-full py-3 rounded-xl border border-[#bfc9c3]/40 bg-[#f8fafe]
                      text-[#0b1c30] text-sm placeholder:text-[#c8d0cc]
                      focus:outline-none transition-all
                      ${isPassword ? 'pl-4 pr-11' : 'px-4'}
                      ${accent === 'green'
                        ? 'focus:border-[#003527] focus:ring-1 focus:ring-[#003527]/15'
                        : 'focus:border-[#fea619] focus:ring-1 focus:ring-[#fea619]/15'}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca8a3] hover:text-[#003527] transition-colors"
            aria-label={showPwd ? 'Hide password' : 'Show password'}
          >
            <span className="material-symbols-outlined text-[20px]">
              {showPwd ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        )}
      </div>
      {hint && <p className="text-[10px] text-[#9ca8a3] mt-1.5">{hint}</p>}
    </div>
  );
};

const getPasswordStrength = (pass: string) => {
  if (!pass) return { score: 0, label: '', color: 'bg-[#e0e5e2]', textColor: 'text-[#9ca8a3]' };
  let score = 0;
  if (pass.length >= 8) score += 1;
  if (/[A-Z]/.test(pass)) score += 1;
  if (/[0-9]/.test(pass)) score += 1;
  if (/[^A-Za-z0-9]/.test(pass)) score += 1;

  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500', textColor: 'text-red-500' };
  if (score === 2) return { score, label: 'Fair', color: 'bg-amber-500', textColor: 'text-amber-600' };
  if (score === 3) return { score, label: 'Good', color: 'bg-blue-500', textColor: 'text-blue-500' };
  return { score, label: 'Strong', color: 'bg-[#003527]', textColor: 'text-[#003527]' };
};

// ── OTP Input (6 boxes) ─────────────────────────────────────
const OTPInput: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (idx: number, char: string) => {
    const digit = char.replace(/\D/g, '').slice(-1);
    const arr = value.padEnd(6, ' ').split('');
    arr[idx] = digit || ' ';
    const next = arr.join('').trimEnd();
    onChange(next);
    if (digit && idx < 5) refs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !value[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(text);
    refs.current[Math.min(text.length, 5)]?.focus();
    e.preventDefault();
  };

  return (
    <div className="flex gap-2.5 justify-center" onPaste={handlePaste}>
      {[0, 1, 2, 3, 4, 5].map((idx) => (
        <input
          key={idx}
          ref={(el) => { refs.current[idx] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[idx] || ''}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          autoFocus={idx === 0}
          className="w-11 h-13 text-center text-xl font-bold text-[#0b1c30]
                     border-2 border-[#bfc9c3]/50 rounded-xl bg-[#f8fafe]
                     focus:border-[#003527] focus:ring-2 focus:ring-[#003527]/15
                     outline-none transition-all"
          style={{ width: '44px', height: '52px' }}
        />
      ))}
    </div>
  );
};

// ── Countdown timer hook ────────────────────────────────────
function useCountdown(seconds: number, active: boolean) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (!active) return;
    setRemaining(seconds);
    const interval = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) { clearInterval(interval); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [active, seconds]);
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  return { remaining, formatted: `${mm}:${ss}` };
}

// ── Main component ──────────────────────────────────────────
export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = 'login', onLogin, onBack, emailJustVerified }) => {
  const [mode, setModeRaw] = useState<Mode>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get('mode') as Mode;
    return urlMode || initialMode || 'login';
  });

  const setMode = (newMode: Mode) => {
    setModeRaw(newMode);
    window.history.pushState({ mode: newMode, view: 'auth' }, '', `?view=auth&mode=${newMode}`);
  };

  useEffect(() => {
    window.history.replaceState({ mode, view: 'auth' }, '', `?view=auth&mode=${mode}`);
    const onPopState = (e: PopStateEvent) => {
      if (e.state && e.state.mode) {
        setModeRaw(e.state.mode);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const [role, setRole] = useState<Role>('student');
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '',
    department: '', year: '', semester: '', rollNumber: '', section: '',
    adminCode: '', teacherCode: '', subject: '', employeeId: '',
  });

  // Forgot-password / OTP flow state
  const [fpEmail, setFpEmail]           = useState('');
  const [otp, setOtp]                   = useState('');
  const [resetToken, setResetToken]     = useState('');
  const [newPassword, setNewPassword]   = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pendingEmail, setPendingEmail] = useState(''); // email used during signup
  const [pendingPhone, setPendingPhone] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<'email' | 'sms'>('email');

  const [error,   setError]   = useState('');
  // Pre-populate success if user just verified email
  const [success, setSuccess] = useState(emailJustVerified ? '✅ Email verified! You can now sign in below.' : '');
  const [loading, setLoading] = useState(false);

  const { remaining: otpRemaining, formatted: otpTimer } = useCountdown(600, mode === 'otp-verify' || mode === 'verify-pending');

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const clearAlerts = () => { setError(''); setSuccess(''); };

  // ── Handle signup ──────────────────────────────────────────
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();

    // Name: must not be empty, must start with a letter, min 2 chars, only letters & spaces
    if (!form.name.trim()) {
      setError('Please enter your full name.'); return;
    }
    if (!/^[A-Za-z]/.test(form.name.trim())) {
      setError('Name must start with a letter (A–Z).'); return;
    }
    if (form.name.trim().replace(/\s/g, '').length < 2) {
      setError('Name must contain at least 2 letters.'); return;
    }
    if (!/^[A-Za-z\s]+$/.test(form.name.trim())) {
      setError('Name must contain only letters and spaces.'); return;
    }

    // Phone mandatory for students only
    if (role === 'student' && !form.phone.trim()) {
      setError('Mobile number is required.'); return;
    }
    if (form.phone.trim()) {
      const phone = form.phone.trim();
      if (!/^[0-9]{10}$/.test(phone)) {
        setError('Mobile number must be exactly 10 digits.'); return;
      }
      if (!/^[789]/.test(phone)) {
        setError('Please enter a valid Indian mobile number (must start with 7, 8, or 9).'); return;
      }
      if (/^(\d)\1{9}$/.test(phone)) {
        setError('Please enter a valid mobile number (e.g. 0000000000 is not accepted).'); return;
      }
    }

    // Email required for teacher
    if (role === 'teacher' && !form.email.trim()) {
      setError('Email address is required for teacher registration.'); return;
    }
    // Validate email format if provided — must contain @
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email address (must contain @).'); return;
    }

    if (!form.password.trim()) {
      setError('Please enter a password.'); return;
    }
    if (getPasswordStrength(form.password).score < 4) {
      setError('Password must have 8+ chars, 1 uppercase, 1 number, and 1 symbol.'); return;
    }
    if (role === 'student' && form.rollNumber && !/^[A-Za-z0-9]+$/.test(form.rollNumber)) {
      setError('Roll number must be alphanumeric.'); return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        form.name,
          email:       form.email   || undefined,
          password:    form.password,
          role,
          phone:       form.phone      || undefined,
          department:  form.department || undefined,
          year:        form.year       || undefined,
          semester:    form.semester   || undefined,
          rollNumber:  form.rollNumber || undefined,
          section:     form.section    || undefined,
          subject:     form.subject    || undefined,
          employeeId:  form.employeeId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return; }

      // Mobile-only student — auto-verified, go straight to login
      if (data.autoVerified) {
        setSuccess('✅ Account created! You can now sign in with your mobile number.');
        setMode('login');
        return;
      }

      // Needs OTP Verification
      setPendingEmail(form.email || data.identifier);
      setPendingPhone(form.phone || data.identifier);
      setVerificationMethod(data.method || 'email');
      setMode('verify-pending');
    } catch {
      setError('Cannot connect to server. Is the dev server running?');
    } finally {
      setLoading(false);
    }
  };

  // ── Handle login ───────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();

    if (!form.email.trim() || !form.password.trim()) {
      setError('Please fill in all required fields.'); return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone: form.email, password: form.password, role }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Email not verified — offer to resend
        if (data.emailNotVerified) {
          setPendingEmail(data.email || form.email);
          setError('');
          setMode('verify-pending');
          return;
        }
        // Role mismatch — auto-switch to the correct role tab
        if (data.roleMismatch && data.actualRole) {
          setRole(data.actualRole as Role);
        }
        setError(data.error || 'Something went wrong.');
        return;
      }

      localStorage.setItem('campusiq_token', data.token);
      localStorage.setItem('campusiq_user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch {
      setError('Cannot connect to server. Is the dev server running?');
    } finally {
      setLoading(false);
    }
  };

  // ── Handle forgot password — send OTP ─────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fpEmail)) {
      setError('Please enter a valid email address.'); return;
    }
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fpEmail }),
      });
      // Always proceed to OTP screen (to prevent email enumeration)
      setOtp('');
      setMode('otp-verify');
    } catch {
      setError('Cannot connect to server.');
    } finally {
      setLoading(false);
    }
  };

  // ── Handle OTP verify for Signup ───────────────────────────
  const handleVerifySignupOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    if (otp.length !== 6) { setError('Please enter the full 6-digit OTP.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-signup-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: verificationMethod === 'email' ? pendingEmail : pendingPhone, otp }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Invalid OTP.'); return; }
      
      setSuccess('Account verified successfully! You can now sign in.');
      setMode('login');
      setOtp('');
    } catch {
      setError('Cannot connect to server.');
    } finally {
      setLoading(false);
    }
  };

  // ── Handle OTP verify for Forgot Password ────────────────────
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    if (otp.length !== 6) { setError('Please enter the full 6-digit OTP.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fpEmail, otp }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Invalid OTP.'); return; }
      setResetToken(data.resetToken);
      setNewPassword('');
      setConfirmPassword('');
      setMode('reset-password');
    } catch {
      setError('Cannot connect to server.');
    } finally {
      setLoading(false);
    }
  };

  // ── Handle reset password ──────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    if (getPasswordStrength(newPassword).score < 4) {
      setError('Password must have 8+ chars, 1 uppercase, 1 number, and 1 symbol.'); return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.'); return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Reset failed.'); return; }
      setSuccess('Password updated! You can now sign in with your new password.');
      setTimeout(() => { setMode('login'); clearAlerts(); }, 2500);
    } catch {
      setError('Cannot connect to server.');
    } finally {
      setLoading(false);
    }
  };

  // ── Handle resend verification ─────────────────────────────
  const handleResendVerification = async () => {
    clearAlerts();
    setLoading(true);
    try {
      const endpoint = verificationMethod === 'email' ? '/api/auth/resend-verification' : '/api/auth/resend-otp-sms';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: verificationMethod === 'email' ? pendingEmail : pendingPhone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to resend email.'); return; }
      setSuccess(verificationMethod === 'email' ? 'A new verification email has been sent.' : 'A new OTP has been sent via SMS.');
    } catch {
      setError('Cannot connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendSMSFallback = async () => {
    clearAlerts();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/resend-otp-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: pendingEmail || pendingPhone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to resend SMS.'); return; }
      setSuccess('A new OTP has been sent via SMS.');
      setVerificationMethod('sms');
      setOtp('');
    } catch {
      setError('Cannot connect to server.');
    } finally {
      setLoading(false);
    }
  };

  // ── Alert box ──────────────────────────────────────────────
  const AlertBox = ({ msg, type }: { msg: string; type: 'error' | 'success' }) => (
    <div className={`flex items-center gap-2 p-3 rounded-xl border
      ${type === 'error'
        ? 'bg-red-50 border-red-100'
        : 'bg-[#f0f9f6] border-[#b0f0d6]'}`}>
      <span className={`material-symbols-outlined text-[16px]
        ${type === 'error' ? 'text-red-500' : 'text-[#003527]'}`}>
        {type === 'error' ? 'error' : 'check_circle'}
      </span>
      <p className={`text-xs font-semibold
        ${type === 'error' ? 'text-red-600' : 'text-[#003527]'}`}>
        {msg}
      </p>
    </div>
  );

  // ── Back / nav helper ──────────────────────────────────────
  const BackBtn = ({ to, label }: { to: Mode; label: string }) => (
    <button
      onClick={() => { setMode(to); clearAlerts(); }}
      className="self-start flex items-center gap-1.5 text-xs font-semibold
                 text-[#5a6672] hover:text-[#003527] transition-colors mb-8 group"
    >
      <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-0.5 transition-transform">
        arrow_back
      </span>
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#f4f7ff] flex items-center justify-center p-4">

      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 right-0 w-[600px] h-[600px] rounded-full
                        bg-gradient-radial from-[#b0f0d6]/18 to-transparent blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full
                        bg-gradient-radial from-[#e5eeff]/50 to-transparent blur-[90px]" />
      </div>

      {/* ── Card shell ── */}
      <div className="w-full max-w-[920px] bg-white rounded-3xl overflow-hidden shadow-2xl
                      border border-[#bfc9c3]/15 grid grid-cols-1 lg:grid-cols-2"
           style={{ boxShadow: '0 20px 80px rgba(0,53,39,0.12)' }}>

        {/* ── Left: form column ── */}
        <div className="p-8 md:p-10 flex flex-col overflow-y-auto max-h-screen">

          {/* ════════════════════════════════════════════════
              SCREEN: Verify-pending (after signup)
          ════════════════════════════════════════════════ */}
          {mode === 'verify-pending' && (
            <>
              <BackBtn to="login" label="Back to Sign In" />
              <div className="mb-6">
                <h1 className="font-headline text-2xl font-extrabold text-[#0b1c30] mb-1">
                  {verificationMethod === 'email' ? 'Check your inbox!' : 'Check your phone!'}
                </h1>
                <p className="text-sm text-[#9ca8a3]">
                  A 6-digit verification code was sent to <strong className="text-[#003527]">
                    {verificationMethod === 'email' ? pendingEmail : pendingPhone}
                  </strong>
                </p>
              </div>

              <form onSubmit={handleVerifySignupOTP} className="flex flex-col gap-5">
                <OTPInput value={otp} onChange={setOtp} />

                {/* Countdown */}
                <div className="flex items-center justify-center gap-2">
                  <span className={`text-sm font-bold tabular-nums
                    ${otpRemaining > 60 ? 'text-[#003527]' : otpRemaining > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                    {otpRemaining > 0 ? `⏱ ${otpTimer} remaining` : '⚠ OTP expired'}
                  </span>
                </div>

                {error   && <AlertBox msg={error}   type="error"   />}
                {success && <AlertBox msg={success} type="success" />}

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6 || otpRemaining === 0}
                  className="w-full py-3.5 bg-[#003527] hover:bg-[#064e3b] disabled:bg-[#9ca8a3]
                             text-white font-bold text-sm rounded-xl shadow-md transition-all
                             flex items-center justify-center gap-2"
                >
                  {loading
                    ? <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    : <span className="material-symbols-outlined text-[18px]">verified</span>}
                  {loading ? 'Verifying…' : 'Verify Account'}
                </button>

                {verificationMethod === 'email' && pendingPhone && (
                  <button
                    type="button"
                    onClick={async () => {
                      clearAlerts();
                      setOtp('');
                      await handleResendSMSFallback();
                    }}
                    className="text-xs text-amber-700 font-bold hover:underline bg-amber-50 p-2 rounded-lg border border-amber-200"
                  >
                    💬 Having trouble with email? Send OTP via SMS instead
                  </button>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    clearAlerts();
                    setOtp('');
                    await handleResendVerification();
                  }}
                  disabled={otpRemaining > 540} // allow resend after 1 min
                  className="text-xs text-[#003527] font-bold hover:underline disabled:text-[#9ca8a3] disabled:no-underline"
                >
                  Resend OTP
                  {otpRemaining > 540 && ` (wait ${otpRemaining - 540}s)`}
                </button>
              </form>
            </>
          )}

          {/* ════════════════════════════════════════════════
              SCREEN: Forgot password — enter email
          ════════════════════════════════════════════════ */}
          {mode === 'forgot-password' && (
            <>
              <BackBtn to="login" label="Back to Sign In" />
              <div className="mb-6">
                <h1 className="font-headline text-2xl font-extrabold text-[#0b1c30] mb-1">
                  Forgot your password?
                </h1>
                <p className="text-sm text-[#9ca8a3]">
                  Enter your registered email and we'll send a 6-digit OTP.
                </p>
              </div>

              <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
                <Field
                  label="Registered Email *"
                  type="email"
                  value={fpEmail}
                  onChange={setFpEmail}
                  placeholder="you@university.edu"
                  autoFocus
                />

                {error   && <AlertBox msg={error}   type="error"   />}
                {success && <AlertBox msg={success} type="success" />}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[#003527] hover:bg-[#064e3b] disabled:bg-[#9ca8a3]
                             text-white font-bold text-sm rounded-xl shadow-md transition-all
                             flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">send</span>
                  )}
                  {loading ? 'Sending OTP…' : 'Send OTP'}
                </button>
              </form>
            </>
          )}

          {/* ════════════════════════════════════════════════
              SCREEN: OTP verify
          ════════════════════════════════════════════════ */}
          {mode === 'otp-verify' && (
            <>
              <BackBtn to="forgot-password" label="Back" />
              <div className="mb-6">
                <h1 className="font-headline text-2xl font-extrabold text-[#0b1c30] mb-1">
                  Enter your OTP
                </h1>
                <p className="text-sm text-[#9ca8a3]">
                  A 6-digit code was sent to <strong className="text-[#003527]">{fpEmail}</strong>
                </p>
              </div>

              <form onSubmit={handleVerifyOTP} className="flex flex-col gap-5">
                <OTPInput value={otp} onChange={setOtp} />

                {/* Countdown */}
                <div className="flex items-center justify-center gap-2">
                  <span className={`text-sm font-bold tabular-nums
                    ${otpRemaining > 60 ? 'text-[#003527]' : otpRemaining > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                    {otpRemaining > 0 ? `⏱ ${otpTimer} remaining` : '⚠ OTP expired'}
                  </span>
                </div>

                {error   && <AlertBox msg={error}   type="error"   />}
                {success && <AlertBox msg={success} type="success" />}

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6 || otpRemaining === 0}
                  className="w-full py-3.5 bg-[#003527] hover:bg-[#064e3b] disabled:bg-[#9ca8a3]
                             text-white font-bold text-sm rounded-xl shadow-md transition-all
                             flex items-center justify-center gap-2"
                >
                  {loading
                    ? <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    : <span className="material-symbols-outlined text-[18px]">verified</span>}
                  {loading ? 'Verifying…' : 'Verify OTP'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    clearAlerts();
                    setOtp('');
                    handleForgotPassword(new Event('submit') as unknown as React.FormEvent);
                  }}
                  disabled={otpRemaining > 540} // allow resend after 1 min
                  className="text-xs text-[#003527] font-bold hover:underline disabled:text-[#9ca8a3] disabled:no-underline"
                >
                  Resend OTP
                  {otpRemaining > 540 && ` (wait ${otpRemaining - 540}s)`}
                </button>
              </form>
            </>
          )}

          {/* ════════════════════════════════════════════════
              SCREEN: Reset password
          ════════════════════════════════════════════════ */}
          {mode === 'reset-password' && (
            <>
              <div className="mb-6 mt-2">
                <div className="w-12 h-12 rounded-2xl bg-[#f0f9f6] border border-[#b0f0d6]
                                flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-[24px] text-[#003527]">lock_reset</span>
                </div>
                <h1 className="font-headline text-2xl font-extrabold text-[#0b1c30] mb-1">
                  Set new password
                </h1>
                <p className="text-sm text-[#9ca8a3]">
                  Choose a strong password for your account.
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
                <div>
                  <Field
                    label="New Password *"
                    type="password"
                    value={newPassword}
                    onChange={setNewPassword}
                    placeholder="••••••••"
                    autoFocus
                  />
                  {newPassword && (
                    <div className="mt-2 animate-fade-in">
                      <div className="flex gap-1 h-1.5 mb-1.5">
                        {[1, 2, 3, 4].map((step) => {
                          const strength = getPasswordStrength(newPassword);
                          return (
                            <div key={step} className={`flex-1 rounded-full transition-colors duration-300
                              ${step <= strength.score ? strength.color : 'bg-[#e8eef0]'}`} />
                          );
                        })}
                      </div>
                      <p className={`text-[10px] font-bold ${getPasswordStrength(newPassword).textColor} flex justify-between`}>
                        <span>{getPasswordStrength(newPassword).label} Password</span>
                        {getPasswordStrength(newPassword).score < 4 && (
                          <span className="text-[#9ca8a3] font-normal">Use upper, number & symbol</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                <Field
                  label="Confirm Password *"
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="••••••••"
                />

                {error   && <AlertBox msg={error}   type="error"   />}
                {success && <AlertBox msg={success} type="success" />}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[#003527] hover:bg-[#064e3b] disabled:bg-[#9ca8a3]
                             text-white font-bold text-sm rounded-xl shadow-md transition-all
                             flex items-center justify-center gap-2"
                >
                  {loading
                    ? <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    : <span className="material-symbols-outlined text-[18px]">lock</span>}
                  {loading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </>
          )}

          {/* ════════════════════════════════════════════════
              SCREEN: Login / Signup (main form)
          ════════════════════════════════════════════════ */}
          {(mode === 'login' || mode === 'signup') && (
            <>
              {/* Back button */}
              <button
                onClick={onBack}
                className="self-start flex items-center gap-1.5 text-xs font-semibold
                           text-[#5a6672] hover:text-[#003527] transition-colors mb-8 group"
              >
                <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-0.5 transition-transform">
                  arrow_back
                </span>
                Back to Home
              </button>

              {/* Mobile brand */}
              <div className="flex items-center gap-2.5 mb-6 lg:hidden">
                <div className="w-9 h-9 rounded-xl bg-[#003527] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[19px] text-[#80bea6]">school</span>
                </div>
                <span className="font-headline font-extrabold text-lg text-[#003527]">CampusIQ</span>
              </div>

              {/* Heading */}
              <div className="mb-6">
                <h1 className="font-headline text-2xl font-extrabold text-[#0b1c30] mb-1">
                  {mode === 'login' ? 'Welcome back' : 'Create your account'}
                </h1>
                <p className="text-sm text-[#9ca8a3]">
                  {mode === 'login'
                    ? 'Sign in to access your campus dashboard.'
                    : "Join CampusIQ — it's free for all enrolled students."}
                </p>
              </div>

              {/* Mode toggle */}
              <div className="flex bg-[#f4f7ff] rounded-2xl p-1 mb-5">
                {(['login', 'signup'] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m as Mode); clearAlerts(); }}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all
                                ${mode === m
                                  ? 'bg-white text-[#003527] shadow-sm'
                                  : 'text-[#9ca8a3] hover:text-[#003527]'}`}
                  >
                    {m === 'login' ? 'Sign In' : 'Create Account'}
                  </button>
                ))}
              </div>

              {/* Role toggle — login shows all 3, signup shows only student & teacher */}
              <div className="flex gap-2 mb-5">
                {([
                  { id: 'student', label: 'Student',  icon: 'school',      activeClass: 'border-[#003527] bg-[#003527]/6 text-[#003527]' },
                  { id: 'teacher', label: 'Teacher',  icon: 'person_book', activeClass: 'border-[#2563eb] bg-[#2563eb]/8 text-[#1d4ed8]' },
                  ...(mode === 'login' ? [{ id: 'admin' as Role, label: 'Admin', icon: 'admin_panel_settings', activeClass: 'border-[#fea619] bg-[#fea619]/10 text-[#855300]' }] : []),
                ] as { id: Role; label: string; icon: string; activeClass: string }[]).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5
                                rounded-xl border-2 text-xs font-bold transition-all
                                ${role === r.id ? r.activeClass : 'border-[#e0e5e2] text-[#9ca8a3] hover:border-[#bfc9c3]'}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{r.icon}</span>
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="flex flex-col gap-4 flex-1">

                {/* === SIGNUP: Full Name === */}
                {mode === 'signup' && (
                  <Field label="Full Name *" value={form.name}
                         onChange={(v) => set('name', v)} placeholder="e.g. Sumukh Sharma" />
                )}

                {/* === LOGIN: Email-or-Phone identifier === */}
                {mode === 'login' && (
                  <Field
                    label="Email or Mobile Number *"
                    type="text"
                    value={form.email}
                    onChange={(v) => set('email', v)}
                    placeholder={role === 'student' ? 'Mobile number or email' : role === 'teacher' ? 'Email or mobile number' : 'admin@university.edu'}
                  />
                )}

                {/* === SIGNUP: Mobile Number — student only === */}
                {mode === 'signup' && role === 'student' && (
                  <Field
                    label="Mobile Number *"
                    type="tel"
                    value={form.phone}
                    onChange={(v) => set('phone', v.replace(/\D/g, '').slice(0, 10))}
                    placeholder="e.g. 9876543210"
                  />
                )}

                {/* === SIGNUP: Email — optional for student, required for teacher/admin === */}
                {mode === 'signup' && (
                  <Field
                    label={role === 'student' ? 'College Email (optional)' : 'Email Address *'}
                    type="email"
                    value={form.email}
                    onChange={(v) => set('email', v)}
                    placeholder={
                      role === 'student' ? 'you@university.edu — skip if you don\'t have one'
                      : role === 'teacher' ? 'teacher@university.edu'
                      : 'admin@university.edu'
                    }
                    hint={role === 'student' ? "No college email yet? Leave blank — your mobile number is enough to sign in." : undefined}
                    accent={role === 'admin' ? 'amber' : 'green'}
                  />
                )}

                {/* === Password === */}
                <div>
                  <Field
                    label="Password *" type="password" value={form.password}
                    onChange={(v) => set('password', v)} placeholder="••••••••"
                  />
                  {mode === 'signup' && form.password && (
                    <div className="mt-2 animate-fade-in">
                      <div className="flex gap-1 h-1.5 mb-1.5">
                        {[1, 2, 3, 4].map((step) => {
                          const strength = getPasswordStrength(form.password);
                          return (
                            <div key={step} className={`flex-1 rounded-full transition-colors duration-300
                              ${step <= strength.score ? strength.color : 'bg-[#e8eef0]'}`} />
                          );
                        })}
                      </div>
                      <p className={`text-[10px] font-bold ${getPasswordStrength(form.password).textColor} flex justify-between`}>
                        <span>{getPasswordStrength(form.password).label} Password</span>
                        {getPasswordStrength(form.password).score < 4 && (
                          <span className="text-[#9ca8a3] font-normal">Use upper, number &amp; symbol</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {/* Forgot password link */}
                {mode === 'login' && (
                  <div className="-mt-1 text-right">
                    <button
                      type="button"
                      onClick={() => { setFpEmail(form.email); setMode('forgot-password'); clearAlerts(); }}
                      className="text-xs text-[#003527] font-bold hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {/* === SIGNUP — STUDENT extra fields === */}
                {mode === 'signup' && role === 'student' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Department" value={form.department}
                             onChange={(v) => set('department', v)} placeholder="e.g. CSE" />
                      <Field label="Roll Number" value={form.rollNumber}
                             onChange={(v) => set('rollNumber', v)} placeholder="e.g. CS21B1034" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[#5a6672] uppercase tracking-wide mb-1.5">Year</label>
                        <select value={form.year} onChange={(e) => set('year', e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-[#bfc9c3]/40 bg-[#f8fafe]
                                           text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]
                                           focus:ring-1 focus:ring-[#003527]/15">
                          <option value="">Select Year</option>
                          <option value="FY">FY — First Year</option>
                          <option value="SY">SY — Second Year</option>
                          <option value="TY">TY — Third Year</option>
                          <option value="BY">BY — B.Tech Final Year</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#5a6672] uppercase tracking-wide mb-1.5">Semester</label>
                        <select value={form.semester} onChange={(e) => set('semester', e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-[#bfc9c3]/40 bg-[#f8fafe]
                                           text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]
                                           focus:ring-1 focus:ring-[#003527]/15">
                          <option value="">Select</option>
                          {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={`Semester ${s}`}>Semester {s}</option>)}
                        </select>
                      </div>
                    </div>
                    {/* Section — optional free text */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#5a6672] uppercase tracking-wide mb-1.5">
                        Class Section
                        <span className="ml-1 text-[#9ca8a3] normal-case font-normal tracking-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={form.section}
                        onChange={(e) => set('section', e.target.value.toUpperCase())}
                        placeholder="e.g. A, B, TY-A, AIML-B  — leave blank if no section"
                        className="w-full py-3 px-4 rounded-xl border border-[#bfc9c3]/40 bg-[#f8fafe]
                                   text-sm text-[#0b1c30] placeholder:text-[#c8d0cc]
                                   focus:outline-none focus:border-[#003527] focus:ring-1 focus:ring-[#003527]/15"
                      />
                      <p className="text-[10px] text-[#9ca8a3] mt-1.5">
                        Type your section exactly (e.g. <strong>A</strong>, <strong>B</strong>, <strong>TY AIML</strong>).
                        Leave blank if your class has no section split.
                        This ensures you see the right timetable &amp; documents on your dashboard.
                      </p>
                    </div>
                  </>
                )}

                {/* === SIGNUP — TEACHER extra fields === */}
                {mode === 'signup' && role === 'teacher' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Department *" value={form.department}
                           onChange={(v) => set('department', v)} placeholder="e.g. CSE" />
                    <Field label="Subject You Teach" value={form.subject}
                           onChange={(v) => set('subject', v)} placeholder="e.g. Data Structures" />
                  </div>
                )}

                {error   && <AlertBox msg={error}   type="error"   />}
                {success && <AlertBox msg={success} type="success" />}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[#003527] hover:bg-[#064e3b] disabled:bg-[#9ca8a3]
                             text-white font-bold text-sm rounded-xl shadow-md transition-all
                             flex items-center justify-center gap-2 mt-1"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">
                        {mode === 'login' ? 'login' : 'person_add'}
                      </span>
                      {mode === 'login'
                        ? `Sign in as ${role === 'student' ? 'Student' : role === 'teacher' ? 'Teacher' : 'Admin'}`
                        : `Create ${role === 'student' ? 'Student' : role === 'teacher' ? 'Teacher' : 'Admin'} Account`}
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-[#9ca8a3] mt-1">
                  {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                  <button type="button"
                    onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); clearAlerts(); }}
                    className="text-[#003527] font-bold hover:underline">
                    {mode === 'login' ? 'Create one' : 'Sign in'}
                  </button>
                </p>
              </form>

              <p className="text-[10px] text-[#9ca8a3] text-center mt-6">
                © 2026 CampusIQ · Made by Fantastic Four
              </p>
            </>
          )}
        </div>

        {/* ── Right: decorative panel ── */}
        <RightPanel mode={mode} />
      </div>
    </div>
  );
};
