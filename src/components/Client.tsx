import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, Clock, XCircle, Edit2, Gift, Star, FileText, Sparkles, 
  Percent, Share2, Copy, Check, Users, Heart, ArrowRight, Camera, 
  RefreshCw, Trash2, Image as ImageIcon, Video, VideoOff, SwitchCamera
} from 'lucide-react';
import { Booking } from '../types';
import { BookingReceiptModal } from './BookingReceiptModal';

export function Client() {
  const { 
    user, bookings, services, logout, cancelBooking, rescheduleBooking, 
    settings, feedbacks, addFeedback, updateLoyaltyStamps, updateReferralStamps, 
    showToast, addBooking, refreshBookings, refreshUser
  } = useApp();

  const [rescheduleModal, setRescheduleModal] = useState<{ isOpen: boolean, booking: Booking | null }>({ isOpen: false, booking: null });
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');

  const [feedbackModal, setFeedbackModal] = useState<{ isOpen: boolean, booking: Booking | null }>({ isOpen: false, booking: null });
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [receiptBooking, setReceiptBooking] = useState<Booking | null>(null);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'>('all');
  const [activeViewTab, setActiveViewTab] = useState<'appointments' | 'history'>('appointments');

  // Camera State for Customer Evaluation / Feedback
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Modal para resgate de fidelidade ou indicação
  const [redeemModalType, setRedeemModalType] = useState<'loyalty' | 'referral'>('loyalty');
  const [redeemModalOpen, setRedeemModalOpen] = useState(false);
  const [redeemDate, setRedeemDate] = useState('');
  const [redeemTime, setRedeemTime] = useState('');
  const [redeemSelectedServiceId, setRedeemSelectedServiceId] = useState('');
  const [isSubmittingRedeem, setIsSubmittingRedeem] = useState(false);

  const [cancelModalBooking, setCancelModalBooking] = useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const configuredTimes = useMemo(() => {
    if (settings?.availableTimeSlots && settings.availableTimeSlots.length > 0) {
      return settings.availableTimeSlots;
    }
    return ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
  }, [settings?.availableTimeSlots]);

  const bookedTimesOnRedeemDate = useMemo(() => {
    if (!redeemDate) return [];
    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = redeemDate === todayStr;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const booked = bookings
      .filter(b => b.date === redeemDate && b.status !== 'cancelled')
      .map(b => b.time);

    return configuredTimes.filter(t => {
      if (booked.includes(t)) return true;
      if (isToday) {
        const [h, m] = t.split(':').map(Number);
        const slotMinutes = (h || 0) * 60 + (m || 0);
        if (slotMinutes <= currentMinutes) return true;
      }
      return false;
    });
  }, [redeemDate, bookings, configuredTimes]);

  const isDateAvailableDay = useMemo(() => {
    if (!redeemDate) return true;
    const allowedDays = settings?.availableDays !== undefined ? settings.availableDays : [1, 2, 3, 4, 5, 6];
    const [year, month, day] = redeemDate.split('-').map(Number);
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    return allowedDays.includes(dayOfWeek);
  }, [redeemDate, settings?.availableDays]);

  if (!user) return null;

  // Loyalty computations
  const rewardService = useMemo(() => {
    if (!settings?.loyaltyRewardServiceId) return null;
    return services.find(s => s.id === settings.loyaltyRewardServiceId) || null;
  }, [settings?.loyaltyRewardServiceId, services]);

  const isRewardReady = (user.loyaltyStamps || 0) >= (settings?.loyaltyMaxStamps || 10);
  const isFreeService = (settings?.loyaltyRewardType || 'free_service') === 'free_service';
  const discountPercent = settings?.loyaltyRewardDiscountPercent || 100;

  // Referral computations
  const referralMaxStamps = settings?.referralMaxStamps !== undefined ? settings.referralMaxStamps : 5;
  const isReferralReady = (user.referralStamps || 0) >= referralMaxStamps && referralMaxStamps > 0;
  const referralDiscountForReferred = settings?.referralDiscountForReferred || 10;

  const myBookings = useMemo(() => {
    return bookings
      .filter(b => b.userId === user.id || (user.phone && b.clientPhone === user.phone) || (user.cpf && b.clientCpf === user.cpf))
      .sort((a, b) => new Date(`${b.date}T${b.time || '00:00'}`).getTime() - new Date(`${a.date}T${a.time || '00:00'}`).getTime());
  }, [bookings, user]);

  const filteredBookings = useMemo(() => {
    if (activeCategory === 'all') return myBookings;
    return myBookings.filter(b => b.status === activeCategory);
  }, [myBookings, activeCategory]);

  const bookingCounts = useMemo(() => {
    return {
      all: myBookings.length,
      pending: myBookings.filter(b => b.status === 'pending').length,
      confirmed: myBookings.filter(b => b.status === 'confirmed').length,
      in_progress: myBookings.filter(b => b.status === 'in_progress').length,
      completed: myBookings.filter(b => b.status === 'completed').length,
      cancelled: myBookings.filter(b => b.status === 'cancelled').length,
    };
  }, [myBookings]);

  const clientHistoryStats = useMemo(() => {
    const completed = myBookings.filter(b => b.status === 'completed');
    const totalSpent = completed.reduce((sum, b) => sum + (b.finalPrice !== undefined ? b.finalPrice : (b.originalPrice || 0)), 0);
    const totalEconomy = myBookings.reduce((sum, b) => {
      if (b.status === 'cancelled') return sum;
      return sum + (b.discountAmount || 0);
    }, 0);
    return {
      totalCompleted: completed.length,
      totalSpent,
      totalEconomy,
      totalBookings: myBookings.length
    };
  }, [myBookings]);

  const handleCopyReferral = () => {
    if (!user.referralCode) return;
    navigator.clipboard.writeText(user.referralCode);
    setCopiedReferral(true);
    showToast('Código de indicação copiado com sucesso!', 'success');
    setTimeout(() => setCopiedReferral(false), 2500);
  };

  const handleShareWhatsApp = () => {
    if (!user.referralCode) return;
    const salonName = settings?.name || 'Bella Beauty';
    const discountVal = Number(referralDiscountForReferred).toFixed(2).replace('.', ',');
    const text = `Olá amiga! Te convido para conhecer o ${salonName}! Ao se cadastrar com meu código de indicação *${user.referralCode}*, você ganha R$ ${discountVal} de desconto especial no seu 1º atendimento! Agende seu horário: ${window.location.origin}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalBooking) return;
    setIsCancelling(true);
    try {
      await cancelBooking(cancelModalBooking.id);
      showToast('Agendamento cancelado com sucesso.', 'success');
      setCancelModalBooking(null);
    } catch {
      showToast('Erro ao cancelar agendamento.', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const openReschedule = (booking: Booking) => {
    setRescheduleModal({ isOpen: true, booking });
    setRescheduleDate(booking.date);
    setRescheduleTime(booking.time);
  };

  const closeReschedule = () => {
    setRescheduleModal({ isOpen: false, booking: null });
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rescheduleModal.booking) {
      const err = await rescheduleBooking(rescheduleModal.booking.id, rescheduleDate, rescheduleTime);
      if (!err) closeReschedule();
    }
  };

  const attachVideoElement = (element: HTMLVideoElement | null) => {
    videoRef.current = element;
    if (element && mediaStreamRef.current) {
      try {
        element.muted = true;
        element.playsInline = true;
        element.setAttribute('playsinline', 'true');
        element.setAttribute('autoplay', 'true');
        element.srcObject = mediaStreamRef.current;
        element.onloadedmetadata = () => {
          element.play().catch(e => console.warn('Video play catch:', e));
        };
        element.play().catch(e => console.warn('Direct play error:', e));
      } catch (e) {
        console.warn('Error attaching video stream:', e);
      }
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setCameraError(null);
  };

  const startCamera = async (mode: 'environment' | 'user' = cameraFacingMode) => {
    stopCamera();
    try {
      setCameraError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (nativeCameraInputRef.current) {
          nativeCameraInputRef.current.click();
          return;
        }
        throw new Error('Câmera não suportada neste navegador');
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (inner) {
        // Fallback with basic video constraint
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      mediaStreamRef.current = stream;
      setCameraFacingMode(mode);
      setIsCameraActive(true);

      // In case videoRef is already rendered
      if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => console.warn('Camera video play error:', e));
        };
        videoRef.current.play().catch(e => console.warn('Direct video play error:', e));
      }
    } catch (err: any) {
      console.warn('Live camera access error, falling back to native file input capture', err);
      if (nativeCameraInputRef.current) {
        nativeCameraInputRef.current.click();
      } else {
        setCameraError('Permissão de câmera não concedida ou restrita. Utilize a opção "Câmera do Celular" ou selecione uma foto da galeria.');
      }
    }
  };

  useEffect(() => {
    if (isCameraActive && videoRef.current && mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(e => console.warn('Camera play error on active change:', e));
      };
    }
  }, [isCameraActive]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPhotoUrl(dataUrl);
    stopCamera();
  };

  // Close camera if feedback modal closes
  useEffect(() => {
    if (!feedbackModal.isOpen) {
      stopCamera();
    }
  }, [feedbackModal.isOpen]);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (feedbackModal.booking) {
      stopCamera();
      await addFeedback({
        bookingId: feedbackModal.booking.id,
        userId: user.id,
        rating,
        comment,
        photoUrl
      });
      setFeedbackModal({ isOpen: false, booking: null });
      setRating(5);
      setComment('');
      setPhotoUrl('');
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      stopCamera();
      const reader = new FileReader();
      reader.onloadend = () => setPhotoUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Time slot logic for rescheduling
  const allAvailableTimes = configuredTimes;
  const availableTimesForReschedule = useMemo(() => {
    if (!rescheduleDate) return [];
    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = rescheduleDate === todayStr;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const bookedTimesOnDate = bookings
      .filter(b => b.date === rescheduleDate && b.status !== 'cancelled' && b.id !== rescheduleModal.booking?.id)
      .map(b => b.time);

    return allAvailableTimes.filter(t => {
      if (bookedTimesOnDate.includes(t)) return false;
      if (isToday) {
        const [h, m] = t.split(':').map(Number);
        const slotMinutes = (h || 0) * 60 + (m || 0);
        if (slotMinutes <= currentMinutes) return false;
      }
      return true;
    });
  }, [rescheduleDate, bookings, rescheduleModal.booking, allAvailableTimes]);

  const handleConfirmRedemption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemDate || !redeemTime || !redeemSelectedServiceId) {
      showToast('Por favor, preencha todos os campos do agendamento.', 'error');
      return;
    }

    const selectedService = services.find(s => s.id === redeemSelectedServiceId);
    if (!selectedService) return;

    setIsSubmittingRedeem(true);
    try {
      const isFree = redeemModalType === 'loyalty' ? isFreeService : true;
      const discount = redeemModalType === 'loyalty' ? discountPercent : 100;
      const originalPrice = selectedService.price;
      const finalPrice = isFree ? 0 : originalPrice * (1 - (discount / 100));
      const discountAmount = originalPrice - finalPrice;

      const result = await addBooking({
        serviceId: selectedService.id,
        serviceIds: [selectedService.id],
        paymentMethod: 'cortesia_bonus',
        userId: user.id,
        date: redeemDate,
        time: redeemTime,
        notes: redeemModalType === 'loyalty' 
          ? `[Resgate Cartela Fidelidade] Recompensa: ${settings?.loyaltyRewardText || 'Serviço de Fidelidade'}`
          : `[Resgate Cartela Indicação] Recompensa: ${settings?.referralRewardText || 'Bônus de Indicação'}`,
        originalPrice,
        finalPrice,
        discountAmount,
        discountPercent: discount,
        isPromo: false
      });

      if (result.booking) {
        if (redeemModalType === 'loyalty') {
          await updateLoyaltyStamps(user.id, 0);
          showToast('Parabéns! Recompensa de fidelidade agendada e carteirinha zerada.', 'success');
        } else {
          await updateReferralStamps(user.id, 0);
          showToast('Parabéns! Bônus de indicação agendado e cartela zerada para novos convites!', 'success');
        }
        await refreshBookings();
        if (refreshUser) await refreshUser();
        setRedeemModalOpen(false);
        setRedeemDate('');
        setRedeemTime('');
      } else if (result.error) {
        showToast(result.error, 'error');
      }
    } finally {
      setIsSubmittingRedeem(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto px-4 py-12"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-3xl font-serif text-stone-900 dark:text-stone-100">
              Olá, {user.name.split(' ')[0]}
            </h2>
            <Heart size={20} className="fill-rose-400 text-rose-400" />
          </div>
          <p className="text-stone-500 dark:text-stone-400 mt-1">
            Seja bem-vinda ao seu espaço exclusivo. Acompanhe seus benefícios, carteirinhas e agendamentos.
          </p>
        </div>
      </div>

      {/* 1. CARTEIRINHA DE FIDELIDADE (Com marcação em X) */}
      {settings?.loyaltyActive && (
        <div className="mb-8 bg-white dark:bg-stone-900 p-6 md:p-8 rounded-3xl border border-rose-100 dark:border-stone-800 shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                  Carteirinha Digital de Fidelidade
                </h3>
                <span className="bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-rose-200/60 dark:border-rose-900/40">
                  Fidelidade
                </span>
              </div>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                {settings.loyaltyRewardText || (isFreeService ? 'A cada serviço concluído você ganha um X! Ao completar, resgate seu serviço de cortesia!' : `Complete a cartela com X e ganhe ${discountPercent}% de desconto no seu próximo serviço!`)}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50 text-rose-600 dark:text-rose-300 px-4 py-2 rounded-2xl font-bold text-sm self-start sm:self-auto shadow-sm">
              <Gift size={20} className="animate-bounce" />
              <span>{user.loyaltyStamps || 0} / {settings.loyaltyMaxStamps || 10} Selos</span>
            </div>
          </div>

          {/* Destaque do Prêmio Definido pela Administradora */}
          <div className="bg-rose-50/40 dark:bg-stone-800/40 border border-rose-100 dark:border-stone-800 rounded-2xl p-4 mb-5 flex items-center gap-3">
            {isFreeService ? (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <Gift size={20} />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <Percent size={20} />
              </div>
            )}
            <div className="text-xs">
              <span className="font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wider block text-[10px]">
                {isFreeService ? 'Serviço de Cortesia (100% Grátis)' : 'Recompensa de Desconto'}
              </span>
              <p className="font-medium text-stone-900 dark:text-stone-100 text-sm mt-0.5">
                {isFreeService 
                  ? (rewardService ? `${rewardService.name} (Cortesia sem custo)` : (settings.loyaltyRewardServiceId === 'any' ? 'Qualquer serviço cadastrado no site (100% Grátis)' : (settings.loyaltyRewardText || 'Serviço de cortesia')))
                  : (rewardService ? `${discountPercent}% de desconto em ${rewardService.name}` : `${discountPercent}% de desconto em qualquer serviço cadastrado`)}
              </p>
            </div>
          </div>
          
          {/* Cartela de Selos com X automático */}
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5 my-6">
            {Array.from({ length: settings.loyaltyMaxStamps || 10 }).map((_, i) => {
              const isStamped = i < (user.loyaltyStamps || 0);
              return (
                <div 
                  key={i} 
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-center border-2 transition-all relative ${
                    isStamped 
                      ? 'bg-rose-500 border-rose-600 text-white shadow-md shadow-rose-200/50 scale-105 ring-2 ring-rose-300/40' 
                      : 'bg-stone-50 dark:bg-stone-800/60 border-dashed border-stone-200 dark:border-stone-700 text-stone-300 dark:text-stone-600'
                  }`}
                  title={isStamped ? `Selo #${i + 1} marcado com X` : `Selo #${i + 1} pendente`}
                >
                  {isStamped ? (
                    <div className="flex flex-col items-center">
                      <span className="font-black text-2xl sm:text-3xl leading-none select-none drop-shadow-sm font-mono">✕</span>
                      <span className="text-[9px] font-bold opacity-80 mt-0.5">OK</span>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-stone-400 dark:text-stone-500">{i + 1}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Área de Resgate da Recompensa quando a cartela estiver cheia */}
          {isRewardReady ? (
            <div className="mt-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-5 md:p-6 rounded-2xl shadow-lg shadow-emerald-200/40 flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
              <div className="flex items-center gap-4 text-center sm:text-left">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                  <Sparkles size={28} className="text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-white">Parabéns! Sua carteirinha está 100% preenchida!</h4>
                  <p className="text-xs text-emerald-100 mt-0.5 max-w-xl">
                    {isFreeService 
                      ? `Você conquistou seu serviço de cortesia: ${rewardService ? rewardService.name : 'cortesia especial'}. Clique para agendar!`
                      : `Você conquistou seu cupom de ${discountPercent}% de desconto em qualquer serviço! Clique para agendar.`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setRedeemModalType('loyalty');
                  setRedeemSelectedServiceId(rewardService?.id || (services[0]?.id || ''));
                  setRedeemModalOpen(true);
                }}
                className="bg-white hover:bg-stone-100 text-emerald-800 font-bold px-6 py-3 rounded-xl text-sm shadow-md transition-all cursor-pointer whitespace-nowrap active:scale-95"
              >
                {isFreeService ? 'Resgatar Serviço de Cortesia' : `Resgatar ${discountPercent}% de Desconto`}
              </button>
            </div>
          ) : (
            <div className="text-xs text-stone-500 dark:text-stone-400 flex items-center justify-between bg-stone-50 dark:bg-stone-800/40 p-3 rounded-xl border border-stone-100 dark:border-stone-800">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock size={14} className="text-stone-400" />
                Faltam <strong className="text-rose-600 dark:text-rose-400 font-bold">{(settings.loyaltyMaxStamps || 10) - (user.loyaltyStamps || 0)}</strong> atendimento(s) concluído(s) para completar a carteirinha.
              </span>
              <span className="text-stone-400 dark:text-stone-500 hidden sm:inline">Marcação automática com ✕ a cada atendimento finalizado</span>
            </div>
          )}
        </div>
      )}

      {/* 2. CARTEIRINHA DE BÔNUS POR INDICAÇÃO (No mesmo padrão visual da fidelidade) */}
      {(settings?.referralActive ?? true) && (
        <div className="mb-8 bg-white dark:bg-stone-900 p-6 md:p-8 rounded-3xl border border-rose-200/80 dark:border-stone-800 shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                  Carteirinha de Bônus por Indicação
                </h3>
                <span className="bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-xs">
                  Indique & Ganhe
                </span>
              </div>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                {settings?.referralRewardText || `Indique suas amigas! A cada amiga que agendar e concluir o 1º atendimento, você ganha 1 selo (✕) e ela ganha R$ ${Number(referralDiscountForReferred).toFixed(2)} de desconto!`}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-gradient-to-r from-pink-50 to-rose-50 dark:from-rose-950/60 dark:to-stone-800 border border-pink-200/70 dark:border-rose-900/50 text-pink-600 dark:text-rose-300 px-4 py-2 rounded-2xl font-bold text-sm self-start sm:self-auto shadow-sm">
              <Users size={18} className="text-pink-500" />
              <span>{user.referralStamps || 0} / {referralMaxStamps} Indicações</span>
            </div>
          </div>

          {/* Bloco de Compartilhamento do Código da Cliente */}
          <div className="bg-gradient-to-br from-rose-50 via-pink-50/60 to-rose-50/30 dark:from-rose-950/30 dark:via-stone-800 dark:to-stone-800 border border-rose-200/80 dark:border-rose-900/40 rounded-2xl p-4 sm:p-5 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-rose-500" />
                  Seu Código Exclusivo de Indicação
                </span>
                <p className="text-xs text-stone-600 dark:text-stone-300 max-w-md">
                  Compartilhe seu código com amigas. Quando elas se cadastrarem com seu código e fizerem o 1º atendimento, elas ganham <strong>R$ {Number(referralDiscountForReferred).toFixed(2).replace('.', ',')} de desconto</strong> e você ganha <strong>1 X</strong> na sua cartela!
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div className="bg-white dark:bg-stone-900 px-4 py-2.5 rounded-xl border border-rose-300 dark:border-rose-800 font-mono font-bold text-base text-stone-900 dark:text-rose-200 tracking-wider select-all shadow-inner">
                  {user.referralCode || 'CRIANDO...'}
                </div>
                <button
                  onClick={handleCopyReferral}
                  className="bg-white dark:bg-stone-800 hover:bg-rose-50 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 p-2.5 rounded-xl border border-rose-200 dark:border-stone-700 shadow-xs transition-colors cursor-pointer"
                  title="Copiar Código"
                >
                  {copiedReferral ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
                </button>
                <button
                  onClick={handleShareWhatsApp}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer whitespace-nowrap"
                  title="Enviar convite pelo WhatsApp"
                >
                  <Share2 size={16} />
                  <span>Enviar no WhatsApp</span>
                </button>
              </div>
            </div>
          </div>

          {/* Cartela de Selos de Indicação com X (0 a 10) */}
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5 my-6">
            {Array.from({ length: referralMaxStamps }).map((_, i) => {
              const isStamped = i < (user.referralStamps || 0);
              return (
                <div 
                  key={i} 
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-center border-2 transition-all relative ${
                    isStamped 
                      ? 'bg-gradient-to-tr from-pink-500 to-rose-600 border-pink-600 text-white shadow-md shadow-pink-200/50 scale-105 ring-2 ring-pink-300/40' 
                      : 'bg-stone-50 dark:bg-stone-800/60 border-dashed border-stone-200 dark:border-stone-700 text-stone-300 dark:text-stone-600'
                  }`}
                  title={isStamped ? `Amiga #${i + 1} completou o 1º agendamento (✕)` : `Indicação #${i + 1} pendente`}
                >
                  {isStamped ? (
                    <div className="flex flex-col items-center">
                      <span className="font-black text-2xl sm:text-3xl leading-none select-none drop-shadow-sm font-mono">✕</span>
                      <span className="text-[9px] font-bold opacity-80 mt-0.5">AMIGA</span>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-stone-400 dark:text-stone-500">{i + 1}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Área de Resgate da Recompensa de Indicação quando a cartela estiver cheia */}
          {isReferralReady ? (
            <div className="mt-4 bg-gradient-to-r from-pink-500 via-rose-500 to-rose-600 text-white p-5 md:p-6 rounded-2xl shadow-lg shadow-pink-200/50 flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
              <div className="flex items-center gap-4 text-center sm:text-left">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                  <Gift size={28} className="text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-white">Parabéns! Você completou sua meta de indicações!</h4>
                  <p className="text-xs text-pink-100 mt-0.5 max-w-xl">
                    {settings?.referralRewardText || 'Você conquistou seu prêmio especial de indicação! Escolha seu atendimento de cortesia.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setRedeemModalType('referral');
                  setRedeemSelectedServiceId(services[0]?.id || '');
                  setRedeemModalOpen(true);
                }}
                className="bg-white hover:bg-stone-100 text-rose-800 font-bold px-6 py-3 rounded-xl text-sm shadow-md transition-all cursor-pointer whitespace-nowrap active:scale-95"
              >
                Resgatar Bônus de Indicação
              </button>
            </div>
          ) : (
            <div className="text-xs text-stone-500 dark:text-stone-400 flex items-center justify-between bg-stone-50 dark:bg-stone-800/40 p-3 rounded-xl border border-stone-100 dark:border-stone-800">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock size={14} className="text-stone-400" />
                Faltam <strong className="text-pink-600 dark:text-pink-400 font-bold">{Math.max(0, referralMaxStamps - (user.referralStamps || 0))}</strong> amiga(s) concluírem o 1º agendamento para você resgatar seu prêmio de indicação!
              </span>
              <span className="text-stone-400 dark:text-stone-500 hidden sm:inline">Desconto de R$ {Number(referralDiscountForReferred).toFixed(2).replace('.', ',')} concedido no 1º serviço dela</span>
            </div>
          )}
        </div>
      )}

      {/* Cabeçalho e Abas: Agendamentos por Categorias & Histórico da Cliente */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 dark:border-stone-800 pb-4">
        <div>
          <h3 className="text-2xl font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>{activeViewTab === 'appointments' ? 'Meus Atendimentos' : 'Histórico da Cliente'}</span>
            <span className="text-xs font-sans font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 px-2.5 py-1 rounded-full border border-rose-200 dark:border-rose-900">
              {myBookings.length} {myBookings.length === 1 ? 'registro' : 'registros'}
            </span>
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            {activeViewTab === 'appointments' 
              ? 'Acompanhe seus horários separados por categoria e status em tempo real.'
              : 'Linha do tempo completa com todas as suas visitas, valores investidos e economias.'}
          </p>
        </div>

        {/* Alternador entre Categorias e Histórico Completo */}
        <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 p-1 rounded-2xl w-fit">
          <button
            onClick={() => setActiveViewTab('appointments')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeViewTab === 'appointments'
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            Agendamentos
          </button>
          <button
            onClick={() => setActiveViewTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeViewTab === 'history'
                ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-xs'
                : 'text-stone-500 hover:text-rose-600 dark:text-stone-400 dark:hover:text-rose-400'
            }`}
          >
            <Sparkles size={14} /> Histórico da Cliente
          </button>
        </div>
      </div>

      {/* ABA: AGENDAMENTOS SEPARADOS POR CATEGORIAS */}
      {activeViewTab === 'appointments' && (
        <div className="space-y-6">
          {/* Menu de Categorias Solicitadas */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'all'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                  : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 hover:bg-stone-50 border border-stone-200 dark:border-stone-800'
              }`}
            >
              <span>Todos</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                {bookingCounts.all}
              </span>
            </button>

            <button
              onClick={() => setActiveCategory('pending')}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-400 hover:bg-amber-50/60 border border-amber-200 dark:border-amber-900/60'
              }`}
            >
              <span>Aguardando confirmação</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                {bookingCounts.pending}
              </span>
            </button>

            <button
              onClick={() => setActiveCategory('confirmed')}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'confirmed'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-stone-900 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50/60 border border-emerald-200 dark:border-emerald-900/60'
              }`}
            >
              <span>Agendado</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                {bookingCounts.confirmed}
              </span>
            </button>

            <button
              onClick={() => setActiveCategory('in_progress')}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'in_progress'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white dark:bg-stone-900 text-purple-700 dark:text-purple-400 hover:bg-purple-50/60 border border-purple-200 dark:border-purple-900/60'
              }`}
            >
              <span>Em andamento</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                {bookingCounts.in_progress}
              </span>
            </button>

            <button
              onClick={() => setActiveCategory('completed')}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'completed'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-stone-900 text-blue-700 dark:text-blue-400 hover:bg-blue-50/60 border border-blue-200 dark:border-blue-900/60'
              }`}
            >
              <span>Concluído</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                {bookingCounts.completed}
              </span>
            </button>

            <button
              onClick={() => setActiveCategory('cancelled')}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'cancelled'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-white dark:bg-stone-900 text-red-700 dark:text-red-400 hover:bg-red-50/60 border border-red-200 dark:border-red-900/60'
              }`}
            >
              <span>Cancelado</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                {bookingCounts.cancelled}
              </span>
            </button>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-stone-900 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm p-8">
              <Calendar size={44} className="mx-auto text-rose-300 dark:text-stone-700 mb-3" />
              <h4 className="text-lg text-stone-800 dark:text-stone-200 font-serif font-medium">
                {activeCategory === 'all' 
                  ? 'Nenhum agendamento ativo' 
                  : `Nenhum agendamento na categoria "${
                      activeCategory === 'pending' ? 'Aguardando confirmação' :
                      activeCategory === 'confirmed' ? 'Agendado' :
                      activeCategory === 'in_progress' ? 'Em andamento' :
                      activeCategory === 'completed' ? 'Concluído' : 'Cancelado'
                    }"`}
              </h4>
              <p className="text-stone-500 dark:text-stone-400 text-xs mt-1.5 max-w-md mx-auto">
                {activeCategory === 'all' 
                  ? 'Você ainda não possui horários agendados. Reserve agora seu momento especial.' 
                  : 'Selecione outra categoria acima ou faça um novo agendamento.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredBookings.map(booking => {
                const bookingServices = services.filter(s => (booking.serviceIds || [booking.serviceId]).includes(s.id));
                if (bookingServices.length === 0) return null;
                
                const totalDuration = bookingServices.reduce((sum, s) => sum + s.duration, 0);
                const originalPrice = booking.originalPrice || bookingServices.reduce((sum, s) => sum + s.price, 0);
                const finalPrice = booking.finalPrice !== undefined && booking.finalPrice !== null ? booking.finalPrice : originalPrice;
                const discountAmount = booking.discountAmount || (originalPrice > finalPrice ? originalPrice - finalPrice : 0);
                const isPromo = booking.isPromo || discountAmount > 0;

                const isPast = new Date(`${booking.date}T${booking.time}`) < new Date();
                const canCancel = booking.status === 'pending' || booking.status === 'confirmed';
                
                const hasFeedback = feedbacks.some(f => f.bookingId === booking.id);
                const canFeedback = booking.status === 'completed' && !hasFeedback;

                return (
                  <div 
                    key={booking.id} 
                    className={`bg-white dark:bg-stone-900 p-6 rounded-3xl border border-rose-100 dark:border-stone-800 shadow-sm relative overflow-hidden transition-all ${isPast || booking.status === 'cancelled' ? 'opacity-65' : ''}`}
                  >
                    <div className={`absolute top-0 left-0 w-1.5 h-full ${
                      booking.status === 'confirmed' ? 'bg-emerald-500' : 
                      booking.status === 'in_progress' ? 'bg-purple-500' :
                      booking.status === 'completed' ? 'bg-blue-500' :
                      booking.status === 'cancelled' ? 'bg-red-500' : 'bg-amber-400'}`}></div>
                    
                    <div className="flex justify-between items-start mb-4 pl-1">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border ${
                        booking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900' : 
                        booking.status === 'in_progress' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-900 animate-pulse' :
                        booking.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900' :
                        booking.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-900' : 
                        'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900'
                      }`}>
                        {booking.status === 'confirmed' ? 'Agendado' : 
                         booking.status === 'in_progress' ? 'Em Andamento' :
                         booking.status === 'completed' ? 'Concluído' : 
                         booking.status === 'cancelled' ? 'Cancelado' : 'Aguardando Confirmação'}
                      </span>
                      
                      <div className="text-right">
                        {isPromo ? (
                          <div className="flex flex-col items-end">
                            <span className="text-xs line-through text-stone-400 font-medium">
                              De {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(originalPrice)}
                            </span>
                            <span className="font-bold text-base text-rose-600 dark:text-rose-400">
                              {finalPrice === 0 ? 'CORTESIA 100% GRÁTIS' : `Por ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finalPrice)}`}
                            </span>
                            <span className="text-[10px] bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 font-bold px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900 mt-0.5">
                              Desconto (-R$ {discountAmount.toFixed(2).replace('.', ',')})
                            </span>
                          </div>
                        ) : (
                          <span className="text-stone-900 dark:text-stone-100 font-bold text-base">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finalPrice)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mb-4 pl-1">
                      {bookingServices.map(s => (
                        <h4 key={s.id} className="text-base font-semibold text-stone-800 dark:text-stone-200">{s.name}</h4>
                      ))}
                      {booking.paymentMethod && (
                        <span className="inline-block mt-2 text-[11px] bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/50 px-2 py-0.5 rounded-md font-medium">
                          Pagamento: {booking.paymentMethod === 'cortesia_bonus' ? 'Cortesia / Bônus' : (booking.paymentMethod.toLowerCase().includes('ato') ? 'No ato do atendimento' : booking.paymentMethod.toUpperCase())}
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-2 text-sm text-stone-600 dark:text-stone-400 pl-1">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-rose-400" />
                        <span>{new Date(booking.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-rose-400" />
                        <span>{booking.time} ({totalDuration} min)</span>
                      </div>
                    </div>

                    {booking.notes && (
                      <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 text-xs text-stone-500 dark:text-stone-400 pl-1">
                        <p className="italic">"{booking.notes}"</p>
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3">
                      <button 
                        onClick={() => setReceiptBooking(booking)}
                        className="text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors px-3 py-1.5 rounded-xl cursor-pointer"
                      >
                        <FileText size={15} className="text-rose-500" /> Ver Comprovante
                      </button>

                      <div className="flex flex-wrap items-center gap-2">
                        {canCancel && (
                          <>
                            <button 
                              onClick={() => openReschedule(booking)}
                              className="text-stone-600 dark:text-stone-300 text-xs font-medium flex items-center gap-1 hover:text-stone-900 transition-colors bg-stone-100 dark:bg-stone-800 px-3 py-1.5 rounded-xl cursor-pointer"
                            >
                              <Edit2 size={14} /> Reagendar
                            </button>
                            <button 
                              type="button"
                              onClick={() => setCancelModalBooking(booking)}
                              className="text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-1.5 hover:text-red-700 dark:hover:text-red-300 transition-colors bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/60 px-3 py-1.5 rounded-xl cursor-pointer border border-red-200 dark:border-red-900/40 shadow-xs active:scale-95"
                            >
                              <XCircle size={14} /> Cancelar
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {canFeedback && (
                      <div className="mt-3">
                        <button 
                          onClick={() => setFeedbackModal({ isOpen: true, booking })}
                          className="w-full text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-center gap-2 hover:text-rose-700 transition-colors bg-rose-50 dark:bg-rose-950/40 py-2 rounded-xl cursor-pointer"
                        >
                          <Star size={15} className="fill-rose-400 text-rose-400" /> Avaliar Atendimento
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ABA: HISTÓRICO COMPLETO DA CLIENTE */}
      {activeViewTab === 'history' && (
        <div className="space-y-6">
          {/* Cartões com Métricas do Histórico */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-rose-100 dark:border-stone-800 shadow-xs">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Visitas Concluídas</span>
              <div className="text-2xl font-bold font-serif text-stone-900 dark:text-stone-100 mt-1">
                {clientHistoryStats.totalCompleted}
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Momentos de autocuidado</span>
            </div>

            <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-rose-100 dark:border-stone-800 shadow-xs">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Economia Conquistada</span>
              <div className="text-2xl font-bold font-serif text-rose-600 dark:text-rose-400 mt-1">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(clientHistoryStats.totalEconomy)}
              </div>
              <span className="text-[11px] text-rose-500 font-medium">Bônus & Descontos</span>
            </div>

            <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-rose-100 dark:border-stone-800 shadow-xs">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Selos Fidelidade</span>
              <div className="text-2xl font-bold font-serif text-stone-900 dark:text-stone-100 mt-1">
                {user.loyaltyStamps || 0} / {settings?.loyaltyMaxStamps || 10}
              </div>
              <span className="text-[11px] text-stone-400 font-medium">Pontos na cartela</span>
            </div>

            <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-rose-100 dark:border-stone-800 shadow-xs">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Amigas Indicadas</span>
              <div className="text-2xl font-bold font-serif text-stone-900 dark:text-stone-100 mt-1">
                {user.referralStamps || 0}
              </div>
              <span className="text-[11px] text-pink-500 font-medium">Bônus ativos</span>
            </div>
          </div>

          {/* Tabela / Lista Detalhada do Histórico */}
          <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
              <div>
                <h4 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100">
                  Registro Cronológico de Atendimentos
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Histórico completo com todos os serviços, comprovantes e valores.
                </p>
              </div>
            </div>

            {myBookings.length === 0 ? (
              <div className="p-8 text-center text-stone-500 text-sm">
                Nenhum histórico registrado ainda.
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {myBookings.map((booking) => {
                  const bookingServices = services.filter(s => (booking.serviceIds || [booking.serviceId]).includes(s.id));
                  const originalPrice = booking.originalPrice || bookingServices.reduce((sum, s) => sum + s.price, 0);
                  const finalPrice = booking.finalPrice !== undefined && booking.finalPrice !== null ? booking.finalPrice : originalPrice;
                  const discountAmount = booking.discountAmount || (originalPrice > finalPrice ? originalPrice - finalPrice : 0);

                  return (
                    <div key={booking.id} className="p-5 hover:bg-stone-50/50 dark:hover:bg-stone-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                            booking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200' : 
                            booking.status === 'in_progress' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200' :
                            booking.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200' :
                            booking.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200' : 
                            'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200'
                          }`}>
                            {booking.status === 'confirmed' ? 'Agendado' : 
                             booking.status === 'in_progress' ? 'Em Andamento' :
                             booking.status === 'completed' ? 'Concluído' : 
                             booking.status === 'cancelled' ? 'Cancelado' : 'Aguardando Confirmação'}
                          </span>
                          <span className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                            {new Date(booking.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} às {booking.time}
                          </span>
                        </div>

                        <div className="font-medium text-sm text-stone-800 dark:text-stone-200">
                          {bookingServices.map(s => s.name).join(', ') || 'Serviço Personalizado'}
                        </div>

                        {booking.notes && (
                          <div className="text-xs text-stone-500 italic">"{booking.notes}"</div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 self-end sm:self-center">
                        <div className="text-right">
                          {discountAmount > 0 ? (
                            <div>
                              <div className="text-xs line-through text-stone-400">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(originalPrice)}
                              </div>
                              <div className="font-bold text-rose-600 dark:text-rose-400 text-sm">
                                {finalPrice === 0 ? 'CORTESIA 100%' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finalPrice)}
                              </div>
                            </div>
                          ) : (
                            <div className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finalPrice)}
                            </div>
                          )}
                        </div>

                        <button 
                          onClick={() => setReceiptBooking(booking)}
                          className="p-2 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white bg-stone-100 dark:bg-stone-800 rounded-xl transition-colors cursor-pointer"
                          title="Ver Comprovante Oficial"
                        >
                          <FileText size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      <AnimatePresence>
        {rescheduleModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl p-6 md:p-8 w-full max-w-md border border-rose-100 dark:border-stone-800"
            >
              <h3 className="text-xl font-serif text-stone-900 dark:text-stone-100 mb-6 font-bold">Reagendar Horário</h3>
              <form onSubmit={handleRescheduleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-2">Nova Data</label>
                  <input 
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => {
                      setRescheduleDate(e.target.value);
                      setRescheduleTime('');
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                    required
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-2">Novo Horário</label>
                  <select 
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                    required
                    disabled={!rescheduleDate}
                  >
                    <option value="" disabled>{rescheduleDate ? (availableTimesForReschedule.length ? 'Selecione um horário' : 'Nenhum horário disponível') : 'Escolha a data'}</option>
                    {availableTimesForReschedule.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={closeReschedule}
                    className="flex-1 py-3 px-4 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl font-medium hover:bg-stone-200 transition-colors"
                  >
                    Voltar
                  </button>
                  <button 
                    type="submit"
                    disabled={!rescheduleDate || !rescheduleTime}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl font-medium hover:from-rose-600 hover:to-pink-700 transition-colors disabled:opacity-50"
                  >
                    Confirmar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Feedback Modal */}
      <AnimatePresence>
        {feedbackModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl p-6 md:p-8 w-full max-w-md border border-rose-100 dark:border-stone-800"
            >
              <h3 className="text-xl font-serif text-stone-900 dark:text-stone-100 mb-2 font-bold">Avaliar Atendimento</h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-6">Sua opinião é fundamental para mantermos a excelência do salão.</p>
              
              <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                <div className="flex justify-center gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 cursor-pointer transition-transform hover:scale-110"
                    >
                      <Star 
                        size={32} 
                        className={star <= rating ? 'fill-amber-400 text-amber-400' : 'text-stone-300 dark:text-stone-700'} 
                      />
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-2">Seu Comentário</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="Conte como foi sua experiência..."
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-2">
                    Foto do Resultado (Opcional)
                  </label>

                  {/* Hidden inputs and canvas for camera capture */}
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    ref={nativeCameraInputRef} 
                    onChange={handlePhotoUpload} 
                    className="hidden" 
                  />
                  <input 
                    type="file" 
                    accept="image/*" 
                    id="client-feedback-gallery-file" 
                    onChange={handlePhotoUpload} 
                    className="hidden" 
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* 1. Live In-App Camera View */}
                  {isCameraActive ? (
                    <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border-2 border-rose-400 dark:border-stone-700 shadow-lg">
                      <video 
                        ref={attachVideoElement} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="w-full h-full object-cover"
                      />

                      {/* Viewfinder crosshair overlay */}
                      <div className="absolute inset-6 border border-white/40 rounded-xl pointer-events-none flex items-center justify-center">
                        <div className="w-8 h-8 border border-white/60 rounded-full"></div>
                      </div>

                      {/* Top Action Bar */}
                      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
                        <span className="bg-black/60 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                          Câmera Ativa
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => startCamera(cameraFacingMode === 'user' ? 'environment' : 'user')}
                            className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-xl backdrop-blur-sm transition-colors cursor-pointer"
                            title="Alternar Câmera Frontal / Traseira"
                          >
                            <SwitchCamera size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-xl backdrop-blur-sm transition-colors cursor-pointer"
                            title="Cancelar Câmera"
                          >
                            <XCircle size={18} />
                          </button>
                        </div>
                      </div>

                      {/* Bottom Shutter Capture Button */}
                      <div className="absolute bottom-3 inset-x-0 flex justify-center items-center gap-3 z-10">
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="bg-white hover:bg-rose-50 text-rose-600 font-bold px-6 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-xs transition-transform active:scale-95 cursor-pointer border-2 border-rose-500"
                        >
                          <div className="w-4 h-4 rounded-full bg-rose-500"></div>
                          <span>Capturar Foto</span>
                        </button>
                      </div>
                    </div>
                  ) : photoUrl ? (
                    /* 2. Photo Preview with Replace / Remove actions */
                    <div className="relative rounded-2xl overflow-hidden border border-rose-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-2">
                      <div className="h-44 w-full rounded-xl overflow-hidden relative group">
                        <img src={photoUrl} alt="Resultado do Atendimento" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => startCamera()}
                            className="bg-white/90 text-stone-800 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-white cursor-pointer"
                          >
                            <Camera size={14} /> Tirar Outra
                          </button>
                          <button
                            type="button"
                            onClick={() => setPhotoUrl('')}
                            className="bg-rose-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-rose-700 cursor-pointer"
                          >
                            <Trash2 size={14} /> Remover
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 px-1 text-xs">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <Check size={14} /> Foto anexada com sucesso!
                        </span>
                        <button
                          type="button"
                          onClick={() => setPhotoUrl('')}
                          className="text-stone-400 hover:text-rose-600 transition-colors font-medium text-[11px]"
                        >
                          Excluir foto
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 3. Choose Camera or Gallery options */
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => startCamera('environment')}
                          className="p-4 rounded-2xl border-2 border-dashed border-rose-300 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-stone-800 shadow-xs flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
                            <Camera size={22} />
                          </div>
                          <span className="text-xs font-bold">Abrir Câmera ao Vivo</span>
                          <span className="text-[10px] text-stone-400">Ver imagem em tempo real</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => nativeCameraInputRef.current?.click()}
                          className="p-4 rounded-2xl border border-rose-200 dark:border-stone-700 bg-white dark:bg-stone-800/60 hover:bg-rose-50 dark:hover:bg-stone-800 text-rose-700 dark:text-rose-300 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-stone-700 shadow-xs flex items-center justify-center text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                            <Camera size={22} />
                          </div>
                          <span className="text-xs font-bold">Câmera do Celular</span>
                          <span className="text-[10px] text-stone-400">Abrir app da câmera nativa</span>
                        </button>

                        <label
                          htmlFor="client-feedback-gallery-file"
                          className="sm:col-span-2 p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center gap-2 transition-colors cursor-pointer group"
                        >
                          <ImageIcon size={18} className="text-stone-500 dark:text-stone-400" />
                          <span className="text-xs font-semibold">Ou selecionar foto existente da galeria</span>
                        </label>
                      </div>

                      {cameraError && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200 dark:border-amber-900">
                          {cameraError}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setFeedbackModal({ isOpen: false, booking: null })}
                    className="flex-1 py-3 px-4 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl font-medium hover:bg-stone-200 transition-colors"
                  >
                    Voltar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl font-medium hover:from-rose-600 hover:to-pink-700 transition-colors"
                  >
                    Enviar Avaliação
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Unificado de Resgate de Prêmio (Fidelidade ou Indicação) */}
      <AnimatePresence>
        {redeemModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl p-6 md:p-8 w-full max-w-lg border border-rose-100 dark:border-stone-800 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 text-white flex items-center justify-center shadow-md">
                  <Gift size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                    {redeemModalType === 'loyalty' ? 'Resgatar Prêmio de Fidelidade' : 'Resgatar Bônus de Indicação'}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {redeemModalType === 'loyalty' 
                      ? 'Parabéns por completar sua carteirinha de fidelidade!' 
                      : 'Parabéns por atingir sua meta de indicações de amigas!'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleConfirmRedemption} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                    Serviço de Recompensa
                  </label>
                  {redeemModalType === 'loyalty' && rewardService ? (
                    <div className="p-3.5 bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="font-bold text-stone-900 dark:text-stone-100 block text-sm">{rewardService.name}</span>
                        <span className="text-xs text-stone-500 dark:text-stone-400">{rewardService.duration} min • {rewardService.category}</span>
                      </div>
                      <span className="text-rose-600 dark:text-rose-300 font-bold bg-white dark:bg-stone-800 px-3 py-1 rounded-xl border border-rose-200 dark:border-rose-900 text-xs shadow-xs">
                        100% CORTESIA
                      </span>
                    </div>
                  ) : (
                    <select
                      value={redeemSelectedServiceId}
                      onChange={e => setRedeemSelectedServiceId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:ring-2 focus:ring-rose-500"
                      required
                    >
                      <option value="">Selecione o serviço para o seu atendimento...</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} (Valor normal: R$ {s.price.toFixed(2).replace('.', ',')} • {s.category})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                        Data Desejada
                      </label>
                      <input
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        value={redeemDate}
                        onChange={e => {
                          setRedeemDate(e.target.value);
                          setRedeemTime('');
                        }}
                        className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                        Horário
                      </label>
                      <select
                        value={redeemTime}
                        onChange={e => setRedeemTime(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm"
                        required
                        disabled={!redeemDate || !isDateAvailableDay}
                      >
                        <option value="">
                          {!redeemDate 
                            ? 'Escolha a data primeiro' 
                            : !isDateAvailableDay 
                            ? 'Salão fechado nesta data' 
                            : 'Selecione o horário...'}
                        </option>
                        {configuredTimes.map(t => {
                          const isBooked = bookedTimesOnRedeemDate.includes(t);
                          return (
                            <option key={t} value={t} disabled={isBooked}>
                              {t} {isBooked ? '— [ ✕ Indisponível ]' : '— Disponível'}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {redeemDate && !isDateAvailableDay && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900">
                      Não atendemos no dia da semana selecionado. Por favor, escolha outro dia.
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t border-stone-100 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => setRedeemModalOpen(false)}
                    disabled={isSubmittingRedeem}
                    className="flex-1 py-3 px-4 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl font-medium text-sm hover:bg-stone-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRedeem}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl font-bold text-sm hover:from-rose-600 hover:to-pink-700 transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    {isSubmittingRedeem ? 'Processando...' : 'Confirmar Agendamento'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Cancelamento do Agendamento */}
      <AnimatePresence>
        {cancelModalBooking && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl p-6 md:p-8 w-full max-w-md border border-rose-100 dark:border-stone-800 text-center space-y-4"
            >
              <div className="w-14 h-14 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-2xl mx-auto flex items-center justify-center shadow-xs">
                <XCircle size={28} />
              </div>
              <div>
                <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                  Cancelar Agendamento?
                </h3>
                <p className="text-sm text-stone-600 dark:text-stone-300 mt-2">
                  Você tem certeza que deseja cancelar seu horário para o dia{' '}
                  <strong className="text-stone-900 dark:text-stone-100">
                    {new Date(`${cancelModalBooking.date}T12:00:00`).toLocaleDateString('pt-BR')}
                  </strong>{' '}
                  às{' '}
                  <strong className="text-stone-900 dark:text-stone-100">
                    {cancelModalBooking.time}
                  </strong>?
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  O horário ficará liberado imediatamente na agenda para outras clientes.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModalBooking(null)}
                  disabled={isCancelling}
                  className="flex-1 py-3 px-4 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl font-medium text-sm hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  disabled={isCancelling}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isCancelling ? 'Cancelando...' : 'Sim, Cancelar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Recibo do Agendamento */}
      {receiptBooking && (
        <BookingReceiptModal 
          isOpen={true} 
          onClose={() => setReceiptBooking(null)} 
          booking={receiptBooking} 
        />
      )}
    </motion.div>
  );
}
