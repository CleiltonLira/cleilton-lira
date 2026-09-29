import { useState } from 'react';
import { useApp } from '../store';
import { Clock, Tag, Gift, Users, Sparkles, Heart, Star, CheckCircle2, Camera, X, Maximize2 } from 'lucide-react';
import { motion } from 'motion/react';
import { PromoBanner } from './PromoBanner';

export function Home() {
  const { setView, settings, services, user, feedbacks, hasUserRedeemedPromo } = useApp();
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Média de avaliações
  const averageRating = feedbacks.length > 0 
    ? (feedbacks.reduce((acc, f) => acc + f.rating, 0) / feedbacks.length).toFixed(1)
    : '5.0';

  // Função para verificar se um serviço está na promoção e calcular preços
  const getServicePromo = (serviceId: string, originalPrice: number) => {
    if (!settings?.promoActive || hasUserRedeemedPromo) return null;

    const promoList = settings.promoServices || [];
    if (promoList.length > 0) {
      const match = promoList.find(p => p.serviceId === serviceId);
      if (match) {
        const discount = match.discountPercent > 0 ? match.discountPercent : (settings.promoDiscount || 0);
        if (discount > 0) {
          const finalPrice = originalPrice * (1 - (discount / 100));
          return { discount, finalPrice };
        }
      }
      return null;
    }

    const s = services.find(srv => srv.id === serviceId);
    if (settings.promoService && s && settings.promoService.toLowerCase() === s.name.toLowerCase()) {
      const discount = settings.promoDiscount || 0;
      if (discount > 0) {
        const finalPrice = originalPrice * (1 - (discount / 100));
        return { discount, finalPrice };
      }
    }

    return null;
  };

  const referralDiscount = settings?.referralDiscountForReferred || 10;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="pb-16"
    >
      <PromoBanner />

      {/* Hero Section Feminina & Sofisticada */}
      <section className="relative bg-stone-100 dark:bg-stone-900/60 overflow-hidden min-h-[520px] flex items-center border-b border-rose-100/60 dark:border-stone-800">
        {settings.heroImageUrl && (
          <div 
            className="absolute inset-0 bg-cover bg-center z-0 opacity-30 dark:opacity-20 mix-blend-multiply filter contrast-105"
            style={{ backgroundImage: `url(${settings.heroImageUrl})` }}
          />
        )}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-rose-400 via-pink-300 to-transparent z-0"></div>
        <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-rose-200/40 dark:bg-rose-950/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-5xl mx-auto px-4 py-16 lg:py-24 flex flex-col md:flex-row items-center gap-12 relative z-10 w-full">
          <div className="flex-1 space-y-6 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold shadow-2xs">
              <Sparkles size={14} className="text-rose-500" />
              <span>{settings.heroSubtitle || 'Espaço Exclusivo de Beleza & Bem-Estar'}</span>
            </div>

            <h2 className="text-4xl lg:text-5xl font-serif text-stone-900 dark:text-stone-100 leading-tight whitespace-pre-wrap">
              {settings.heroTitle || 'Realce sua beleza natural com todo carinho.'}
            </h2>

            <p className="text-stone-600 dark:text-stone-300 text-base sm:text-lg max-w-lg mx-auto md:mx-0 font-light leading-relaxed">
              {settings.welcomeMessage || settings.heroDescription || 'Agende seu horário com nossas especialistas. Conforto, delicadeza e atendimento de alta qualidade em cada detalhe.'}
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-4">
              <button 
                onClick={() => setView('booking')}
                className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white px-8 py-3.5 rounded-full font-medium transition-all shadow-lg shadow-rose-200 dark:shadow-none cursor-pointer flex items-center gap-2"
              >
                <Sparkles size={18} />
                <span>Agendar Horário</span>
              </button>

              {!user && (
                <button
                  onClick={() => setView('register')}
                  className="bg-white dark:bg-stone-800 hover:bg-rose-50 dark:hover:bg-stone-700 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-stone-700 px-6 py-3.5 rounded-full font-medium transition-all shadow-2xs cursor-pointer flex items-center gap-2"
                >
                  <Heart size={16} className="text-rose-500" />
                  <span>Cadastre-se com Bônus</span>
                </button>
              )}
            </div>
          </div>

          <div className="w-full md:w-5/12 max-w-sm">
            <div className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-md p-6 rounded-3xl shadow-xl border border-rose-100 dark:border-stone-800 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-gradient-to-tr from-rose-100 to-pink-100 dark:from-rose-950 dark:to-stone-800 rounded-2xl flex items-center justify-center text-2xl overflow-hidden border border-rose-200/60 dark:border-rose-900/40 shrink-0">
                  {settings.storeIconUrl ? (
                    <img src={settings.storeIconUrl} alt="Store Icon" className="w-full h-full object-cover" />
                  ) : (
                    <Heart size={26} className="fill-rose-400 text-rose-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold font-serif text-stone-900 dark:text-stone-100 text-base">{settings.name || 'Bella Beauty'}</h3>
                  <p className="text-stone-500 dark:text-stone-400 text-xs mt-0.5">{settings.subtitle || 'Salão & Estética'}</p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-400">
                <div className="flex items-center gap-2">
                  <Clock size={15} className="text-rose-400 shrink-0" />
                  <span>{settings.hours || 'Segunda a Sábado, das 08h às 18h'}</span>
                </div>
                {settings.address && (
                  <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400">
                    <span>📍 {settings.address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Destaque das Carteirinhas: Fidelidade & Bônus por Indicação */}
      <section className="max-w-5xl mx-auto px-4 mt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cartão Fidelidade */}
          <div className="bg-gradient-to-br from-white to-rose-50/50 dark:from-stone-900 dark:to-stone-800/80 p-6 rounded-3xl border border-rose-100 dark:border-stone-800 shadow-sm flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-200/50">
              <Gift size={22} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                Carteirinha Fidelidade
              </span>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                Ganhe Cortesia a Cada {settings?.loyaltyMaxStamps || 10} Atendimentos
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                A cada atendimento concluído, sua cartela digital é carimbada com ✕. Complete e desfrute de serviços exclusivos!
              </p>
            </div>
          </div>

          {/* Cartão Indicação Amiga */}
          <div className="bg-gradient-to-br from-white to-pink-50/50 dark:from-stone-900 dark:to-stone-800/80 p-6 rounded-3xl border border-pink-200/70 dark:border-stone-800 shadow-sm flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-pink-200/50">
              <Users size={22} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider block">
                Indique Amigas & Ganhe
              </span>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                Sua amiga ganha R$ {Number(referralDiscount).toFixed(2).replace('.', ',')} OFF
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Compartilhe seu código exclusivo. Quando sua amiga fizer o 1º agendamento, ela ganha desconto e você ganha ✕ na sua cartela!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="max-w-5xl mx-auto px-4 mt-16">
        <div className="text-center mb-10">
          <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest block mb-1">
            Menu de Cuidados
          </span>
          <h2 className="text-3xl font-serif text-stone-900 dark:text-stone-100 font-bold">Nossos Serviços</h2>
          <p className="text-stone-500 dark:text-stone-400 mt-2 text-sm">Escolha seu atendimento favorito e reserve seu momento de renovação.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => {
            const promo = getServicePromo(service.id, service.price);
            return (
              <div 
                key={service.id} 
                className={`bg-white dark:bg-stone-900 p-6 rounded-3xl border transition-all group relative overflow-hidden flex flex-col justify-between ${
                  promo ? 'border-rose-300 dark:border-rose-800 shadow-rose-100 dark:shadow-none shadow-md ring-1 ring-rose-200 dark:ring-rose-900' : 'border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md'
                }`}
              >
                {promo && (
                  <div className="absolute top-0 right-0 bg-rose-500 text-white text-[11px] font-bold px-3 py-1 rounded-bl-2xl flex items-center gap-1 shadow-sm">
                    <Tag size={12} /> {promo.discount}% OFF
                  </div>
                )}

                <div>
                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-3 py-1 rounded-full border border-rose-100 dark:border-rose-900/40 inline-block">
                    {service.category}
                  </span>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 mt-3">{service.name}</h3>
                </div>

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-stone-50 dark:border-stone-800">
                  <span className="text-stone-500 dark:text-stone-400 text-xs flex items-center gap-1 font-medium">
                    <Clock size={14} className="text-rose-400" /> {service.duration} min
                  </span>
                  <div className="text-right">
                    {promo ? (
                      <div className="flex flex-col items-end">
                        <span className="text-xs line-through text-stone-400 font-normal">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(service.price)}
                        </span>
                        <span className="font-bold text-rose-600 dark:text-rose-400 text-base sm:text-lg">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(promo.finalPrice)}
                        </span>
                      </div>
                    ) : (
                      <span className="font-bold text-stone-900 dark:text-stone-100 text-base sm:text-lg">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(service.price)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <button
            onClick={() => setView('booking')}
            className="bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-white text-white dark:text-stone-900 px-8 py-3.5 rounded-full font-medium transition-all shadow-md cursor-pointer"
          >
            Ver Horários & Agendar
          </button>
        </div>
      </section>

      {/* SEÇÃO: CONHEÇA NOSSO ESTÚDIO & GALERIA DE FOTOS EDITÁVEL */}
      <section className="max-w-5xl mx-auto px-4 mt-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest block mb-1">
            Ambiente Acolhedor & Sofisticado
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif text-stone-900 dark:text-stone-100 font-bold">
            Conheça o Nosso Estúdio
          </h2>
          <p className="text-stone-600 dark:text-stone-300 text-sm mt-3 font-light leading-relaxed">
            {settings.studioAbout || 'Nosso espaço foi cuidadosamente planejado para proporcionar uma experiência acolhedora de beleza e bem-estar. Cada detalhe foi pensado para tornar seu momento de autocuidado único.'}
          </p>
        </div>

        {/* Galeria de Fotos Publicadas pela Admin */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {(settings.studioPhotos || []).map((photo: any) => (
            <div 
              key={photo.id || photo.url}
              onClick={() => setSelectedPhoto(photo.url)}
              className="bg-white dark:bg-stone-900 rounded-3xl overflow-hidden border border-rose-100 dark:border-stone-800 shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col"
            >
              <div className="h-56 relative overflow-hidden bg-stone-100 dark:bg-stone-800">
                <img 
                  src={photo.url} 
                  alt={photo.title || 'Foto do Estúdio'} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <span className="text-white text-xs font-medium flex items-center gap-1.5">
                    <Maximize2 size={14} /> Ampliar Foto
                  </span>
                </div>
                {photo.tag && (
                  <span className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full">
                    {photo.tag}
                  </span>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100">{photo.title}</h3>
                  {photo.caption && (
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-2 leading-relaxed">{photo.caption}</p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {(!settings.studioPhotos || settings.studioPhotos.length === 0) && (
            <div className="col-span-full bg-white dark:bg-stone-900 rounded-3xl p-12 text-center border border-stone-200 dark:border-stone-800">
              <Camera size={40} className="mx-auto text-rose-400 mb-3" />
              <h3 className="font-bold text-stone-800 dark:text-stone-200 text-base">Galeria em Atualização</h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">A administradora está preparando fotos incríveis do espaço para você!</p>
            </div>
          )}
        </div>

        {/* Comodidades / Amenities */}
        {settings.studioAmenities && settings.studioAmenities.length > 0 && (
          <div className="bg-gradient-to-br from-rose-50/60 to-pink-50/30 dark:from-stone-900 dark:to-stone-800/80 rounded-3xl p-8 border border-rose-100 dark:border-stone-800">
            <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-100 mb-6 text-center">
              Comodidades para o Seu Conforto ✨
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {settings.studioAmenities.map((amenity: string, idx: number) => (
                <div key={idx} className="bg-white dark:bg-stone-800/80 p-4 rounded-2xl border border-rose-100/60 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 flex items-center gap-2.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                  <span>{amenity}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ÁREA DEDICADA A FEEDBACK, AVALIAÇÃO E FOTOS DAS CLIENTES */}
      <section className="max-w-5xl mx-auto px-4 mt-20">
        <div className="bg-gradient-to-b from-rose-50/70 via-pink-50/40 to-white dark:from-stone-900 dark:via-stone-900/80 dark:to-stone-900/50 rounded-3xl p-8 sm:p-12 border border-rose-100 dark:border-stone-800 shadow-sm relative overflow-hidden">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100/70 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-xs font-bold mb-3 border border-rose-200/60 dark:border-rose-900">
              <Heart size={13} className="fill-rose-500 text-rose-500" />
              <span>Experiências & Amor Próprio</span>
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-serif text-stone-900 dark:text-stone-100 font-bold">
              Feedbacks & Fotos das Clientes
            </h2>
            <p className="text-stone-600 dark:text-stone-300 text-sm mt-2 font-light">
              Veja os depoimentos, notas de 1 a 5 estrelas e os resultados reais compartilhados por quem confia em nossos cuidados.
            </p>

            {/* Selo de Nota Média */}
            <div className="flex items-center justify-center gap-3 mt-4">
              <div className="flex items-center gap-1 text-amber-400">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={20} className="fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-base font-bold text-stone-800 dark:text-stone-200">
                {averageRating} de 5.0
              </span>
              <span className="text-xs text-stone-400 font-medium">
                ({feedbacks.length} {feedbacks.length === 1 ? 'avaliação' : 'avaliações'})
              </span>
            </div>
          </div>

          {feedbacks.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-stone-800/60 rounded-2xl border border-rose-100 dark:border-stone-700 p-6">
              <Camera size={40} className="mx-auto text-rose-300 mb-2" />
              <p className="text-stone-600 dark:text-stone-300 text-sm">Nenhum feedback enviado ainda. Seja a primeira a avaliar!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {feedbacks.map((fb) => (
                <div 
                  key={fb.id}
                  className="bg-white dark:bg-stone-900 rounded-3xl border border-rose-100/90 dark:border-stone-800 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                >
                  {/* Foto da cliente se houver */}
                  {(fb.photoUrl || fb.imageUrl) && (
                    <div 
                      onClick={() => setSelectedPhoto(fb.photoUrl || fb.imageUrl!)}
                      className="relative h-48 w-full overflow-hidden group cursor-pointer bg-stone-100 dark:bg-stone-800"
                    >
                      <img 
                        src={fb.photoUrl || fb.imageUrl} 
                        alt={`Resultado de ${fb.userName || 'Cliente'}`} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1 backdrop-blur-xs">
                        <Camera size={16} /> Ver Foto Ampliada
                      </div>
                      <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Camera size={10} /> Foto Real
                      </div>
                    </div>
                  )}

                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Estrelas */}
                      <div className="flex items-center gap-1 text-amber-400 mb-3">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star 
                            key={star} 
                            size={16} 
                            className={star <= fb.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-200 dark:text-stone-700'} 
                          />
                        ))}
                      </div>

                      {/* Comentário */}
                      <p className="text-stone-700 dark:text-stone-300 text-sm italic font-serif leading-relaxed">
                        "{fb.comment}"
                      </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1">
                          <span>{fb.userName || 'Cliente'}</span>
                          <CheckCircle2 size={13} className="text-emerald-500" title="Atendimento Verificado" />
                        </div>
                        <span className="text-[10px] text-stone-400">Cliente Verificada</span>
                      </div>

                      {fb.createdAt && (
                        <span className="text-[10px] text-stone-400">
                          {new Date(fb.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chamada para clientes avaliarem */}
          <div className="mt-10 text-center bg-white/70 dark:bg-stone-800/50 backdrop-blur-sm rounded-2xl p-4 border border-rose-100 dark:border-stone-700 max-w-lg mx-auto">
            <p className="text-xs text-stone-600 dark:text-stone-300">
              Já realizou um atendimento? Acesse a aba <strong>Meus Atendimentos</strong> e envie seu feedback com foto para inspirar outras mulheres!
            </p>
          </div>
        </div>
      </section>

      {/* Modal de Foto Ampliada */}
      {selectedPhoto && (
        <div 
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 cursor-pointer"
        >
          <div className="relative max-w-2xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl border border-white/20" onClick={(e) => e.stopPropagation()}>
            <img src={selectedPhoto} alt="Foto da Cliente" className="w-full h-full object-contain max-h-[80vh] rounded-2xl" />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-3 right-3 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
