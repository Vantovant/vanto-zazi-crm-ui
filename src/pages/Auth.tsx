import { useState } from 'react';
import logo from '@/assets/getwellgrow-logo.png';
import { Navigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { env } from '@/lib/env';
import {
  Mail, Lock, User, Loader2, Ticket, Eye, EyeOff,
  Bot, MessageCircle, Users as UsersIcon, Cake, BarChart3,
  ShieldCheck, KeyRound, Clock, ArrowLeft, Mail as MailIcon,
} from 'lucide-react';

export function Auth() {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const inviteFromUrl = searchParams.get('invite') || '';
  const [isSignUp, setIsSignUp] = useState(!!inviteFromUrl);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState(inviteFromUrl);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 relative overflow-hidden">
      {/* ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            'radial-gradient(circle at 15% 20%, rgba(42,138,143,0.35), transparent 55%), radial-gradient(circle at 85% 85%, rgba(232,115,44,0.25), transparent 55%)',
        }}
      />

      {/* top bar */}
      <header className="relative border-b border-slate-800/80">
        <div className="container mx-auto flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="GetWell Grow" className="w-10 h-10 object-contain" />
            <div className="leading-tight">
              <div className="font-bold">
                <span className="text-brand-teal-300">GetWell</span>{' '}
                <span className="text-brand-orange-400">Grow</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium">
                getwellgrow.app/signin
              </div>
            </div>
          </div>
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to homepage
          </a>
        </div>
      </header>

      <div className="relative container mx-auto py-10 lg:py-14">
        <div className="grid lg:grid-cols-[1fr_1.05fr_1fr] gap-8 lg:gap-10 items-start">
          {/* LEFT — Pitch */}
          <aside className="space-y-6">
            <div>
              <span className="inline-block text-[11px] uppercase tracking-[0.18em] font-bold text-brand-orange-400">
                Workspace sign-in
              </span>
              <h2 className="mt-3 text-2xl lg:text-3xl font-bold leading-tight">
                WhatsApp-first CRM for downline-driven teams.
              </h2>
              <p className="mt-3 text-sm text-slate-300/85 leading-relaxed">
                GetWell Grow is the autonomous Prospector, unified inbox, and follow-up engine for
                network-marketing leaders. Purpose-built for APLGO and configurable for any MLM
                company on request.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { icon: Bot, t: 'AI Prospector',
                  d: 'Autonomous first-touch, intent detection, and follow-up scheduling — 24/7.' },
                { icon: MessageCircle, t: 'Unified Inbox',
                  d: 'WhatsApp (Maytapi) + SMS (Twilio) conversations in one shared, audited thread.' },
                { icon: UsersIcon, t: 'CRM Pipeline',
                  d: 'Prospect → Registered → Purchase → Status tracking with lead-temperature scoring.' },
                { icon: Cake, t: 'Birthday Engine',
                  d: 'Daily queue, Smart Phone Rescue, and MP1.5 Assisted Send — never miss a moment.' },
                { icon: BarChart3, t: 'Activity Engine',
                  d: 'Daily goals, neglected-contact alerts, and monthly appreciation push.' },
              ].map(({ icon: Icon, t, d }) => (
                <div key={t} className="flex gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #2A8A8F33, #E8732C33)' }}
                  >
                    <Icon className="w-4.5 h-4.5 text-brand-teal-300" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{t}</div>
                    <p className="text-xs text-slate-400 mt-0.5 leading-snug">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* CENTER — Auth card */}
          <div className="lg:sticky lg:top-8">
            <div className="rounded-2xl bg-slate-800/90 border border-slate-700 shadow-2xl backdrop-blur-sm">
              <div className="p-7 pb-5">
                <h1 className="text-2xl font-bold text-white">
                  {isSignUp ? 'Create your account' : 'Welcome back'}
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  {isSignUp ? 'Redeem your invite code to join the workspace' : 'Sign in to your workspace'}
                </p>
              </div>
              <div className="px-7 pb-7">
                <AuthForm
                  isSignUp={isSignUp}
                  email={email} setEmail={setEmail}
                  password={password} setPassword={setPassword}
                  displayName={displayName} setDisplayName={setDisplayName}
                  inviteCode={inviteCode} setInviteCode={setInviteCode}
                  error={error} setError={setError}
                  message={message} setMessage={setMessage}
                  submitting={submitting} setSubmitting={setSubmitting}
                />

                <div className="mt-6 text-center space-y-2">
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage(''); }}
                    className="text-sm text-brand-teal-300 hover:text-brand-teal-400 transition-colors"
                  >
                    {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                  </button>
                  {!isSignUp && <ForgotPasswordLink />}
                </div>

                <p className="mt-5 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
                  <KeyRound className="w-3 h-3" /> Access is invite-only. Contact your admin for access.
                </p>
              </div>
            </div>

            <p className="mt-4 text-center text-[11px] text-slate-500">
              By signing in you agree to the GetWell Grow workspace acceptable-use policy.
            </p>
          </div>

          {/* RIGHT — Safety + access */}
          <aside className="space-y-5">
            <div className="rounded-2xl border border-slate-700/60 bg-slate-800/60 p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-400">
                Workspace safety
              </div>
              <ul className="mt-4 space-y-3">
                {[
                  { icon: ShieldCheck, t: 'Invite-only access with role-based permissions.' },
                  { icon: Lock, t: 'Encrypted conversations and audited activity logs.' },
                  { icon: Clock, t: 'Quiet-hour guards and per-contact rate limits.' },
                  { icon: ShieldCheck, t: 'Anti-duplicate safety — one touch per prospect.' },
                  { icon: ShieldCheck, t: 'MP1 manual-send rule — no WhatsApp bans, ever.' },
                ].map(({ icon: Icon, t }) => (
                  <li key={t} className="flex gap-2.5 text-sm text-slate-300/90">
                    <Icon className="w-4 h-4 text-brand-teal-300 mt-0.5 flex-shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-700/60 bg-slate-800/60 p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-400">
                Need access?
              </div>
              <p className="mt-3 text-sm text-slate-300/90 leading-relaxed">
                This is a private workspace for GetWell Grow distributors and operators. If you
                believe you should have access, reach out to your admin to receive an invite code.
              </p>
              <a
                href="mailto:hello@getwellgrow.app"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-orange-400 hover:text-brand-orange-300"
              >
                <MailIcon className="w-4 h-4" /> Contact your admin for an invitation
              </a>
            </div>

            <div className="rounded-2xl border border-slate-700/60 bg-slate-800/60 p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-400">
                Explore first
              </div>
              <p className="mt-3 text-sm text-slate-300/90">New here?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/" className="px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-700 hover:bg-slate-600 text-slate-200">Homepage</Link>
                <Link to="/features" className="px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-700 hover:bg-slate-600 text-slate-200">Features</Link>
                <Link to="/flagship" className="px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-700 hover:bg-slate-600 text-slate-200">Flagship</Link>
                <Link to="/how-it-works" className="px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-700 hover:bg-slate-600 text-slate-200">How it works</Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}


function AuthForm({
  isSignUp, email, setEmail, password, setPassword,
  displayName, setDisplayName, inviteCode, setInviteCode,
  error, setError, message, setMessage, submitting, setSubmitting,
}: {
  isSignUp: boolean;
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  displayName: string; setDisplayName: (v: string) => void;
  inviteCode: string; setInviteCode: (v: string) => void;
  error: string; setError: (v: string) => void;
  message: string; setMessage: (v: string) => void;
  submitting: boolean; setSubmitting: (v: boolean) => void;
}) {
  const { signIn, signUp } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!env.hasBackend) {
      setError('Backend is not configured for this deployment. Please contact the administrator.');
      return;
    }
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      if (isSignUp) {
        const code = inviteCode.trim().toUpperCase();
        if (!code) {
          setError('Please enter your invite code to sign up.');
          setSubmitting(false);
          return;
        }

        // Validate the invite code
        const { data: validateData, error: validateError } = await supabase.functions.invoke('invite-check', {
          body: { action: 'validate', token: code },
        });

        if (validateError || !validateData?.valid) {
          setError(validateData?.error || 'Invalid invite code. Please check and try again.');
          setSubmitting(false);
          return;
        }

        // Create the account
        const { error: signUpError } = await signUp(email, password, displayName);
        if (signUpError) {
          setError(signUpError.message);
          setSubmitting(false);
          return;
        }

        // Redeem the invite code after successful signup
        await supabase.functions.invoke('invite-check', {
          body: { action: 'redeem', token: code },
        });

        setMessage('Account created! You can now sign in.');
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isSignUp && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Invite Code</label>
            <div className="relative">
              <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Enter your invite code"
                required
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all placeholder:text-slate-500 uppercase tracking-wider font-mono"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Ask your team leader for an invite code</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Display Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all placeholder:text-slate-500"
              />
            </div>
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all placeholder:text-slate-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
            className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all placeholder:text-slate-500"
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          {error}
        </div>
      )}

      {message && (
        <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm">
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {isSignUp ? 'Create Account' : 'Sign In'}
      </button>
    </form>
  );
}

function ForgotPasswordLink() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) { setError(error.message); } else { setSent(true); }
    setSending(false);
  };

  if (!show) {
    return (
      <button type="button" onClick={() => setShow(true)} className="block mx-auto text-sm text-slate-400 hover:text-slate-300 transition-colors">
        Forgot your password?
      </button>
    );
  }

  if (sent) {
    return <p className="text-sm text-teal-400 text-center">Check your email for a reset link.</p>;
  }

  return (
    <form onSubmit={handleSend} className="mt-2 space-y-2">
      <input
        type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" required
        className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 placeholder:text-slate-500"
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <button type="submit" disabled={sending} className="w-full py-2 text-sm font-medium bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50">
        {sending ? 'Sending…' : 'Send Reset Link'}
      </button>
    </form>
  );
}
