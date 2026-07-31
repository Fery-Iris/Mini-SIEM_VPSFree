import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { FeatureSection } from './components/FeatureSection';
import { FeatureCardsSection } from './components/FeatureCardsSection';
import { FaqSection } from './components/faq';
import { Footer } from './components/Footer';
import { Login } from './components/Login';
import SignInPage from './components/SignInPage';
import { Dashboard } from './components/Dashboard';
import { DetectionPanel } from './components/DetectionPanel';
import { BlockedPanel } from './components/BlockedPanel';
import { GetApiKey } from './components/GetApiKey';
import { DocumentationPage } from './components/DocumentationPage';
import { clearToken } from './utils/auth';

function MainApp() {
  const navigate = useNavigate();

  // Persist userEmail in localStorage so it persists on page refreshes
  const [userEmail, setUserEmail] = useState(() => {
    return localStorage.getItem('userEmail') || '';
  });

  useEffect(() => {
    if (userEmail) {
      localStorage.setItem('userEmail', userEmail);
    } else {
      localStorage.removeItem('userEmail');
    }
  }, [userEmail]);

  const handleLogout = () => {
    setUserEmail('');
    clearToken();
    localStorage.removeItem('adminId');
    localStorage.removeItem('orgId');
    localStorage.removeItem('orgName');
    navigate('/signin');
  };

  const handleNavigate = (page: string) => {
    if (page === 'home') navigate('/');
    else navigate(`/${page}`);
  };

  return (
    <Routes>
      {/* Landing Page */}
      <Route path="/" element={
        <div className="min-h-screen font-sans bg-slate-50 text-slate-900 selection:bg-blue-200">
          <Navbar onGetDemo={() => navigate('/signin')} />
          <main>
            <Hero onGetDemo={() => navigate('/signin')} />
            <FeatureSection />
            <FeatureCardsSection />
            <FaqSection />
          </main>
          <Footer />
        </div>
      } />

      {/* Documentation */}
      <Route path="/docs" element={<DocumentationPage />} />

      {/* Auth */}
      <Route path="/login" element={
        <Login
          onLogin={(email) => {
            setUserEmail(email);
            navigate('/dashboard');
          }}
        />
      } />

      {/* Sign Up / Sign In Page */}
      <Route path="/signin" element={
        <SignInPage onAuthSuccess={(data) => {
          setUserEmail(data.email);
          navigate('/dashboard');
        }} />
      } />

      {/* Protected-ish routes (In real app, we'd add an AuthGuard here) */}
      <Route path="/dashboard" element={
        <Dashboard userEmail={userEmail} onLogout={handleLogout} onNavigate={handleNavigate} />
      } />

      <Route path="/detection" element={
        <DetectionPanel userEmail={userEmail} onLogout={handleLogout} onNavigate={handleNavigate} />
      } />

      <Route path="/blocked" element={
        <BlockedPanel userEmail={userEmail} onLogout={handleLogout} onNavigate={handleNavigate} />
      } />

      <Route path="/apikey" element={
        <GetApiKey userEmail={userEmail} onLogout={handleLogout} onNavigate={handleNavigate} />
      } />
    </Routes>
  );
}

function App() {
  return (
    <LanguageProvider>
      <Router>
        <MainApp />
      </Router>
    </LanguageProvider>
  );
}

export default App;

