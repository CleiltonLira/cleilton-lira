import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, CheckCircle2, XCircle, MessageCircle, X, ExternalLink, Sparkles, FileText, Clock, AlertCircle, CreditCard, Info, Banknote, Copy, Check, QrCode } from 'lucide-react';
import { Service, Professional, Booking as BookingType } from '../types';
import { BookingReceiptModal } from './BookingReceiptModal';
import { generatePixQrCodeDataUrl } from '../utils/pix';

export function Booking() {
  const { 
    user, 
    setView, 
    services, 
    addBooking, 
    bookings, 
    settings, 
    professionals, 
    bookingPreselectedServices, 
    setBookingPreselectedServices,
    hasUserRedeemedPromo
  } = useApp();
  
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [selectedProfId, setSelectedProfId] = useState<string>('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');

  // Modals & Receipt State
  const [showProfWhatsAppModal, setShowProfWhatsAppModal] = useState<Professional | null>(null);
  const [popupStatus, setPopupStatus] = useState<{ isOpen: boolean; success: boolean; title: string; message: string } | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingType | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [pixQrDataUrl, setPixQrDataUrl] = useState<string>('');
  const [pixPayload, setPixPayload] = useState<string>('');
  const [copiedPixKey, setCopiedPixKey] = useState<boolean>(false);
  const [copiedPixPayload, setCopiedPixPayload] = useState<boolean>(false);

  // Initialize with preselected promo services if any
  useEffect(() => {
    if (bookingPreselectedServices && bookingPreselectedServices.length > 0) {
      setServiceIds(bookingPreselectedServices);
      // Clean up preselected state
      setBookingPreselectedServices([]);
    }
  }, [bookingPreselectedServices, setBookingPreselectedServices]);

  // Check pricing & promo discounts
  const getServicePriceInfo = (service: Service) => {
    // Se a cliente já resgatou a promoção da semana, novos agendamentos voltam para o valor normal da tabela
    if (!settings || !settings.promoActive || hasUserRedeemedPromo) {
      return { originalPrice: service.price, finalPrice: service.price, discountPercent: 0 };
    }
    
    // Apenas serviços listados na aba de promoção entram em promoção
    const promoServicesList = settings.promoServices || [];
    
    if (promoServicesList.length > 0) {
      const specificPromo = promoServicesList.find(p => p.serviceId === service.id);
      if (specificPromo) {
        const discount = specificPromo.discountPercent > 0 
          ? specificPromo.discountPercent 
          : (settings.promoDiscount || 0);
        if (discount > 0) {
          const finalPrice = service.price * (1 - (discount / 100));
          return { originalPrice: service.price, finalPrice, discountPercent: discount };
        }
      }
      // Se há lista de serviços na promoção e este serviço não está nela, preço normal
      return { originalPrice: service.price, finalPrice: service.price, discountPercent: 0 };
    }

    // Caso retrocompatível se configurado apenas serviço individual por nome
    if (settings.promoService && settings.promoService.toLowerCase() === service.name.toLowerCase()) {
      const discount = settings.promoDiscount || 0;
      if (discount > 0) {
        const finalPrice = service.price * (1 - (discount / 100));
        return { originalPrice: service.price, finalPrice, discountPercent: discount };
      }
    }
    
    // Se nenhum serviço foi selecionado na aba de promoção, nenhum serviço recebe desconto
    return { originalPrice: service.price, finalPrice: service.price, discountPercent: 0 };
  };

  // Current day of the week based on selected date
  const currentDayOfWeek = useMemo(() => {
    if (!date) return null;
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day).getDay();
  }, [date]);

  // Check if selected date falls on an open day of the week (respecting daily schedules or general availableDays)
  const isDateAvailableDay = useMemo(() => {
    if (currentDayOfWeek === null) return true;
    if (settings?.dailySchedules && settings.dailySchedules[currentDayOfWeek]) {
      return Boolean(settings.dailySchedules[currentDayOfWeek].enabled);
    }
    const allowedDays = settings?.availableDays !== undefined ? settings.availableDays : [1, 2, 3, 4, 5, 6];
    return allowedDays.includes(currentDayOfWeek);
  }, [currentDayOfWeek, settings?.dailySchedules, settings?.availableDays]);

  // Generate available times based on daily schedule or fallback salon times
  const configuredTimes = useMemo(() => {
    if (currentDayOfWeek !== null && settings?.dailySchedules && settings.dailySchedules[currentDayOfWeek]) {
      return settings.dailySchedules[currentDayOfWeek].slots || [];
    }
    if (settings?.availableTimeSlots && settings.availableTimeSlots.length > 0) {
      return settings.availableTimeSlots;
    }
    return ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
  }, [currentDayOfWeek, settings?.dailySchedules, settings?.availableTimeSlots]);

  // Duração total estimada dos serviços selecionados (em minutos)
  const totalSelectedDuration = useMemo(() => {
    const selected = services.filter(s => serviceIds.includes(s.id));
    if (selected.length === 0) return 60;
    return selected.reduce((sum, s) => sum + (s.duration || 60), 0);
  }, [serviceIds, services]);

  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Verifica se o horário já passou em relação à hora atual
  const isSlotPast = (slotTime: string) => {
    if (!date) return false;
    const todayStr = getTodayDateString();
    if (date < todayStr) return true;
    if (date === todayStr) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const slotMinutes = timeToMinutes(slotTime);
      return slotMinutes <= currentMinutes;
    }
    return false;
  };

  // Intervalos de agendamentos existentes na data selecionada considerando duração estipulada
  const activeBookingsIntervalsOnDate = useMemo(() => {
    if (!date) return [];
    return bookings
      .filter(b => b.date === date && b.status !== 'cancelled' && (!selectedProfId || !b.professionalId || b.professionalId === selectedProfId))
      .map(b => {
        const bStart = timeToMinutes(b.time);
        const bServices = services.filter(s => (b.serviceIds || [b.serviceId]).includes(s.id));
        const bDuration = bServices.reduce((sum, s) => sum + (s.duration || 60), 0) || 60;
        const bEnd = bStart + bDuration;
        return { start: bStart, end: bEnd, time: b.time, duration: bDuration };
      });
  }, [date, bookings, selectedProfId, services]);

  const isSlotOccupied = (slotTime: string) => {
    const slotStart = timeToMinutes(slotTime);
    const slotEnd = slotStart + totalSelectedDuration;

    return activeBookingsIntervalsOnDate.some(b => {
      // Overlap condition: max(start1, start2) < min(end1, end2)
      return Math.max(slotStart, b.start) < Math.min(slotEnd, b.end);
    });
  };

  const isSlotUnavailable = (slotTime: string) => {
    return isSlotPast(slotTime) || isSlotOccupied(slotTime);
  };

  // Deseleciona horário caso os serviços selecionados façam o tempo colidir ou horário já tenha passado
  useEffect(() => {
    if (time && isSlotUnavailable(time)) {
      setTime('');
    }
  }, [serviceIds, date, totalSelectedDuration]);

  const toggleService = (id: string) => {
    setServiceIds(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  // Pricing calculations: Original Real Value vs Promotional Final Value & Referral Bonus
  const pricingSummary = useMemo(() => {
    let originalTotal = 0;
    let promoTotal = 0;

    serviceIds.forEach(id => {
      const s = services.find(srv => srv.id === id);
      if (!s) return;
      const { originalPrice, finalPrice } = getServicePriceInfo(s);
      originalTotal += originalPrice;
      promoTotal += finalPrice;
    });

    // Desconto de Indicação para novas clientes indicadas (válido exclusivamente no 1º serviço)
    const userAlreadyHasPriorBookings = bookings.some(b => b.userId === user?.id && b.status !== 'cancelled');
    const isFirstReferredBooking = Boolean(
      user?.referredBy && 
      !user?.firstBookingDone && 
      !userAlreadyHasPriorBookings &&
      settings?.referralActive &&
      settings?.referralDiscountForReferred && 
      settings.referralDiscountForReferred > 0
    );

    let referralDiscount = 0;
    if (isFirstReferredBooking) {
      if (settings?.referralDiscountType === 'percent') {
        referralDiscount = (promoTotal * (settings.referralDiscountForReferred || 0)) / 100;
      } else {
        referralDiscount = settings?.referralDiscountForReferred || 0;
      }
    }

    const finalTotal = Math.max(0, promoTotal - referralDiscount);
    const discountTotal = Math.max(0, originalTotal - finalTotal);
    const hasDiscount = discountTotal > 0;
    const discountPercent = originalTotal > 0 && hasDiscount 
      ? Math.round((discountTotal / originalTotal) * 100) 
      : 0;

    return {
      originalTotal,
      finalTotal,
      discountTotal,
      hasDiscount,
      discountPercent,
      isFirstReferredBooking,
      referralDiscount,
      referralDiscountType: settings?.referralDiscountType || 'fixed',
      referralDiscountConfigured: settings?.referralDiscountForReferred || 0
    };
  }, [serviceIds, services, settings, user]);

  // Gera o QR Code Pix e Payload dinamicamente quando houver chave cadastrada
  useEffect(() => {
    if (settings?.paymentPixKey && settings.paymentPixKey.trim()) {
      generatePixQrCodeDataUrl(settings.paymentPixKey.trim(), {
        merchantName: settings.name || 'BELLA BEAUTY',
        amount: pricingSummary.finalTotal > 0 ? pricingSummary.finalTotal : undefined,
        width: 240,
      }).then(res => {
        setPixQrDataUrl(res.dataUrl);
        setPixPayload(res.payload);
      }).catch(() => {
        setPixQrDataUrl('');
        setPixPayload('');
      });
    } else {
      setPixQrDataUrl('');
      setPixPayload('');
    }
  }, [settings?.paymentPixKey, settings?.name, pricingSummary.finalTotal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setView('login');
      return;
    }

    if (serviceIds.length === 0 || !date || !time) return;

    const isPromoBooking = Boolean(!hasUserRedeemedPromo && pricingSummary.hasDiscount && !pricingSummary.isFirstReferredBooking);

    const result = await addBooking({
      serviceId: serviceIds[0],
      serviceIds,
      paymentMethod: settings?.paymentTitle || 'No ato do atendimento',
      professionalId: selectedProfId || undefined,
      userId: user.id,
      date,
      time,
      notes,
      originalPrice: pricingSummary.originalTotal,
      finalPrice: pricingSummary.finalTotal,
      discountAmount: hasUserRedeemedPromo ? 0 : pricingSummary.discountTotal,
      discountPercent: hasUserRedeemedPromo ? 0 : pricingSummary.discountPercent,
      isPromo: isPromoBooking
    });
    
    if (result.error) {
      setPopupStatus({
        isOpen: true,
        success: false,
        title: 'Horário Indisponível',
        message: result.error || 'Não foi possível concluir o agendamento no momento.'
      });
    } else if (result.booking) {
      setConfirmedBooking(result.booking);
      setShowReceiptModal(true);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-serif text-stone-800 mb-4">Quase lá!</h2>
        <p className="text-stone-600 mb-8">Para agendar um horário, precisamos que você faça login ou um rápido cadastro.</p>
        <button 
          onClick={() => setView('login')}
          className="bg-rose-600 text-white px-8 py-3 rounded-full font-medium hover:bg-rose-700 transition-colors cursor-pointer"
        >
          Fazer Login ou Cadastro
        </button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto px-4 py-12"
    >
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500">
          <Calendar size={28} />
        </div>
        <h2 className="text-3xl font-serif text-stone-800">Agende seu horário</h2>
        <p className="text-stone-500 mt-2">Selecione os serviços desejados, profissional e o melhor dia e hora.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-100 space-y-6">
        
        {/* Serviços */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-stone-700">
              Serviços Desejados <span className="text-xs text-stone-400">(selecione um ou mais)</span>
            </label>
            {settings?.promoActive && !hasUserRedeemedPromo && (
              <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles size={12} /> Promoção Ativa
              </span>
            )}
            {hasUserRedeemedPromo && (
              <span className="text-xs font-semibold text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-500" /> Tabela Normal (Promoção já resgatada)
              </span>
            )}
          </div>

          {hasUserRedeemedPromo && (
            <div className="mb-3 p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center gap-2.5 text-amber-900 text-xs">
              <Sparkles size={16} className="text-amber-600 shrink-0" />
              <span>
                <strong>Oferta da Semana já resgatada por você.</strong> Este novo agendamento será realizado pelo <strong>valor normal</strong> do catálogo.
              </span>
            </div>
          )}
          
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {services.map(s => {
              const isSelected = serviceIds.includes(s.id);
              const { originalPrice, finalPrice, discountPercent } = getServicePriceInfo(s);
              const hasDiscount = discountPercent > 0;

              return (
                <div 
                  key={s.id} 
                  onClick={() => toggleService(s.id)}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    isSelected ? 'border-rose-500 bg-rose-50/40 ring-1 ring-rose-300' : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-colors ${
                      isSelected ? 'bg-rose-500 border-rose-500' : 'bg-white border-stone-300'
                    }`}>
                      {isSelected && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-stone-800 text-sm block">{s.name}</span>
                      <span className="text-xs text-stone-500">{s.duration} min • {s.category}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    {hasDiscount ? (
                      <div className="flex flex-col items-end">
                        <span className="text-xs line-through text-stone-400">
                          R$ {originalPrice.toFixed(2).replace('.', ',')}
                        </span>
                        <span className="font-bold text-rose-600 text-sm">
                          R$ {finalPrice.toFixed(2).replace('.', ',')}
                        </span>
                        <span className="text-[10px] font-semibold text-rose-500 bg-rose-100 px-1.5 py-0.2 rounded mt-0.5">
                          -{discountPercent}%
                        </span>
                      </div>
                    ) : (
                      <span className="font-semibold text-stone-700 text-sm">
                        R$ {originalPrice.toFixed(2).replace('.', ',')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {serviceIds.length > 0 && (
            <div className="mt-4 p-4 sm:p-5 bg-stone-50/90 rounded-2xl border border-stone-200/90 space-y-2.5">
              <div className="flex items-center justify-between text-xs sm:text-sm text-stone-600">
                <span className="font-medium">
                  Valor Real ({serviceIds.length} {serviceIds.length === 1 ? 'serviço' : 'serviços'}):
                </span>
                <span className={pricingSummary.hasDiscount ? 'line-through text-stone-400 font-semibold' : 'font-bold text-stone-800'}>
                  R$ {pricingSummary.originalTotal.toFixed(2).replace('.', ',')}
                </span>
              </div>

              {pricingSummary.hasDiscount && (
                <div className="flex items-center justify-between text-xs sm:text-sm text-rose-600 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={15} /> Desconto da Promoção ({pricingSummary.discountPercent}% OFF):
                  </span>
                  <span>- R$ {pricingSummary.discountTotal.toFixed(2).replace('.', ',')}</span>
                </div>
              )}

              <div className="pt-2.5 border-t border-stone-200 flex items-center justify-between">
                <div>
                  <span className="text-xs sm:text-sm font-bold text-stone-900 block uppercase tracking-wider">
                    Valor a Pagar:
                  </span>
                  {pricingSummary.hasDiscount && (
                    <span className="text-[11px] font-semibold text-emerald-600 block">
                      Você economiza R$ {pricingSummary.discountTotal.toFixed(2).replace('.', ',')}!
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xl sm:text-2xl font-extrabold text-stone-900">
                    R$ {pricingSummary.finalTotal.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Escolha do Profissional */}
        {professionals.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Escolha a Profissional <span className="text-xs text-stone-400">(opcional)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {professionals.map(prof => {
                const isSelected = selectedProfId === prof.id;
                return (
                  <div
                    key={prof.id}
                    onClick={() => setSelectedProfId(isSelected ? '' : prof.id)}
                    className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected ? 'border-rose-500 bg-rose-50/40 ring-2 ring-rose-200' : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 font-bold flex items-center justify-center text-sm">
                        {prof.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-stone-800">{prof.name}</p>
                        <p className="text-xs text-stone-500">{prof.phone}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowProfWhatsAppModal(prof);
                      }}
                      className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Chamar no WhatsApp"
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Informação sobre Pagamento */}
        <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
            <CreditCard size={20} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                {settings?.paymentTitle || 'Pagamento no Ato do Atendimento'}
              </h4>
              {settings?.paymentMethodsList && (
                <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-200 bg-amber-200/60 dark:bg-amber-900/50 px-2 py-0.5 rounded-full">
                  {settings.paymentMethodsList}
                </span>
              )}
            </div>
            <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-1 leading-relaxed">
              {settings?.paymentInstructions || (
                <>O pagamento do seu procedimento não é cobrado agora pelo site. Você realiza o pagamento <strong>no ato do atendimento</strong> diretamente no salão (aceitamos <strong>Cartões de Crédito/Débito, PIX e Dinheiro</strong>).</>
              )}
            </p>
            {settings?.paymentPixKey && (
              <div className="mt-3.5 p-3.5 bg-white dark:bg-stone-900 rounded-2xl border border-amber-200 dark:border-amber-800 shadow-2xs">
                <div className="flex flex-col sm:flex-row items-center gap-3.5">
                  <div className="relative group shrink-0">
                    <img 
                      src={pixQrDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(settings.paymentPixKey)}`} 
                      alt="QR Code Pix" 
                      className="w-24 h-24 rounded-xl border border-stone-200 dark:border-stone-700 bg-white p-1.5 shadow-xs" 
                    />
                    <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full shadow-xs">
                      <QrCode size={11} />
                    </div>
                  </div>

                  <div className="space-y-2 text-center sm:text-left flex-1 min-w-0 w-full">
                    <div className="flex items-center justify-center sm:justify-start gap-1.5">
                      <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                        Chave PIX do Salão
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        QR Code Gerado
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <div className="text-xs font-mono font-bold text-stone-900 dark:text-stone-100 bg-stone-100 dark:bg-stone-800 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 select-all max-w-full truncate">
                        {settings.paymentPixKey}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(settings.paymentPixKey || '');
                          setCopiedPixKey(true);
                          setTimeout(() => setCopiedPixKey(false), 2500);
                        }}
                        className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Copiar Chave PIX"
                      >
                        {copiedPixKey ? <Check size={13} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={13} />}
                        <span>{copiedPixKey ? 'Chave Copiada!' : 'Copiar Chave PIX'}</span>
                      </button>
                    </div>

                    {pixPayload && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(pixPayload);
                            setCopiedPixPayload(true);
                            setTimeout(() => setCopiedPixPayload(false), 2500);
                          }}
                          className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          {copiedPixPayload ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedPixPayload ? 'Código Copiado com Sucesso!' : 'Copiar Código Pix Copia e Cola'}</span>
                        </button>
                      </div>
                    )}

                    <span className="text-[10px] text-stone-500 dark:text-stone-400 block">
                      ✨ Você pode escanear o QR Code no app do seu banco ou copiar a chave para efetuar o pagamento.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Data e Horário */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Data do Atendimento</label>
              <input 
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTime('');
                }}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 bg-white"
                required
                min={getTodayDateString()}
              />
              {date && !isDateAvailableDay && (
                <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-800">
                  <AlertCircle size={15} className="shrink-0 text-amber-600" />
                  <span>Não atendemos no dia da semana selecionado. Por favor, escolha outro dia.</span>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-stone-700">Horário</label>
                {date && (
                  <span className="text-xs text-stone-500 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Vago</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span> Reservado</span>
                    {date === getTodayDateString() && (
                      <span className="flex items-center gap-1 text-stone-500"><span className="w-2 h-2 rounded-full bg-stone-400 inline-block"></span> Passou</span>
                    )}
                  </span>
                )}
              </div>

              {serviceIds.length > 0 && (
                <div className="mb-2 text-[11px] font-medium text-stone-600 bg-rose-50/60 p-2 rounded-xl border border-rose-100 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-rose-700">
                    <Clock size={13} /> Duração total estipulada: <strong>{totalSelectedDuration} min</strong>
                  </span>
                  <span className="text-stone-400 text-[10px]">Horários ajustados automaticamente</span>
                </div>
              )}

              {!date ? (
                <div className="p-4 rounded-xl border border-dashed border-stone-300 text-center text-sm text-stone-400 bg-stone-50">
                  Selecione a data primeiro para visualizar os horários
                </div>
              ) : !isDateAvailableDay ? (
                <div className="p-4 rounded-xl border border-amber-200 text-center text-sm text-amber-700 bg-amber-50">
                  Salão fechado nesta data. Escolha um dia de atendimento.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Grade de botões interativos de horários */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {configuredTimes.map((t) => {
                      const past = isSlotPast(t);
                      const occupied = !past && isSlotOccupied(t);
                      const isUnavailable = past || occupied;
                      const isSelected = time === t;

                      if (isUnavailable) {
                        return (
                          <div
                            key={t}
                            title={past ? "Horário anterior ao atual (indisponível para hoje)" : "Horário indisponível (ocupado por outro atendimento)"}
                            className="relative py-2 px-2 rounded-xl bg-stone-100 border border-stone-200 text-stone-400 text-xs font-semibold flex items-center justify-center gap-1 cursor-not-allowed select-none opacity-60"
                          >
                            <span className="line-through">{t}</span>
                            <span className={`text-white font-extrabold text-[9px] px-1 py-0.2 rounded shadow-xs ${past ? 'bg-stone-400 text-[8px]' : 'bg-rose-500'}`}>
                              {past ? 'passou' : '✕'}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTime(t)}
                          className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                            isSelected
                              ? 'bg-rose-600 text-white border-rose-600 shadow-sm ring-2 ring-rose-200'
                              : 'bg-white text-stone-800 border-stone-200 hover:border-rose-300 hover:bg-rose-50/40'
                          }`}
                        >
                          <Clock size={12} className={isSelected ? 'text-white' : 'text-stone-400'} />
                          <span>{t}</span>
                        </button>
                      );
                    })}
                  </div>
                  {date === getTodayDateString() && (
                    <p className="text-[11px] text-stone-500 italic">
                      * Horários de hoje a partir da hora atual estão livres para agendamento. Horários anteriores ficam indisponíveis automaticamente.
                    </p>
                  )}

                  {time && (
                    <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 size={13} /> Horário selecionado: <strong>{time}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Observações */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">Observações (opcional)</label>
          <textarea 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 bg-white resize-none h-20"
            placeholder="Alguma preferência, dúvida ou detalhe do atendimento?"
          ></textarea>
        </div>

        {/* Resumo Financeiro & Bônus de Indicação */}
        {serviceIds.length > 0 && (
          <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-4 sm:p-5 space-y-2 text-sm">
            <div className="flex justify-between items-center text-stone-600">
              <span>Subtotal dos Serviços ({serviceIds.length}):</span>
              <span className="font-semibold text-stone-800">
                R$ {pricingSummary.originalTotal.toFixed(2).replace('.', ',')}
              </span>
            </div>

            {pricingSummary.isFirstReferredBooking && pricingSummary.referralDiscount > 0 && (
              <div className="flex justify-between items-center text-pink-700 bg-pink-100/70 px-3 py-2 rounded-xl border border-pink-200 font-medium">
                <span className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <Sparkles size={16} className="text-pink-600" />
                  Bônus de Indicação Amiga ({pricingSummary.referralDiscountType === 'percent' ? `-${pricingSummary.referralDiscountConfigured}% no 1º Serviço` : '1º Serviço'}):
                </span>
                <span className="font-bold">
                  - R$ {pricingSummary.referralDiscount.toFixed(2).replace('.', ',')}
                </span>
              </div>
            )}

            {pricingSummary.discountTotal > 0 && !pricingSummary.isFirstReferredBooking && (
              <div className="flex justify-between items-center text-rose-700 font-medium text-xs sm:text-sm">
                <span>Desconto Promocional:</span>
                <span className="font-bold">
                  - R$ {pricingSummary.discountTotal.toFixed(2).replace('.', ',')}
                </span>
              </div>
            )}

            <div className="border-t border-rose-200/70 pt-2 flex justify-between items-center">
              <span className="font-bold text-stone-800 text-base">Total Final a Pagar:</span>
              <span className="font-extrabold text-rose-700 text-lg sm:text-xl">
                {pricingSummary.finalTotal === 0 
                  ? '100% CORTESIA' 
                  : `R$ ${pricingSummary.finalTotal.toFixed(2).replace('.', ',')}`}
              </span>
            </div>
          </div>
        )}

        {/* Lembrete ao finalizar */}
        <div className="p-4 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex items-start sm:items-center gap-3 text-xs text-rose-950 dark:text-rose-200">
          <AlertCircle size={20} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
          <div className="leading-relaxed">
            <span className="font-bold uppercase tracking-wider block sm:inline mr-1 text-rose-800 dark:text-rose-300">
              {settings?.paymentTitle || 'Lembrete de Pagamento'}:
            </span>
            <span>
              {pricingSummary.finalTotal === 0 ? (
                <span>Este procedimento é uma <strong>cortesia/benefício</strong> e não possui custo. Aproveite o seu momento!</span>
              ) : settings?.paymentInstructions ? (
                <span>{settings.paymentInstructions}</span>
              ) : (
                <span>O valor de <strong>R$ {pricingSummary.finalTotal.toFixed(2).replace('.', ',')}</strong> deve ser pago <strong>no ato do atendimento</strong> diretamente no salão (PIX, Cartão ou Dinheiro).</span>
              )}
            </span>
          </div>
        </div>

        <button 
          type="submit"
          disabled={!time || serviceIds.length === 0}
          className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white py-4 rounded-xl font-medium transition-all shadow-lg shadow-rose-200/50 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
        >
          <span>Confirmar Agendamento</span>
          {pricingSummary.finalTotal > 0 && (
            <span className="bg-white/20 px-2.5 py-0.5 rounded-lg text-sm font-bold">
              • {settings?.paymentTitle ? `${settings.paymentTitle}:` : 'Pagar no ato:'} R$ {pricingSummary.finalTotal.toFixed(2).replace('.', ',')}
            </span>
          )}
        </button>
      </form>

      {/* Modal WhatsApp Profissional */}
      <AnimatePresence>
        {showProfWhatsAppModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 w-full max-w-sm text-center relative"
            >
              <button 
                onClick={() => setShowProfWhatsAppModal(null)}
                className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 p-2 cursor-pointer"
              >
                <X size={20} />
              </button>

              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MessageCircle size={32} />
              </div>

              <h3 className="text-xl font-serif text-stone-800 mb-1">Falar com {showProfWhatsAppModal.name}</h3>
              <p className="text-sm text-stone-500 mb-6">
                Tire dúvidas sobre horários ou serviços diretamente pelo WhatsApp: <br />
                <span className="font-semibold text-stone-700">{showProfWhatsAppModal.phone}</span>
              </p>

              <a 
                href={`https://wa.me/55${showProfWhatsAppModal.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${showProfWhatsAppModal.name}! Estou no aplicativo agendando um horário e gostaria de tirar uma dúvida.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-emerald-600 text-white py-3.5 px-4 rounded-xl font-medium hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
              >
                <MessageCircle size={18} /> Iniciar conversa no WhatsApp <ExternalLink size={16} />
              </a>

              <button 
                onClick={() => setShowProfWhatsAppModal(null)}
                className="mt-3 text-sm text-stone-400 hover:text-stone-600 py-1"
              >
                Fechar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pop-up de Confirmação ou Negação */}
      <AnimatePresence>
        {popupStatus?.isOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 w-full max-w-md text-center"
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                popupStatus.success ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
              }`}>
                {popupStatus.success ? <CheckCircle2 size={36} /> : <XCircle size={36} />}
              </div>

              <h3 className="text-2xl font-serif text-stone-900 mb-2">{popupStatus.title}</h3>
              <p className="text-sm text-stone-600 mb-6 leading-relaxed">{popupStatus.message}</p>

              <div className="space-y-2.5">
                {popupStatus.success && confirmedBooking && (
                  <button 
                    onClick={() => {
                      setPopupStatus(null);
                      setShowReceiptModal(true);
                    }}
                    className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all flex items-center justify-center gap-2 shadow-md shadow-rose-200 cursor-pointer"
                  >
                    <FileText size={18} /> Ver Recibo de Agendamento
                  </button>
                )}

                <button 
                  onClick={() => {
                    const wasSuccess = popupStatus.success;
                    setPopupStatus(null);
                    if (wasSuccess) {
                      setView('client');
                    }
                  }}
                  className={`w-full py-3.5 px-4 rounded-xl font-medium transition-all cursor-pointer ${
                    popupStatus.success 
                      ? 'bg-stone-100 hover:bg-stone-200 text-stone-800' 
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {popupStatus.success ? 'Ir para Meus Agendamentos' : 'Tentar Novamente'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Recibo Oficial de Agendamento */}
      <BookingReceiptModal 
        isOpen={showReceiptModal}
        onClose={() => {
          setShowReceiptModal(false);
          setView('client');
        }}
        booking={confirmedBooking}
      />

    </motion.div>
  );
}
