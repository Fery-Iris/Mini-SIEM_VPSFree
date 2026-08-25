'use client';
import type { FC, FormEvent } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { AnimatedCircles } from './AnimatedCircles';
import { LanguageToggle } from './LanguageToggle';

interface LoginProps {
  onLogin?: (email: string) => void;
}

export const Login: FC<LoginProps> = ({ onLogin }) => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const API = '';
      const response = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        onLogin?.(data.email || email);
        localStorage.setItem('token', data.token);
        router.push('/dashboard');
      } else {
        setError(data.message || 'Invalid credentials.');
      }
    } catch (err) {
      console.error('Request failed:', err);
      setError('Cannot connect to server. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#f8fafc] font-sans selection:bg-blue-200">

      {/* Left Marketing Section */}
      <div className="relative w-full lg:w-[55%] bg-slate-950 overflow-hidden flex flex-col justify-end p-8 lg:p-16 min-h-[500px] lg:min-h-screen group">

        {/* Futuristic Space Background / Glows */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-950 to-blue-950 opacity-90"></div>
          {/* Subtle star/particle noise */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.06] mix-blend-overlay"></div>
          {/* Glowing orbs */}
          <div className="absolute top-[20%] left-[20%] w-[500px] h-[500px] bg-blue-500/10 blur-[100px] rounded-full"></div>
          <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-indigo-500/15 blur-[100px] rounded-full"></div>
          {/* Cyber network lines placeholder */}
          <div className="absolute inset-0 opacity-[0.1] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.3)_1px,transparent_1px)] bg-[size:24px_24px] mask-image-[radial-gradient(ellipse_at_top,black_40%,transparent_100%)] bg-fixed" style={{ WebkitMaskImage: 'radial-gradient(ellipse at top, rgba(0,0,0,1) 0%, transparent 70%)' }}></div>
        </div>

        {/* Dashboard Mockups Grid (Background effect) */}
        <div className="absolute inset-x-0 top-0 h-[60%] lg:h-[70%] z-0 overflow-hidden opacity-30 lg:opacity-40 transition-opacity duration-1000 group-hover:opacity-50 pointer-events-none">
          {/* A fake skewed grid of dashboards */}
          <div className="absolute -top-10 -left-10 right-0 bottom-0 grid grid-cols-2 lg:grid-cols-3 gap-4 transform scale-110 rotate-1 origin-center">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl overflow-hidden aspect-video flex flex-col">
                <div className="h-3 border-b border-slate-800 bg-slate-950/50 flex gap-1 px-2 items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                </div>
                <div className="flex-1 p-2 flex gap-2">
                  <div className="w-1/4 h-full bg-slate-800/50 rounded-md"></div>
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="w-2/3 h-2 bg-slate-800/80 rounded-full"></div>
                    <div className="w-full h-1/2 bg-blue-900/20 rounded-md border border-slate-800"></div>
                    <div className="w-1/2 h-2 bg-indigo-900/30 rounded-full mt-auto"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Falloff gradient so the mockups fade into the bottom dark part */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/60 to-slate-950"></div>
        </div>

        {/* Logo at Top Left */}
        <div className="absolute top-8 left-8 lg:top-12 lg:left-12 z-20 flex items-center gap-2">
          <img src="/logo-siem.png" alt="Mini-SIEM Logo" className="h-10 w-auto" />
          <span className="text-xl font-bold text-white tracking-tight drop-shadow-md">
            MicroGaze
          </span>
        </div>

        {/* Animated Circles Full Background */}
        <AnimatedCircles />

        {/* Text Content */}
        <div className="relative z-20 max-w-xl">
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white mb-6 tracking-tight leading-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-blue-100 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
              4x
            </span> Your Threat Visibility
          </h1>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-slate-300 text-base lg:text-lg leading-snug">
                <strong className="text-white font-semibold">The most advanced SIEM platform</strong> <br />
                for real-time threat monitoring and response
              </p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-slate-300 text-base lg:text-lg leading-snug">
                <strong className="text-white font-semibold">Secure your entire organization</strong> <br />
                with cutting-edge AI and automation
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Form Section */}
      <div className="w-full lg:w-[45%] flex flex-col bg-white min-h-screen relative">
        <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto px-6 py-12 lg:px-8">

          {/* Subtle bottom clouds overlay for the form like reference image (Optional aesthetic) */}
          <div className="absolute bottom-0 left-0 right-0 h-[400px] pointer-events-none overflow-hidden opacity-60 z-0">
            <div className="absolute bottom-[-100px] left-[-100px] w-[300px] h-[300px] bg-blue-100/50 rounded-full blur-[60px] mix-blend-multiply"></div>
            <div className="absolute bottom-[-50px] right-[-100px] w-[400px] h-[400px] bg-indigo-50/50 rounded-full blur-[80px] mix-blend-multiply"></div>
          </div>

          <div className="relative z-10">
            <h2 className="text-[28px] lg:text-[32px] font-bold text-slate-800 tracking-tight mb-8">
              Login to MicroGaze
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium animate-[shake_0.3s_ease-in-out]">
                  <AlertCircle size={18} className="shrink-0" />
                  {error}
                </div>
              )}

      

              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800" htmlFor="email">
                  Email
                </label>
                <div className="w-full relative">
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. john@example.com"
                    className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 font-medium shadow-sm shadow-slate-100/50"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800" htmlFor="password">
                  Password
                </label>
                <div className="w-full relative">
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    className="w-full px-4 py-3.5 pr-12 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 font-medium shadow-sm shadow-slate-100/50"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                    <Lock size={18} strokeWidth={2.5} />
                  </div>
                </div>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 mt-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Logging in...
                  </span>
                ) : (
                  'Login'
                )}
              </button>

              {/* Remember me & Forgot Password */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 transition-colors cursor-pointer"
                  />
                  <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800 transition-colors">
                    Remember me
                  </span>
                </label>

                <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-all">
                  Forgot password?
                </a>
              </div>
            </form>

            {/* Divider */}
            <div className="relative flex items-center mt-8 mb-6">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Google OAuth Button */}
            <a
              href="/api/auth/google"
              id="google-login-btn"
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98] group"
            >
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

            <div className="mt-6 text-center">
              <p className="text-sm font-medium text-slate-600">
                Don&apos;t have an account?{' '}
                <a href="/login" className="text-blue-600 hover:text-blue-800 hover:underline font-semibold transition-colors">
                  Sign up
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-auto py-6 flex justify-center items-center gap-3 sm:gap-4 text-xs font-semibold text-slate-400 relative z-10 w-full px-4">
          <a href="#" className="hover:text-slate-600 transition-colors">Terms</a>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <a href="#" className="hover:text-slate-600 transition-colors">Privacy</a>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <a href="#" className="hover:text-slate-600 transition-colors">Help</a>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <LanguageToggle variant="light" />
        </div>
      </div>

    </div>
  );
};

