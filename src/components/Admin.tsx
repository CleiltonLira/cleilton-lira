import React, { useState, useEffect, useRef } from 'react';
import { useApp, playFinishSound } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Settings2, CalendarCheck, Trash2, LogOut, MessageCircle, Edit2, X, 
  Tag, Zap, Link as LinkIcon, Database, CheckCircle2, Lock, List, Users, 
  Gift, FileText, Clock, Share2, Palette, Sparkles, Heart, Check, Sun, Moon,
  Timer, Play, Copy, CheckCheck, Search, FolderPlus, Maximize2, CreditCard, RotateCcw,
  KeyRound, Shield, UserCheck, Eye, EyeOff, UserPlus, Bell, Camera, UserCircle,
  Download, ShieldAlert, FileArchive, TrendingUp, QrCode
} from 'lucide-react';
import { Service, Booking as BookingType, Professional, AdminAreaPermission } from '../types';
import { BookingReceiptModal } from './BookingReceiptModal';
import { FinancialManagement } from './FinancialManagement';
import { generatePixQrCodeDataUrl } from '../utils/pix';

export const ADMIN_MODULES: { id: AdminAreaPermission; label: string; description: string; icon: any }[] = [
  { id: 'bookings', label: 'Agendamentos', description: 'Agenda, confirmações e atendimentos em tempo real', icon: CalendarCheck },
  { id: 'financial', label: 'Gestão & Balancetes', description: 'Faturamento, despesas, balancetes e lucros', icon: TrendingUp },
  { id: 'services', label: 'Serviços & Catálogo', description: 'Procedimentos, categorias, valores e tempos', icon: Sparkles },
  { id: 'professionals', label: 'Equipe & Acessos', description: 'Cadastro da equipe, logins e permissões', icon: Users },
  { id: 'studio', label: 'Estúdio & Galeria', description: 'Sobre o espaço e fotos da galeria', icon: Camera },
  { id: 'clients', label: 'Clientes', description: 'Lista de clientes, contatos e histórico', icon: UserCircle },
  { id: 'loyalty', label: 'Fidelidade', description: 'Cartão fidelidade e carimbos/selos', icon: Gift },
  { id: 'referral', label: 'Indicação & Bônus', description: 'Programa de indicação de amigas e metas', icon: Share2 },
  { id: 'personalization', label: 'Personalização', description: 'Aparência, cores e temas claro/escuro', icon: Palette },
  { id: 'promo', label: 'Promoção', description: 'Ofertas da semana e avisos WhatsApp', icon: Zap },
  { id: 'schedule', label: 'Horários e Dias', description: 'Dias de atendimento e horários', icon: Clock },
  { id: 'settings', label: 'Dados & Pagamento', description: 'Telefone, endereço, Chave PIX e dados', icon: Settings2 },
];

export function Admin() {
  const { 
    user, settings, updateSettings, categories, addCategory, removeCategory, 
    services, addService, updateService, removeService, 
    bookings, updateBookingStatus, updatePaymentStatus, cancelBooking, rescheduleBooking, logout,
    professionals, addProfessional, updateProfessional, removeProfessional, 
    updateLoyaltyStamps, updateReferralStamps, themeMode, toggleTheme,
    showToast, newBookingAlert, setNewBookingAlert
  } = useApp();

  const [activeTab, setActiveTab] = useState<
    'bookings' | 'services' | 'categories' | 'schedule' | 'settings' | 
    'promo' | 'loyalty' | 'referral' | 'personalization' | 'professionals' | 'studio' | 'clients' | 'financial'
  >('bookings');

  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const autoCompletedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (activeTab === 'clients') {
      fetch('/api/users')
        .then(r => r.json())
        .then(setClients)
        .catch(console.error);
    }
  }, [activeTab]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);

      // Finalização automática de atendimentos em andamento quando o tempo estimado termina
      bookings.forEach(b => {
        if (b.status === 'in_progress' && b.startedAt && !autoCompletedIdsRef.current.has(b.id)) {
          const bServices = services.filter(s => (b.serviceIds || [b.serviceId]).includes(s.id));
          const totalDurationMinutes = bServices.reduce((sum, s) => sum + (s.duration || 60), 0) || 60;
          const startedAtMs = new Date(b.startedAt).getTime();
          const elapsedSec = Math.floor((now - startedAtMs) / 1000);
          const totalDurationSec = totalDurationMinutes * 60;

          if (elapsedSec >= totalDurationSec) {
            autoCompletedIdsRef.current.add(b.id);
            updateBookingStatus(b.id, 'completed');
            showToast(
              `Tempo estimado finalizado (${totalDurationMinutes} min)! O atendimento de ${b.clientName || 'Cliente'} foi finalizado automaticamente.`,
              'success'
            );
            try {
              playFinishSound();
            } catch (err) {
              console.error(err);
            }
          }
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [bookings, services, updateBookingStatus, showToast]);

  const [newService, setNewService] = useState({ name: '', category: '', duration: 60, price: 0 });
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [serviceSuccessNotice, setServiceSuccessNotice] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Unificação Serviços & Catálogo: filtros e busca
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string>('all');
  const [serviceSearchTerm, setServiceSearchTerm] = useState<string>('');
  const [showAddCategoryInline, setShowAddCategoryInline] = useState<boolean>(false);

  const [newProf, setNewProf] = useState<{ 
    name: string; 
    phone: string; 
    username: string; 
    password: string; 
    permissions: AdminAreaPermission[];
  }>({ 
    name: '', 
    phone: '', 
    username: '', 
    password: '', 
    permissions: ['bookings'] 
  });
  const [editingProf, setEditingProf] = useState<Professional | null>(null);

  // Controle de Acesso aos Módulos / Abas por Perfil
  const userPermissions: AdminAreaPermission[] = React.useMemo(() => {
    if (user?.role === 'admin') {
      return [
        'bookings', 'financial', 'services', 'professionals', 'studio', 
        'clients', 'loyalty', 'referral', 'personalization', 'promo', 'schedule', 'settings'
      ];
    }
    if (Array.isArray(user?.permissions) && user.permissions.length > 0) {
      return user.permissions as AdminAreaPermission[];
    }
    return ['bookings'];
  }, [user]);

  const hasAccess = (area: AdminAreaPermission) => {
    if (user?.role === 'admin') return true;
    return userPermissions.includes(area);
  };

  useEffect(() => {
    if (user?.role === 'staff') {
      const allowed = activeTab === 'categories' ? hasAccess('services') : hasAccess(activeTab as AdminAreaPermission);
      if (!allowed) {
        const first = userPermissions[0] || 'bookings';
        setActiveTab(first as any);
      }
    }
  }, [user, userPermissions, activeTab]);

  // Helpers para Seleção de Permissões no Formulário de Funcionárias
  const currentProfPerms: AdminAreaPermission[] = editingProf 
    ? (editingProf.permissions && editingProf.permissions.length > 0 ? (editingProf.permissions as AdminAreaPermission[]) : ['bookings'])
    : newProf.permissions;

  const toggleProfPerm = (permId: AdminAreaPermission) => {
    if (editingProf) {
      const existing = (editingProf.permissions && editingProf.permissions.length > 0 ? editingProf.permissions : ['bookings']) as AdminAreaPermission[];
      const next = existing.includes(permId)
        ? existing.filter(p => p !== permId)
        : [...existing, permId];
      setEditingProf({
        ...editingProf,
        permissions: next.length > 0 ? next : ['bookings']
      });
    } else {
      const existing = newProf.permissions || ['bookings'];
      const next = existing.includes(permId)
        ? existing.filter(p => p !== permId)
        : [...existing, permId];
      setNewProf({
        ...newProf,
        permissions: next.length > 0 ? next : ['bookings']
      });
    }
  };

  const selectAllProfPerms = () => {
    const all = ADMIN_MODULES.map(m => m.id);
    if (editingProf) {
      setEditingProf({ ...editingProf, permissions: all });
    } else {
      setNewProf({ ...newProf, permissions: all });
    }
  };

  const selectBasicProfPerms = () => {
    const basic: AdminAreaPermission[] = ['bookings', 'clients'];
    if (editingProf) {
      setEditingProf({ ...editingProf, permissions: basic });
    } else {
      setNewProf({ ...newProf, permissions: basic });
    }
  };

  const clearProfPerms = () => {
    const min: AdminAreaPermission[] = ['bookings'];
    if (editingProf) {
      setEditingProf({ ...editingProf, permissions: min });
    } else {
      setNewProf({ ...newProf, permissions: min });
    }
  };

  // Admin Credentials Change State
  const [adminUsername, setAdminUsername] = useState(user?.username || 'admin');
  const [adminCurrentPassword, setAdminCurrentPassword] = useState('');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [adminSavingCredentials, setAdminSavingCredentials] = useState(false);
  const [showAdminPass, setShowAdminPass] = useState(false);

  const [rescheduleModal, setRescheduleModal] = useState<{ id: string, date: string, time: string } | null>(null);
  const [receiptBooking, setReceiptBooking] = useState<BookingType | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [newTimeSlotInput, setNewTimeSlotInput] = useState('');
  const [bookingCategoryFilter, setBookingCategoryFilter] = useState<'all' | 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'>('all');
  const [clientHistoryModal, setClientHistoryModal] = useState<{ name: string; phone?: string; cpf?: string; userId?: string } | null>(null);

  // Estados para Download do Pacote ZIP e Painel de Segurança Anti-Robô
  const [zipGenerating, setZipGenerating] = useState(false);
  const [securityStatsData, setSecurityStatsData] = useState<any>(null);

  const fetchSecurityStats = () => {
    fetch('/api/security/status')
      .then(r => r.json())
      .then(setSecurityStatsData)
      .catch(() => {});
  };

  useEffect(() => {
    if (activeTab === 'settings') {
      fetchSecurityStats();
    }
  }, [activeTab]);

  // Estados para Geração Automática do QR Code Pix
  const [pixQrDataUrl, setPixQrDataUrl] = useState<string>('');
  const [pixPayloadStr, setPixPayloadStr] = useState<string>('');
  const [copiedPixKey, setCopiedPixKey] = useState(false);
  const [copiedPixPayload, setCopiedPixPayload] = useState(false);

  const handleDownloadPublicationZip = () => {
    window.location.href = '/api/admin/download-publication-zip?techLogin=cleiltonlira&techPass=21061994';
    showToast('Download do pacote ZIP iniciado com credenciais do técnico!', 'success');
  };

  const handleRegenerateZip = async () => {
    setZipGenerating(true);
    try {
      const res = await fetch('/api/admin/generate-publication-zip', { 
        method: 'POST',
        headers: {
          'x-technician-auth': 'tech_cleiltonlira_21061994'
        }
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Pacote ZIP gerado com sucesso (${data.sizeFormatted})!`, 'success');
        fetchSecurityStats();
      } else {
        showToast(data.error || 'Erro ao gerar ZIP.', 'error');
      }
    } catch {
      showToast('Falha na comunicação com o servidor.', 'error');
    } finally {
      setZipGenerating(false);
    }
  };

  // Promo Catalog Selection State (com duração personalizada e compartilhamento WhatsApp)
  const [selectedPromoServiceId, setSelectedPromoServiceId] = useState('');
  const [selectedPromoDiscountPercent, setSelectedPromoDiscountPercent] = useState<number>(20);
  const [selectedPromoDurationMinutes, setSelectedPromoDurationMinutes] = useState<number>(60);
  const [copiedPromoWhatsapp, setCopiedPromoWhatsapp] = useState(false);
  const [copiedServiceWhatsappId, setCopiedServiceWhatsappId] = useState<string | null>(null);

  // Daily Schedule Management State
  const [selectedDayTab, setSelectedDayTab] = useState<number>(1); // 1 = Segunda
  const [daySlotInput, setDaySlotInput] = useState<string>('');

  const defaultDailySchedules: Record<number, { enabled: boolean; slots: string[] }> = {
    0: { enabled: false, slots: ['09:00', '10:00', '11:00', '12:00', '13:00'] }, // Domingo
    1: { enabled: true, slots: ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'] }, // Segunda
    2: { enabled: true, slots: ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'] }, // Terça
    3: { enabled: true, slots: ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'] }, // Quarta
    4: { enabled: true, slots: ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'] }, // Quinta
    5: { enabled: true, slots: ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'] }, // Sexta
    6: { enabled: true, slots: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'] }, // Sábado
  };

  const getDaySchedule = (day: number) => {
    if (localSettings.dailySchedules && localSettings.dailySchedules[day]) {
      return localSettings.dailySchedules[day];
    }
    const enabled = localSettings.availableDays ? localSettings.availableDays.includes(day) : defaultDailySchedules[day].enabled;
    const slots = (localSettings.availableTimeSlots && localSettings.availableTimeSlots.length > 0)
      ? localSettings.availableTimeSlots
      : defaultDailySchedules[day].slots;
    return { enabled, slots: [...slots] };
  };

  const updateDaySchedule = (day: number, data: { enabled?: boolean; slots?: string[] }) => {
    const current = getDaySchedule(day);
    const updated = {
      ...current,
      ...data,
      slots: (data.slots !== undefined ? data.slots : current.slots).sort()
    };
    const newDaily = {
      ...(localSettings.dailySchedules || defaultDailySchedules),
      [day]: updated
    };
    const newAvailableDays = Object.entries(newDaily)
      .filter(([_, sched]) => (sched as { enabled: boolean; slots: string[] })?.enabled)
      .map(([d]) => Number(d))
      .sort((a, b) => a - b);

    setLocalSettings({
      ...localSettings,
      dailySchedules: newDaily,
      availableDays: newAvailableDays
    });
  };

  useEffect(() => {
    if (activeTab === 'loyalty' || activeTab === 'referral') {
      fetch('/api/users')
        .then(r => r.json())
        .then(setClients)
        .catch(console.error);
    }
  }, [activeTab]);

  const [localSettings, setLocalSettings] = useState(settings || { 
    name: '', subtitle: '', phone: '', address: '', instagram: '', hours: '',
    promoActive: false, promoTitle: '', promoDescription: '', promoImageUrl: '', promoEndsAt: '', promoService: '', promoPrice: '', promoDiscount: 0, promoServices: [],
    heroTitle: '', heroSubtitle: '', heroDescription: '', heroImageUrl: '', storeIconUrl: '',
    loyaltyActive: true, loyaltyMaxStamps: 10, loyaltyRewardText: 'Ganhe um serviço de cortesia!',
    loyaltyRewardType: 'free_service', loyaltyRewardServiceId: '', loyaltyRewardDiscountPercent: 100,
    referralActive: true, referralMaxStamps: 5, referralDiscountForReferred: 10, referralRewardText: 'Ganhe 1 serviço de cortesia ao completar as indicações!',
    themeColor: 'rose', welcomeMessage: 'Realçando sua beleza natural com carinho e delicadeza ✨',
    availableDays: [1, 2, 3, 4, 5, 6],
    availableTimeSlots: ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
    paymentTitle: 'Pagamento no ato do atendimento',
    paymentInstructions: 'O pagamento do seu procedimento não é cobrado agora pelo site. Você realiza o pagamento no ato do atendimento diretamente no salão (aceitamos Cartões de Crédito/Débito, PIX e Dinheiro).',
    paymentMethodsList: 'PIX, Cartão de Crédito/Débito e Dinheiro',
    paymentPixKey: '',
    studioAbout: '',
    studioPhotos: [],
    studioAmenities: [],
    studioPolicies: [],
    studioAddressNotes: '',
    studioMapsUrl: ''
  });

  const [newStudioPhoto, setNewStudioPhoto] = useState({
    url: '',
    title: '',
    tag: 'Recepção',
    caption: ''
  });

  const handleAddStudioPhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudioPhoto.url.trim() || !newStudioPhoto.title.trim()) return;
    const photoItem = {
      id: 'sp_' + Date.now(),
      url: newStudioPhoto.url.trim(),
      title: newStudioPhoto.title.trim(),
      tag: newStudioPhoto.tag || 'Recepção',
      caption: newStudioPhoto.caption.trim(),
      isCover: (localSettings.studioPhotos || []).length === 0
    };
    const updatedPhotos = [...(localSettings.studioPhotos || []), photoItem];
    setLocalSettings({ ...localSettings, studioPhotos: updatedPhotos });
    setNewStudioPhoto({ url: '', title: '', tag: 'Recepção', caption: '' });
  };

  const studioFileInputRef = useRef<HTMLInputElement>(null);

  const handleStudioPhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const autoTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setNewStudioPhoto(prev => ({ 
          ...prev, 
          url: reader.result as string,
          title: prev.title.trim() ? prev.title : (autoTitle || 'Foto do Studio')
        }));
        showToast('Foto selecionada com sucesso!', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteStudioPhoto = (id: string) => {
    const updatedPhotos = (localSettings.studioPhotos || []).filter(p => p.id !== id);
    setLocalSettings({ ...localSettings, studioPhotos: updatedPhotos });
  };

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  // Gera o QR Code Pix e Payload automaticamente quando a chave for digitada/alterada
  useEffect(() => {
    if (localSettings.paymentPixKey && localSettings.paymentPixKey.trim()) {
      generatePixQrCodeDataUrl(localSettings.paymentPixKey.trim(), {
        merchantName: localSettings.name || 'BELLA BEAUTY',
        width: 320
      }).then(res => {
        setPixQrDataUrl(res.dataUrl);
        setPixPayloadStr(res.payload);
      }).catch(() => {
        setPixQrDataUrl('');
        setPixPayloadStr('');
      });
    } else {
      setPixQrDataUrl('');
      setPixPayloadStr('');
    }
  }, [localSettings.paymentPixKey, localSettings.name]);

  const handlePromoChange = (field: string, value: any) => {
    const newSettings = { ...localSettings, [field]: value };
    
    if (field === 'promoService' || field === 'promoDiscount') {
      const serviceName = field === 'promoService' ? value : newSettings.promoService;
      const discount = field === 'promoDiscount' ? Number(value) : Number(newSettings.promoDiscount || 0);
      
      const selectedService = services.find(s => s.name === serviceName);
      if (selectedService) {
        if (discount > 0) {
          const newPrice = selectedService.price * (1 - (discount / 100));
          newSettings.promoPrice = `De R$ ${selectedService.price.toFixed(2).replace('.', ',')} por R$ ${newPrice.toFixed(2).replace('.', ',')}`;
        } else {
          newSettings.promoPrice = `R$ ${selectedService.price.toFixed(2).replace('.', ',')}`;
        }
      }
    }
    
    setLocalSettings(newSettings);
  };

  if (!user || user.role !== 'admin') return null;

  const handleOpenEditService = (service: Service) => {
    setEditingService({ ...service });
    setIsServiceModalOpen(true);
  };

  const handleOpenNewService = () => {
    setEditingService(null);
    setNewService({ 
      name: '', 
      category: categories.length > 0 ? categories[0].name : '', 
      duration: 60, 
      price: 0 
    });
    setIsServiceModalOpen(true);
  };

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newService.name.trim() || !newService.category) return;
    addService(newService);
    setNewService({ name: '', category: categories.length > 0 ? categories[0].name : '', duration: 60, price: 0 });
    setIsServiceModalOpen(false);
    showToast('Alteração concluída com sucesso!', 'success');
    setServiceSuccessNotice('Alteração concluída! Novo procedimento cadastrado no catálogo.');
    setTimeout(() => {
      setServiceSuccessNotice(null);
    }, 5000);
  };

  const handleUpdateService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService || !editingService.name.trim() || !editingService.category) return;
    updateService(editingService.id, editingService);
    setEditingService(null);
    setIsServiceModalOpen(false);
    showToast('Alteração concluída com sucesso!', 'success');
    setServiceSuccessNotice('Alteração concluída! O procedimento foi atualizado com sucesso no catálogo.');
    setTimeout(() => {
      setServiceSuccessNotice(null);
    }, 5000);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName) return;
    addCategory(newCategoryName);
    setNewCategoryName('');
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(localSettings);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalSettings({ ...localSettings, [field]: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const getWhatsAppLink = (phone: string | undefined) => {
    if (!phone) return '#';
    const cleanPhone = phone.replace(/\D/g, '');
    return `https://wa.me/55${cleanPhone}`;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto px-4 py-12">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-3xl font-serif text-stone-900 dark:text-stone-100">
              {user?.role === 'staff' ? 'Painel de Atendimento (Equipe)' : 'Painel de Controle'}
            </h2>
            <Sparkles size={20} className="text-rose-500" />
            {user?.role === 'staff' && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                Colaboradora: {user.name}
              </span>
            )}
          </div>
          <p className="text-stone-500 dark:text-stone-400 mt-1">
            {user?.role === 'staff' 
              ? 'Acompanhe os agendamentos das clientes, confirme presenças e inicie os atendimentos com carinho.'
              : 'Gerencie atendimentos, equipe, fidelidade, indicações, serviços e a personalização feminina do site.'}
          </p>
        </div>
        <button 
          onClick={logout}
          className="flex items-center gap-2 text-stone-500 hover:text-rose-600 transition-colors px-4 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-stone-800 w-fit cursor-pointer"
        >
          <LogOut size={18} /> Sair
        </button>
      </div>

      {/* Menu Superior de Abas (filtradas de acordo com as permissões da colaboradora ou acesso total admin) */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
        {hasAccess('bookings') && (
          <button 
            onClick={() => setActiveTab('bookings')}
            className={`px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'bookings' ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm' : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800'
            }`}
          >
            <CalendarCheck size={16} /> Agendamentos
          </button>
        )}
        {hasAccess('financial') && (
          <button 
            onClick={() => setActiveTab('financial')}
            className={`px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'financial' 
                ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-sm ring-2 ring-emerald-200 dark:ring-emerald-900' 
                : 'bg-white dark:bg-stone-900 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-stone-800 border border-emerald-200 dark:border-emerald-900'
            }`}
          >
            <TrendingUp size={16} /> Gestão & Balancetes
          </button>
        )}
        {hasAccess('services') && (
          <button 
            onClick={() => setActiveTab('services')}
            className={`px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'services' || activeTab === 'categories' ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm' : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800'
            }`}
          >
            <Sparkles size={16} /> Serviços & Catálogo
          </button>
        )}
        {hasAccess('professionals') && (
          <button 
            onClick={() => setActiveTab('professionals')}
            className={`px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'professionals' ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm' : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800'
            }`}
          >
            <Users size={16} /> Equipe & Acessos
          </button>
        )}
        {hasAccess('studio') && (
          <button 
            onClick={() => setActiveTab('studio')}
            className={`px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'studio' ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm' : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800'
            }`}
          >
            <Camera size={16} /> Estúdio
          </button>
        )}
        {hasAccess('clients') && (
          <button 
            onClick={() => setActiveTab('clients')}
            className={`px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'clients' ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm' : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800'
            }`}
          >
            <UserCircle size={16} /> Clientes
          </button>
        )}
        {hasAccess('loyalty') && (
          <button 
            onClick={() => setActiveTab('loyalty')}
            className={`px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'loyalty' ? 'bg-rose-600 text-white shadow-sm' : 'bg-white dark:bg-stone-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-stone-800 border border-rose-200 dark:border-rose-900'
            }`}
          >
            <Gift size={16} /> Fidelidade
          </button>
        )}
        {hasAccess('referral') && (
          <button 
            onClick={() => setActiveTab('referral')}
            className={`px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'referral' ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-sm' : 'bg-white dark:bg-stone-900 text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-stone-800 border border-pink-200 dark:border-pink-900'
            }`}
          >
            <Share2 size={16} /> Indicação & Bônus
          </button>
        )}
        {hasAccess('personalization') && (
          <button 
            onClick={() => setActiveTab('personalization')}
            className={`px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'personalization' ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm' : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800'
            }`}
          >
            <Palette size={16} /> Personalização do Site
          </button>
        )}
        {hasAccess('promo') && (
          <button 
            onClick={() => setActiveTab('promo')}
            className={`px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'promo' ? 'bg-rose-600 text-white' : 'bg-white dark:bg-stone-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 border border-rose-200 dark:border-rose-900'
            }`}
          >
            <Zap size={16} /> Promoção
          </button>
        )}
        {hasAccess('schedule') && (
          <button 
            onClick={() => setActiveTab('schedule')}
            className={`px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'schedule' ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900' : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-100 border border-stone-200 dark:border-stone-800'
            }`}
          >
            <Clock size={16} /> Horários e Dias
          </button>
        )}
        {hasAccess('settings') && (
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'settings' ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900' : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-100 border border-stone-200 dark:border-stone-800'
            }`}
          >
            <Settings2 size={16} /> Dados & Pagamento
          </button>
        )}
      </div>

      {/* ABA: GESTÃO & BALANCETES FINANCEIROS */}
      {activeTab === 'financial' && (
        <FinancialManagement 
          salonName={localSettings.name || 'Bella Beauty'} 
          showToast={showToast} 
        />
      )}

      {activeTab === 'studio' && (
        <div className="space-y-8 max-w-4xl">
          <form onSubmit={handleSaveSettings} className="bg-white dark:bg-stone-900 p-6 md:p-8 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-8">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
              <div>
                <h3 className="font-serif text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Camera className="text-rose-500" size={24} />
                  Gestão do Estúdio & Galeria de Fotos
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  Gerencie o texto institucional e adicione fotos para exibir na galeria pública do estúdio para as clientes.
                </p>
              </div>
              <button 
                type="submit" 
                className="bg-gradient-to-r from-rose-500 to-pink-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:from-rose-600 hover:to-pink-700 transition-all cursor-pointer shadow-md shadow-rose-200"
              >
                Publicar Alterações
              </button>
            </div>
            
            <div className="space-y-4">
              <label className="block text-xs font-semibold uppercase text-stone-700 dark:text-stone-300">Sobre o Estúdio (Apresentação)</label>
              <textarea 
                value={localSettings.studioAbout || ''} 
                onChange={e => setLocalSettings({...localSettings, studioAbout: e.target.value})} 
                placeholder="Ex: Nosso espaço foi cuidadosamente planejado..."
                className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm h-32 focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>
          </form>

          {/* Gerenciador de Fotos da Galeria */}
          <div className="bg-white dark:bg-stone-900 p-6 md:p-8 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-100">Galeria de Fotos do Estúdio</h4>
                <p className="text-xs text-stone-500 dark:text-stone-400">Adicione fotos reais do espaço, bancadas, recepção ou procedimentos.</p>
              </div>
              <span className="text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 px-3 py-1 rounded-full border border-rose-200 dark:border-rose-900">
                {(localSettings.studioPhotos || []).length} fotos cadastradas
              </span>
            </div>

            {/* Formulário para Adicionar Nova Foto */}
            <div className="bg-stone-50 dark:bg-stone-800/60 p-5 rounded-2xl border border-stone-200/80 dark:border-stone-700 space-y-4">
              <h5 className="text-xs font-bold uppercase text-stone-700 dark:text-stone-300">Adicionar Nova Foto à Galeria</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                    Escolher Foto do Aparelho / Galeria
                  </label>
                  <input 
                    ref={studioFileInputRef}
                    id="admin-studio-photo-input"
                    type="file"
                    accept="image/*"
                    onChange={handleStudioPhotoFile}
                    className="hidden"
                  />
                  <div 
                    onClick={() => studioFileInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-rose-300 dark:border-rose-700/60 bg-white dark:bg-stone-900 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 cursor-pointer transition-all text-center group shadow-2xs"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform border border-rose-200/60 dark:border-rose-900/40">
                      <Camera size={22} />
                    </div>
                    <p className="text-xs font-bold text-stone-800 dark:text-stone-100">
                      {newStudioPhoto.url ? 'Foto selecionada! Toque para trocar de foto' : 'Toque aqui para escolher a foto da sua galeria'}
                    </p>
                    <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
                      Abre as fotos do celular, galeria ou computador (PNG, JPG, WEBP)
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-stone-500 dark:text-stone-400 mb-1">Ou cole o Link / URL da Imagem</label>
                  <input 
                    type="url"
                    placeholder="https://exemplo.com/foto.jpg"
                    value={newStudioPhoto.url}
                    onChange={e => setNewStudioPhoto({...newStudioPhoto, url: e.target.value})}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-500 dark:text-stone-400 mb-1">Título da Foto</label>
                  <input 
                    type="text"
                    placeholder="Ex: Recepção Aconchegante"
                    value={newStudioPhoto.title}
                    onChange={e => setNewStudioPhoto({...newStudioPhoto, title: e.target.value})}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-500 dark:text-stone-400 mb-1">Categoria / Tag</label>
                  <select
                    value={newStudioPhoto.tag}
                    onChange={e => setNewStudioPhoto({...newStudioPhoto, tag: e.target.value})}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs"
                  >
                    <option value="Recepção">Recepção</option>
                    <option value="Bancadas">Bancadas</option>
                    <option value="Biossegurança">Biossegurança</option>
                    <option value="Procedimentos">Procedimentos</option>
                    <option value="Cantinho do Café">Cantinho do Café</option>
                    <option value="Fachada">Fachada</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-stone-500 dark:text-stone-400 mb-1">Legenda (Opcional)</label>
                  <input 
                    type="text"
                    placeholder="Ex: Espaço climatizado com café gourmet"
                    value={newStudioPhoto.caption}
                    onChange={e => setNewStudioPhoto({...newStudioPhoto, caption: e.target.value})}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs"
                  />
                </div>
              </div>
              {newStudioPhoto.url && (
                <div className="mt-2 h-32 rounded-2xl overflow-hidden border border-rose-200 max-w-xs relative bg-black/5">
                  <img src={newStudioPhoto.url} alt="Preview" className="w-full h-full object-cover" />
                  <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">Pré-visualização</span>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleAddStudioPhoto}
                  className="bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 px-5 py-2.5 rounded-xl text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                >
                  + Adicionar Foto à Galeria
                </button>
              </div>
            </div>

            {/* Listagem das Fotos Atuais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {(localSettings.studioPhotos || []).map((photo: any) => (
                <div key={photo.id} className="relative bg-stone-50 dark:bg-stone-800 rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-700 flex flex-col group">
                  <div className="h-40 relative overflow-hidden bg-stone-200 dark:bg-stone-900">
                    <img src={photo.url} alt={photo.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <span className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      {photo.tag || 'Foto'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteStudioPhoto(photo.id)}
                      className="absolute top-2 right-2 bg-rose-600 text-white p-1.5 rounded-full hover:bg-rose-700 shadow-md transition-colors cursor-pointer"
                      title="Excluir Foto"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h6 className="font-bold text-xs text-stone-900 dark:text-stone-100">{photo.title}</h6>
                      {photo.caption && <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-2">{photo.caption}</p>}
                    </div>
                  </div>
                </div>
              ))}
              {(!localSettings.studioPhotos || localSettings.studioPhotos.length === 0) && (
                <div className="col-span-full py-8 text-center text-stone-400 text-xs">
                  Nenhuma foto cadastrada na galeria ainda. Adicione a primeira foto acima!
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex justify-end">
              <button 
                type="button"
                onClick={handleSaveSettings}
                className="bg-gradient-to-r from-rose-500 to-pink-600 text-white px-8 py-3 rounded-xl font-bold hover:from-rose-600 hover:to-pink-700 transition-all cursor-pointer shadow-md shadow-rose-200 text-sm"
              >
                Salvar & Publicar Galeria para Clientes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ABA: CLIENTES */}
      {activeTab === 'clients' && (
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Gestão de Clientes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-stone-700 uppercase bg-stone-50 dark:bg-stone-800 dark:text-stone-300">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Data de Cadastro</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-700">
                {clients.map(client => (
                  <tr key={client.id} className="hover:bg-stone-50 dark:hover:bg-stone-800">
                    <td className="px-4 py-3 font-medium">{client.name}</td>
                    <td className="px-4 py-3">{client.phone}</td>
                    <td className="px-4 py-3">{new Date(client.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <button className="text-blue-600 hover:text-blue-800 font-medium">Ver Histórico</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA: AGENDAMENTOS */}
      {activeTab === 'bookings' && (() => {
        const filteredAdminBookings = bookings.filter(b => {
          if (bookingCategoryFilter === 'all') return true;
          return b.status === bookingCategoryFilter;
        });

        const adminBookingCounts = {
          all: bookings.length,
          pending: bookings.filter(b => b.status === 'pending').length,
          confirmed: bookings.filter(b => b.status === 'confirmed').length,
          in_progress: bookings.filter(b => b.status === 'in_progress').length,
          completed: bookings.filter(b => b.status === 'completed').length,
          cancelled: bookings.filter(b => b.status === 'cancelled').length,
        };

        return (
          <div className="space-y-4">
            {/* Filtro por Categorias de Agendamento */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setBookingCategoryFilter('all')}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  bookingCategoryFilter === 'all'
                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                    : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 hover:bg-stone-50 border border-stone-200 dark:border-stone-800'
                }`}
              >
                <span>Todos</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                  {adminBookingCounts.all}
                </span>
              </button>

              <button
                onClick={() => setBookingCategoryFilter('pending')}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  bookingCategoryFilter === 'pending'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-400 hover:bg-amber-50 border border-amber-200 dark:border-amber-900/60'
                }`}
              >
                <span>Aguardando confirmação</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                  {adminBookingCounts.pending}
                </span>
              </button>

              <button
                onClick={() => setBookingCategoryFilter('confirmed')}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  bookingCategoryFilter === 'confirmed'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-stone-900 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 border border-emerald-200 dark:border-emerald-900/60'
                }`}
              >
                <span>Agendado</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                  {adminBookingCounts.confirmed}
                </span>
              </button>

              <button
                onClick={() => setBookingCategoryFilter('in_progress')}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  bookingCategoryFilter === 'in_progress'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white dark:bg-stone-900 text-purple-700 dark:text-purple-400 hover:bg-purple-50 border border-purple-200 dark:border-purple-900/60'
                }`}
              >
                <span>Em andamento</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                  {adminBookingCounts.in_progress}
                </span>
              </button>

              <button
                onClick={() => setBookingCategoryFilter('completed')}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  bookingCategoryFilter === 'completed'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white dark:bg-stone-900 text-blue-700 dark:text-blue-400 hover:bg-blue-50 border border-blue-200 dark:border-blue-900/60'
                }`}
              >
                <span>Concluído</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                  {adminBookingCounts.completed}
                </span>
              </button>

              <button
                onClick={() => setBookingCategoryFilter('cancelled')}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  bookingCategoryFilter === 'cancelled'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-white dark:bg-stone-900 text-red-700 dark:text-red-400 hover:bg-red-50 border border-red-200 dark:border-red-900/60'
                }`}
              >
                <span>Cancelado</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                  {adminBookingCounts.cancelled}
                </span>
              </button>
            </div>

            <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 dark:bg-stone-800/60 text-stone-600 dark:text-stone-300 text-xs uppercase tracking-wider border-b border-stone-100 dark:border-stone-800">
                      <th className="p-4 font-semibold">Data/Hora</th>
                      <th className="p-4 font-semibold">Cliente & Histórico</th>
                      <th className="p-4 font-semibold">Serviços & Pagamento</th>
                      <th className="p-4 font-semibold">Valor / Bônus</th>
                      <th className="p-4 font-semibold">Status / Ações</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-stone-100 dark:divide-stone-800">
                    {filteredAdminBookings.map(booking => {
                      const bServices = services.filter(s => (booking.serviceIds || [booking.serviceId]).includes(s.id));
                      const originalPrice = booking.originalPrice || bServices.reduce((sum, s) => sum + s.price, 0);
                      const finalPrice = booking.finalPrice !== undefined && booking.finalPrice !== null ? booking.finalPrice : originalPrice;
                      const discountAmount = booking.discountAmount || (originalPrice > finalPrice ? originalPrice - finalPrice : 0);

                      // Duração estipulada e controle de andamento em tempo real
                      const totalDurationMinutes = bServices.reduce((sum, s) => sum + (s.duration || 60), 0) || 60;
                      const startedAtMs = booking.startedAt ? new Date(booking.startedAt).getTime() : Date.now();
                      const elapsedTotalSec = Math.floor(Math.max(0, currentTime - startedAtMs) / 1000);
                      const totalSec = totalDurationMinutes * 60;
                      const elapsedMinutes = Math.floor(elapsedTotalSec / 60);
                      const remainingTotalSec = Math.max(0, totalSec - elapsedTotalSec);
                      const remainingMin = Math.floor(remainingTotalSec / 60);
                      const remainingSec = remainingTotalSec % 60;
                      const progressPercent = Math.min(100, Math.round((elapsedTotalSec / totalSec) * 100));
                      const isDurationReached = elapsedTotalSec >= totalSec;

                      return (
                        <tr key={booking.id} className={`hover:bg-stone-50/50 dark:hover:bg-stone-800/40 transition-colors ${booking.status === 'in_progress' ? 'bg-purple-50/30 dark:bg-purple-950/20' : ''}`}>
                          <td className="p-4 whitespace-nowrap font-medium text-stone-900 dark:text-stone-100">
                            <div>{new Date(booking.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</div>
                            <div className="text-xs text-stone-500 dark:text-stone-400">{booking.time}</div>
                            <div className="text-[11px] text-stone-400 mt-1 flex items-center gap-1 font-mono">
                              <Clock size={11} className="text-rose-400" />
                              <span>{totalDurationMinutes} min estipulados</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-stone-900 dark:text-stone-100">{booking.clientName || 'Cliente'}</span>
                              <button
                                onClick={() => setClientHistoryModal({
                                  name: booking.clientName || 'Cliente',
                                  phone: booking.clientPhone,
                                  cpf: booking.clientCpf,
                                  userId: booking.userId
                                })}
                                className="text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-900 font-bold transition-colors cursor-pointer"
                                title="Ver Histórico Completo da Cliente"
                              >
                                Ver Histórico
                              </button>
                            </div>
                            <div className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1 mt-0.5">
                              {booking.clientPhone && (
                                <a 
                                  href={getWhatsAppLink(booking.clientPhone)} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
                                >
                                  <MessageCircle size={12} /> {booking.clientPhone}
                                </a>
                              )}
                            </div>
                            {booking.clientCpf && (
                              <div className="text-[11px] text-stone-400 font-mono">CPF: {booking.clientCpf}</div>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="font-medium text-stone-800 dark:text-stone-200">
                              {bServices.map(s => s.name).join(', ') || 'Serviço'}
                            </div>
                            <div className="text-xs text-stone-400 mt-1">
                              Pagamento: <span className="font-semibold text-rose-600 dark:text-rose-400">{booking.paymentMethod === 'cortesia_bonus' ? 'Cortesia / Bônus' : (booking.paymentMethod || 'No ato do atendimento')}</span>
                            </div>
                            {booking.notes && (
                              <div className="text-xs italic text-stone-500 mt-0.5">"{booking.notes}"</div>
                            )}
                          </td>
                          <td className="p-4">
                            {discountAmount > 0 ? (
                              <div>
                                <div className="text-xs line-through text-stone-400">R$ {originalPrice.toFixed(2).replace('.', ',')}</div>
                                <div className="font-bold text-rose-600 dark:text-rose-400">
                                  {finalPrice === 0 ? 'CORTESIA 100%' : `R$ ${finalPrice.toFixed(2).replace('.', ',')}`}
                                </div>
                                <span className="text-[10px] bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 px-1.5 py-0.5 rounded font-bold">
                                  - R$ {discountAmount.toFixed(2).replace('.', ',')}
                                </span>
                              </div>
                            ) : (
                              <span className="font-bold text-stone-900 dark:text-stone-100">
                                R$ {finalPrice.toFixed(2).replace('.', ',')}
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="space-y-2 min-w-[200px]">
                              <div className="flex flex-wrap items-center gap-2">
                                <select 
                                  value={booking.status}
                                  onChange={(e) => {
                                    const nextStatus = e.target.value as any;
                                    updateBookingStatus(
                                      booking.id, 
                                      nextStatus, 
                                      nextStatus === 'in_progress' ? new Date().toISOString() : undefined
                                    );
                                  }}
                                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border focus:outline-none cursor-pointer ${
                                    booking.status === 'confirmed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300' :
                                    booking.status === 'in_progress' ? 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300' :
                                    booking.status === 'completed' ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300' :
                                    booking.status === 'cancelled' ? 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300' :
                                    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                                  }`}
                                >
                                  <option value="pending">Aguardando confirmação</option>
                                  <option value="confirmed">Agendado</option>
                                  <option value="in_progress">Em andamento</option>
                                  <option value="completed">Concluído (Marca Selo)</option>
                                  <option value="cancelled">Cancelado</option>
                                </select>

                                <button 
                                  onClick={() => setReceiptBooking(booking)}
                                  className="p-1.5 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white bg-stone-100 dark:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                                  title="Ver Comprovante"
                                >
                                  <FileText size={15} />
                                </button>
                              </div>

                              {/* Ação rápida para Iniciar Atendimento */}
                              {(booking.status === 'confirmed' || booking.status === 'pending') && (
                                <button
                                  type="button"
                                  onClick={() => updateBookingStatus(booking.id, 'in_progress', new Date().toISOString())}
                                  className="w-full py-1.5 px-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <Play size={12} className="fill-purple-600 text-purple-600" />
                                  <span>Iniciar Atendimento ({totalDurationMinutes} min)</span>
                                </button>
                              )}

                              {/* Módulo Ativo de Serviço Em Andamento & Conclusão por Tempo Estipulado */}
                              {booking.status === 'in_progress' && (
                                <div className="p-2.5 bg-purple-50/80 dark:bg-purple-950/50 rounded-xl border border-purple-200/80 dark:border-purple-900 space-y-2">
                                  <div className="flex items-center justify-between text-[11px] font-bold text-purple-900 dark:text-purple-200">
                                    <span className="flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping"></span>
                                      Em andamento
                                    </span>
                                    <span className="font-mono text-purple-700 dark:text-purple-300">
                                      {remainingMin}m {remainingSec < 10 ? '0' : ''}{remainingSec}s restantes
                                    </span>
                                  </div>

                                  {/* Barra de Progresso do Tempo Estipulado */}
                                  <div className="w-full bg-purple-200/60 dark:bg-stone-700 h-1.5 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full transition-all duration-500 ${isDurationReached ? 'bg-emerald-500' : 'bg-purple-600'}`}
                                      style={{ width: `${progressPercent}%` }}
                                    ></div>
                                  </div>

                                  {isDurationReached ? (
                                    <div className="space-y-1.5 pt-0.5">
                                      <div className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/80 px-2 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                                        <CheckCircle2 size={12} className="text-emerald-600" />
                                        <span>Tempo estipulado concluído! Finalizando...</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => updateBookingStatus(booking.id, 'completed')}
                                        className="w-full py-1.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
                                      >
                                        <CheckCircle2 size={14} />
                                        <span>Concluir Atendimento</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-2 pt-0.5">
                                      <span className="text-[10px] text-purple-700 dark:text-purple-300 font-medium">
                                        {elapsedMinutes}m de {totalDurationMinutes}m decorridos
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => updateBookingStatus(booking.id, 'completed')}
                                        className="py-1 px-2.5 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                                      >
                                        <Check size={12} />
                                        <span>Concluir Agora</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredAdminBookings.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-stone-500 dark:text-stone-400">
                          Nenhum agendamento encontrado nesta categoria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ABA UNIFICADA: SERVIÇOS & CATÁLOGO */}
      {(activeTab === 'services' || activeTab === 'categories') && (() => {
        const filteredServices = services.filter(s => {
          const matchesCat = serviceCategoryFilter === 'all' || s.category === serviceCategoryFilter;
          const matchesSearch = !serviceSearchTerm || 
            s.name.toLowerCase().includes(serviceSearchTerm.toLowerCase()) || 
            s.category.toLowerCase().includes(serviceSearchTerm.toLowerCase());
          return matchesCat && matchesSearch;
        });

        return (
          <div className="space-y-6">
            {/* Mensagem de Alteração Concluída */}
            {serviceSuccessNotice && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between text-emerald-900 dark:text-emerald-200 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <span className="font-bold text-sm block text-emerald-900 dark:text-emerald-100">
                      Alteração Concluída com Sucesso!
                    </span>
                    <span className="text-xs text-emerald-700 dark:text-emerald-300">
                      {serviceSuccessNotice}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setServiceSuccessNotice(null)}
                  className="p-1.5 text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-100 transition-colors cursor-pointer"
                  title="Fechar aviso"
                >
                  <X size={16} />
                </button>
              </motion.div>
            )}

            {/* Cabeçalho Unificado com Estatísticas e Busca */}
            <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-serif text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    <Sparkles className="text-rose-500" size={24} />
                    Catálogo de Serviços & Categorias
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                    Cadastre procedimentos, estipule a duração exata para controle de horários e organize as categorias do catálogo em um único painel.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleOpenNewService}
                    className="px-4 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-rose-200/50 dark:shadow-none flex items-center gap-2 cursor-pointer shrink-0"
                    title="Abrir telinha para cadastrar novo procedimento"
                  >
                    <Plus size={16} />
                    <span>Novo Procedimento</span>
                  </button>

                  {/* Barra de Busca Rápida no Catálogo */}
                  <div className="relative w-full md:w-64">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Buscar no catálogo..."
                      value={serviceSearchTerm}
                      onChange={e => setServiceSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                    {serviceSearchTerm && (
                      <button 
                        onClick={() => setServiceSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Filtro por Categorias (Pills) */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide pt-2 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setServiceCategoryFilter('all')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    serviceCategoryFilter === 'all'
                      ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                >
                  <span>Todos os Serviços</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                    {services.length}
                  </span>
                </button>

                {categories.map(cat => {
                  const count = services.filter(s => s.category === cat.name).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setServiceCategoryFilter(cat.name)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                        serviceCategoryFilter === cat.name
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                      }`}
                    >
                      <span>{cat.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Conteúdo em Duas Colunas Integradas */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Coluna Esquerda: Formulário de Serviços + Gestão de Categorias */}
              <div className="lg:col-span-5 space-y-6">
                {/* 1. Formulário de Novo/Editar Serviço */}
                <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-serif text-lg text-stone-900 dark:text-stone-100 font-bold flex items-center gap-2">
                      <List size={18} className="text-rose-500" />
                      {editingService ? 'Editar Atendimento' : 'Novo Procedimento / Serviço'}
                    </h4>
                    <div className="flex items-center gap-2">
                      {editingService && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                          Editando
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => editingService ? setIsServiceModalOpen(true) : handleOpenNewService()}
                        className="text-xs text-rose-600 dark:text-rose-400 font-bold hover:underline flex items-center gap-1 cursor-pointer bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 px-2.5 py-1 rounded-lg border border-rose-200/60 dark:border-rose-900/60 transition-colors"
                        title="Abrir em uma janela maior para alterar mais facilmente"
                      >
                        <Maximize2 size={13} />
                        <span>Abrir Telinha</span>
                      </button>
                    </div>
                  </div>

                  <form onSubmit={editingService ? handleUpdateService : handleAddService} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                        Nome do Serviço
                      </label>
                      <input 
                        type="text" 
                        value={editingService ? editingService.name : newService.name} 
                        onChange={e => editingService ? setEditingService({...editingService, name: e.target.value}) : setNewService({...newService, name: e.target.value})}
                        placeholder="Ex: Manicure e Pedicure Spa"
                        className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:ring-2 focus:ring-rose-500"
                        required 
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                          Categoria no Catálogo
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowAddCategoryInline(!showAddCategoryInline)}
                          className="text-[11px] text-rose-600 dark:text-rose-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus size={12} />
                          <span>{showAddCategoryInline ? 'Fechar' : '+ Nova Categoria'}</span>
                        </button>
                      </div>

                      {showAddCategoryInline && (
                        <div className="mb-2 p-2.5 bg-rose-50/60 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900 space-y-2">
                          <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-200">
                            Cadastrar nova categoria rapidamente:
                          </span>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newCategoryName}
                              onChange={e => setNewCategoryName(e.target.value)}
                              placeholder="Nome da categoria..."
                              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                handleAddCategory(e);
                                setShowAddCategoryInline(false);
                              }}
                              className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700"
                            >
                              Salvar
                            </button>
                          </div>
                        </div>
                      )}

                      <select 
                        value={editingService ? editingService.category : newService.category} 
                        onChange={e => editingService ? setEditingService({...editingService, category: e.target.value}) : setNewService({...newService, category: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:ring-2 focus:ring-rose-500"
                        required
                      >
                        <option value="">Selecione uma categoria...</option>
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                          Duração (minutos)
                        </label>
                        <input 
                          type="number" 
                          min="5" 
                          step="5"
                          value={editingService ? editingService.duration : newService.duration} 
                          onChange={e => editingService ? setEditingService({...editingService, duration: Number(e.target.value)}) : setNewService({...newService, duration: Number(e.target.value)})}
                          className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:ring-2 focus:ring-rose-500 font-mono"
                          required 
                        />
                        <span className="text-[10px] text-stone-400 mt-1 block">
                          Bloqueia este intervalo na agenda
                        </span>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                          Preço (R$)
                        </label>
                        <input 
                          type="number" 
                          min="0" 
                          step="0.5"
                          value={editingService ? editingService.price : newService.price} 
                          onChange={e => editingService ? setEditingService({...editingService, price: Number(e.target.value)}) : setNewService({...newService, price: Number(e.target.value)})}
                          className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:ring-2 focus:ring-rose-500 font-mono"
                          required 
                        />
                        <span className="text-[10px] text-stone-400 mt-1 block">
                          Valor praticado pelo salão
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      {editingService && (
                        <button 
                          type="button" 
                          onClick={() => setEditingService(null)} 
                          className="flex-1 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold hover:bg-stone-200 transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                      )}
                      <button 
                        type="submit" 
                        className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        {editingService ? 'Salvar Alterações' : 'Cadastrar no Catálogo'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* 2. Caixa de Gestão de Categorias */}
                <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-serif text-base text-stone-900 dark:text-stone-100 font-bold flex items-center gap-2">
                      <Tag size={16} className="text-rose-500" />
                      Categorias do Catálogo ({categories.length})
                    </h4>
                  </div>

                  <form onSubmit={handleAddCategory} className="flex gap-2">
                    <input 
                      type="text" 
                      value={newCategoryName} 
                      onChange={e => setNewCategoryName(e.target.value)} 
                      placeholder="Nova categoria (ex: Cílios, Depilação...)" 
                      className="flex-1 px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-rose-500" 
                      required 
                    />
                    <button 
                      type="submit" 
                      className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-4 py-2 rounded-xl text-xs font-bold hover:bg-stone-800 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus size={14} /> Adicionar
                    </button>
                  </form>

                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {categories.map(c => {
                      const count = services.filter(s => s.category === c.name).length;
                      return (
                        <div 
                          key={c.id} 
                          className="flex justify-between items-center p-2.5 rounded-xl border border-stone-100 dark:border-stone-800 hover:border-stone-200 bg-stone-50/50 dark:bg-stone-800/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-stone-800 dark:text-stone-200 text-xs">{c.name}</span>
                            <span className="text-[10px] text-stone-400 bg-white dark:bg-stone-700 px-1.5 py-0.5 rounded border border-stone-200 dark:border-stone-600">
                              {count} {count === 1 ? 'serviço' : 'serviços'}
                            </span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => removeCategory(c.id)} 
                            className="text-stone-400 hover:text-red-500 p-1 rounded-md transition-colors cursor-pointer"
                            title="Excluir categoria"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Coluna Direita: Lista de Procedimentos do Catálogo */}
              <div className="lg:col-span-7">
                <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800 p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                    <div>
                      <h4 className="font-serif text-lg text-stone-900 dark:text-stone-100 font-bold">
                        Procedimentos Cadastrados ({filteredServices.length})
                      </h4>
                      <p className="text-xs text-stone-400">
                        {serviceCategoryFilter !== 'all' ? `Filtrando por: ${serviceCategoryFilter}` : 'Mostrando todos os serviços'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOpenNewService}
                        className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200/80 dark:border-rose-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Abrir telinha para cadastrar"
                      >
                        <Plus size={14} />
                        <span>+ Novo Procedimento</span>
                      </button>
                      {serviceCategoryFilter !== 'all' && (
                        <button
                          onClick={() => setServiceCategoryFilter('all')}
                          className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer"
                        >
                          Limpar filtro
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {filteredServices.map(s => (
                      <div 
                        key={s.id} 
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-stone-100 dark:border-stone-800 hover:border-stone-200 dark:hover:border-stone-700 bg-stone-50/30 dark:bg-stone-800/30 transition-all gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 rounded-full border border-rose-200/60 dark:border-rose-900/60 uppercase">
                              {s.category}
                            </span>
                            <span className="text-[11px] font-mono text-stone-500 dark:text-stone-400 flex items-center gap-1">
                              <Clock size={12} className="text-stone-400" />
                              {s.duration} min estipulados
                            </span>
                          </div>
                          <h5 className="font-bold text-stone-900 dark:text-stone-100 text-base mt-1.5">{s.name}</h5>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 dark:border-stone-800">
                          <span className="font-black text-stone-900 dark:text-stone-100 text-lg">
                            R$ {s.price.toFixed(2).replace('.', ',')}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button 
                              type="button"
                              onClick={() => handleOpenEditService(s)} 
                              className="p-2 text-stone-500 hover:text-rose-600 dark:text-stone-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                              title="Abrir telinha para alterar procedimento"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => removeService(s.id)} 
                              className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
                              title="Excluir serviço"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {filteredServices.length === 0 && (
                      <div className="text-center py-12 text-stone-500 dark:text-stone-400 space-y-2">
                        <List size={36} className="mx-auto text-stone-300 dark:text-stone-600" />
                        <p className="text-sm font-semibold">Nenhum serviço encontrado no catálogo.</p>
                        <p className="text-xs text-stone-400">Verifique os filtros selecionados ou cadastre um novo atendimento ao lado.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ABA: EQUIPE & ACESSO DE FUNCIONÁRIAS */}
      {activeTab === 'professionals' && (
        <div className="space-y-8 max-w-5xl">
          {/* Header explicativo da aba */}
          <div className="bg-gradient-to-r from-rose-50 to-pink-50/60 dark:from-rose-950/40 dark:to-stone-900 p-6 rounded-3xl border border-rose-100 dark:border-rose-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-200 dark:shadow-none">
                <Users size={24} />
              </div>
              <div>
                <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-100">
                  Equipe de Funcionárias & Acesso para Atender Clientes
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-300 mt-1 max-w-2xl leading-relaxed">
                  Cadastre as profissionais do salão com <strong>Login e Senha individuais</strong>. Suas colaboradoras poderão entrar diretamente no app através da aba de login administrativo para visualizar e atender os agendamentos das clientes.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white dark:bg-stone-800 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-stone-700 shadow-2xs">
                {professionals.length} profissional{professionals.length !== 1 ? 'is' : ''}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Formulário de Cadastro de Profissional com Credenciais */}
            <div className="bg-white dark:bg-stone-900 p-6 sm:p-7 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <UserPlus size={18} />
                </div>
                <h3 className="font-serif text-lg text-stone-900 dark:text-stone-100 font-bold">
                  {editingProf ? 'Editar Profissional' : 'Nova Profissional'}
                </h3>
              </div>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (editingProf) {
                  if (!editingProf.name.trim()) return;
                  await updateProfessional(editingProf.id, {
                    ...editingProf,
                    permissions: editingProf.permissions && editingProf.permissions.length > 0 ? editingProf.permissions : ['bookings']
                  });
                  setEditingProf(null);
                } else {
                  if (!newProf.name.trim()) return;
                  await addProfessional({
                    ...newProf,
                    permissions: newProf.permissions && newProf.permissions.length > 0 ? newProf.permissions : ['bookings']
                  });
                  setNewProf({ name: '', phone: '', username: '', password: '', permissions: ['bookings'] });
                }
              }} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                    Nome Completo <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    required 
                    type="text" 
                    value={editingProf ? editingProf.name : newProf.name} 
                    onChange={e => editingProf 
                      ? setEditingProf({ ...editingProf, name: e.target.value }) 
                      : setNewProf({ ...newProf, name: e.target.value })} 
                    placeholder="Ex: Amanda Silva" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:ring-2 focus:ring-rose-400 focus:outline-none" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                    WhatsApp (com DDD) <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    required 
                    type="text" 
                    value={editingProf ? editingProf.phone : newProf.phone} 
                    onChange={e => editingProf 
                      ? setEditingProf({ ...editingProf, phone: e.target.value }) 
                      : setNewProf({ ...newProf, phone: e.target.value })} 
                    placeholder="(11) 99999-9999" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:ring-2 focus:ring-rose-400 focus:outline-none" 
                  />
                </div>

                {/* Bloco de Login & Senha da Colaboradora */}
                <div className="p-3.5 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 dark:text-stone-200">
                    <KeyRound size={14} className="text-rose-500" />
                    <span>Login & Senha para Atender Clientes</span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Com esses dados ela entra na opção "Admin & Equipe" e acessa as áreas permitidas abaixo.
                  </p>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider mb-1">
                      Usuário de Acesso (Login)
                    </label>
                    <input 
                      type="text" 
                      value={editingProf ? (editingProf.username || '') : newProf.username} 
                      onChange={e => {
                        const val = e.target.value.toLowerCase().replace(/\s+/g, '');
                        if (editingProf) {
                          setEditingProf({ ...editingProf, username: val });
                        } else {
                          setNewProf({ ...newProf, username: val });
                        }
                      }} 
                      placeholder="Ex: amanda.nails" 
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-mono lowercase focus:ring-2 focus:ring-rose-400 focus:outline-none" 
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider mb-1">
                      Senha de Acesso
                    </label>
                    <input 
                      type="text" 
                      value={editingProf ? (editingProf.password || '') : newProf.password} 
                      onChange={e => editingProf 
                        ? setEditingProf({ ...editingProf, password: e.target.value }) 
                        : setNewProf({ ...newProf, password: e.target.value })} 
                      placeholder="Ex: 123456 ou senha segura" 
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-mono focus:ring-2 focus:ring-rose-400 focus:outline-none" 
                    />
                  </div>
                </div>

                {/* Bloco de Caixas de Seleção de Cada Área do Admin */}
                <div className="p-3.5 bg-rose-50/60 dark:bg-rose-950/30 rounded-2xl border border-rose-200/80 dark:border-rose-900/60 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900 dark:text-stone-100">
                      <Shield size={14} className="text-rose-600 dark:text-rose-400" />
                      <span>Áreas Permitidas ({currentProfPerms.length}/12)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={selectAllProfPerms}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-white dark:bg-stone-800 px-2 py-0.5 rounded-md border border-rose-200 dark:border-stone-700 cursor-pointer shadow-2xs"
                      >
                        Todas
                      </button>
                      <button
                        type="button"
                        onClick={selectBasicProfPerms}
                        className="text-[10px] font-bold text-stone-600 hover:text-stone-700 bg-white dark:bg-stone-800 px-2 py-0.5 rounded-md border border-stone-200 dark:border-stone-700 cursor-pointer shadow-2xs"
                      >
                        Agenda
                      </button>
                      <button
                        type="button"
                        onClick={clearProfPerms}
                        className="text-[10px] font-bold text-stone-400 hover:text-stone-600 bg-white dark:bg-stone-800 px-2 py-0.5 rounded-md border border-stone-200 dark:border-stone-700 cursor-pointer shadow-2xs"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-stone-600 dark:text-stone-300">
                    Selecione nas caixas de seleção abaixo quais áreas do painel esta funcionária poderá acessar:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                    {ADMIN_MODULES.map(mod => {
                      const IconComp = mod.icon;
                      const isChecked = currentProfPerms.includes(mod.id);
                      return (
                        <label
                          key={mod.id}
                          className={`flex items-start gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-white dark:bg-stone-800 border-rose-300 dark:border-rose-700 text-stone-900 dark:text-stone-100 shadow-2xs ring-1 ring-rose-200/60 dark:ring-rose-900/50'
                              : 'bg-white/70 dark:bg-stone-900/60 border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 hover:border-stone-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleProfPerm(mod.id)}
                            className="mt-0.5 rounded border-stone-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 font-bold text-[11px]">
                              <IconComp size={12} className={isChecked ? 'text-rose-500' : 'text-stone-400'} />
                              <span className="truncate">{mod.label}</span>
                            </div>
                            <p className="text-[10px] text-stone-400 dark:text-stone-500 leading-tight mt-0.5 truncate">
                              {mod.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  {editingProf && (
                    <button
                      type="button"
                      onClick={() => setEditingProf(null)}
                      className="flex-1 px-4 py-2.5 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 rounded-xl text-xs font-bold hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                  )}
                  <button 
                    type="submit" 
                    className="flex-1 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 py-2.5 rounded-xl text-xs font-bold hover:bg-stone-800 transition-colors cursor-pointer shadow-sm"
                  >
                    {editingProf ? 'Salvar Alterações' : 'Cadastrar na Equipe'}
                  </button>
                </div>
              </form>
            </div>
            
            {/* Lista das Profissionais com status de credenciais */}
            <div className="lg:col-span-2 bg-white dark:bg-stone-900 p-6 sm:p-7 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-xl text-stone-900 dark:text-stone-100 font-bold">
                  Profissionais Cadastradas ({professionals.length})
                </h3>
                <span className="text-xs text-stone-400">
                  Acesso liberado via perfil de Equipe
                </span>
              </div>

              <div className="space-y-3">
                {professionals.map(p => (
                  <div key={p.id} className="p-4 border border-stone-100 dark:border-stone-800 rounded-2xl bg-stone-50/40 dark:bg-stone-800/40 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:border-stone-200 dark:hover:border-stone-700 transition-colors">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-100 to-pink-100 dark:from-rose-950 dark:to-stone-800 text-rose-600 dark:text-rose-400 flex items-center justify-center font-serif font-bold text-base shrink-0 border border-rose-200/50 dark:border-stone-700">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                            {p.name}
                          </span>
                          {p.username && p.password ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                              <CheckCircle2 size={11} /> Login Ativo: {p.username}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60">
                              Sem login configurado
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-stone-500 mt-1">
                          <span>{p.phone}</span>
                          {p.password && (
                            <span className="font-mono text-[11px] text-stone-400">
                              Senha: {p.password}
                            </span>
                          )}
                        </div>

                        {/* Badges das Áreas Permitidas */}
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {(p.permissions && p.permissions.length > 0 ? p.permissions : ['bookings']).map((permId) => {
                            const mod = ADMIN_MODULES.find(m => m.id === permId);
                            if (!mod) return null;
                            const ModIcon = mod.icon;
                            return (
                              <span key={permId} className="inline-flex items-center gap-1 text-[10px] font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-md border border-rose-200/60 dark:border-rose-900/60">
                                <ModIcon size={10} /> {mod.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button 
                        onClick={() => setEditingProf({ ...p, permissions: p.permissions && p.permissions.length > 0 ? p.permissions : ['bookings'] })}
                        className="p-2 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
                        title="Editar profissional, permissões e login"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => removeProfessional(p.id)} 
                        className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-colors cursor-pointer"
                        title="Remover profissional e revogar acesso"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}

                {professionals.length === 0 && (
                  <div className="text-center py-12 text-stone-400 bg-stone-50/50 dark:bg-stone-800/20 rounded-2xl border border-dashed border-stone-200 dark:border-stone-800">
                    <Users size={32} className="mx-auto mb-2 text-stone-300" />
                    <p className="text-sm font-medium">Nenhuma profissional cadastrada ainda.</p>
                    <p className="text-xs text-stone-400">Cadastre suas colaboradoras no formulário ao lado para liberar seus logins.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA: FIDELIDADE (Personalização do Programa & Selos das Clientes) */}
      {activeTab === 'loyalty' && (
        <div className="space-y-8 max-w-4xl">
          <form onSubmit={handleSaveSettings} className="bg-white dark:bg-stone-900 p-6 md:p-8 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-100 dark:border-stone-800">
              <div>
                <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Gift className="text-rose-500" size={22} />
                  Personalização da Carteirinha de Fidelidade
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  Defina o número de atendimentos necessários para completar e a recompensa (cortesia ou desconto %).
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={localSettings.loyaltyActive || false} 
                  onChange={e => setLocalSettings({...localSettings, loyaltyActive: e.target.checked})} 
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                <span className="ml-2 text-xs font-bold text-stone-700 dark:text-stone-300">Ativa</span>
              </label>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Quantidade de Selos (Meta de Atendimentos)
                </label>
                <input 
                  type="number" 
                  min="1" 
                  max="30" 
                  value={localSettings.loyaltyMaxStamps || 10} 
                  onChange={e => setLocalSettings({...localSettings, loyaltyMaxStamps: Number(e.target.value)})} 
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold" 
                />
                <span className="text-[11px] text-stone-400 mt-1 block">A cada serviço concluído, 1 "✕" é marcado na carteirinha da cliente.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Tipo de Recompensa
                </label>
                <select
                  value={localSettings.loyaltyRewardType || 'free_service'}
                  onChange={e => {
                    const newType = e.target.value as 'free_service' | 'discount_percent';
                    let defaultText = localSettings.loyaltyRewardText;
                    if (newType === 'free_service') {
                      const svc = services.find(s => s.id === localSettings.loyaltyRewardServiceId) || services[0];
                      if (svc) defaultText = `Ganhe 1 ${svc.name} 100% grátis ao completar!`;
                    } else {
                      const pct = localSettings.loyaltyRewardDiscountPercent || 50;
                      defaultText = `Ganhe ${pct}% de desconto ao completar!`;
                    }
                    setLocalSettings({ ...localSettings, loyaltyRewardType: newType, loyaltyRewardText: defaultText });
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium"
                >
                  <option value="free_service">Serviço de Cortesia (100% Grátis)</option>
                  <option value="discount_percent">Porcentagem de Desconto no Serviço</option>
                </select>
              </div>

              {localSettings.loyaltyRewardType !== 'discount_percent' ? (
                <div className="md:col-span-2 bg-rose-50/70 dark:bg-rose-950/40 p-5 rounded-2xl border border-rose-200 dark:border-rose-900/60">
                  <label className="block text-xs font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wider mb-2">
                    Serviço Oferecido como Cortesia (100% Grátis)
                  </label>
                  <select
                    value={localSettings.loyaltyRewardServiceId || ''}
                    onChange={e => {
                      const sId = e.target.value;
                      const selected = services.find(s => s.id === sId);
                      const text = selected 
                        ? `Ganhe 1 ${selected.name} (100% Cortesia) ao completar a carteirinha!` 
                        : (sId === 'any' ? 'Ganhe 1 serviço de sua preferência 100% grátis ao completar a cartela!' : 'Ganhe um serviço de cortesia!');
                      setLocalSettings({ ...localSettings, loyaltyRewardServiceId: sId, loyaltyRewardText: text });
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium"
                  >
                    <option value="">-- Selecione o serviço de cortesia --</option>
                    <option value="any">✨ Qualquer serviço cadastrado no site (escolha livre da cliente)</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} — R$ {s.price.toFixed(2).replace('.', ',')} ({s.duration} min • {s.category})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="md:col-span-2 bg-amber-50/70 dark:bg-amber-950/40 p-5 rounded-2xl border border-amber-200 dark:border-amber-900/60">
                  <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider mb-2">
                    Porcentagem de Desconto no Serviço (%)
                  </label>
                  <div className="flex items-center gap-2 max-w-xs">
                    <input
                      type="number"
                      min="5"
                      max="100"
                      step="5"
                      value={localSettings.loyaltyRewardDiscountPercent || 50}
                      onChange={e => {
                        const pct = Number(e.target.value);
                        setLocalSettings({
                          ...localSettings,
                          loyaltyRewardDiscountPercent: pct,
                          loyaltyRewardText: `Ganhe ${pct}% de desconto ao completar a carteirinha!`
                        });
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 font-bold text-stone-900 dark:text-stone-100"
                    />
                    <span className="font-bold text-stone-600">%</span>
                  </div>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Texto Explicativo na Carteirinha da Cliente
                </label>
                <input 
                  type="text" 
                  value={localSettings.loyaltyRewardText || ''} 
                  onChange={e => setLocalSettings({...localSettings, loyaltyRewardText: e.target.value})} 
                  placeholder="Ex: Complete 10 atendimentos e ganhe 1 Manicure Tradicional grátis!" 
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm" 
                />
              </div>
            </div>
            
            <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex justify-end">
              <button type="submit" className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-8 py-3 rounded-xl font-bold hover:bg-stone-800 transition-colors cursor-pointer">
                Salvar Fidelidade
              </button>
            </div>
          </form>

          {/* Tabela de Selos das Clientes */}
          <div className="bg-white dark:bg-stone-900 p-6 md:p-8 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800">
            <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-100 mb-4">Clientes & Selos Acumulados</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 dark:bg-stone-800/60 text-stone-600 dark:text-stone-400 text-xs uppercase tracking-wider border-b border-stone-100 dark:border-stone-800">
                    <th className="p-4 font-semibold">Cliente</th>
                    <th className="p-4 font-semibold">Telefone</th>
                    <th className="p-4 font-semibold">Selos (✕)</th>
                    <th className="p-4 font-semibold text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-stone-100 dark:divide-stone-800">
                  {clients.map(client => (
                    <tr key={client.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/40">
                      <td className="p-4 font-medium text-stone-900 dark:text-stone-100">{client.name}</td>
                      <td className="p-4 text-stone-500 dark:text-stone-400">{client.phone}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            min="0" 
                            max={localSettings.loyaltyMaxStamps || 10}
                            value={client.loyaltyStamps || 0} 
                            onChange={(e) => {
                              const newStamps = Number(e.target.value);
                              setClients(prev => prev.map(c => c.id === client.id ? { ...c, loyaltyStamps: newStamps } : c));
                            }}
                            className="w-20 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold"
                          />
                          <span className="text-stone-400">/ {localSettings.loyaltyMaxStamps || 10}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => updateLoyaltyStamps(client.id, client.loyaltyStamps || 0)} 
                          className="px-4 py-1.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-xl text-xs font-bold hover:bg-stone-800 transition-colors"
                        >
                          Salvar Selos
                        </button>
                      </td>
                    </tr>
                  ))}
                  {clients.length === 0 && (
                    <tr><td colSpan={4} className="p-8 text-center text-stone-500">Nenhum cliente cadastrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA: INDICAÇÃO & BÔNUS (Solicitada pelo Usuário) */}
      {activeTab === 'referral' && (
        <div className="space-y-8 max-w-4xl">
          <form onSubmit={handleSaveSettings} className="bg-white dark:bg-stone-900 p-6 md:p-8 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-100 dark:border-stone-800">
              <div>
                <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Share2 className="text-pink-500" size={22} />
                  Programa de Indicação de Amigas & Bônus
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  Configure a quantidade de indicações necessárias (0 a 10) e o desconto que a amiga ganha no 1º serviço.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={localSettings.referralActive ?? true} 
                  onChange={e => setLocalSettings({...localSettings, referralActive: e.target.checked})} 
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                <span className="ml-2 text-xs font-bold text-stone-700 dark:text-stone-300">Ativo</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Meta de Indicações: 0 a 10 */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Meta de Indicações para Completar a Cartela (0 a 10)
                </label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    min="0" 
                    max="10" 
                    step="1"
                    value={localSettings.referralMaxStamps ?? 5} 
                    onChange={e => {
                      const val = Math.min(10, Math.max(0, Number(e.target.value)));
                      setLocalSettings({ ...localSettings, referralMaxStamps: val });
                    }} 
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-extrabold text-lg" 
                  />
                  <span className="text-xs text-stone-500 font-medium whitespace-nowrap">amigas indicadas</span>
                </div>
                <span className="text-[11px] text-stone-400 mt-1 block">
                  A administradora pode definir qualquer meta entre 0 e 10 amigas indicadas.
                </span>
              </div>

              {/* Desconto para a NOVA CLIENTE INDICADA (Amiga) no 1º serviço */}
              <div className="bg-pink-50/50 dark:bg-pink-950/20 p-4 rounded-2xl border border-pink-200/60 dark:border-pink-900/40">
                <label className="block text-xs font-bold text-pink-900 dark:text-pink-300 uppercase tracking-wider mb-2">
                  Desconto para a Amiga Indicada no 1º Atendimento
                </label>
                
                {/* Tipo de Desconto para a Amiga: R$ Fixo ou Porcentagem % */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setLocalSettings({ ...localSettings, referralDiscountType: 'fixed' })}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                      (localSettings.referralDiscountType || 'fixed') === 'fixed'
                        ? 'bg-pink-600 text-white shadow-xs'
                        : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    Valor em R$
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocalSettings({ ...localSettings, referralDiscountType: 'percent' })}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                      localSettings.referralDiscountType === 'percent'
                        ? 'bg-pink-600 text-white shadow-xs'
                        : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    Porcentagem (%)
                  </button>
                </div>

                {/* Input do valor conforme o tipo */}
                {(localSettings.referralDiscountType || 'fixed') === 'fixed' ? (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-600 dark:text-stone-400">R$</span>
                    <input 
                      type="number" 
                      min="0" 
                      step="1"
                      value={localSettings.referralDiscountForReferred ?? 10} 
                      onChange={e => setLocalSettings({ ...localSettings, referralDiscountForReferred: Number(e.target.value) })} 
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-extrabold text-base" 
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      min="1" 
                      max="100"
                      step="1"
                      value={localSettings.referralDiscountForReferred ?? 15} 
                      onChange={e => setLocalSettings({ ...localSettings, referralDiscountForReferred: Number(e.target.value) })} 
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-extrabold text-base" 
                    />
                    <span className="font-bold text-stone-600 dark:text-stone-400">%</span>
                  </div>
                )}

                <span className="text-[11px] text-pink-600 dark:text-pink-400 font-medium mt-1.5 block">
                  ✓ Desconto de {(localSettings.referralDiscountType || 'fixed') === 'percent' ? `${localSettings.referralDiscountForReferred ?? 15}%` : `R$ ${(localSettings.referralDiscountForReferred ?? 10).toFixed(2).replace('.', ',')}`} aplicado no 1º serviço da amiga.
                </span>
              </div>

              {/* SEÇÃO: RECOMPENSA PARA A CLIENTE INDICADORA (Ao completar a meta) */}
              <div className="md:col-span-2 p-5 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-200 dark:border-stone-700">
                  <div>
                    <label className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider block">
                      Recompensa da Cliente que Indicou (Ao Completar a Meta)
                    </label>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Escolha se a cliente ganha um serviço 100% brinde ou uma porcentagem de desconto no serviço.
                    </p>
                  </div>

                  {/* Toggle Recompensa: Cortesia Brinde vs Desconto % */}
                  <div className="inline-flex rounded-xl p-1 bg-stone-200 dark:bg-stone-700 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const sId = localSettings.referralRewardServiceId;
                        const selected = services.find(s => s.id === sId);
                        const sName = selected ? selected.name : 'serviço de cortesia';
                        setLocalSettings({
                          ...localSettings,
                          referralRewardType: 'free_service',
                          referralRewardText: `Ganhe 1 ${sName} 100% de brinde ao completar suas indicações!`
                        });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        (localSettings.referralRewardType || 'free_service') === 'free_service'
                          ? 'bg-white dark:bg-stone-900 text-pink-600 dark:text-pink-400 shadow-xs'
                          : 'text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      🎁 Serviço de Brinde (Cortesia)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const pct = localSettings.referralRewardDiscountPercent || 50;
                        setLocalSettings({
                          ...localSettings,
                          referralRewardType: 'discount_percent',
                          referralRewardText: `Ganhe ${pct}% de desconto no serviço ao completar suas indicações!`
                        });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        localSettings.referralRewardType === 'discount_percent'
                          ? 'bg-white dark:bg-stone-900 text-pink-600 dark:text-pink-400 shadow-xs'
                          : 'text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      🏷️ Desconto no Serviço (%)
                    </button>
                  </div>
                </div>

                {/* Seleção de Serviços Prestados do Catálogo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      Serviço Prestado no Catálogo para a Recompensa
                    </label>
                    <select
                      value={localSettings.referralRewardServiceId || ''}
                      onChange={e => {
                        const sId = e.target.value;
                        const selected = services.find(s => s.id === sId);
                        let autoText = '';
                        if (localSettings.referralRewardType === 'discount_percent') {
                          const pct = localSettings.referralRewardDiscountPercent || 50;
                          autoText = selected 
                            ? `Ganhe ${pct}% de desconto em ${selected.name} ao completar suas indicações!` 
                            : `Ganhe ${pct}% de desconto no seu próximo serviço ao completar suas indicações!`;
                        } else {
                          autoText = selected 
                            ? `Ganhe 1 ${selected.name} (100% Cortesia) ao completar suas indicações!` 
                            : (sId === 'any' ? 'Ganhe 1 serviço de sua preferência 100% grátis ao completar a cartela!' : 'Ganhe 1 serviço de cortesia!');
                        }
                        setLocalSettings({ 
                          ...localSettings, 
                          referralRewardServiceId: sId, 
                          referralRewardText: autoText 
                        });
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium"
                    >
                      <option value="">-- Selecione o serviço ou qualquer serviço do catálogo --</option>
                      <option value="any">✨ Qualquer serviço prestado no catálogo (escolha livre da cliente no resgate)</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} — R$ {s.price.toFixed(2).replace('.', ',')} ({s.duration} min • {s.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Se for Desconto %, define a porcentagem */}
                  {localSettings.referralRewardType === 'discount_percent' && (
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                        Porcentagem de Desconto no Serviço (%)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="5"
                          max="100"
                          step="5"
                          value={localSettings.referralRewardDiscountPercent || 50}
                          onChange={e => {
                            const pct = Math.min(100, Math.max(1, Number(e.target.value)));
                            const selected = services.find(s => s.id === localSettings.referralRewardServiceId);
                            const text = selected 
                              ? `Ganhe ${pct}% de desconto em ${selected.name} ao completar suas indicações!` 
                              : `Ganhe ${pct}% de desconto no serviço ao completar suas indicações!`;
                            setLocalSettings({
                              ...localSettings,
                              referralRewardDiscountPercent: pct,
                              referralRewardText: text
                            });
                          }}
                          className="w-full px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 font-bold text-stone-900 dark:text-stone-100 text-sm"
                        />
                        <span className="font-bold text-stone-600">%</span>
                      </div>
                    </div>
                  )}

                  {/* Texto Exibido para a Cliente */}
                  <div className={localSettings.referralRewardType === 'discount_percent' ? '' : 'sm:col-span-2'}>
                    <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      Texto do Bônus Exibido na Cartela da Cliente
                    </label>
                    <input 
                      type="text" 
                      value={localSettings.referralRewardText || ''} 
                      onChange={e => setLocalSettings({...localSettings, referralRewardText: e.target.value})} 
                      placeholder="Ex: Ganhe 1 serviço de cortesia 100% gratuito ao completar sua cartela!" 
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm" 
                    />
                  </div>

                  {/* Mensagem de Agradecimento Editável */}
                  <div className="sm:col-span-2 pt-2">
                    <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      Mensagem de Notificação de Indicação Concluída
                    </label>
                    <textarea 
                      rows={2}
                      value={localSettings.referralThankYouMessage || ''} 
                      onChange={e => setLocalSettings({...localSettings, referralThankYouMessage: e.target.value})} 
                      placeholder="Parabéns! Sua indicação {clientName} concluiu o atendimento no salão! Você ganhou +1 carimbo no seu Cartão de Indicação 🎁" 
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm leading-relaxed" 
                    />
                    <p className="text-[11px] text-stone-500 mt-1">
                      Dica: Use <code className="bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded text-pink-600 font-mono font-bold">{`{clientName}`}</code> onde deseja que apareça o nome da amiga indicada.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-pink-50/70 dark:bg-pink-950/30 p-4 rounded-2xl border border-pink-200 dark:border-pink-900/50 text-xs text-stone-700 dark:text-stone-300 space-y-1.5 mb-6">
              <span className="font-bold text-pink-700 dark:text-pink-300 uppercase block">Resumo do Programa de Indicação:</span>
              <p>1. Cada cliente tem seu código de indicação único para compartilhar com amigas.</p>
              <p>2. A nova cliente insere o código no cadastro e ganha <strong>{(localSettings.referralDiscountType || 'fixed') === 'percent' ? `${localSettings.referralDiscountForReferred ?? 15}%` : `R$ ${(localSettings.referralDiscountForReferred ?? 10).toFixed(2).replace('.', ',')}`} de desconto</strong> no seu 1º atendimento.</p>
              <p>3. A cliente que indicou ganha 1 selo por amiga que concluir o 1º agendamento.</p>
              <p>4. Ao alcançar {localSettings.referralMaxStamps ?? 5} selos, ela resgata: <strong>{localSettings.referralRewardText || 'sua recompensa especial'}</strong>.</p>
            </div>
            
            <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex justify-end">
              <button type="submit" className="bg-gradient-to-r from-pink-500 to-rose-600 text-white px-8 py-3 rounded-xl font-bold hover:from-pink-600 hover:to-rose-700 transition-all cursor-pointer shadow-md shadow-pink-200/40">
                Salvar Configurações de Indicação
              </button>
            </div>
          </form>

          {/* Tabela de Clientes e Códigos de Indicação */}
          <div className="bg-white dark:bg-stone-900 p-6 md:p-8 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800">
            <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-100 mb-4">
              Clientes, Códigos & Indicações Concluídas
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 dark:bg-stone-800/60 text-stone-600 dark:text-stone-400 text-xs uppercase tracking-wider border-b border-stone-100 dark:border-stone-800">
                    <th className="p-4 font-semibold">Cliente</th>
                    <th className="p-4 font-semibold">Código Pessoal</th>
                    <th className="p-4 font-semibold">Amigas Indicadas (✕)</th>
                    <th className="p-4 font-semibold">Indicada Por</th>
                    <th className="p-4 font-semibold">1º Atendimento</th>
                    <th className="p-4 font-semibold text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-stone-100 dark:divide-stone-800">
                  {clients.map(client => (
                    <tr key={client.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/40">
                      <td className="p-4">
                        <div className="font-semibold text-stone-900 dark:text-stone-100">{client.name}</div>
                        <div className="text-xs text-stone-400">{client.phone}</div>
                      </td>
                      <td className="p-4 font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">
                        {client.referralCode || '—'}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            min="0" 
                            max={localSettings.referralMaxStamps ?? 5}
                            value={client.referralStamps || 0} 
                            onChange={(e) => {
                              const newStamps = Number(e.target.value);
                              setClients(prev => prev.map(c => c.id === client.id ? { ...c, referralStamps: newStamps } : c));
                            }}
                            className="w-16 px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold text-center"
                          />
                          <span className="text-stone-400">/ {localSettings.referralMaxStamps ?? 5}</span>
                        </div>
                      </td>
                      <td className="p-4 text-xs font-medium text-stone-600 dark:text-stone-300">
                        {client.referredBy ? (
                          <span className="bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 px-2 py-0.5 rounded border border-pink-200 font-mono">
                            {client.referredBy}
                          </span>
                        ) : (
                          <span className="text-stone-400">Direto</span>
                        )}
                      </td>
                      <td className="p-4">
                        {client.firstBookingDone ? (
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                            ✓ Realizado
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                            Pendente
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => updateReferralStamps(client.id, client.referralStamps || 0)} 
                          className="px-3.5 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          Salvar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {clients.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-stone-500">Nenhum cliente cadastrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA: PERSONALIZAÇÃO DO SITE (Aparência Feminina & Temas de Cores) */}
      {activeTab === 'personalization' && (
        <form onSubmit={handleSaveSettings} className="bg-white dark:bg-stone-900 p-6 md:p-8 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800 max-w-4xl space-y-8">
          <div>
            <h3 className="font-serif text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Palette className="text-rose-500" size={24} />
              Personalização da Identidade & Aparência Feminina
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              Altere as cores, temas claro/escuro, slogans, mensagem de boas-vindas e visual do site diretamente por esta aba.
            </p>
          </div>

          {/* SELETOR DE MODO DE TEMA (CLARO / ESCURO) */}
          <div className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <label className="block text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                  Modo de Iluminação do Sistema (Tema Claro / Escuro)
                </label>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Alterne entre a estética diurna acolhedora e a sofisticação do modo escuro com um toque.
                </p>
              </div>
              <div className="inline-flex rounded-xl p-1 bg-stone-200 dark:bg-stone-700 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (themeMode !== 'light') toggleTheme();
                  }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    themeMode === 'light'
                      ? 'bg-white text-rose-600 shadow-xs'
                      : 'text-stone-600 dark:text-stone-300 hover:text-stone-900'
                  }`}
                >
                  <Sun size={16} className="text-amber-500" />
                  <span>Modo Claro</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (themeMode !== 'dark') toggleTheme();
                  }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    themeMode === 'dark'
                      ? 'bg-stone-900 text-rose-400 shadow-xs'
                      : 'text-stone-600 dark:text-stone-300 hover:text-stone-900'
                  }`}
                >
                  <Moon size={16} className="text-indigo-400" />
                  <span>Modo Escuro</span>
                </button>
              </div>
            </div>
            <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${themeMode === 'dark' ? 'bg-indigo-500' : 'bg-amber-500'}`}></span>
              <span>Tema ativo no momento: <strong>{themeMode === 'dark' ? 'Modo Escuro Sofisticado (Dark)' : 'Modo Claro Iluminado (Light)'}</strong></span>
            </div>
          </div>

          {/* Paletas de Cores Femininas */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-3">
              Paleta de Cores do Salão
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { id: 'rose', name: 'Rosa Suave & Blush', desc: 'Delicado, acolhedor e clássico', bg: 'bg-rose-500' },
                { id: 'pink', name: 'Pink Chic & Glam', desc: 'Moderno, vibrante e marcante', bg: 'bg-pink-500' },
                { id: 'rose_gold', name: 'Rose Gold Sofisticado', desc: 'Elegante, premium e refinado', bg: 'bg-amber-600' },
                { id: 'lavender', name: 'Lavanda Romântica', desc: 'Calmo, suave e encantador', bg: 'bg-purple-500' },
                { id: 'nude', name: 'Nude & Pêssego Natural', desc: 'Minimalista, clean e estético', bg: 'bg-stone-600' },
              ].map(palette => {
                const isSelected = (localSettings.themeColor || 'rose') === palette.id;
                return (
                  <div
                    key={palette.id}
                    onClick={() => setLocalSettings({ ...localSettings, themeColor: palette.id })}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                      isSelected 
                        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/40 shadow-sm ring-2 ring-rose-200 dark:ring-rose-900' 
                        : 'border-stone-200 dark:border-stone-800 hover:border-stone-300'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-full ${palette.bg} shrink-0 flex items-center justify-center text-white shadow-xs`}>
                      {isSelected ? <Check size={16} /> : null}
                    </span>
                    <div>
                      <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">{palette.name}</h4>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">{palette.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mensagem de Boas-Vindas & Slogans Femininos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                Mensagem de Boas-Vindas no Banner Principal
              </label>
              <textarea 
                value={localSettings.welcomeMessage || ''} 
                onChange={e => setLocalSettings({ ...localSettings, welcomeMessage: e.target.value })} 
                placeholder="Ex: Realçando sua beleza natural com carinho, técnica e todo cuidado que você merece ✨"
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                Título de Destaque (Hero)
              </label>
              <input 
                type="text" 
                value={localSettings.heroTitle || ''} 
                onChange={e => setLocalSettings({ ...localSettings, heroTitle: e.target.value })} 
                placeholder="Ex: Realce sua beleza única"
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                Subtítulo Delicado
              </label>
              <input 
                type="text" 
                value={localSettings.heroSubtitle || ''} 
                onChange={e => setLocalSettings({ ...localSettings, heroSubtitle: e.target.value })} 
                placeholder="Ex: Espaço de Beleza & Bem-Estar"
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                Foto de Capa Principal (Banner Hero)
              </label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={e => handleImageUpload(e, 'heroImageUrl')} 
                className="w-full text-xs text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100 cursor-pointer"
              />
              {localSettings.heroImageUrl && (
                <div className="mt-2 h-28 rounded-2xl overflow-hidden border border-rose-100 max-w-sm">
                  <img src={localSettings.heroImageUrl} alt="Banner Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                Logotipo ou Ícone do Salão
              </label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={e => handleImageUpload(e, 'storeIconUrl')} 
                className="w-full text-xs text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100 cursor-pointer"
              />
              {localSettings.storeIconUrl && (
                <div className="mt-2 w-16 h-16 rounded-2xl overflow-hidden border border-rose-100">
                  <img src={localSettings.storeIconUrl} alt="Logo Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-stone-100 dark:border-stone-800 flex justify-end">
            <button 
              type="submit" 
              className="bg-gradient-to-r from-rose-500 to-pink-600 text-white px-8 py-3 rounded-xl font-bold hover:from-rose-600 hover:to-pink-700 transition-all cursor-pointer shadow-md shadow-rose-200"
            >
              Salvar Personalização do Site
            </button>
          </div>
        </form>
      )}

      {/* ABA: PROMOÇÃO */}
      {activeTab === 'promo' && (
        <form onSubmit={handleSaveSettings} className="bg-white dark:bg-stone-900 p-6 md:p-8 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800 max-w-4xl space-y-8">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
            <div>
              <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Zap className="text-rose-500" size={22} />
                Promoções & Ofertas da Semana
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Ative promoções com desconto nos serviços do catálogo. Cada cliente só pode resgatar 1 vez por promoção.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={localSettings.promoActive || false} 
                onChange={e => setLocalSettings({...localSettings, promoActive: e.target.checked})} 
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
              <span className="ml-2 text-xs font-bold text-stone-700 dark:text-stone-300">Promoção Ativa</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-1">Título da Promoção</label>
              <input type="text" value={localSettings.promoTitle || ''} onChange={e => setLocalSettings({...localSettings, promoTitle: e.target.value})} placeholder="Ex: Semana da Beleza Especial" className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm font-medium" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-1">Válido Até</label>
              <input type="date" value={localSettings.promoEndsAt || ''} onChange={e => setLocalSettings({...localSettings, promoEndsAt: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm font-medium" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-1">Descrição do Banner</label>
              <input type="text" value={localSettings.promoDescription || ''} onChange={e => setLocalSettings({...localSettings, promoDescription: e.target.value})} placeholder="Ex: Aproveite descontos exclusivos em procedimentos selecionados do nosso catálogo!" className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm" />
            </div>
          </div>

          {/* SELEÇÃO DE SERVIÇOS DO CATÁLOGO PARA A PROMOÇÃO */}
          <div className="p-6 bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl border border-rose-200/70 dark:border-rose-900/50 space-y-4">
            <div>
              <h4 className="font-serif text-base font-bold text-rose-900 dark:text-rose-200 flex items-center gap-2">
                <Tag size={18} className="text-rose-500" />
                Escolher Serviços do Catálogo para a Promoção
              </h4>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                Selecione os serviços cadastrados no catálogo e defina a porcentagem de desconto individual.
              </p>
            </div>

            {/* Adicionar Serviço com Porcentagem e Duração Estipulada */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-white dark:bg-stone-800 p-4 rounded-xl border border-rose-100 dark:border-stone-700 shadow-xs">
              <div className="sm:col-span-5">
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Serviço do Catálogo
                </label>
                <select
                  value={selectedPromoServiceId}
                  onChange={e => {
                    const id = e.target.value;
                    setSelectedPromoServiceId(id);
                    const found = services.find(s => s.id === id);
                    if (found) {
                      setSelectedPromoDurationMinutes(found.duration || 60);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-medium text-stone-900 dark:text-stone-100"
                >
                  <option value="">-- Selecione o serviço --</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} — R$ {s.price.toFixed(2).replace('.', ',')} ({s.duration} min • {s.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Desconto (%)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="95"
                    step="1"
                    value={selectedPromoDiscountPercent}
                    onChange={e => setSelectedPromoDiscountPercent(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-stone-900 dark:text-stone-100 font-mono"
                  />
                  <span className="text-xs font-bold text-stone-600">%</span>
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Duração Promo (min)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={selectedPromoDurationMinutes}
                    onChange={e => setSelectedPromoDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-stone-900 dark:text-stone-100 font-mono"
                  />
                  <span className="text-[11px] font-semibold text-stone-500">min</span>
                </div>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  disabled={!selectedPromoServiceId}
                  onClick={() => {
                    if (!selectedPromoServiceId) return;
                    const existing = localSettings.promoServices || [];
                    const filtered = existing.filter(p => p.serviceId !== selectedPromoServiceId);
                    const updated = [
                      ...filtered, 
                      { 
                        serviceId: selectedPromoServiceId, 
                        discountPercent: selectedPromoDiscountPercent,
                        durationMinutes: selectedPromoDurationMinutes 
                      }
                    ];
                    setLocalSettings({ ...localSettings, promoServices: updated });
                    setSelectedPromoServiceId('');
                  }}
                  className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus size={14} /> Adicionar
                </button>
              </div>

              {/* Pré-visualização do Preço e Duração */}
              {selectedPromoServiceId && (() => {
                const s = services.find(item => item.id === selectedPromoServiceId);
                if (!s) return null;
                const finalPrice = s.price * (1 - (selectedPromoDiscountPercent / 100));
                return (
                  <div className="sm:col-span-12 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span>
                        Original: <strong>R$ {s.price.toFixed(2).replace('.', ',')}</strong> ➔ Promoção: <strong>R$ {finalPrice.toFixed(2).replace('.', ',')}</strong> ({selectedPromoDiscountPercent}% OFF)
                      </span>
                      <span className="bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        ⏱️ {selectedPromoDurationMinutes} min estipulados
                      </span>
                    </div>
                    <span className="font-bold">Economia de R$ {(s.price - finalPrice).toFixed(2).replace('.', ',')}</span>
                  </div>
                );
              })()}
            </div>

            {/* Lista dos Serviços Atualmente em Promoção com Envio WhatsApp Individual */}
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-2">
                Serviços Atualmente na Promoção ({(localSettings.promoServices || []).length}):
              </label>

              {(localSettings.promoServices || []).length === 0 ? (
                <div className="text-center py-6 bg-white/70 dark:bg-stone-800/50 rounded-xl border border-dashed border-rose-200 dark:border-stone-700">
                  <Tag size={28} className="mx-auto text-rose-300 mb-1" />
                  <p className="text-xs text-stone-500">Nenhum serviço individual selecionado ainda.</p>
                  <p className="text-[11px] text-stone-400">Escolha um serviço no seletor acima para ativar descontos e tempo de atendimento na promoção.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(localSettings.promoServices || []).map(ps => {
                    const svc = services.find(s => s.id === ps.serviceId);
                    if (!svc) return null;
                    const finalPrice = svc.price * (1 - (ps.discountPercent / 100));
                    const promoDuration = ps.durationMinutes || svc.duration || 60;

                    // Mensagem WhatsApp formatada
                    const whatsappMsg = `✨ *SUPER OFERTA NO ${localSettings.name || 'NOSSO SALÃO'}!* ✨\n\n` +
                      `Olá! Temos uma promoção especial para você:\n` +
                      `💇 *Procedimento:* ${svc.name}\n` +
                      `⏱️ *Tempo de Atendimento:* ${promoDuration} minutos\n` +
                      `🏷️ *Desconto:* ${ps.discountPercent}% OFF\n` +
                      `💰 *Valor Especial:* de ~R$ ${svc.price.toFixed(2).replace('.', ',')}~ por apenas *R$ ${finalPrice.toFixed(2).replace('.', ',')}*!\n\n` +
                      `📅 Garanta seu horário online agora pelo nosso site:\n${window.location.origin}`;

                    const whatsappLink = `https://wa.me/?text=${encodeURIComponent(whatsappMsg)}`;

                    return (
                      <div 
                        key={ps.serviceId} 
                        className="bg-white dark:bg-stone-800 p-4 rounded-xl border border-rose-100 dark:border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between shadow-2xs gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-stone-900 dark:text-stone-100">{svc.name}</span>
                            <span className="bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-[10px] font-black px-2 py-0.5 rounded-md">
                              -{ps.discountPercent}%
                            </span>
                            <span className="bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Clock size={11} /> {promoDuration} min estipulados
                            </span>
                          </div>
                          <div className="text-xs text-stone-400 flex items-center gap-2">
                            <span className="line-through">R$ {svc.price.toFixed(2).replace('.', ',')}</span>
                            <span className="text-rose-600 dark:text-rose-400 font-extrabold text-sm">
                              R$ {finalPrice.toFixed(2).replace('.', ',')}
                            </span>
                            <span className="text-stone-400 text-[11px]">
                              (Economia de R$ {(svc.price - finalPrice).toFixed(2).replace('.', ',')})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 dark:border-stone-700">
                          {/* Botão Enviar Oferta via WhatsApp */}
                          <a
                            href={whatsappLink}
                            target="_blank"
                            rel="noreferrer"
                            className="py-1.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                            title="Compartilhar oferta deste serviço no WhatsApp"
                          >
                            <MessageCircle size={14} />
                            <span>Enviar no WhatsApp</span>
                          </a>

                          {/* Botão Copiar Texto */}
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(whatsappMsg);
                              setCopiedServiceWhatsappId(ps.serviceId);
                              setTimeout(() => setCopiedServiceWhatsappId(null), 2500);
                            }}
                            className="p-1.5 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 bg-stone-100 dark:bg-stone-700 rounded-lg transition-colors cursor-pointer"
                            title="Copiar texto da mensagem"
                          >
                            {copiedServiceWhatsappId === ps.serviceId ? (
                              <CheckCheck size={16} className="text-emerald-600" />
                            ) : (
                              <Copy size={16} />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const updated = (localSettings.promoServices || []).filter(item => item.serviceId !== ps.serviceId);
                              setLocalSettings({ ...localSettings, promoServices: updated });
                            }}
                            className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                            title="Remover serviço da promoção"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Compartilhar Campanha Geral no WhatsApp */}
            {(localSettings.promoServices || []).length > 0 && (() => {
              const promoCount = (localSettings.promoServices || []).length;
              const campaignText = `🎉 *PROMOÇÕES ESPECIAIS - ${localSettings.name || 'BELLA BEAUTY'}* 🎉\n\n` +
                `${localSettings.promoTitle || 'Ofertas Imperdíveis'}\n` +
                `${localSettings.promoDescription ? `"${localSettings.promoDescription}"\n\n` : '\n'}` +
                `Confira nossos serviços com desconto exclusivo:\n\n` +
                (localSettings.promoServices || []).map(ps => {
                  const s = services.find(item => item.id === ps.serviceId);
                  if (!s) return '';
                  const final = s.price * (1 - (ps.discountPercent / 100));
                  const dur = ps.durationMinutes || s.duration || 60;
                  return `• *${s.name}*: de ~R$ ${s.price.toFixed(2).replace('.', ',')}~ por *R$ ${final.toFixed(2).replace('.', ',')}* (-${ps.discountPercent}% OFF • ⏱️ ${dur} min)\n`;
                }).join('') +
                `\n${localSettings.promoEndsAt ? `⏳ Válido até: ${new Date(localSettings.promoEndsAt).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}\n` : ''}` +
                `\nAgende seu horário online com facilidade:\n${window.location.origin}`;

              const generalWhatsappLink = `https://wa.me/?text=${encodeURIComponent(campaignText)}`;

              return (
                <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-rose-500/10 dark:from-emerald-950/40 dark:to-rose-950/30 rounded-2xl border border-emerald-300 dark:border-emerald-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h5 className="font-serif text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                        <MessageCircle size={18} className="text-emerald-600 dark:text-emerald-400" />
                        Divulgação Completa via WhatsApp ({promoCount} ofertas)
                      </h5>
                      <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                        Envie todas as promoções de uma vez para seus clientes ou listas de transmissão no WhatsApp.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={generalWhatsappLink}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                      >
                        <MessageCircle size={15} />
                        <span>Disparar Campanha no WhatsApp</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(campaignText);
                          setCopiedPromoWhatsapp(true);
                          setTimeout(() => setCopiedPromoWhatsapp(false), 2500);
                        }}
                        className="py-2 px-3 bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Copiar texto da campanha completa"
                      >
                        {copiedPromoWhatsapp ? (
                          <>
                            <CheckCheck size={14} className="text-emerald-600" />
                            <span className="text-emerald-600 font-bold">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>Copiar Texto</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex justify-end">
            <button type="submit" className="bg-gradient-to-r from-rose-500 to-pink-600 text-white px-8 py-3 rounded-xl font-bold hover:from-rose-600 hover:to-pink-700 transition-all cursor-pointer shadow-md shadow-rose-200">
              Salvar Promoção
            </button>
          </div>
        </form>
      )}

      {/* ABA: HORÁRIOS E DIAS DE ATENDIMENTO PERSONALIZADOS */}
      {activeTab === 'schedule' && (
        <form onSubmit={handleSaveSettings} className="space-y-8 max-w-4xl">
          {/* SELETOR DOS 7 DIAS DA SEMANA */}
          <div className="bg-white dark:bg-stone-900 p-6 md:p-8 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <CalendarCheck className="text-rose-500" size={22} />
                  Horários Personalizados por Dia da Semana
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  Configure dias de atendimento e horários específicos para cada dia de Segunda a Domingo.
                </p>
              </div>

              {/* Botão para aplicar presets rápidos */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // Preencher Segunda a Sábado com horário comercial
                    const updated = { ...(localSettings.dailySchedules || defaultDailySchedules) };
                    [1, 2, 3, 4, 5].forEach(d => {
                      updated[d] = { enabled: true, slots: ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'] };
                    });
                    updated[6] = { enabled: true, slots: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'] };
                    updated[0] = { enabled: false, slots: [] };
                    setLocalSettings({
                      ...localSettings,
                      dailySchedules: updated,
                      availableDays: [1, 2, 3, 4, 5, 6]
                    });
                  }}
                  className="text-xs font-semibold px-3 py-1.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                >
                  Restaurar Padrão Seg-Sáb
                </button>
              </div>
            </div>

            {/* Navegação entre os 7 dias */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
              {[
                { day: 0, label: 'Domingo', short: 'Dom' },
                { day: 1, label: 'Segunda', short: 'Seg' },
                { day: 2, label: 'Terça', short: 'Ter' },
                { day: 3, label: 'Quarta', short: 'Qua' },
                { day: 4, label: 'Quinta', short: 'Qui' },
                { day: 5, label: 'Sexta', short: 'Sex' },
                { day: 6, label: 'Sábado', short: 'Sáb' },
              ].map(({ day, label, short }) => {
                const sched = getDaySchedule(day);
                const isCurrentTab = selectedDayTab === day;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDayTab(day)}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer relative ${
                      isCurrentTab
                        ? 'border-rose-600 bg-rose-50/80 dark:bg-rose-950/40 ring-2 ring-rose-500/20'
                        : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-850 hover:bg-stone-50 dark:hover:bg-stone-800'
                    }`}
                  >
                    <span className={`text-xs font-bold ${isCurrentTab ? 'text-rose-700 dark:text-rose-300' : 'text-stone-800 dark:text-stone-200'}`}>
                      {short}
                    </span>
                    <span className="text-[10px] text-stone-400">{label}</span>
                    
                    {/* Badge de status do dia */}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1 ${
                      sched.enabled 
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-400'
                    }`}>
                      {sched.enabled ? `${sched.slots.length} horários` : 'Fechado'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CONFIGURAÇÃO DO DIA SELECIONADO */}
          {(() => {
            const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            const currentSched = getDaySchedule(selectedDayTab);

            return (
              <div className="bg-white dark:bg-stone-900 p-6 md:p-8 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Clock className="text-rose-500" size={20} />
                      <h4 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100">
                        Configurando: {dayNames[selectedDayTab]}
                      </h4>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      Defina se o estabelecimento abre e quais horários estão livres para agendamento.
                    </p>
                  </div>

                  {/* Toggle Aberto / Fechado */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      {currentSched.enabled ? 'Atendimento Aberto' : 'Fechado neste dia'}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={currentSched.enabled} 
                        onChange={e => updateDaySchedule(selectedDayTab, { enabled: e.target.checked })} 
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>

                {currentSched.enabled ? (
                  <>
                    {/* Botões de Ação Rápida / Presets para o dia */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-stone-500 mr-1">Preenchimento Rápido:</span>
                      <button
                        type="button"
                        onClick={() => {
                          updateDaySchedule(selectedDayTab, {
                            slots: ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']
                          });
                        }}
                        className="text-xs px-2.5 py-1 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors font-medium"
                      >
                        Comercial (08h às 18h)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateDaySchedule(selectedDayTab, {
                            slots: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00']
                          });
                        }}
                        className="text-xs px-2.5 py-1 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors font-medium"
                      >
                        Meio Período (08h às 14h)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateDaySchedule(selectedDayTab, {
                            slots: ['13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00']
                          });
                        }}
                        className="text-xs px-2.5 py-1 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors font-medium"
                      >
                        Vespertino (13h às 19h)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Copiar estes horários para Segunda a Sexta
                          const slotsToCopy = currentSched.slots;
                          const newDaily = { ...(localSettings.dailySchedules || defaultDailySchedules) };
                          [1, 2, 3, 4, 5].forEach(d => {
                            newDaily[d] = { enabled: true, slots: [...slotsToCopy] };
                          });
                          setLocalSettings({ ...localSettings, dailySchedules: newDaily });
                        }}
                        className="text-xs px-2.5 py-1 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-lg hover:bg-rose-100 transition-colors font-bold"
                      >
                        Copiar p/ Seg-Sex
                      </button>
                    </div>

                    {/* Adicionar Horário Específico */}
                    <div className="p-4 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-200 dark:border-stone-700 flex flex-col sm:flex-row items-center gap-3">
                      <label className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider shrink-0">
                        Adicionar Horário em {dayNames[selectedDayTab]}:
                      </label>
                      <input
                        type="time"
                        value={daySlotInput}
                        onChange={e => setDaySlotInput(e.target.value)}
                        className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm font-medium focus:ring-2 focus:ring-rose-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!daySlotInput) return;
                          if (currentSched.slots.includes(daySlotInput)) {
                            alert(`O horário ${daySlotInput} já está cadastrado para este dia.`);
                            return;
                          }
                          const updatedSlots = [...currentSched.slots, daySlotInput].sort();
                          updateDaySchedule(selectedDayTab, { slots: updatedSlots });
                          setDaySlotInput('');
                        }}
                        className="px-5 py-2 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 rounded-xl text-xs font-bold hover:bg-stone-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus size={15} /> Adicionar Horário
                      </button>
                    </div>

                    {/* Lista dos Horários do Dia */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-xs font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider">
                          Horários Ativos em {dayNames[selectedDayTab]} ({currentSched.slots.length}):
                        </label>
                        {currentSched.slots.length > 0 && (
                          <button
                            type="button"
                            onClick={() => updateDaySchedule(selectedDayTab, { slots: [] })}
                            className="text-[11px] text-rose-500 hover:text-rose-700 font-semibold"
                          >
                            Limpar todos os horários
                          </button>
                        )}
                      </div>

                      {currentSched.slots.length === 0 ? (
                        <div className="text-center py-8 bg-stone-50/60 dark:bg-stone-800/40 rounded-2xl border border-dashed border-stone-200 dark:border-stone-700">
                          <Clock size={28} className="mx-auto text-stone-300 mb-1" />
                          <p className="text-xs text-stone-500">Nenhum horário cadastrado para {dayNames[selectedDayTab]}.</p>
                          <p className="text-[11px] text-stone-400">Clique em um dos presets acima ou adicione horários manualmente.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                          {currentSched.slots.map(slot => (
                            <div
                              key={slot}
                              className="p-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl flex items-center justify-between shadow-2xs group hover:border-stone-400 transition-colors"
                            >
                              <span className="text-sm font-bold text-stone-800 dark:text-stone-200">{slot}</span>
                              <button
                                type="button"
                                title="Excluir horário deste dia"
                                onClick={() => {
                                  const updatedSlots = currentSched.slots.filter(s => s !== slot);
                                  updateDaySchedule(selectedDayTab, { slots: updatedSlots });
                                }}
                                className="text-stone-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-10 bg-stone-50 dark:bg-stone-800/40 rounded-2xl border border-dashed border-stone-200 dark:border-stone-700">
                    <p className="text-sm font-medium text-stone-600 dark:text-stone-300">
                      O atendimento está fechado em <strong>{dayNames[selectedDayTab]}</strong>.
                    </p>
                    <p className="text-xs text-stone-400 mt-1">
                      Para disponibilizar horários neste dia, ative a chave no canto superior direito.
                    </p>
                  </div>
                )}

                <div className="pt-6 border-t border-stone-100 dark:border-stone-800 flex justify-end">
                  <button
                    type="submit"
                    className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-8 py-3 rounded-xl font-bold hover:bg-stone-800 transition-colors cursor-pointer shadow-md"
                  >
                    Salvar Horários e Dias
                  </button>
                </div>
              </div>
            );
          })()}
        </form>
      )}

      {/* ABA: DADOS DO NEGÓCIO & PAGAMENTO */}
      {activeTab === 'settings' && (
        <div className="space-y-8 max-w-3xl">
          <form onSubmit={handleSaveSettings} className="bg-white dark:bg-stone-900 p-6 md:p-8 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-8">
            <div>
              <h3 className="font-serif text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Settings2 className="text-rose-500" size={24} />
                Dados do Estabelecimento & Pagamento
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Atualize as informações comerciais do salão e personalize a mensagem de cobrança exibida para suas clientes.
              </p>
            </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
              Informações do Salão
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase text-stone-700 dark:text-stone-300 mb-1">Nome do Salão</label>
                <input required type="text" value={localSettings.name} onChange={e => setLocalSettings({...localSettings, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase text-stone-700 dark:text-stone-300 mb-1">Subtítulo / Descrição Curta</label>
                <input required type="text" value={localSettings.subtitle} onChange={e => setLocalSettings({...localSettings, subtitle: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-stone-700 dark:text-stone-300 mb-1">WhatsApp Oficial</label>
                <input required type="text" value={localSettings.phone} onChange={e => setLocalSettings({...localSettings, phone: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-stone-700 dark:text-stone-300 mb-1">Horário de Funcionamento</label>
                <input required type="text" value={localSettings.hours} onChange={e => setLocalSettings({...localSettings, hours: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase text-stone-700 dark:text-stone-300 mb-1">Endereço Completo</label>
                <input required type="text" value={localSettings.address} onChange={e => setLocalSettings({...localSettings, address: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase text-stone-700 dark:text-stone-300 mb-1">Instagram (ex: @bellabeauty)</label>
                <input required type="text" value={localSettings.instagram} onChange={e => setLocalSettings({...localSettings, instagram: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm" />
              </div>
            </div>
          </div>

          {/* PAINEL DE SEGURANÇA, CRIPTOGRAFIA, ESCUDO ANTI-ROBÔ & PACOTE ZIP */}
          <div className="pt-6 border-t border-stone-100 dark:border-stone-800 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Shield className="text-emerald-600 dark:text-emerald-400" size={20} />
                  Segurança Máxima, Barreira Anti-Robô & Bloqueio por IP
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Proteção de dados em repouso (LGPD), proteção contra força bruta por IP e acesso 100% discreto.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 size={13} />
                Sistema Blindado Ativo
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="flex items-center gap-2 text-xs font-bold text-stone-800 dark:text-stone-200 mb-1">
                  <Lock size={15} className="text-emerald-500" />
                  Criptografia AES-256-GCM
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                  Todos os CPFs, telefones e anotações confidenciais das clientes são criptografados com chave militar de 256 bits no banco de dados.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="flex items-center gap-2 text-xs font-bold text-stone-800 dark:text-stone-200 mb-1">
                  <ShieldAlert size={15} className="text-rose-500" />
                  Barreira Anti-Robô (Honeypot)
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                  Armadilha invisível e verificação de velocidade que detecta robôs automaticamente e bloqueia envio de formulários spam.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="flex items-center gap-2 text-xs font-bold text-stone-800 dark:text-stone-200 mb-1">
                  <KeyRound size={15} className="text-amber-500" />
                  Proteção por IP & Rate Limiter
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                  Limite de 5 tentativas consecutivas por IP. Caso excedido, o IP é bloqueado por 15 minutos contra ataques de força bruta.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="flex items-center gap-2 text-xs font-bold text-stone-800 dark:text-stone-200 mb-1">
                  <Users size={15} className="text-purple-500" />
                  Acesso Discreto Unificado
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                  A tela de login é 100% voltada para as clientes. Administradora e equipe entram pela mesma tela com seu login e senha, de forma invisível para visitantes.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="flex items-center gap-2 text-xs font-bold text-stone-800 dark:text-stone-200 mb-1">
                  <Search size={15} className="text-emerald-500" />
                  Busca Blind Index HMAC-SHA256
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                  Validação instantânea de cadastros sem descriptografar dados em memória, garantindo performance e conformidade com a LGPD.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="flex items-center gap-2 text-xs font-bold text-stone-800 dark:text-stone-200 mb-1">
                  <UserCheck size={15} className="text-emerald-500" />
                  Login Google & Senha de Clientes
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                  Clientes podem cadastrar sua própria senha de acesso ou entrar com 1 toque através da conta Google verificada.
                </p>
              </div>
            </div>

            {/* CARD DESTACADO: PACOTE COMPLETO PARA PUBLICAÇÃO DO SITE (EXCLUSIVO PARA O TÉCNICO CLEILTON LIRA) */}
            {user?.username === 'cleiltonlira' && (
              <div className="p-6 rounded-3xl bg-gradient-to-br from-rose-50 via-pink-50/60 to-white dark:from-stone-850 dark:via-stone-900 dark:to-stone-850 border-2 border-rose-200/80 dark:border-rose-900/60 shadow-sm mt-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-200 dark:shadow-none">
                      <FileArchive size={28} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-100/70 dark:bg-rose-950 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-900">
                          Área Exclusiva do Técnico
                        </span>
                        <span className="text-xs text-amber-700 dark:text-amber-300 font-bold">• Cleilton Lira</span>
                      </div>
                      <h4 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-100 mt-1">
                        Arquivo ZIP para Publicação do Site
                      </h4>
                      <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 max-w-xl leading-relaxed">
                        Baixe o pacote completo com todo o código compilado (HTML, CSS, JS, banco de dados SQLite, servidor e guia em PDF/texto) pronto para ser hospedado no cPanel, Vercel, Netlify, Render ou VPS.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleRegenerateZip}
                      disabled={zipGenerating}
                      className="px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-750 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                      title="Gera um novo pacote ZIP atualizado com as últimas fotos e dados"
                    >
                      {zipGenerating ? (
                        <span className="inline-block w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <RotateCcw size={14} />
                          <span>Atualizar Pacote ZIP</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadPublicationZip}
                      className="px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-rose-200/50 dark:shadow-none transition-all cursor-pointer active:scale-95"
                    >
                      <Download size={16} />
                      <span>Baixar Arquivo ZIP</span>
                    </button>
                  </div>
                </div>

                {/* Informações detalhadas do pacote */}
                <div className="mt-4 pt-3.5 border-t border-rose-100 dark:border-stone-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-stone-500 dark:text-stone-400">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    <span>Frontend compilado em <strong>dist/</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    <span>Banco de Dados <strong>database.sqlite</strong> incluído</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    <span>Manual passo a passo <strong>COMO-PUBLICAR.md</strong></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SEÇÃO EDITÁVEL DE PAGAMENTO */}
          <div className="pt-6 border-t border-stone-100 dark:border-stone-800 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <CreditCard className="text-rose-600 dark:text-rose-400" size={20} />
                  Instruções e Mensagem de Pagamento
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Atualize a mensagem de "Pagamento no ato do atendimento" exibida durante o agendamento e no comprovante.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLocalSettings({
                    ...localSettings,
                    paymentTitle: 'Pagamento no ato do atendimento',
                    paymentInstructions: 'O pagamento do seu procedimento não é cobrado agora pelo site. Você realiza o pagamento no ato do atendimento diretamente no salão (aceitamos Cartões de Crédito/Débito, PIX e Dinheiro).',
                    paymentMethodsList: 'PIX, Cartão de Crédito/Débito e Dinheiro',
                    paymentPixKey: ''
                  });
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1.5 py-1 px-2.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 cursor-pointer transition-colors"
              >
                <RotateCcw size={13} />
                Restaurar Mensagem Padrão
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-stone-700 dark:text-stone-300 mb-1">
                  Título da Cobrança / Status
                </label>
                <input
                  type="text"
                  value={localSettings.paymentTitle ?? 'Pagamento no ato do atendimento'}
                  onChange={e => setLocalSettings({...localSettings, paymentTitle: e.target.value})}
                  placeholder="Ex: Pagamento no ato do atendimento"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm font-medium"
                />
                <span className="text-[11px] text-stone-400 dark:text-stone-500 mt-1 block">
                  Exibido no resumo do procedimento e no status do comprovante.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-stone-700 dark:text-stone-300 mb-1">
                  Formas de Pagamento Aceitas
                </label>
                <input
                  type="text"
                  value={localSettings.paymentMethodsList ?? 'PIX, Cartão de Crédito/Débito e Dinheiro'}
                  onChange={e => setLocalSettings({...localSettings, paymentMethodsList: e.target.value})}
                  placeholder="Ex: PIX, Cartão de Crédito/Débito e Dinheiro"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm"
                />
                <span className="text-[11px] text-stone-400 dark:text-stone-500 mt-1 block">
                  Exibido como badge rápida e no WhatsApp compartilhado.
                </span>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase text-stone-700 dark:text-stone-300 mb-1">
                  Mensagem Explicativa de Pagamento (Instruções para a Cliente)
                </label>
                <textarea
                  rows={3}
                  value={localSettings.paymentInstructions ?? 'O pagamento do seu procedimento não é cobrado agora pelo site. Você realiza o pagamento no ato do atendimento diretamente no salão (aceitamos Cartões de Crédito/Débito, PIX e Dinheiro).'}
                  onChange={e => setLocalSettings({...localSettings, paymentInstructions: e.target.value})}
                  placeholder="Digite as instruções de pagamento que a cliente verá antes de confirmar..."
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm leading-relaxed"
                />
                <span className="text-[11px] text-stone-400 dark:text-stone-500 mt-1 block">
                  Esta mensagem é exibida para a cliente ao agendar e no lembrete do recibo.
                </span>
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase text-stone-700 dark:text-stone-300">
                    Chave PIX do Salão (Geração Automática de QR Code & Copia e Cola)
                  </label>
                  {localSettings.paymentPixKey && localSettings.paymentPixKey.trim() && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <Check size={13} /> QR Code Gerado Automaticamente
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={localSettings.paymentPixKey ?? ''}
                    onChange={e => setLocalSettings({...localSettings, paymentPixKey: e.target.value})}
                    placeholder="Ex: 11999998888 ou financeiro@bellabeauty.com.br ou CNPJ"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm font-mono"
                  />
                  {localSettings.paymentPixKey && localSettings.paymentPixKey.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(localSettings.paymentPixKey || '');
                        setCopiedPixKey(true);
                        setTimeout(() => setCopiedPixKey(false), 2500);
                        showToast('Chave PIX copiada com sucesso!', 'success');
                      }}
                      className="px-4 py-2.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                      title="Copiar Chave PIX"
                    >
                      {copiedPixKey ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      <span>{copiedPixKey ? 'Copiada!' : 'Copiar Chave'}</span>
                    </button>
                  )}
                </div>
                <span className="text-[11px] text-stone-400 dark:text-stone-500 mt-1 block">
                  Ao preencher esta chave, o sistema gera instantaneamente o QR Code e o botão para a cliente copiar a chave PIX para pagamento na tela de agendamento e nos comprovantes.
                </span>
              </div>
            </div>

            {/* PRÉ-VISUALIZAÇÃO AO VIVO */}
            <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl">
              <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider block mb-2">
                Pré-visualização para a Cliente (Tela de Agendamento):
              </span>
              <div className="bg-white dark:bg-stone-800 p-3.5 rounded-xl border border-amber-200/60 dark:border-stone-700 flex items-start gap-3 text-xs">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <CreditCard size={16} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <strong className="text-stone-900 dark:text-stone-100 font-semibold">
                      {localSettings.paymentTitle || 'Pagamento no ato do atendimento'}
                    </strong>
                    {localSettings.paymentMethodsList && (
                      <span className="text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full font-medium">
                        {localSettings.paymentMethodsList}
                      </span>
                    )}
                  </div>
                  <p className="text-stone-600 dark:text-stone-300 mt-1 leading-relaxed">
                    {localSettings.paymentInstructions || 'O pagamento do seu procedimento não é cobrado agora pelo site. Você realiza o pagamento no ato do atendimento diretamente no salão (aceitamos Cartões de Crédito/Débito, PIX e Dinheiro).'}
                  </p>
                  {localSettings.paymentPixKey && (
                    <div className="mt-3 space-y-3 pt-3 border-t border-amber-200/60 dark:border-stone-700">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-[11px] text-amber-900 dark:text-amber-200 bg-white dark:bg-stone-900 p-2 px-3 rounded-xl border border-amber-200 dark:border-stone-700 font-mono flex items-center gap-1.5 shadow-2xs">
                          <span className="font-sans font-medium text-stone-500">Chave PIX:</span>
                          <strong>{localSettings.paymentPixKey}</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(localSettings.paymentPixKey || '');
                            setCopiedPixKey(true);
                            setTimeout(() => setCopiedPixKey(false), 2500);
                            showToast('Chave PIX copiada com sucesso!', 'success');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {copiedPixKey ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          <span>{copiedPixKey ? 'Copiada!' : 'Copiar Chave'}</span>
                        </button>
                      </div>

                      <div className="p-3.5 bg-white dark:bg-stone-900 rounded-2xl border border-amber-200 dark:border-stone-700 flex flex-col sm:flex-row items-center gap-4">
                        <img 
                          src={pixQrDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(localSettings.paymentPixKey)}`} 
                          alt="QR Code Pix" 
                          className="w-28 h-28 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white p-1.5 shadow-xs shrink-0" 
                        />
                        <div className="space-y-1 text-center sm:text-left">
                          <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center justify-center sm:justify-start gap-1.5">
                            <QrCode size={16} className="text-emerald-600" />
                            QR Code Pix Gerado Automaticamente
                          </span>
                          <span className="text-[11px] text-stone-500 dark:text-stone-400 block leading-relaxed">
                            Padrão oficial do Banco Central. Gerado em tempo real e exibido automaticamente nas fichas e comprovantes das clientes.
                          </span>
                          {pixPayloadStr && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(pixPayloadStr);
                                setCopiedPixPayload(true);
                                setTimeout(() => setCopiedPixPayload(false), 2500);
                                showToast('Código Pix Copia e Cola copiado!', 'success');
                              }}
                              className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              {copiedPixPayload ? <Check size={12} /> : <Copy size={12} />}
                              <span>{copiedPixPayload ? 'Código Copiado!' : 'Copiar Código Pix Copia e Cola'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex justify-end">
            <button type="submit" className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-8 py-3 rounded-xl font-bold hover:bg-stone-800 cursor-pointer shadow-sm">
              Salvar Dados & Regras de Pagamento
            </button>
          </div>
        </form>

        {/* CARTÃO SEPARADO: ALTERAR LOGIN E SENHA DA ADMINISTRADORA */}
        <div className="bg-white dark:bg-stone-900 p-6 md:p-8 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800 max-w-3xl mt-8">
          <div className="flex items-start justify-between flex-wrap gap-4 pb-5 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-900/50">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  Trocar Login e Senha da Administradora
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Atualize suas credenciais mestras de acesso ao painel de controle.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-mono">
              Usuário atual: {user?.username || 'admin'}
            </span>
          </div>

          <form onSubmit={async (e) => {
            e.preventDefault();
            if (adminUsername.trim().toLowerCase() === 'cleiltonlira') {
              showToast('O login secreto do técnico é exclusivo e não pode ser utilizado ou alterado.', 'error');
              return;
            }
            if (!adminNewPassword) {
              showToast('Digite a nova senha desejada.', 'error');
              return;
            }
            if (adminNewPassword !== adminConfirmPassword) {
              showToast('A confirmação da nova senha não confere.', 'error');
              return;
            }
            if (adminNewPassword.length < 4) {
              showToast('A nova senha deve ter no mínimo 4 caracteres.', 'error');
              return;
            }

            setAdminSavingCredentials(true);
            try {
              const res = await fetch('/api/admin/credentials', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  currentPassword: adminCurrentPassword,
                  newUsername: adminUsername.trim(),
                  newPassword: adminNewPassword
                })
              });
              const data = await res.json();
              if (!res.ok) {
                showToast(data.error || 'Erro ao atualizar credenciais.', 'error');
              } else {
                showToast('Login e senha da administradora alterados com sucesso!', 'success');
                setAdminCurrentPassword('');
                setAdminNewPassword('');
                setAdminConfirmPassword('');
              }
            } catch {
              showToast('Falha na comunicação com o servidor.', 'error');
            } finally {
              setAdminSavingCredentials(false);
            }
          }} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Novo Usuário de Login (Opcional)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={adminUsername}
                    onChange={e => setAdminUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="Ex: admin ou seu nome"
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-mono lowercase focus:ring-2 focus:ring-rose-400 focus:outline-none"
                    required
                  />
                </div>
                <span className="text-[11px] text-stone-400 dark:text-stone-500 mt-1 block">
                  Usado no campo "Usuário ou CPF" da tela de acesso admin.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Senha Atual (Para Confirmação)
                </label>
                <input
                  type={showAdminPass ? "text" : "password"}
                  value={adminCurrentPassword}
                  onChange={e => setAdminCurrentPassword(e.target.value)}
                  placeholder="Sua senha atual"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:ring-2 focus:ring-rose-400 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showAdminPass ? "text" : "password"}
                    value={adminNewPassword}
                    onChange={e => setAdminNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:ring-2 focus:ring-rose-400 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPass(!showAdminPass)}
                    className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                  >
                    {showAdminPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Confirmar Nova Senha
                </label>
                <input
                  type={showAdminPass ? "text" : "password"}
                  value={adminConfirmPassword}
                  onChange={e => setAdminConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:ring-2 focus:ring-rose-400 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={adminSavingCredentials}
                className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
              >
                {adminSavingCredentials ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <KeyRound size={14} />
                    <span>Salvar Novo Login & Senha</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      )}

      {/* Modal: Histórico Completo do Cliente */}
      {clientHistoryModal && (() => {
        const clientBookings = bookings.filter(b => {
          if (clientHistoryModal.userId && b.userId === clientHistoryModal.userId) return true;
          if (clientHistoryModal.phone && b.clientPhone === clientHistoryModal.phone) return true;
          if (clientHistoryModal.cpf && b.clientCpf === clientHistoryModal.cpf) return true;
          return b.clientName && b.clientName.toLowerCase() === clientHistoryModal.name.toLowerCase();
        });

        const totalCompleted = clientBookings.filter(b => b.status === 'completed').length;
        const totalInvested = clientBookings.filter(b => b.status === 'completed').reduce((sum, b) => {
          const bServices = services.filter(s => (b.serviceIds || [b.serviceId]).includes(s.id));
          const op = b.originalPrice || bServices.reduce((acc, s) => acc + s.price, 0);
          return sum + (b.finalPrice !== undefined && b.finalPrice !== null ? b.finalPrice : op);
        }, 0);
        const totalEconomy = clientBookings.reduce((sum, b) => {
          const bServices = services.filter(s => (b.serviceIds || [b.serviceId]).includes(s.id));
          const op = b.originalPrice || bServices.reduce((acc, s) => acc + s.price, 0);
          const fp = b.finalPrice !== undefined && b.finalPrice !== null ? b.finalPrice : op;
          return sum + (b.discountAmount || (op > fp ? op - fp : 0));
        }, 0);

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl border border-rose-100 dark:border-stone-800">
              <div className="flex items-start justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 px-2.5 py-1 rounded-full border border-rose-200 dark:border-rose-900">
                      Histórico da Cliente
                    </span>
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-stone-900 dark:text-stone-100 mt-1">
                    {clientHistoryModal.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500 mt-1">
                    {clientHistoryModal.phone && (
                      <a 
                        href={getWhatsAppLink(clientHistoryModal.phone)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1"
                      >
                        <MessageCircle size={14} /> {clientHistoryModal.phone}
                      </a>
                    )}
                    {clientHistoryModal.cpf && (
                      <span className="font-mono bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded text-stone-600 dark:text-stone-300">
                        CPF: {clientHistoryModal.cpf}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setClientHistoryModal(null)}
                  className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Estatísticas resumidas da cliente */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
                <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-2xl border border-stone-100 dark:border-stone-800">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block">Total Agendamentos</span>
                  <span className="text-xl font-bold font-serif text-stone-900 dark:text-stone-100">{clientBookings.length}</span>
                </div>
                <div className="bg-emerald-50/60 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-900">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Concluídos</span>
                  <span className="text-xl font-bold font-serif text-emerald-700 dark:text-emerald-300">{totalCompleted}</span>
                </div>
                <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-2xl border border-stone-100 dark:border-stone-800">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block">Total Investido</span>
                  <span className="text-xl font-bold font-serif text-stone-900 dark:text-stone-100">
                    R$ {totalInvested.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <div className="bg-rose-50/60 dark:bg-rose-950/40 p-3 rounded-2xl border border-rose-100 dark:border-rose-900">
                  <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 block">Economia/Bônus</span>
                  <span className="text-xl font-bold font-serif text-rose-600 dark:text-rose-300">
                    R$ {totalEconomy.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>

              {/* Linha do tempo dos agendamentos */}
              <h4 className="font-bold text-sm text-stone-800 dark:text-stone-200 mb-3">
                Linha do Tempo de Atendimentos
              </h4>
              {clientBookings.length === 0 ? (
                <p className="text-sm text-stone-400 italic py-4 text-center">Nenhum registro para esta cliente.</p>
              ) : (
                <div className="space-y-3">
                  {clientBookings.map((b) => {
                    const bServices = services.filter(s => (b.serviceIds || [b.serviceId]).includes(s.id));
                    const op = b.originalPrice || bServices.reduce((acc, s) => acc + s.price, 0);
                    const fp = b.finalPrice !== undefined && b.finalPrice !== null ? b.finalPrice : op;
                    const discount = b.discountAmount || (op > fp ? op - fp : 0);

                    return (
                      <div key={b.id} className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                              b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                              b.status === 'in_progress' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                              b.status === 'completed' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                              b.status === 'cancelled' ? 'bg-red-100 text-red-800 border-red-200' :
                              'bg-amber-100 text-amber-800 border-amber-200'
                            }`}>
                              {b.status === 'confirmed' ? 'Agendado' :
                               b.status === 'in_progress' ? 'Em andamento' :
                               b.status === 'completed' ? 'Concluído' :
                               b.status === 'cancelled' ? 'Cancelado' : 'Aguardando confirmação'}
                            </span>
                            <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                              {new Date(b.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} às {b.time}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-stone-900 dark:text-stone-100 mt-1">
                            {bServices.map(s => s.name).join(', ') || 'Serviço'}
                          </p>
                          {b.notes && <p className="text-xs text-stone-400 italic">"{b.notes}"</p>}
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <div className="text-right">
                            {discount > 0 ? (
                              <div>
                                <span className="text-[11px] line-through text-stone-400 block">R$ {op.toFixed(2).replace('.', ',')}</span>
                                <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                                  {fp === 0 ? 'CORTESIA' : `R$ ${fp.toFixed(2).replace('.', ',')}`}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm font-bold text-stone-900 dark:text-stone-100">
                                R$ {fp.toFixed(2).replace('.', ',')}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => setReceiptBooking(b)}
                            className="p-2 bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-200 hover:text-stone-900 rounded-xl border border-stone-200 dark:border-stone-600 cursor-pointer"
                            title="Ver Comprovante"
                          >
                            <FileText size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-stone-100 dark:border-stone-800 flex justify-end">
                <button
                  onClick={() => setClientHistoryModal(null)}
                  className="px-5 py-2.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Fechar Histórico
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Recibo do Agendamento */}
      <BookingReceiptModal 
        isOpen={!!receiptBooking}
        onClose={() => setReceiptBooking(null)}
        booking={receiptBooking}
      />

      {/* Telinha Modal de Alterar ou Cadastrar Procedimento */}
      <AnimatePresence>
        {isServiceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-rose-100 dark:border-stone-800 w-full max-w-lg overflow-hidden relative max-h-[90vh] flex flex-col"
            >
              {/* Cabeçalho da Telinha */}
              <div className="p-5 sm:p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-gradient-to-r from-rose-50/80 to-pink-50/50 dark:from-rose-950/30 dark:to-stone-900 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white flex items-center justify-center shadow-md shadow-rose-200 dark:shadow-none shrink-0">
                    {editingService ? <Edit2 size={20} /> : <Plus size={22} />}
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100">
                      {editingService ? 'Alterar Procedimento' : 'Cadastrar Novo Procedimento'}
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      {editingService 
                        ? 'Altere facilmente os dados, duração e valor do atendimento' 
                        : 'Preencha as informações para incluir no catálogo'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsServiceModalOpen(false);
                    setEditingService(null);
                  }}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Formulário da Telinha */}
              <form onSubmit={editingService ? handleUpdateService : handleAddService} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {/* Nome do Procedimento */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                    Nome do Procedimento / Serviço <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingService ? editingService.name : newService.name}
                    onChange={e => editingService 
                      ? setEditingService({ ...editingService, name: e.target.value }) 
                      : setNewService({ ...newService, name: e.target.value })
                    }
                    placeholder="Ex: Alongamento em Gel, Design de Sobrancelhas..."
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500"
                    required
                    autoFocus
                  />
                </div>

                {/* Categoria */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                      Categoria no Catálogo <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddCategoryInline(!showAddCategoryInline)}
                      className="text-xs text-rose-600 dark:text-rose-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>{showAddCategoryInline ? 'Fechar' : '+ Nova Categoria'}</span>
                    </button>
                  </div>

                  {showAddCategoryInline && (
                    <div className="mb-2.5 p-3 bg-rose-50/90 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60 space-y-2">
                      <span className="text-xs font-semibold text-rose-800 dark:text-rose-200 block">
                        Cadastrar nova categoria:
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newCategoryName}
                          onChange={e => setNewCategoryName(e.target.value)}
                          placeholder="Nome (ex: Sobrancelhas, Cílios)..."
                          className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            handleAddCategory(e);
                            setShowAddCategoryInline(false);
                          }}
                          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  )}

                  <select
                    value={editingService ? editingService.category : newService.category}
                    onChange={e => editingService 
                      ? setEditingService({ ...editingService, category: e.target.value }) 
                      : setNewService({ ...newService, category: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 cursor-pointer"
                    required
                  >
                    <option value="">Selecione uma categoria...</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                {/* Duração com atalhos */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                      Duração (Minutos) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                      {editingService ? editingService.duration : newService.duration} min
                    </span>
                  </div>

                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={editingService ? editingService.duration : newService.duration}
                    onChange={e => {
                      const val = Number(e.target.value);
                      if (editingService) setEditingService({ ...editingService, duration: val });
                      else setNewService({ ...newService, duration: val });
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 mb-2"
                    required
                  />

                  {/* Atalhos rápidos de tempo */}
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] text-stone-400 uppercase font-semibold mr-1">Atalhos:</span>
                    {[30, 45, 60, 90, 120].map((mins) => {
                      const currentDur = editingService ? editingService.duration : newService.duration;
                      return (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => {
                            if (editingService) setEditingService({ ...editingService, duration: mins });
                            else setNewService({ ...newService, duration: mins });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                            currentDur === mins
                              ? 'bg-rose-500 text-white shadow-xs'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                          }`}
                        >
                          {mins} min
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[11px] text-stone-400 dark:text-stone-500 mt-1 block">
                    Bloqueia o intervalo correto na agenda para não sobrepor clientes.
                  </span>
                </div>

                {/* Preço (R$) */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                    Preço Praticado (R$) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">
                      R$
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={editingService ? editingService.price : newService.price}
                      onChange={e => {
                        const val = Number(e.target.value);
                        if (editingService) setEditingService({ ...editingService, price: val });
                        else setNewService({ ...newService, price: val });
                      }}
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-base font-bold font-mono focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500"
                      placeholder="0,00"
                      required
                    />
                  </div>
                </div>

                {/* Botões do Rodapé da Telinha */}
                <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsServiceModalOpen(false);
                      setEditingService(null);
                    }}
                    className="flex-1 py-3 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-bold text-sm hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-2 py-3 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-rose-200/50 dark:shadow-none flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 size={18} />
                    <span>{editingService ? 'Concluir Alteração' : 'Cadastrar Procedimento'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL / TELA DE NOTIFICAÇÃO DE NOVO AGENDAMENTO COM COMANDOS */}
      <AnimatePresence>
        {newBookingAlert && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border-2 border-rose-500/80 dark:border-rose-500/60 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Header do Alerta com Chime Visual */}
              <div className="bg-gradient-to-r from-rose-600 via-pink-600 to-rose-700 text-white p-5 flex items-center justify-between relative overflow-hidden shrink-0">
                <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
                <div className="flex items-center gap-3 relative z-10">
                  <div className="w-12 h-12 rounded-2xl bg-white text-rose-600 flex items-center justify-center shadow-lg animate-bounce">
                    <Bell size={24} />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold tracking-widest uppercase bg-white/20 px-2 py-0.5 rounded-full inline-block mb-1">
                      Novo Agendamento em Tempo Real
                    </span>
                    <h3 className="text-xl font-serif font-bold">Solicitação de Horário!</h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setNewBookingAlert(null)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer relative z-10"
                  title="Fechar Notificação"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Conteúdo com os dados do agendamento */}
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {/* Cliente */}
                <div className="p-4 bg-rose-50/60 dark:bg-stone-800/80 rounded-2xl border border-rose-100 dark:border-stone-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-stone-500 dark:text-stone-400 font-medium">Cliente</div>
                      <div className="text-base font-bold text-stone-900 dark:text-stone-100">
                        {newBookingAlert.clientName || 'Cliente'}
                      </div>
                    </div>
                    {newBookingAlert.isPromo && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2.5 py-1 rounded-full border border-amber-300">
                        Promoção Aplicada
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 text-stone-600 dark:text-stone-300">
                    <div>
                      <span className="text-stone-400 block text-[10px]">Telefone</span>
                      <span className="font-semibold">{newBookingAlert.clientPhone || 'Não informado'}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px]">CPF</span>
                      <span className="font-semibold">{newBookingAlert.clientCpf || 'Não informado'}</span>
                    </div>
                  </div>
                </div>

                {/* Data e Horário */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-stone-50 dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                      <CalendarCheck size={18} />
                    </div>
                    <div>
                      <div className="text-[10px] text-stone-400 uppercase font-semibold">Data</div>
                      <div className="text-sm font-bold text-stone-800 dark:text-stone-100">
                        {new Date(newBookingAlert.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-stone-50 dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <Clock size={18} />
                    </div>
                    <div>
                      <div className="text-[10px] text-stone-400 uppercase font-semibold">Horário</div>
                      <div className="text-sm font-bold text-stone-800 dark:text-stone-100">
                        {newBookingAlert.time}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Serviços Solicitados */}
                {(() => {
                  const bServices = services.filter(s => (newBookingAlert.serviceIds || [newBookingAlert.serviceId]).includes(s.id));
                  const totalDur = bServices.reduce((sum, s) => sum + (s.duration || 60), 0);
                  const totalPrice = newBookingAlert.finalPrice !== undefined && newBookingAlert.finalPrice !== null
                    ? newBookingAlert.finalPrice
                    : bServices.reduce((sum, s) => sum + s.price, 0);

                  return (
                    <div className="p-4 bg-stone-50 dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300">
                        <span>Serviços Solicitados ({bServices.length})</span>
                        <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                          <Clock size={12} /> {totalDur} min total
                        </span>
                      </div>
                      <div className="space-y-1.5 divide-y divide-stone-200 dark:divide-stone-700">
                        {bServices.map(s => (
                          <div key={s.id} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                            <span className="text-stone-800 dark:text-stone-200 font-medium">{s.name} ({s.duration}m)</span>
                            <span className="font-bold text-stone-900 dark:text-stone-100">R$ {s.price.toFixed(2).replace('.', ',')}</span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-stone-200 dark:border-stone-700 flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-500">Valor Total do Atendimento:</span>
                        <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                          R$ {totalPrice.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      {newBookingAlert.notes && (
                        <div className="text-[11px] text-stone-500 bg-white dark:bg-stone-900 p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 mt-2">
                          <strong className="text-stone-700 dark:text-stone-300">Observação da cliente:</strong> {newBookingAlert.notes}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Comandos e Ações do Agendamento */}
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-stone-400">Comandos Rápidos</div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        updateBookingStatus(newBookingAlert.id, 'confirmed');
                        showToast(`Agendamento de ${newBookingAlert.clientName || 'Cliente'} confirmado com sucesso!`, 'success');
                        setNewBookingAlert(null);
                      }}
                      className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                    >
                      <CheckCircle2 size={16} /> Aceitar / Confirmar
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        updateBookingStatus(newBookingAlert.id, 'in_progress', new Date().toISOString());
                        showToast(`Atendimento de ${newBookingAlert.clientName || 'Cliente'} iniciado! Cronômetro automático em contagem.`, 'success');
                        setNewBookingAlert(null);
                      }}
                      className="py-3 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                    >
                      <Play size={16} className="fill-white" /> Iniciar Atendimento
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {newBookingAlert.clientPhone && (
                      <a
                        href={getWhatsAppLink(newBookingAlert.clientPhone)}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-stone-200 dark:border-stone-700"
                      >
                        <MessageCircle size={15} className="text-emerald-500" /> Abrir WhatsApp
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setReceiptBooking(newBookingAlert);
                        setNewBookingAlert(null);
                      }}
                      className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-stone-200 dark:border-stone-700"
                    >
                      <FileText size={15} className="text-rose-500" /> Ver Comprovante
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Tem certeza que deseja recusar/cancelar o agendamento de ${newBookingAlert.clientName}?`)) {
                          cancelBooking(newBookingAlert.id);
                          showToast('Agendamento cancelado com sucesso.', 'success');
                          setNewBookingAlert(null);
                        }
                      }}
                      className="py-2 px-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} /> Recusar / Cancelar
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewBookingAlert(null)}
                      className="py-2 px-4 bg-stone-200 hover:bg-stone-300 dark:bg-stone-700 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Dispensar Notificação
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
