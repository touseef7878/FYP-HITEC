import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import logger from '@/utils/logger';
import logoImg from '@/assets/images/marine-logo.png';

// ── Password strength ─────────────────────────────────────────────────────────
function getStrength(pw: string) {
  if (!pw) return { label: '', color: '', width: '0%' };
  if (pw.length < 6)  return { label: 'Weak',   color: 'bg-red-400',    width: '33%' };
  if (pw.length < 10) return { label: 'Fair',   color: 'bg-yellow-400', width: '66%' };
  return               { label: 'Strong', color: 'bg-emerald-500', width: '100%' };
}

// ── Floating-label field ──────────────────────────────────────────────────────
function Field({
  label, id, name, type = 'text', value, onChange, placeholder, error, children,
}: {
  label: string; id: string; name: string; type?: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; error?: string; children?: React.ReactNode;
}) {
  return (
    <div>
      <div className={`relative border rounded-xl bg-background transition-colors ${
        error ? 'border-destructive' : 'border-border focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20'
      }`}>
        <label htmlFor={id} className="absolute top-2 left-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider pointer-events-none">
          {label}
        </label>
        <input
          id={id} name={name} type={type} value={value} onChange={onChange}
          placeholder={placeholder}
          className="w-full pt-6 pb-2.5 px-3.5 text-[13.5px] text-foreground bg-transparent outline-none rounded-xl placeholder:text-muted-foreground/50 font-medium"
          autoComplete={name}
        />
        {children}
      </div>
      {error && <p className="text-destructive text-xs mt-1 ml-1 font-medium">{error}</p>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AuthPage() {
  const [tab, setTab] = useState<'register' | 'login'>('register');
  const navigate      = useNavigate();
  const location      = useLocation();
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      const from = (location.state as any)?.from?.pathname;
      navigate(isAdmin ? '/admin' : (from && from !== '/auth' ? from : '/'), { replace: true });
    }
  }, [isAuthenticated, isAdmin, isLoading, navigate, location]);

  const handleSuccess = () => {
    const from = (location.state as any)?.from?.pathname;
    navigate(isAdmin ? '/admin' : (from && from !== '/auth' ? from : '/'), { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f3]">
        <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    /* Full-screen grid: on mobile video is background, on lg it's right column */
    <div className="min-h-screen lg:grid lg:grid-cols-[520px_1fr]">

      {/* ── Mobile video background (shows behind form on small screens) ── */}
      <div className="fixed inset-0 lg:hidden -z-10">
        <video src="/auth-ocean.mp4" autoPlay loop muted playsInline preload="auto"
          className="w-full h-full object-cover"
          style={{ willChange: 'transform', transform: 'translateZ(0)' }}
        />
        {/* Dark overlay so form text is readable */}
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* ── LEFT — Form panel ── */}
      <div className="relative z-10 flex flex-col justify-center min-h-screen lg:min-h-0
                      px-5 py-8 sm:px-10
                      lg:bg-background lg:px-12 xl:px-16">

        {/* Card wrapper on mobile (glass effect) */}
        <div className="lg:contents">
          <div className="bg-background/92 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-border/50
                          lg:bg-transparent lg:backdrop-blur-none lg:rounded-none lg:p-0 lg:shadow-none lg:border-0">

            {/* Logo + title */}
            <div className="flex flex-col items-center mb-7">
              <div className="w-12 h-12 rounded-2xl bg-foreground flex items-center justify-center mb-3 shadow-md">
                <img src={logoImg} alt="OceanGuard" className="w-8 h-8 rounded-xl" />
              </div>
              <h1 className="font-display text-lg font-bold text-foreground tracking-tight">OceanGuard AI</h1>
              <p className="text-xs text-muted-foreground mt-0.5 text-center font-medium">
                {tab === 'register' ? 'This is the start of something good.' : 'Welcome back. Sign in to continue.'}
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex rounded-full bg-muted border border-border p-1 mb-6">
              {(['register', 'login'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-2 text-[13px] font-bold rounded-full transition-all duration-200 tracking-[-0.01em] ${
                    tab === t
                      ? 'bg-foreground text-background shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {t === 'register' ? 'Register' : 'Login'}
                </button>
              ))}
            </div>

            {/* Forms */}
            <AnimatePresence mode="wait" initial={false}>
              {tab === 'register'
                ? <RegisterPanel key="reg" onSuccess={handleSuccess} onSwitch={() => setTab('login')} />
                : <LoginPanel    key="log" onSuccess={handleSuccess} onSwitch={() => setTab('register')} />}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── RIGHT — Video panel (desktop only) ── */}
      <div className="hidden lg:block relative overflow-hidden m-3 rounded-3xl">
        <video src="/auth-ocean.mp4" autoPlay loop muted playsInline preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ willChange: 'transform', transform: 'translateZ(0)' }}
        />
        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

        {/* Content overlay */}
        <div className="absolute inset-0 flex flex-col justify-between p-10">
          {/* Top badge */}
          <div className="self-start flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/90 text-xs font-medium">HITEC University Taxila — FYP 2026</span>
          </div>

          {/* Bottom text */}
          <div className="text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300 mb-3">
              Built by students, for the planet
            </p>
            <h2 className="text-3xl xl:text-4xl font-bold leading-tight mb-3">
              Every piece of plastic<br />
              <span className="text-cyan-300">we find matters.</span>
            </h2>
            <p className="text-white/65 text-sm max-w-sm leading-relaxed mb-6">
              Three engineers. One mission. We built OceanGuard AI to give researchers
              the tools to detect, track, and predict marine plastic pollution — because
              the ocean can't wait.
            </p>

            {/* Team chips */}
            <div className="flex flex-wrap gap-2">
              {[
                { name: 'Touseef Ur Rehman', role: 'ML' },
                { name: 'Qasim Shahzad',     role: 'Backend' },
                { name: 'Zohaib Ashraf',     role: 'Frontend' },
              ].map(m => (
                <div key={m.name} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-3 py-1.5">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                    {m.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <span className="text-white/90 text-xs font-medium">{m.name}</span>
                  <span className="text-white/40 text-xs">· {m.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Register ──────────────────────────────────────────────────────────────────
function RegisterPanel({ onSuccess, onSwitch }: { onSuccess: () => void; onSwitch: () => void }) {
  const { register } = useAuth();
  const [form, setForm]   = useState({ username: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const strength = getStrength(form.password);

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.username.length < 3) e.username = 'At least 3 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (form.password.length < 6) e.password = 'At least 6 characters';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors(p => ({ ...p, [e.target.name]: '' }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (await register(form.username, form.email, form.password)) onSuccess();
    } catch (err) { logger.error('Register:', err); }
    finally { setLoading(false); }
  };

  return (
    <motion.form onSubmit={onSubmit}
      initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}
      className="space-y-3">

      <Field label="Username" id="username" name="username" value={form.username}
        onChange={onChange} placeholder="Robert Fox" error={errors.username} />

      <Field label="Email" id="email" name="email" type="email" value={form.email}
        onChange={onChange} placeholder="robert.fox@gmail.com" error={errors.email} />

      <Field label="Password" id="password" name="password"
        type={showPw ? 'text' : 'password'} value={form.password}
        onChange={onChange} placeholder="••••••••••" error={errors.password}>
        <div className="absolute top-1/2 -translate-y-1/2 right-3 flex items-center gap-2">
          {strength.label && (
            <span className={`text-[11px] font-bold ${
              strength.label === 'Strong' ? 'text-success' :
              strength.label === 'Fair'   ? 'text-warning' : 'text-destructive'
            }`}>{strength.label}</span>
          )}
          <button type="button" onClick={() => setShowPw(v => !v)} className="text-muted-foreground hover:text-foreground">
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {form.password && (
          <div className="absolute bottom-0 left-3.5 right-3.5 h-0.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
          </div>
        )}
      </Field>

      <button type="submit" disabled={loading}
        className="w-full py-3 rounded-xl bg-foreground text-background text-[13.5px] font-bold
                   hover:opacity-90 active:scale-[0.98] transition-all flex items-center
                   justify-center gap-2 shadow-md mt-1 tracking-[-0.01em]">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create your account →'}
      </button>

      <p className="text-center text-[13px] text-muted-foreground pt-0.5 font-medium">
        Already have an account?{' '}
        <button type="button" onClick={onSwitch} className="font-bold text-foreground hover:underline">
          Sign in
        </button>
      </p>
    </motion.form>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginPanel({ onSuccess, onSwitch }: { onSuccess: () => void; onSwitch: () => void }) {
  const { login } = useAuth();
  const [form, setForm]     = useState({ username: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (await login(form.username, form.password)) onSuccess();
    } catch (err) { logger.error('Login:', err); }
    finally { setLoading(false); }
  };

  return (
    <motion.form onSubmit={onSubmit}
      initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.18 }}
      className="space-y-3">

      <Field label="Username or Email" id="username" name="username" value={form.username}
        onChange={onChange} placeholder="robert.fox@gmail.com" />

      <Field label="Password" id="password" name="password"
        type={showPw ? 'text' : 'password'} value={form.password}
        onChange={onChange} placeholder="••••••••••">
        <button type="button" onClick={() => setShowPw(v => !v)}
          className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground hover:text-foreground">
          {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </Field>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-border accent-primary" />
        <span className="text-[12.5px] text-muted-foreground font-medium">Remember me</span>
      </label>

      <button type="submit" disabled={loading}
        className="w-full py-3 rounded-xl bg-foreground text-background text-[13.5px] font-bold
                   hover:opacity-90 active:scale-[0.98] transition-all flex items-center
                   justify-center gap-2 shadow-md mt-1 tracking-[-0.01em]">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in →'}
      </button>

      <p className="text-center text-[13px] text-muted-foreground pt-0.5 font-medium">
        Don't have an account?{' '}
        <button type="button" onClick={onSwitch} className="font-bold text-foreground hover:underline">
          Sign up
        </button>
      </p>
    </motion.form>
  );
}
