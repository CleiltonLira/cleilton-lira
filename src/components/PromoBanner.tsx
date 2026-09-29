import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Timer, ArrowRight, Tag } from 'lucide-react';
import { useApp } from '../store';

export function PromoBanner() {
  const { settings, applyPromoAndGoToBooking, services, hasUserRedeemedPromo } = useApp();
  const [timeLeft, setTimeLeft] = useState({ dias: 0, horas: 0, minutos: 0, segundos: 0 });
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!settings || !settings.promoActive || !settings.promoEndsAt || hasUserRedeemedPromo) {
      setIsActive(false);
      return;
    }

    const calculateTimeLeft = () => {
      const difference = +new Date(settings.promoEndsAt) - +new Date();
      if (difference > 0) {
        setIsActive(true);
        setTimeLeft({
          dias: Math.floor(difference / (1000 * 60 * 60 * 24)),
          horas: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutos: Math.floor((difference / 1000 / 60) % 60),
          segundos: Math.floor((difference / 1000) % 60)
        });
      } else {
        setIsActive(false);
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [settings, hasUserRedeemedPromo]);

  if (!isActive || !settings || hasUserRedeemedPromo) return null;

  const promoServicesData = (settings.promoServices || []).map(ps => {
    const service = services.find(s => s.id === ps.serviceId);
    if (!service) return null;
    const finalPrice = service.price * (1 - (ps.discountPercent / 100));
    return {
      name: service.name,
      originalPrice: service.price,
      finalPrice: finalPrice,
      discount: ps.discountPercent
    };
  }).filter(Boolean) as {name: string, originalPrice: number, finalPrice: number, discount: number}[];


  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto px-4 mt-6 mb-8"
    >
      <div className="bg-white rounded-3xl overflow-hidden shadow-lg border border-rose-100 flex flex-col md:flex-row relative">
        {/* Abstract shape */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        
        {settings.promoImageUrl && (
          <div className="md:w-2/5 h-48 md:h-auto relative">
            <img 
              src={settings.promoImageUrl} 
              alt="Promoção" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent md:hidden"></div>
            <div className="absolute bottom-4 left-4 md:hidden text-white flex items-center gap-2 font-medium">
              <Tag size={18} />
              Oferta Especial
            </div>
            {settings.promoDiscount > 0 && (
              <div className="absolute top-4 right-4 bg-rose-500 text-white font-bold px-3 py-1 rounded-full shadow-lg transform rotate-3">
                {settings.promoDiscount}% OFF
              </div>
            )}
          </div>
        )}
        
        <div className={`p-6 md:p-8 flex flex-col justify-center flex-1 relative ${!settings.promoImageUrl ? 'text-center items-center' : ''}`}>
          {!settings.promoImageUrl && settings.promoDiscount > 0 && (
            <div className="absolute top-4 right-4 bg-rose-500 text-white font-bold px-3 py-1 rounded-full shadow-sm transform rotate-3">
              {settings.promoDiscount}% OFF
            </div>
          )}
          
          <div className="hidden md:flex items-center gap-2 text-rose-600 font-semibold text-sm uppercase tracking-wider mb-3">
            <Tag size={16} /> Oferta Especial
          </div>
          
          <h3 className="text-2xl md:text-3xl font-serif text-stone-900 leading-tight mb-2">
            {settings.promoTitle}
          </h3>
          
          <p className="text-stone-600 mb-4 max-w-lg">
            {settings.promoDescription}
          </p>

          {promoServicesData.length > 0 ? (
            <div className={`mb-6 flex flex-col gap-2 ${!settings.promoImageUrl ? 'items-center' : ''}`}>
              {promoServicesData.map((s, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-3 bg-stone-50 p-2 rounded-lg border border-stone-100">
                  <div className="text-stone-800 text-sm font-medium">
                    {s.name}
                  </div>
                  {s.discount > 0 ? (
                    <div className="text-rose-700 text-sm font-bold flex items-center gap-2">
                      <span className="line-through text-stone-400 font-normal text-xs">
                        R$ {s.originalPrice.toFixed(2).replace('.', ',')}
                      </span>
                      R$ {s.finalPrice.toFixed(2).replace('.', ',')}
                    </div>
                  ) : (
                    <div className="text-stone-800 text-sm font-bold flex items-center gap-2">
                      R$ {s.finalPrice.toFixed(2).replace('.', ',')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (settings.promoService || settings.promoPrice) && (
            <div className={`mb-6 flex items-center gap-3 ${!settings.promoImageUrl ? 'justify-center' : ''}`}>
              {settings.promoService && (
                <div className="bg-stone-100 text-stone-800 px-3 py-1 rounded-lg text-sm font-medium">
                  {settings.promoService}
                </div>
              )}
              {settings.promoPrice && (
                <div className="bg-rose-100 text-rose-700 px-3 py-1 rounded-lg text-lg font-bold">
                  {settings.promoPrice}
                </div>
              )}
            </div>
          )}
          
          <div className={`flex flex-wrap items-center gap-6 ${!settings.promoImageUrl ? 'justify-center' : ''}`}>
            <div className="flex items-center gap-3">
              <Timer className="text-rose-500" />
              <div className="flex gap-2 text-center">
                <div className="bg-rose-50 border border-rose-100 rounded-lg px-3 py-1.5 min-w-[3.5rem]">
                  <span className="block text-lg font-bold text-rose-600 leading-none">{timeLeft.dias}</span>
                  <span className="text-[10px] uppercase font-medium text-rose-500">Dias</span>
                </div>
                <span className="text-rose-300 font-bold self-center">:</span>
                <div className="bg-rose-50 border border-rose-100 rounded-lg px-3 py-1.5 min-w-[3.5rem]">
                  <span className="block text-lg font-bold text-rose-600 leading-none">{timeLeft.horas.toString().padStart(2, '0')}</span>
                  <span className="text-[10px] uppercase font-medium text-rose-500">Hrs</span>
                </div>
                <span className="text-rose-300 font-bold self-center">:</span>
                <div className="bg-rose-50 border border-rose-100 rounded-lg px-3 py-1.5 min-w-[3.5rem]">
                  <span className="block text-lg font-bold text-rose-600 leading-none">{timeLeft.minutos.toString().padStart(2, '0')}</span>
                  <span className="text-[10px] uppercase font-medium text-rose-500">Min</span>
                </div>
                <span className="text-rose-300 font-bold self-center">:</span>
                <div className="bg-rose-50 border border-rose-100 rounded-lg px-3 py-1.5 min-w-[3.5rem]">
                  <span className="block text-lg font-bold text-rose-600 leading-none">{timeLeft.segundos.toString().padStart(2, '0')}</span>
                  <span className="text-[10px] uppercase font-medium text-rose-500">Seg</span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => applyPromoAndGoToBooking()}
              className="bg-stone-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-stone-800 transition-colors shadow-lg shadow-stone-200 flex items-center gap-2 ml-auto cursor-pointer"
            >
              Aproveitar <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
