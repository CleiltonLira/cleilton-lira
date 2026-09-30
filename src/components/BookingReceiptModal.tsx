import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer, MessageCircle, Calendar, Clock, MapPin, Phone, User, Sparkles, CheckCircle2, ShieldCheck, AlertCircle, CreditCard, Copy, Check, QrCode } from 'lucide-react';
import { Booking, Service } from '../types';
import { useApp } from '../store';
import { generatePixQrCodeDataUrl } from '../utils/pix';

interface BookingReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
}

export function BookingReceiptModal({ isOpen, onClose, booking }: BookingReceiptModalProps) {
  const { services, settings, professionals, user } = useApp();
  const receiptRef = useRef<HTMLDivElement>(null);

  const [pixQrDataUrl, setPixQrDataUrl] = useState<string>('');
  const [pixPayload, setPixPayload] = useState<string>('');
  const [copiedPixKey, setCopiedPixKey] = useState<boolean>(false);
  const [copiedPixPayload, setCopiedPixPayload] = useState<boolean>(false);

  // Resolve booking services safely
  const bookingServiceIds = booking?.serviceIds && booking.serviceIds.length > 0 
    ? booking.serviceIds 
    : (booking?.serviceId ? [booking.serviceId] : []);

  const bookingServices = services.filter(s => bookingServiceIds.includes(s.id));

  // Determine pricing safely
  let originalPrice = booking?.originalPrice || 0;
  let finalPrice = booking?.finalPrice || 0;
  let discountAmount = booking?.discountAmount || 0;

  // If existing older booking didn't have saved prices, compute them from services list
  if (originalPrice === 0 && bookingServices.length > 0) {
    originalPrice = bookingServices.reduce((sum, s) => sum + s.price, 0);
    finalPrice = originalPrice;
  }
  if (finalPrice === 0 && originalPrice > 0) {
    finalPrice = originalPrice - discountAmount;
  }
  if (discountAmount === 0 && originalPrice > finalPrice) {
    discountAmount = originalPrice - finalPrice;
  }

  const hasDiscount = discountAmount > 0;
  const discountPercent = originalPrice > 0 && hasDiscount 
    ? Math.round((discountAmount / originalPrice) * 100) 
    : 0;

  // Gera o QR Code Pix e payload com o valor final do agendamento (Hook chamado sempre incondicionalmente)
  useEffect(() => {
    if (!isOpen || !booking) {
      setPixQrDataUrl('');
      setPixPayload('');
      return;
    }

    if (settings?.paymentPixKey && settings.paymentPixKey.trim()) {
      generatePixQrCodeDataUrl(settings.paymentPixKey.trim(), {
        merchantName: settings.name || 'BELLA BEAUTY',
        amount: finalPrice > 0 ? finalPrice : undefined,
        width: 280,
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
  }, [isOpen, booking, settings?.paymentPixKey, settings?.name, finalPrice]);

  if (!isOpen || !booking) return null;

  const professional = professionals.find(p => p.id === booking.professionalId);
  const clientName = booking.clientName || user?.name || 'Cliente';
  const clientPhone = booking.clientPhone || user?.phone || '';
  const clientCpf = booking.clientCpf || user?.cpf || '';
  const isPaid = booking.paymentStatus === 'paid';

  const formattedDate = (() => {
    try {
      const parts = booking.date.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
      }
      return booking.date;
    } catch {
      return booking.date;
    }
  })();

  const handlePrint = () => {
    window.print();
  };

  const generateWhatsAppMessage = () => {
    const servicesListText = bookingServices.map(s => `• ${s.name}`).join('%0A');
    const msg = 
`🧾 *RECIBO DE AGENDAMENTO & PAGAMENTO*
*Estabelecimento:* ${settings?.name || 'Salão'}
*Protocolo:* %23AG-${booking.id.toUpperCase()}
*Status Pagamento:* ${isPaid ? 'PAGO E CONFIRMADO ✓' : 'Pendente / No ato'}

👤 *Cliente:* ${clientName}
${clientPhone ? `📱 *Telefone:* ${clientPhone}%0A` : ''}
📅 *Data:* ${formattedDate}
⏱️ *Horário:* ${booking.time}
${professional ? `💇‍♀️ *Profissional:* ${professional.name}%0A` : ''}
✂️ *Serviço(s):*
${servicesListText}

💰 *DETALHES DO PAGAMENTO:*
${hasDiscount ? `• Valor Real: R$ ${originalPrice.toFixed(2).replace('.', ',')}%0A• Desconto: -R$ ${discountAmount.toFixed(2).replace('.', ',')} (${discountPercent}%%25)%0A` : ''}*VALOR TOTAL:* R$ ${finalPrice.toFixed(2).replace('.', ',')}
💳 *Forma:* ${encodeURIComponent(booking.paymentMethod || settings?.paymentTitle || 'PIX / No ato')}
${settings?.paymentPixKey ? `🔑 *Chave PIX:* ${encodeURIComponent(settings.paymentPixKey)}%0A` : ''}📍 *Endereço:* ${settings?.address || 'Consulte o estabelecimento'}
📞 *Contato:* ${settings?.phone || ''}

_Obrigado pela preferência!_`;

    return `https://wa.me/?text=${msg}`;
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
        
        {/* Printable area style */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-receipt, #printable-receipt * {
              visibility: visible;
            }
            #printable-receipt {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              max-width: 100% !important;
              box-shadow: none !important;
              border: 1px solid #ddd !important;
              border-radius: 0 !important;
              padding: 20px !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}} />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-stone-100 my-auto print:max-w-none print:border-none"
        >
          {/* Header Action Bar (Hidden when printing) */}
          <div className="no-print bg-stone-900 text-white px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-rose-400" size={18} />
              <span className="font-medium text-xs sm:text-sm tracking-wide">Recibo Oficial & Comprovante PIX</span>
            </div>
            <button 
              onClick={onClose}
              className="text-stone-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              title="Fechar"
            >
              <X size={20} />
            </button>
          </div>

          {/* Receipt Body (The Printable Slip) */}
          <div ref={receiptRef} id="printable-receipt" className="p-6 sm:p-8 bg-stone-50/40">
            
            {/* Salon Brand Banner */}
            <div className="text-center pb-5 border-b border-dashed border-stone-300">
              {settings?.storeIconUrl ? (
                <img 
                  src={settings.storeIconUrl} 
                  alt={settings.name} 
                  className="w-14 h-14 object-cover rounded-2xl mx-auto mb-2.5 shadow-sm border border-stone-200" 
                />
              ) : (
                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center font-serif text-xl font-bold mx-auto mb-2">
                  {settings?.name?.charAt(0) || 'B'}
                </div>
              )}
              <h3 className="font-serif font-bold text-lg text-stone-900">{settings?.name || 'Bella Beauty'}</h3>
              <p className="text-xs text-stone-500">{settings?.subtitle || 'Espaço de Beleza & Estética'}</p>
              {settings?.address && <p className="text-[11px] text-stone-400 mt-1 flex items-center justify-center gap-1"><MapPin size={11} /> {settings.address}</p>}
            </div>

            {/* Receipt Identification */}
            <div className="py-4 border-b border-dashed border-stone-300 flex items-center justify-between text-xs">
              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-semibold">Protocolo / Agendamento</span>
                <span className="font-mono font-bold text-stone-800">#AG-{booking.id.toUpperCase()}</span>
              </div>
              <div className="text-right">
                <span className="text-stone-400 block text-[10px] uppercase font-semibold">Status do Pagamento</span>
                <span className={`inline-flex items-center gap-1 font-bold px-2.5 py-0.5 rounded-full text-[11px] ${
                  isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {isPaid ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                  {isPaid ? 'Pago e Confirmado' : 'Pendente / Salão'}
                </span>
              </div>
            </div>

            {/* Client & Professional Summary */}
            <div className="py-4 border-b border-dashed border-stone-300 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-500 flex items-center gap-1.5"><User size={13} className="text-rose-500" /> Cliente:</span>
                <strong className="text-stone-900">{clientName}</strong>
              </div>
              {clientPhone && (
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 flex items-center gap-1.5"><Phone size={13} className="text-rose-500" /> WhatsApp:</span>
                  <span className="font-mono text-stone-800">{clientPhone}</span>
                </div>
              )}
              {clientCpf && (
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">CPF:</span>
                  <span className="font-mono text-stone-800">{clientCpf}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-stone-500 flex items-center gap-1.5"><Calendar size={13} className="text-rose-500" /> Data:</span>
                <span className="font-medium text-stone-900">{formattedDate} às {booking.time}</span>
              </div>
              {professional && (
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 flex items-center gap-1.5"><Sparkles size={13} className="text-rose-500" /> Profissional:</span>
                  <strong className="text-stone-900">{professional.name}</strong>
                </div>
              )}
            </div>

            {/* Services breakdown */}
            <div className="py-4 border-b border-dashed border-stone-300 space-y-2.5">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Serviços Contratados</span>
              {bookingServices.map((service, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-stone-700 font-medium">{service.name} ({service.duration} min)</span>
                  <span className="font-mono text-stone-900">R$ {service.price.toFixed(2).replace('.', ',')}</span>
                </div>
              ))}
              {bookingServices.length === 0 && (
                <div className="text-xs text-stone-500 italic">Serviço agendado</div>
              )}
            </div>

            {/* Financial Summary */}
            <div className="py-4 border-b border-dashed border-stone-300 space-y-1.5 text-xs">
              {hasDiscount && (
                <>
                  <div className="flex items-center justify-between text-stone-500">
                    <span>Valor Real dos Serviços:</span>
                    <span className="line-through font-mono">R$ {originalPrice.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="flex items-center justify-between text-rose-600 font-medium">
                    <span>Desconto Aplicado ({discountPercent}%):</span>
                    <span className="font-mono">- R$ {discountAmount.toFixed(2).replace('.', ',')}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between text-sm font-bold text-stone-900 pt-1">
                <span>VALOR TOTAL A PAGAR:</span>
                <span className="font-mono text-rose-600 text-base">R$ {finalPrice.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

            {/* Payment & Pix QR Code Section */}
            <div className="mt-4 p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <CreditCard size={18} />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-bold text-amber-900 uppercase block mb-1">
                    {settings?.paymentTitle || 'Forma de Pagamento'}
                  </span>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    {settings?.paymentInstructions || 'O pagamento é realizado no ato do atendimento diretamente no salão.'}
                  </p>
                  
                  {settings?.paymentPixKey && (
                    <div className="mt-3.5 pt-3.5 border-t border-amber-200/60">
                      <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs flex flex-col sm:flex-row items-center gap-3.5">
                        <div className="relative group shrink-0">
                          <img 
                            src={pixQrDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(settings.paymentPixKey)}`} 
                            alt="QR Code Pix" 
                            className="w-24 h-24 rounded-lg border border-stone-200 bg-white p-1 shadow-2xs" 
                          />
                          <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full shadow-xs">
                            <QrCode size={10} />
                          </div>
                        </div>

                        <div className="space-y-1.5 text-center sm:text-left w-full min-w-0">
                          <div className="flex items-center justify-center sm:justify-start gap-1.5">
                            <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                              QR Code PIX Automático
                            </span>
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                              Gerado em Tempo Real
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                            <strong className="font-mono select-all text-xs text-stone-900 bg-stone-100 p-1 px-2 rounded-lg border border-stone-200">
                              {settings.paymentPixKey}
                            </strong>

                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(settings.paymentPixKey || '');
                                setCopiedPixKey(true);
                                setTimeout(() => setCopiedPixKey(false), 2500);
                              }}
                              className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Copiar Chave PIX"
                            >
                              {copiedPixKey ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                              <span>{copiedPixKey ? 'Chave Copiada!' : 'Copiar Chave'}</span>
                            </button>
                          </div>

                          {pixPayload && (
                            <div className="pt-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(pixPayload);
                                  setCopiedPixPayload(true);
                                  setTimeout(() => setCopiedPixPayload(false), 2500);
                                }}
                                className="text-[10px] text-emerald-700 hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                {copiedPixPayload ? <Check size={11} /> : <Copy size={11} />}
                                <span>{copiedPixPayload ? 'Código Copiado!' : 'Copiar Código Pix Copia e Cola'}</span>
                              </button>
                            </div>
                          )}

                          <span className="text-[10px] text-emerald-700 font-semibold block">
                            ✨ Escaneie com o app do banco ou copie a chave para pagamento instantâneo
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Booking Notes if any */}
            {booking.notes && (
              <div className="mt-3 p-2.5 bg-stone-100/70 rounded-xl text-stone-600 text-xs italic">
                <span className="not-italic font-semibold block text-[10px] text-stone-400 uppercase">Observações:</span>
                "{booking.notes}"
              </div>
            )}

            {/* Thermal Perforation Footer Note */}
            <div className="mt-5 pt-4 text-center border-t border-dashed border-stone-300 text-[11px] text-stone-400">
              <p>Obrigado pela sua preferência! Chegue com 10 minutos de antecedência.</p>
              <p className="font-mono text-[9px] text-stone-300 mt-1">EMITIDO ELETRONICAMENTE EM {new Date().toLocaleDateString('pt-BR')} ÀS {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>

          </div>

          {/* Action Buttons (Hidden during window.print) */}
          <div className="no-print p-4 sm:p-5 bg-white border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button 
              onClick={handlePrint}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Printer size={16} /> Imprimir / Salvar PDF
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <a
                href={generateWhatsAppMessage()}
                target="_blank"
                rel="noreferrer"
                className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <MessageCircle size={16} /> Enviar no WhatsApp
              </a>
              <button 
                onClick={onClose}
                className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-sm"
              >
                Fechar
              </button>
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
