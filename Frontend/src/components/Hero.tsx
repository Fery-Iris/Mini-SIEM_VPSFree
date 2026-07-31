import { useState, useEffect } from 'react';
import { Button } from './Button';
import { Shield, Activity, BarChart3, Settings, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useLanguage } from '../contexts/LanguageContext';

interface HeroProps { //what is interface heroprops? In TypeScript, an interface is a way to define the shape of an object. The HeroProps interface defines the expected properties that can be passed to the Hero component. In this case, it specifies that the Hero component can optionally receive a prop called onGetDemo, which is a function that takes no arguments and returns void (i.e., it doesn't return anything). This allows the Hero component to have a type-safe way of handling props and ensures that any component using Hero will know what props are expected.
  onGetDemo?: () => void; //ongetdemo function does nothing right now, yes? Correct, the onGetDemo function is defined as an optional prop in the HeroProps interface, and it is currently set to do nothing (it has an empty function body). This means that when the "Get Free Demo" button is clicked, if the onGetDemo prop is not provided, it will simply do nothing. However, if a parent component passes a function to onGetDemo, that function will be executed when the button is clicked.
}

let hasIncremented = false;

export const Hero: React.FC<HeroProps> = ({ onGetDemo }) => { // what does export const Hero: React.FC<HeroProps> = ({ onGetDemo }) => { do? This line defines a React functional component named Hero. The component is typed with React.FC (which stands for React Functional Component) and is given the type of its props as HeroProps. This means that the Hero component expects to receive props that match the shape defined in the HeroProps interface. The component takes an optional prop called onGetDemo, which is a function that can be called when the "Get Free Demo" button is clicked. The component returns JSX that represents the structure and styling of the hero section of a webpage, including a background image, headline, description, and call-to-action buttons.
  const [isRequesting, setIsRequesting] = useState(false);
  const [visitorCount, setVisitorCount] = useState(1243);
  const heroLeft = useScrollReveal<HTMLDivElement>();
  const heroRight = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });
  const { t } = useLanguage();

  useEffect(() => {
    // Hitung berdasarkan berapa kali halaman di-refresh di browser ini
    // Memastikan tidak terhitung ganda (bertambah 2) akibat React 18 Strict Mode di tahap Development
    if (!hasIncremented) {
      const localVisits = parseInt(localStorage.getItem('pageVisits') || '0', 10);
      const newVisits = localVisits + 1;
      localStorage.setItem('pageVisits', newVisits.toString());
      setVisitorCount(100 + newVisits);
      hasIncremented = true;
    } else {
      // Jika komponen dirender ulang oleh Strict Mode, cukup baca nilainya tanpa menambah
      const localVisits = parseInt(localStorage.getItem('pageVisits') || '0', 10);
      setVisitorCount(100 + localVisits);
    }
  }, []);

  const handleGetDemoClick = async () => {
    setIsRequesting(true);
    try {
      // Explicitly send an HTTP request to the server (e.g., a 'demo-interest' log)
      const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'hero_section',
          action: 'demo_interest',
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        // Upon a successful response, redirect the user to the login page
        if (onGetDemo) {
          onGetDemo();
        }
      } else {
        console.error('Failed to register demo interest.');
      }
    } catch (error) {
      console.error('Network footprint failed:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <section className="relative pt-20 pb-32 overflow-hidden z-10">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 bg-[url('/BG1.png')] bg-cover bg-center bg-no-repeat opacity-100 bg-breathe"></div>

        {/* Optional light overlay to ensure text readability */}
        <div className="absolute inset-0 bg-white/20"></div>
      </div>

      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-8">

          {/* Left Column: Content */}
          <div
            ref={heroLeft.ref}
            className={`w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left z-10 scroll-fade-left scroll-hidden ${heroLeft.isVisible ? 'scroll-revealed' : ''}`}
          >
            <h1 className="text-4xl md:text-5xl lg:text-[54px] font-extrabold text-slate-800 leading-[1.15] tracking-tight mb-6">
              {t('hero.title1')} <br className="hidden md:block" />
              {t('hero.title2')}<span className="text-blue-500"></span> <br className="hidden md:block" />
              <span className="text-blue-600">Mini-SIEM</span>
            </h1>

            <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl font-normal leading-relaxed">
              {t('feature.check1')}, <br className="hidden md:block" />
              {t('feature.check2')}<br className="hidden md:block" />
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <Button
                variant="yellow"
                className="w-full sm:w-auto px-8 py-4 text-base font-bold text-slate-900 rounded-xl shadow-lg shadow-amber-400/30 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                onClick={handleGetDemoClick} // Calls network footprint function before redirecting
                disabled={isRequesting}
              >
                {isRequesting ? t('hero.pleaseWait') : t('hero.getFreeDemo')}
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-blue-600 border-slate-200 bg-white/50 backdrop-blur-sm rounded-xl hover:bg-slate-50 hover:text-blue-700 transition-all shadow-sm"
                onClick={() => document.getElementById('demo-video-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                {t('hero.watchDemo')}
              </Button>
            </div>

            {/* Live Visitors Widget */}
            <div className="mt-10 flex flex-col sm:flex-row items-center sm:items-start gap-4 min-h-[64px]">
              <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md px-5 py-3 rounded-2xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all cursor-default">
                <div className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-semibold text-slate-700 leading-none">
                    <span className="text-emerald-600 font-bold tabular-nums">{visitorCount.toLocaleString()}</span> total visits
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium mt-1">Real-time monitoring</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Illustration Placeholder */}
          <div
            ref={heroRight.ref}
            className={`w-full lg:w-1/2 relative min-h-[450px] lg:min-h-[550px] flex justify-center items-center z-10 mt-10 lg:mt-0 scroll-fade-right scroll-hidden ${heroRight.isVisible ? 'scroll-revealed' : ''}`}
          >

            {/* Base "Laptop/Dashboard" mockup layer */}
            <div className="absolute lg:right-0 w-[95%] sm:w-[85%] lg:w-[110%] aspect-[16/10] bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
              {/* Fake browser/app header */}
              <div className="h-4 bg-slate-50 border-b border-slate-100 flex items-center px-4 gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
              </div>
              {/* Main dashboard body placeholder */}
              <div className="flex-1 bg-slate-50/50 p-4 sm:p-6 grid grid-cols-3 grid-rows-3 gap-3 sm:gap-4 relative">
                {/* Dashboard blocks */}
                <div className="col-span-2 row-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3">
                  <div className="w-1/3 h-3 bg-slate-100 rounded-full"></div>
                  <div className="w-full h-full bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg flex items-end p-2 gap-2">
                    {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
                      <div key={i} className="flex-1 bg-blue-200 rounded-t-sm" style={{ height: `${h}%` }}></div>
                    ))}
                  </div>
                </div>
                <div className="col-span-1 row-span-1 bg-white rounded-xl border border-slate-100 shadow-sm p-3 flex flex-col justify-center items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center">
                    <AlertTriangle size={16} />
                  </div>
                  <div className="w-1/2 h-2 bg-slate-100 rounded-full"></div>
                </div>
                <div className="col-span-1 row-span-1 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md p-3 flex flex-col justify-between text-white">
                  <div className="flex justify-between items-start">
                    <ShieldCheck size={20} className="text-blue-100" />
                    <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">+12%</span>
                  </div>
                  <div className="text-sm font-medium">System Secure</div>
                </div>
                <div className="col-span-3 row-span-1 bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <Activity size={20} />
                    </div>
                    <div className="space-y-1.5">
                      <div className="w-24 h-2.5 bg-slate-200 rounded-full"></div>
                      <div className="w-16 h-2 bg-slate-100 rounded-full"></div>
                    </div>
                  </div>
                  <div className="w-20 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                    <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Central 3D Shield Element */}
            <div className="absolute z-20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] sm:-translate-y-1/2">
              <div className="relative">
                {/* Glowing aura */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 sm:w-48 sm:h-48 bg-blue-400 rounded-full mix-blend-screen filter blur-[40px] opacity-70"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64 bg-cyan-300 rounded-full mix-blend-screen filter blur-[60px] opacity-40"></div>

                {/* Shield container */}
                <div className="w-32 h-32 sm:w-40 sm:h-40 bg-gradient-to-br from-blue-400 via-blue-500 to-cyan-400 rounded-3xl shadow-[0_20px_50px_-12px_rgba(59,130,246,0.6)] flex items-center justify-center relative overflow-hidden ring-4 ring-white/50 backdrop-blur-sm transform rotate-3">
                  {/* Glass reflection */}
                  <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent"></div>

                  <Shield size={64} className="text-white drop-shadow-lg" strokeWidth={1.5} />

                  {/* Inner lightning detail */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 blur-md rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Glass Widgets */}
            <div className="absolute -left-4 sm:left-4 lg:-left-12 top-10 sm:top-20 z-30 animate-[bounce_4s_infinite]">
              <div className="bg-white/80 backdrop-blur-md p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-xl shadow-slate-200/50 border border-white/60 flex items-center gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <Activity size={20} />
                </div>
              </div>
            </div>

            <div className="absolute right-0 sm:-right-4 lg:-right-6 top-1/4 sm:top-1/3 z-30 animate-[bounce_5s_infinite_0.5s]">
              <div className="bg-white/80 backdrop-blur-md p-3 rounded-xl sm:rounded-2xl shadow-xl shadow-slate-200/50 border border-white/60">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-500">
                  <ShieldCheck size={24} />
                </div>
              </div>
            </div>

            <div className="absolute left-6 sm:left-10 lg:left-0 bottom-10 z-30 animate-[bounce_6s_infinite_1s]">
              <div className="bg-white/80 backdrop-blur-md py-2 px-3 sm:py-3 sm:px-4 rounded-xl shadow-xl shadow-blue-900/5 border border-white/60 flex items-center gap-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <BarChart3 size={16} />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="w-12 sm:w-16 h-1.5 sm:h-2 bg-slate-200 rounded-full"></div>
                  <div className="w-8 sm:w-10 h-1.5 sm:h-2 bg-slate-100 rounded-full"></div>
                </div>
              </div>
            </div>

            <div className="absolute right-10 sm:right-20 bottom-0 sm:-bottom-4 z-30 animate-[bounce_4.5s_infinite_0.2s]">
              <div className="bg-white/80 backdrop-blur-md p-2.5 sm:p-3 rounded-xl shadow-xl shadow-slate-200/50 border border-white/60">
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                  <Settings size={18} />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};
