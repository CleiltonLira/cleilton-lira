import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Service, Booking, Settings, View, ToastData, Category, Professional, Feedback, Notification } from './types';

// Feedback Sonoro Suave (Web Audio API nativo)
export function playNotificationChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    
    // Nota 1 (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.45);

    // Nota 2 (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.22, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.75);
  } catch {}
}

export function playFinishSound() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.16, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.6);
    });
  } catch {}
}

interface AppContextType {
  view: View;
  setView: (view: View) => void;
  user: User | null;
  toast: ToastData | null;
  showToast: (message: string, type: 'success' | 'error') => void;
  login: (identifier: string, password?: string, honeypotTrap?: string, formLoadedAt?: number) => Promise<boolean>;
  loginWithGoogle: (googleData: { credential?: string; googleId?: string; email?: string; name?: string; avatarUrl?: string; referralCodeInput?: string }) => Promise<boolean>;
  logout: () => void;
  register: (name: string, phone: string, cpf: string, password?: string, referralCodeInput?: string, honeypotTrap?: string, formLoadedAt?: number) => Promise<boolean>;
  updateProfile: (name: string, phone: string) => Promise<boolean>;
  refreshUser: () => Promise<void>;
  categories: Category[];
  addCategory: (name: string) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  services: Service[];
  addService: (service: Omit<Service, 'id'>) => Promise<void>;
  updateService: (id: string, service: Partial<Service>) => Promise<void>;
  removeService: (id: string) => Promise<void>;
  professionals: Professional[];
  addProfessional: (prof: Omit<Professional, 'id'>) => Promise<void>;
  updateProfessional: (id: string, prof: Partial<Professional>) => Promise<void>;
  removeProfessional: (id: string) => Promise<void>;
  feedbacks: Feedback[];
  addFeedback: (fb: Omit<Feedback, 'id' | 'createdAt'>) => Promise<void>;
  notifications: Notification[];
  markNotificationRead: (id: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  updateLoyaltyStamps: (userId: string, stamps: number) => Promise<void>;
  updateReferralStamps: (userId: string, stamps: number) => Promise<void>;
  bookings: (Booking & { clientPhone?: string; clientName?: string })[];
  addBooking: (booking: Omit<Booking, 'id' | 'status'>) => Promise<{ error?: string; booking?: Booking }>;
  updateBookingStatus: (id: string, status: Booking['status'], startedAt?: string) => Promise<void>;
  updatePaymentStatus: (id: string, paymentStatus: string) => Promise<void>;
  cancelBooking: (id: string) => Promise<void>;
  rescheduleBooking: (id: string, date: string, time: string) => Promise<string | undefined>;
  settings: Settings | null;
  updateSettings: (settings: Settings) => Promise<void>;
  refreshBookings: () => Promise<void>;
  bookingPreselectedServices: string[];
  setBookingPreselectedServices: (ids: string[]) => void;
  isPromoActiveInBooking: boolean;
  setIsPromoActiveInBooking: (active: boolean) => void;
  hasUserRedeemedPromo: boolean;
  applyPromoAndGoToBooking: () => void;
  themeMode: 'light' | 'dark';
  toggleTheme: () => void;
  newBookingAlert: (Booking & { clientPhone?: string; clientName?: string; clientCpf?: string }) | null;
  setNewBookingAlert: (b: (Booking & { clientPhone?: string; clientName?: string; clientCpf?: string }) | null) => void;
  clientArrivalAlert: (Booking & { clientPhone?: string; clientName?: string; clientCpf?: string }) | null;
  setClientArrivalAlert: (b: (Booking & { clientPhone?: string; clientName?: string; clientCpf?: string }) | null) => void;
  markClientArrived: (id: string) => Promise<boolean>;
  confirmClientPresence: (id: string, confirmedBy?: string) => Promise<boolean>;
  startServiceWithPresence: (id: string) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>('home');
  const [user, setUser] = useState<User | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [bookingPreselectedServices, setBookingPreselectedServices] = useState<string[]>([]);
  const [isPromoActiveInBooking, setIsPromoActiveInBooking] = useState<boolean>(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('bb_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('bb_theme', themeMode);
  }, [themeMode]);

  const toggleTheme = () => {
    setThemeMode(prev => prev === 'light' ? 'dark' : 'light');
  };
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [bookings, setBookings] = useState<(Booking & { clientPhone?: string; clientName?: string })[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [newBookingAlert, setNewBookingAlert] = useState<(Booking & { clientPhone?: string; clientName?: string; clientCpf?: string }) | null>(null);
  const [clientArrivalAlert, setClientArrivalAlert] = useState<(Booking & { clientPhone?: string; clientName?: string; clientCpf?: string }) | null>(null);
  const knownBookingIdsRef = useRef<Set<string>>(new Set());
  const knownClientArrivedIdsRef = useRef<Set<string>>(new Set());
  const initialBookingsLoadedRef = useRef<boolean>(false);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchInitialData = async () => {
    try {
      const [svcRes, setRes, catRes, profRes, fbRes] = await Promise.all([
        fetch('/api/services'),
        fetch('/api/settings'),
        fetch('/api/categories'),
        fetch('/api/professionals'),
        fetch('/api/feedbacks')
      ]);
      setServices(await svcRes.json());
      setSettings(await setRes.json());
      setCategories(await catRes.json());
      setProfessionals(await profRes.json());
      setFeedbacks(await fbRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  const refreshNotifications = async () => {
    if (!user) return;
    try {
      // Check admin or client notifications
      const userId = user.role === 'admin' ? 'admin' : user.id;
      const res = await fetch(`/api/notifications/${userId}`);
      if (res.ok) setNotifications(await res.json());
    } catch (e) { console.error(e); }
  };

  const refreshUser = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/users/${user.id}`);
      if (res.ok) {
        const freshUser = await res.json();
        setUser(freshUser);
      }
    } catch (e) { console.error(e); }
  };

  const refreshBookings = async () => {
    try {
      const bkgRes = await fetch('/api/bookings');
      if (!bkgRes.ok) return;
      const data: (Booking & { clientPhone?: string; clientName?: string; clientCpf?: string })[] = await bkgRes.json();

      // Se já carregou inicialmente, verificar se há novo agendamento ou chegada de cliente ao salão
      if (initialBookingsLoadedRef.current) {
        const newlyArrived = data.find(b => !knownBookingIdsRef.current.has(b.id) && b.status === 'pending');
        if (newlyArrived) {
          setNewBookingAlert(newlyArrived);
          try {
            playNotificationChime();
          } catch {}
        }

        // Alerta em tempo real para a administradora quando a cliente marca presença/chegada
        const newlyClientArrived = data.find(
          b => b.clientArrived && !b.presenceConfirmed && !knownClientArrivedIdsRef.current.has(b.id) && b.status !== 'completed' && b.status !== 'cancelled'
        );
        if (newlyClientArrived) {
          knownClientArrivedIdsRef.current.add(newlyClientArrived.id);
          setClientArrivalAlert(newlyClientArrived);
          try {
            playNotificationChime();
          } catch {}
        }
      }

      data.forEach(b => {
        knownBookingIdsRef.current.add(b.id);
        if (b.presenceConfirmed || b.status === 'completed' || b.status === 'cancelled') {
          knownClientArrivedIdsRef.current.add(b.id);
        }
      });
      initialBookingsLoadedRef.current = true;
      setBookings(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchInitialData();
    const savedUser = localStorage.getItem('bb_currentUser');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        if (parsed.id) {
          fetch(`/api/users/${parsed.id}`)
            .then(r => r.ok ? r.json() : null)
            .then(fresh => { if (fresh) setUser(fresh); })
            .catch(() => {});
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('bb_currentUser', JSON.stringify(user));
      refreshBookings(); // Fetch bookings when user logs in
      refreshNotifications(); // Fetch notifications
      
      // Polling periódico: administradoras e equipe atualizam a cada 6s para receber novos agendamentos imediatamente
      const isStaffOrAdmin = user.role === 'admin' || user.role === 'staff';
      const pollIntervalTime = isStaffOrAdmin ? 6000 : 25000;
      const interval = setInterval(() => {
        refreshBookings();
        refreshNotifications();
      }, pollIntervalTime);
      return () => clearInterval(interval);
    } else {
      localStorage.removeItem('bb_currentUser');
    }
  }, [user]);

  const login = async (identifier: string, password?: string, honeypotTrap?: string, formLoadedAt?: number) => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          phone: identifier,
          cpf: identifier,
          password,
          _hp_trap: honeypotTrap,
          _form_loaded_at: formLoadedAt
        })
      });
      if (res.ok) {
        const loggedUser = await res.json();
        setUser(loggedUser);
        setView((loggedUser.role === 'admin' || loggedUser.role === 'staff') ? 'admin' : 'client');
        showToast('Login realizado com sucesso.', 'success');
        return true;
      } else {
        const errorData = await res.json();
        showToast(errorData.error || 'Erro ao fazer login.', 'error');
        return false;
      }
    } catch (e) {
      showToast('Erro de conexão.', 'error');
      return false;
    }
  };

  const register = async (
    name: string,
    phone: string,
    cpf: string,
    password?: string,
    referralCodeInput?: string,
    honeypotTrap?: string,
    formLoadedAt?: number
  ) => {
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          cpf,
          password,
          referralCodeInput,
          _hp_trap: honeypotTrap,
          _form_loaded_at: formLoadedAt
        })
      });
      if (res.ok) {
        const loggedUser = await res.json();
        setUser(loggedUser);
        setView('client');
        showToast('Cadastro realizado com sucesso.', 'success');
        return true;
      } else {
        const errorData = await res.json();
        showToast(errorData.error || 'Erro ao registrar.', 'error');
        return false;
      }
    } catch (e) {
      showToast('Erro de conexão.', 'error');
      return false;
    }
  };

  const loginWithGoogle = async (googleData: { credential?: string; googleId?: string; email?: string; name?: string; avatarUrl?: string; referralCodeInput?: string }) => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(googleData)
      });
      if (res.ok) {
        const loggedUser = await res.json();
        setUser(loggedUser);
        setView(loggedUser.role === 'admin' ? 'admin' : 'client');
        showToast(`Bem-vinda, ${loggedUser.name || 'Cliente'}! Acesso Google realizado com sucesso ✨`, 'success');
        return true;
      } else {
        const errorData = await res.json();
        showToast(errorData.error || 'Erro ao conectar com conta Google.', 'error');
        return false;
      }
    } catch (e) {
      showToast('Erro de conexão ao autenticar com o Google.', 'error');
      return false;
    }
  };

  const updateProfile = async (name: string, phone: string) => {
    if (!user) return false;
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone })
      });
      if (res.ok) {
        const updatedUser = await res.json();
        setUser(updatedUser);
        showToast('Perfil atualizado com sucesso.', 'success');
        return true;
      } else {
        const errorData = await res.json();
        showToast(errorData.error || 'Erro ao atualizar perfil.', 'error');
        return false;
      }
    } catch (e) {
      showToast('Erro de conexão.', 'error');
      return false;
    }
  };

  const addCategory = async (name: string) => {
    try {
      const id = Math.random().toString(36).substring(7);
      const newCat = { id, name };
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCat)
      });
      setCategories(prev => [...prev, newCat]);
      showToast('Categoria adicionada.', 'success');
    } catch {
      showToast('Erro ao adicionar categoria.', 'error');
    }
  };

  const removeCategory = async (id: string) => {
    try {
      await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      setCategories(prev => prev.filter(c => c.id !== id));
      showToast('Categoria removida.', 'success');
    } catch {
      showToast('Erro ao remover categoria.', 'error');
    }
  };

  const logout = () => {
    setUser(null);
    setView('home');
  };

  const addService = async (service: Omit<Service, 'id'>) => {
    try {
      const id = Math.random().toString(36).substring(7);
      const newService = { ...service, id };
      await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newService)
      });
      setServices(prev => [...prev, newService]);
      showToast('Alteração concluída! Procedimento cadastrado com sucesso.', 'success');
    } catch {
      showToast('Erro ao adicionar serviço.', 'error');
    }
  };

  const updateService = async (id: string, service: Partial<Service>) => {
    try {
      await fetch(`/api/services/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(service)
      });
      setServices(prev => prev.map(s => s.id === id ? { ...s, ...service } : s));
      showToast('Alteração concluída com sucesso!', 'success');
    } catch {
      showToast('Erro ao atualizar serviço.', 'error');
    }
  };

  const removeService = async (id: string) => {
    try {
      await fetch(`/api/services/${id}`, { method: 'DELETE' });
      setServices(prev => prev.filter(s => s.id !== id));
      showToast('Serviço removido.', 'success');
    } catch {
      showToast('Erro ao remover serviço.', 'error');
    }
  };

  const addProfessional = async (prof: Omit<Professional, 'id'>) => {
    try {
      const id = Math.random().toString(36).substring(7);
      const newProf = { ...prof, id };
      await fetch('/api/professionals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProf)
      });
      setProfessionals(prev => [...prev, newProf]);
      showToast('Profissional adicionada com sucesso!', 'success');
    } catch {
      showToast('Erro ao adicionar.', 'error');
    }
  };

  const updateProfessional = async (id: string, prof: Partial<Professional>) => {
    try {
      await fetch(`/api/professionals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prof)
      });
      setProfessionals(prev => prev.map(p => p.id === id ? { ...p, ...prof } : p));
      showToast('Profissional e credenciais atualizadas!', 'success');
    } catch {
      showToast('Erro ao atualizar profissional.', 'error');
    }
  };

  const removeProfessional = async (id: string) => {
    try {
      await fetch(`/api/professionals/${id}`, { method: 'DELETE' });
      setProfessionals(prev => prev.filter(p => p.id !== id));
      showToast('Profissional removida.', 'success');
    } catch {
      showToast('Erro ao remover.', 'error');
    }
  };

  const addFeedback = async (fb: Omit<Feedback, 'id' | 'createdAt'>) => {
    try {
      const id = Math.random().toString(36).substring(7);
      const newFb = { 
        ...fb, 
        id, 
        userName: user?.name || 'Cliente Bella',
        createdAt: new Date().toISOString() 
      };
      await fetch('/api/feedbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFb)
      });
      setFeedbacks(prev => [newFb, ...prev]);
      showToast('Sua avaliação foi publicada com sucesso! Muito obrigado pelo carinho 💖', 'success');
    } catch {
      showToast('Erro ao enviar avaliação.', 'error');
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const updateLoyaltyStamps = async (userId: string, stamps: number) => {
    try {
      await fetch(`/api/users/${userId}/loyalty`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stamps })
      });
      if (user && user.id === userId) {
        setUser({ ...user, loyaltyStamps: stamps });
      }
      showToast('Cartela de fidelidade atualizada.', 'success');
    } catch {
      showToast('Erro ao atualizar cartela.', 'error');
    }
  };

  const updateReferralStamps = async (userId: string, stamps: number) => {
    try {
      await fetch(`/api/users/${userId}/referral`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stamps })
      });
      if (user && user.id === userId) {
        setUser({ ...user, referralStamps: stamps });
      }
      showToast('Cartela de indicação atualizada.', 'success');
    } catch {
      showToast('Erro ao atualizar cartela de indicação.', 'error');
    }
  };

  const addBooking = async (booking: Omit<Booking, 'id' | 'status'>): Promise<{ error?: string; booking?: Booking }> => {
    const id = Math.random().toString(36).substring(7);
    const newBooking: Booking = { 
      ...booking, 
      id, 
      status: 'pending' as const,
      clientName: user?.name,
      clientPhone: user?.phone,
      clientCpf: user?.cpf
    };
    
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBooking)
      });

      if (!res.ok) {
        const errorData = await res.json();
        showToast(errorData.error || 'Erro ao realizar agendamento.', 'error');
        return { error: errorData.error || 'Erro ao realizar agendamento.' };
      }

      setBookings(prev => [newBooking, ...prev.filter(b => b.id !== newBooking.id)]);
      await refreshBookings();
      showToast('Agendamento realizado com sucesso!', 'success');
      return { booking: newBooking };
    } catch {
      showToast('Erro de conexão ao agendar.', 'error');
      return { error: 'Erro de conexão ao agendar.' };
    }
  };

  const updateBookingStatus = async (id: string, status: Booking['status'], startedAt?: string) => {
    try {
      const res = await fetch(`/api/bookings/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, startedAt })
      });
      const data = await res.json();
      setBookings(prev => prev.map(b => b.id === id ? { 
        ...b, 
        status,
        startedAt: status === 'in_progress' ? (data.startedAt || startedAt || new Date().toISOString()) : b.startedAt
      } : b));
      
      if (data.updatedLoyalty && user && user.id === data.updatedLoyalty.userId) {
        setUser(prev => prev ? { ...prev, loyaltyStamps: data.updatedLoyalty.stamps } : null);
      }
      
      if (data.wasCourtesyOrBonus) {
        showToast('Atendimento de cortesia/bônus concluído! (Não pontua na carteirinha de fidelidade).', 'success');
      } else if (status === 'completed') {
        showToast('Atendimento finalizado com sucesso! Selo marcado na carteirinha.', 'success');
      } else if (status === 'in_progress') {
        showToast('Atendimento colocado em andamento! Cronômetro de duração iniciado.', 'success');
      } else {
        showToast(`Status atualizado para ${status}.`, 'success');
      }
    } catch {
      showToast('Erro ao atualizar status.', 'error');
    }
  };

  const updatePaymentStatus = async (id: string, paymentStatus: string) => {
    try {
      await fetch(`/api/bookings/${id}/payment-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus })
      });
      setBookings(prev => prev.map(b => b.id === id ? { ...b, paymentStatus } : b));
      showToast('Pagamento validado e confirmado com sucesso!', 'success');
    } catch {
      showToast('Erro ao validar pagamento.', 'error');
    }
  };

  const cancelBooking = async (id: string) => {
    try {
      await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
      showToast('Agendamento cancelado com sucesso.', 'success');
    } catch {
      showToast('Erro ao cancelar agendamento.', 'error');
    }
  };

  const rescheduleBooking = async (id: string, date: string, time: string) => {
    try {
      const res = await fetch(`/api/bookings/${id}/reschedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, time })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        showToast(errorData.error, 'error');
        return errorData.error;
      }
      
      setBookings(prev => prev.map(b => b.id === id ? { ...b, date, time } : b));
      showToast('Horário reagendado com sucesso!', 'success');
      return undefined;
    } catch {
      showToast('Erro ao reagendar.', 'error');
      return 'Erro de conexão';
    }
  };

  const markClientArrived = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/bookings/${id}/client-arrived`, { method: 'PUT' });
      if (res.ok) {
        const data = await res.json();
        setBookings(prev => prev.map(b => b.id === id ? {
          ...b,
          clientArrived: true,
          clientArrivedAt: data.clientArrivedAt || new Date().toISOString()
        } : b));
        await refreshBookings();
        showToast('Presença confirmada! A equipe do salão foi notificada da sua chegada.', 'success');
        return true;
      }
      showToast('Não foi possível registrar a chegada.', 'error');
      return false;
    } catch {
      showToast('Erro de conexão ao registrar chegada.', 'error');
      return false;
    }
  };

  const confirmClientPresence = async (id: string, confirmedBy?: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/bookings/${id}/confirm-presence`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedBy: confirmedBy || user?.name || 'Administração' })
      });
      if (res.ok) {
        const data = await res.json();
        setBookings(prev => prev.map(b => b.id === id ? {
          ...b,
          clientArrived: true,
          presenceConfirmed: true,
          presenceConfirmedAt: data.presenceConfirmedAt || new Date().toISOString(),
          presenceConfirmedBy: confirmedBy || user?.name || 'Administração'
        } : b));
        knownClientArrivedIdsRef.current.add(id);
        if (clientArrivalAlert && clientArrivalAlert.id === id) {
          setClientArrivalAlert(null);
        }
        await refreshBookings();
        showToast('Presença validada com sucesso! Pagamento e QR Code liberados.', 'success');
        return true;
      }
      return false;
    } catch {
      showToast('Erro ao confirmar presença.', 'error');
      return false;
    }
  };

  const startServiceWithPresence = async (id: string): Promise<boolean> => {
    try {
      const nowIso = new Date().toISOString();
      // 1. Confirma presença
      await fetch(`/api/bookings/${id}/confirm-presence`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedBy: user?.name || 'Administração' })
      });
      // 2. Inicia o atendimento
      const res = await fetch(`/api/bookings/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress', startedAt: nowIso })
      });
      if (res.ok) {
        const data = await res.json();
        setBookings(prev => prev.map(b => b.id === id ? {
          ...b,
          status: 'in_progress',
          clientArrived: true,
          presenceConfirmed: true,
          startedAt: data.startedAt || nowIso
        } : b));
        knownClientArrivedIdsRef.current.add(id);
        if (clientArrivalAlert && clientArrivalAlert.id === id) {
          setClientArrivalAlert(null);
        }
        await refreshBookings();
        showToast('Presença confirmada e atendimento iniciado! Cronômetro ativado.', 'success');
        return true;
      }
      return false;
    } catch {
      showToast('Erro ao iniciar atendimento.', 'error');
      return false;
    }
  };

  const handleUpdateSettings = async (newSettings: Settings) => {
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      setSettings(newSettings);
      showToast('Configurações salvas com sucesso.', 'success');
    } catch {
      showToast('Erro ao salvar configurações.', 'error');
    }
  };

  // Verifica se a cliente já resgatou a campanha de promoção da semana ativa
  const hasUserRedeemedPromo = Boolean(
    user &&
    settings?.promoActive &&
    bookings.some(b => {
      if (b.status === 'cancelled') return false;
      if (!b.isPromo) return false;
      const isSameUser = b.userId === user.id || Boolean(user.phone && b.clientPhone && b.clientPhone === user.phone);
      if (!isSameUser) return false;
      const currentPromoId = settings.promoId || 'promo_default';
      return !b.promoId || b.promoId === currentPromoId || b.promoId === 'promo_default';
    })
  );

  const applyPromoAndGoToBooking = () => {
    if (settings && settings.promoActive) {
      if (hasUserRedeemedPromo) {
        showToast('Você já resgatou esta promoção da semana! Seus novos agendamentos são pelo valor normal.', 'success');
        setBookingPreselectedServices([]);
        setIsPromoActiveInBooking(false);
        setView('booking');
        return;
      }
      const promoServiceIds = (settings.promoServices || []).map(p => p.serviceId);
      if (promoServiceIds.length > 0) {
        setBookingPreselectedServices(promoServiceIds);
      } else if (settings.promoService) {
        const match = services.find(s => s.name.toLowerCase() === settings.promoService?.toLowerCase());
        if (match) setBookingPreselectedServices([match.id]);
      }
      setIsPromoActiveInBooking(true);
    }
    setView('booking');
  };

  return (
    <AppContext.Provider value={{
      view, setView,
      user, toast, showToast, login, loginWithGoogle, logout, register, updateProfile, refreshUser,
      categories, addCategory, removeCategory,
      services, addService, updateService, removeService,
      professionals, addProfessional, updateProfessional, removeProfessional,
      feedbacks, addFeedback,
      notifications, markNotificationRead, refreshNotifications,
      updateLoyaltyStamps, updateReferralStamps,
      bookings, addBooking, updateBookingStatus, updatePaymentStatus, cancelBooking, rescheduleBooking, refreshBookings,
      settings, updateSettings: handleUpdateSettings,
      bookingPreselectedServices, setBookingPreselectedServices,
      isPromoActiveInBooking, setIsPromoActiveInBooking,
      hasUserRedeemedPromo,
      applyPromoAndGoToBooking,
      themeMode, toggleTheme,
      newBookingAlert, setNewBookingAlert,
      clientArrivalAlert, setClientArrivalAlert,
      markClientArrived, confirmClientPresence, startServiceWithPresence
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
