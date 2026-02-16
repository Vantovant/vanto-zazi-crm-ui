import { useState, useEffect } from 'react';
import logo from '@/assets/logo.jpg';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Lock, User, Loader2, ShieldX, ShieldCheck } from 'lucide-react';

export function Auth() {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite') || '';
  const [isSignUp, setIsSignUp] = useState(!!inviteToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Invite validation state
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [inviteLabel, setInviteLabel] = useState('');
  const [inviteChecking, setInviteChecking] = useState(false);

  useEffect(() => {
    if (inviteToken) {
      setInviteChecking(true);
      supabase.functions.invoke('invite-check', {
        body: { action: 'validate', token: inviteToken },
      }).then(({ data, error: fnError }) => {
        if (fnError || !data?.valid) {
          setInviteValid(false);
          setError(data?.error || 'Invalid invite link');
        } else {
          setInviteValid(true);
          setInviteLabel(data.label || '');
        }
        setInviteChecking(false);
      });
    }
  }, [inviteToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <img src={logo} alt="Vanto Zazi logo" className="w-14 h-14 rounded-xl mx-auto mb-4 object-cover" />
          <h1 className="text-2xl font-bold text-white">Vanto Zazi</h1>
          <p className="text-slate-400 mt-1">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          {/* Invite status banner */}
          {inviteToken && inviteChecking && (
            <div className="mb-4 p-3 rounded-lg bg-slate-700/50 text-slate-300 text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying invite...
            </div>
          )}
          {inviteToken && inviteValid === true && (
            <div className="mb-4 p-3 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              {inviteLabel ? `Invited as: ${inviteLabel}` : 'Valid invite — create your account below'}
            </div>
          )}
          {inviteToken && inviteValid === false && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2">
              <ShieldX className="w-4 h-4" />
              {error || 'Invalid or expired invite link'}
            </div>
          )}

          {/* Block signup without invite */}
          {isSignUp && !inviteToken ? (
            <div className="text-center py-6">
              <ShieldX className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Sign up is invite-only.</p>
              <p className="text-slate-500 text-xs mt-1">Please ask your team leader for an invite link.</p>
            </div>
          ) : (
            <AuthForm
              isSignUp={isSignUp}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              displayName={displayName}
              setDisplayName={setDisplayName}
              error={error}
              setError={setError}
              message={message}
              setMessage={setMessage}
              submitting={submitting}
              setSubmitting={setSubmitting}
              inviteToken={inviteToken}
              inviteValid={inviteValid}
              disabled={isSignUp && inviteValid !== true}
            />
          )}

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage(''); }}
              className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthForm({
  isSignUp, email, setEmail, password, setPassword,
  displayName, setDisplayName, error, setError,
  message, setMessage, submitting, setSubmitting,
  inviteToken, inviteValid, disabled,
}: {
  isSignUp: boolean;
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  displayName: string; setDisplayName: (v: string) => void;
  error: string; setError: (v: string) => void;
  message: string; setMessage: (v: string) => void;
  submitting: boolean; setSubmitting: (v: boolean) => void;
  inviteToken: string;
  inviteValid: boolean | null;
  disabled: boolean;
}) {
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      if (isSignUp) {
        if (!inviteToken || inviteValid !== true) {
          setError('A valid invite link is required to sign up.');
          setSubmitting(false);
          return;
        }

        const { error } = await signUp(email, password, displayName);
        if (error) {
          setError(error.message);
        } else {
          // Redeem the invite token
          await supabase.functions.invoke('invite-check', {
            body: { action: 'redeem', token: inviteToken },
          });
          setMessage('Account created! You can now sign in.');
        }
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
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all placeholder:text-slate-500"
          />
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
        disabled={submitting || disabled}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {isSignUp ? 'Create Account' : 'Sign In'}
      </button>
    </form>
  );
}
