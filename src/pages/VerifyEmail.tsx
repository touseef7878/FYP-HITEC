/**
 * VerifyEmail page
 * Reached via the link in the verification email:
 *   /verify-email?token=<token>
 *
 * Calls GET /api/auth/verify-email?token=... on mount.
 * On success → stores the JWT and redirects to the app.
 * On failure → shows an error with a resend option.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import ENV from '@/config/env';

type Status = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const [status, setStatus] = useState<Status>('loading');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const API_URL = ENV.API_URL;
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }

    const verify = async () => {
      try {
        // Use token as-is from URL — do NOT re-encode, it's already URL-decoded by the browser
        const res = await fetch(`${API_URL}/api/auth/verify-email?token=${token}`);
        const data = await res.json();

        if (!res.ok) {
          setStatus('error');
          return;
        }

        // Store JWT — same as a normal login
        localStorage.setItem('auth_token', data.access_token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));

        setStatus('success');
        toast({ title: 'Email verified!', description: `Welcome, ${data.user.username} 🎉` });

        // Redirect after a short delay — use window.location so AuthContext re-initialises cleanly
        setTimeout(() => {
          window.location.href = data.user.role === 'ADMIN' ? '/admin' : '/';
        }, 2000);
      } catch {
        setStatus('error');
      }
    };

    verify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleResend = async () => {
    if (!resendEmail) return;
    setResending(true);
    try {
      await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });
      setResent(true);
      toast({ title: 'New link sent', description: 'Check your inbox.' });
    } catch {
      toast({ title: 'Failed to resend', variant: 'destructive' });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f3] px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-border/50 p-10 w-full max-w-md text-center">

        {/* Logo */}
        <div className="text-2xl font-bold text-foreground mb-8">🌊 OceanGuard AI</div>

        {/* Loading */}
        {status === 'loading' && (
          <div className="space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-[15px] font-semibold text-foreground">Verifying your email…</p>
            <p className="text-[13px] text-muted-foreground">Just a moment.</p>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div className="space-y-4">
            <CheckCircle2 className="h-14 w-14 text-success mx-auto" />
            <h2 className="text-[20px] font-bold text-foreground">Email verified!</h2>
            <p className="text-[13px] text-muted-foreground">
              Your account is active. Redirecting you now…
            </p>
            <div className="w-6 h-6 mx-auto">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="space-y-5">
            <XCircle className="h-14 w-14 text-destructive mx-auto" />
            <h2 className="text-[20px] font-bold text-foreground">Link invalid or expired</h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              This verification link has expired or already been used.<br />
              Enter your email to get a new one.
            </p>

            <div className="space-y-2 text-left">
              <input
                type="email"
                placeholder="your@email.com"
                value={resendEmail}
                onChange={e => setResendEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background
                           text-[13.5px] text-foreground outline-none
                           focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
              />
              <button
                onClick={handleResend}
                disabled={resending || resent || !resendEmail}
                className="w-full py-3 rounded-xl bg-foreground text-background text-[13.5px]
                           font-bold hover:opacity-90 active:scale-[0.98] transition-all
                           flex items-center justify-center gap-2 shadow-md disabled:opacity-50">
                {resending
                  ? <><RefreshCw className="h-4 w-4 animate-spin" /> Sending…</>
                  : resent
                  ? <><CheckCircle2 className="h-4 w-4" /> Sent!</>
                  : 'Send new verification link'}
              </button>
            </div>

            <button
              onClick={() => navigate('/auth', { replace: true })}
              className="text-[12.5px] text-muted-foreground hover:text-foreground font-medium">
              ← Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
