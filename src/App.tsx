import { AppProvider, useApp } from './store';
import { Header } from './components/Header';
import { Home } from './components/Home';
import { Auth } from './components/Auth';
import { Booking } from './components/Booking';
import { Client } from './components/Client';
import { Admin } from './components/Admin';
import { Profile } from './components/Profile';
import { Footer } from './components/Footer';
import { Toast } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';

function AppContent() {
  const { view, settings } = useApp();

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950">
        <div className="w-12 h-12 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  const themeColor = settings?.themeColor || 'rose';

  return (
    <div className={`min-h-screen flex flex-col bg-stone-50/90 dark:bg-stone-950 text-stone-800 dark:text-stone-100 selection:bg-rose-200 dark:selection:bg-rose-900 transition-colors duration-200 theme-${themeColor}`}>
      <Header />
      
      <main className="flex-1 w-full">
        {view === 'home' && <Home />}
        {(view === 'login' || view === 'register') && <Auth />}
        {view === 'booking' && <Booking />}
        {view === 'client' && <Client />}
        {view === 'admin' && <Admin />}
        {view === 'profile' && <Profile />}
      </main>

      <Footer />
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
