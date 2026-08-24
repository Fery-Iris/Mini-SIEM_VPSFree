/**
 * SignInPage Component
 *
 * Description:
 * Handles both Sign In and Registration (Daftar) in a single UI.
 *
 * Features:
 * - Toggle between login and registration
 * - Creates organization + user automatically
 * - Redirects to dashboard after authentication
 * - Enables self-service API key generation
 *
 * Notes:
 * - No separate register page is used
 * - Designed for SaaS onboarding flow
 */

import type { FC, FormEvent } from 'react';
import { useState } from 'react';
import {
  User,
  Mail,
  Lock,
  CheckCircle2,
  Eye,
  EyeOff,
  Building2,
  ArrowRight,
} from 'lucide-react';
import { AnimatedCircles } from './AnimatedCircles';
import { setToken } from '../utils/auth';
import { useLanguage } from '../contexts/LanguageContext';
import { LanguageToggle } from './LanguageToggle';

type AuthMode = 'signin' | 'daftar';

interface SignInPageProps {
  onAuthSuccess?: (data: {
    email: string;
    adminId: number;
    organizationId: number;
    organizationName: string;
  }) => void;
}

const API = '';

const SignInPage: FC<SignInPageProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('signin');
  const { t } = useLanguage();

  // Shared fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Daftar-only fields
  const [orgName, setOrgName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setError('');
    setSuccess(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'daftar') {
      if (!orgName.trim()) { setError(t('signin.orgRequired')); return; }
      if (password.length < 8) { setError(t('signin.minPassword')); return; }
      if (password !== confirmPassword) { setError(t('signin.passwordMismatch')); return; }
    } else {
      //Kondisi/validasi hanya untuk signin
      if (!email.trim()) { setError(t('signin.emailRequired')); return; }
      if (!password) { setError(t('signin.passwordRequired')); return; }
    }

    setIsLoading(true);

    try {
      if (mode === 'daftar') {
        const res = await fetch(`${API}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationName: orgName.trim(), email: email.trim(), password }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || t('signin.regFailed')); setIsLoading(false); return; }

        setSuccess(true);
        // Do not auto-login and set token. Wait for email verification instead.
      } else {
        const res = await fetch(`${API}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) { setError(data.message || data.error || t('signin.loginFailed')); setIsLoading(false); return; }

        setToken(data.token);
        localStorage.setItem('adminId', String(data.adminId));
        localStorage.setItem('userEmail', data.email);
        localStorage.setItem('orgId', String(data.organizationId || 0));
        localStorage.setItem('orgName', data.organizationName || '');
        onAuthSuccess?.({ email: data.email, adminId: data.adminId, organizationId: data.organizationId || 0, organizationName: data.organizationName || '' });
      }
    } catch {
      setError(t('signin.serverError'));
    } finally {
      setIsLoading(false);
    }
  };

  /* ───── Input style helper ───── */
  const inputClass = 'w-full px-4 py-3.5 pr-12 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 font-medium shadow-sm shadow-slate-100/50';

  return (
    <div className="min-h-screen w-full flex flex-col-reverse lg:flex-row bg-[#f8fafc] font-sans selection:bg-blue-200">

      {/* ═══ LEFT PANEL — Branding ═══ */}
      <div className="relative w-full lg:w-[55%] bg-slate-950 overflow-hidden flex flex-col justify-end p-8 lg:p-16 min-h-[480px] lg:min-h-screen group">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-950 to-blue-950 opacity-90" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.06] mix-blend-overlay" />
          <div className="absolute top-[20%] left-[20%] w-[500px] h-[500px] bg-blue-500/10 blur-[100px] rounded-full" />
          <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-indigo-500/15 blur-[100px] rounded-full" />
          <div className="absolute top-[60%] left-[50%] w-[300px] h-[300px] bg-violet-500/8 blur-[80px] rounded-full" />
          <div className="absolute inset-0 opacity-[0.1] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.3)_1px,transparent_1px)] bg-[size:24px_24px] bg-fixed" style={{ WebkitMaskImage: 'radial-gradient(ellipse at top, rgba(0,0,0,1) 0%, transparent 70%)' }} />
        </div>

        <div className="absolute inset-x-0 top-0 h-[60%] lg:h-[70%] z-0 overflow-hidden opacity-30 lg:opacity-40 transition-opacity duration-1000 group-hover:opacity-50 pointer-events-none">
          <div className="absolute -top-10 -left-10 right-0 bottom-0 grid grid-cols-2 lg:grid-cols-3 gap-4 transform scale-110 rotate-1 origin-center">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl overflow-hidden aspect-video flex flex-col">
                <div className="h-3 border-b border-slate-800 bg-slate-950/50 flex gap-1 px-2 items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                </div>
                <div className="flex-1 p-2 flex gap-2">
                  <div className="w-1/4 h-full bg-slate-800/50 rounded-md" />
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="w-2/3 h-2 bg-slate-800/80 rounded-full" />
                    <div className="w-full h-1/2 bg-blue-900/20 rounded-md border border-slate-800" />
                    <div className="w-1/2 h-2 bg-indigo-900/30 rounded-full mt-auto" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/60 to-slate-950" />
        </div>

        <div className="absolute top-8 left-8 lg:top-12 lg:left-12 z-20 flex items-center gap-2">
          <img src="/logo-siem.png" alt="Mini-SIEM Logo" className="h-10 w-auto" />
          <span className="text-xl font-bold text-white tracking-tight drop-shadow-md">MicroGaze</span>
        </div>

        <AnimatedCircles />

        <div className="relative z-20 max-w-xl">
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white mb-6 tracking-tight leading-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-blue-100 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
              {mode === 'daftar' ? t('signin.startFree') : t('signin.4x')}
            </span>{' '}
            {mode === 'daftar' ? t('signin.hassleFree') : t('signin.visibility')}
          </h1>

          <div className="space-y-4">
            {mode === 'daftar' ? (
              <>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-slate-300 text-base lg:text-lg leading-snug">
                    <strong className="text-white font-semibold">{t('signin.signUp30')}</strong><br />
                    {t('signin.signUp30Desc')}
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-slate-300 text-base lg:text-lg leading-snug">
                    <strong className="text-white font-semibold">{t('signin.selfGenerate')}</strong><br />
                    {t('signin.selfGenerateDesc')}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-slate-300 text-base lg:text-lg leading-snug">
                    <strong className="text-white font-semibold">{t('signin.feature1.title')}</strong><br />
                    {t('signin.feature1.desc')}
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-slate-300 text-base lg:text-lg leading-snug">
                    <strong className="text-white font-semibold">{t('signin.feature2.title')}</strong><br />
                    {t('signin.feature2.desc')}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ═══ RIGHT PANEL — Form ═══ */}
      <div className="w-full lg:w-[45%] flex flex-col bg-white min-h-screen relative">
        <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto px-6 py-12 lg:px-8">

          <div className="absolute bottom-0 left-0 right-0 h-[400px] pointer-events-none overflow-hidden opacity-60 z-0">
            <div className="absolute bottom-[-100px] left-[-100px] w-[300px] h-[300px] bg-blue-100/50 rounded-full blur-[60px] mix-blend-multiply" />
            <div className="absolute bottom-[-50px] right-[-100px] w-[400px] h-[400px] bg-indigo-50/50 rounded-full blur-[80px] mix-blend-multiply" />
          </div>

          <div className="relative z-10">
            {/* ── Tab Toggle ── */}
            <div className="flex bg-slate-100 rounded-xl p-1 mb-8">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === 'signin'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t('signin.signIn')}
              </button>
              <button
                type="button"
                onClick={() => switchMode('daftar')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === 'daftar'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t('signin.signUp')}
              </button>
            </div>

            {/* ── Header ── */}
            <h2 className="text-[28px] lg:text-[32px] font-bold text-slate-800 tracking-tight mb-2">
              {mode === 'signin' ? t('signin.welcomeBack') : t('signin.createAccount')}
            </h2>
            <p className="text-sm text-slate-500 mb-8">
              {mode === 'signin'
                ? t('signin.signInDesc')
                : t('signin.signUpDesc')}
            </p>

            {/* ── Success State (Daftar) ── */}
            {success ? (
              <div className="flex flex-col items-center text-center py-10">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 size={40} className="text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">{t('signin.verificationSent')}</h3>
                <p className="text-sm text-slate-500">{t('signin.verificationDesc')}</p>
                <div className="mt-6">
                  <button type="button" onClick={() => switchMode('signin')} className="px-6 py-2.5 bg-blue-50 text-blue-600 font-semibold rounded-lg hover:bg-blue-100 transition-colors">{t('signin.backToLogin')}</button>
                </div>
              </div>
            ) : (
              <>
                {/* ── Error ── */}
                {error && (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium mb-5">
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </div>
                )}

                {/* ── Form ── */}
                <form onSubmit={handleSubmit} className="space-y-5">

                  {/* Nama Instansi (Daftar only) */}
                  {mode === 'daftar' && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-800" htmlFor="signin-orgname">{t('signin.orgName')}</label>
                      <div className="w-full relative">
                        <input id="signin-orgname" type="text" required value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder={t('signin.orgPlaceholder')} className={inputClass} />
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                          <Building2 size={18} strokeWidth={2.5} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Full Name (Sign In — hidden, kept for layout consistency) */}
                  {mode === 'signin' && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-800" htmlFor="signin-fullname">Email</label>
                      <div className="w-full relative">
                        <input id="signin-fullname" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. your@gmail.com" className={inputClass} />
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                          <User size={18} strokeWidth={2.5} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Email (Daftar only) */}
                  {mode === 'daftar' && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-800" htmlFor="signin-email">Email</label>
                      <div className="w-full relative">
                        <input id="signin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. you@company.com" className={inputClass} />
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                          <Mail size={18} strokeWidth={2.5} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-800" htmlFor="signin-password">Password</label>
                    <div className="w-full relative">
                      <input id="signin-password" type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'daftar' ? t('signin.minChars') : t('signin.enterPassword')} className="w-full px-4 py-3.5 pr-20 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 font-medium shadow-sm shadow-slate-100/50" />
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center gap-2">
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-slate-600 transition-colors focus:outline-none">
                          {showPassword ? <EyeOff size={18} strokeWidth={2.5} /> : <Eye size={18} strokeWidth={2.5} />}
                        </button>
                        <Lock size={18} strokeWidth={2.5} className="text-slate-400" />
                      </div>
                    </div>
                  </div>

                  {/* Confirm Password (Daftar only) */}
                  {mode === 'daftar' && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-800" htmlFor="signin-confirm-password">Confirm Password</label>
                      <div className="w-full relative">
                        <input id="signin-confirm-password" type={showConfirmPassword ? 'text' : 'password'} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" className="w-full px-4 py-3.5 pr-20 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 font-medium shadow-sm shadow-slate-100/50" />
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center gap-2">
                          <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="text-slate-400 hover:text-slate-600 transition-colors focus:outline-none">
                            {showConfirmPassword ? <EyeOff size={18} strokeWidth={2.5} /> : <Eye size={18} strokeWidth={2.5} />}
                          </button>
                          <Lock size={18} strokeWidth={2.5} className="text-slate-400" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    id="signin-submit-btn"
                    className={`w-full py-3.5 mt-2 rounded-xl font-semibold shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                      mode === 'daftar'
                        ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-emerald-500/30 hover:shadow-emerald-500/40 focus:ring-emerald-500'
                        : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-blue-500/30 hover:shadow-blue-500/40 focus:ring-blue-500'
                    }`}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        {mode === 'daftar' ? t('signin.processing') : t('signin.signingIn')}
                      </span>
                    ) : mode === 'daftar' ? (
                      <>{t('signin.signUpNow')} <ArrowRight size={18} strokeWidth={2.5} /></>
                    ) : (
                      t('signin.signIn')
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative flex items-center my-7">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Google OAuth Button */}
                <a
                  href="/api/auth/google"
                  id="google-signin-btn"
                  className="w-full flex items-center justify-center gap-3 py-3.5 px-4 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98] group"
                >
                  {/* Google Logo SVG */}
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="group-hover:text-slate-900 transition-colors">
                    Continue with Google
                  </span>
                </a>

                {/* Footer Link */}
                <div className="mt-8 text-center">
                  <p className="text-sm font-medium text-slate-600">
                    {mode === 'signin' ? (
                      <>{t('signin.noAccount')}{' '}<button type="button" onClick={() => switchMode('daftar')} className="text-blue-600 hover:text-blue-800 hover:underline font-semibold transition-colors">{t('signin.signUp')}</button></>
                    ) : (
                      <>{t('signin.haveAccount')}{' '}<button type="button" onClick={() => switchMode('signin')} className="text-blue-600 hover:text-blue-800 hover:underline font-semibold transition-colors">{t('signin.signIn')}</button></>
                    )}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bottom Footer Links */}
        <div className="mt-auto py-6 flex justify-center items-center gap-3 sm:gap-4 text-xs font-semibold text-slate-400 relative z-10 w-full px-4">
          <a href="#" className="hover:text-slate-600 transition-colors">Terms</a>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <a href="#" className="hover:text-slate-600 transition-colors">Privacy</a>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <a href="#" className="hover:text-slate-600 transition-colors">Help</a>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <LanguageToggle variant="light" />
        </div>
      </div>
    </div>
  );
};

export default SignInPage;
