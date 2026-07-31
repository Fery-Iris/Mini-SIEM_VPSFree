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
            XR Security
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
              Login to XR Security
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium animate-[shake_0.3s_ease-in-out]">
                  <AlertCircle size={18} className="shrink-0" />
                  {error}
                </div>
              )}

              {/* Demo Credentials Hint */}
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium">
                <Shield size={16} className="shrink-0" />
                <span>Demo: <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">admin@xrsecurity.com</code> / <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">demo1234</code></span>
              </div>

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

            <div className="mt-8 text-center">
              <p className="text-sm font-medium text-slate-600">
                Don't have an account?{' '}
                <a href="#" className="text-blue-600 hover:text-blue-800 hover:underline font-semibold transition-colors">
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

