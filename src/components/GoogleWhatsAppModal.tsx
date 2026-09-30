import React, { useState } from 'react';
import { useApp } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Check, ShieldCheck, Heart } from 'lucide-react';

export function GoogleWhatsAppModal() {
  const { user, requiresGooglePhoneModal, completeGoogleLoginWithPhone, settings, showToast } = useApp();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  // Exibir se requiresGooglePhoneModal for true OU se o usuário logado for do Google e estiver sem WhatsApp válido
  const userPhone = user?.phone ? String(user.phone).replace(/\D/g, '') : '';
  const isGoogleUserWithoutPhone = Boolean(
    user && 
    user.authProvider === 'google' && 
    (!userPhone || user.phone?.startsWith('google_') || userPhone.length < 10)
  );

  const shouldShow = requiresGooglePhoneModal || isGoogleUserWithoutPhone;

  if (!shouldShow) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) {
      showToast('Por favor, informe um número de WhatsApp válido com DDD (mínimo 10 dígitos).', 'error');
      return;
    }

    setLoading(true);
    try {
      await completeGoogleLoginWithPhone(clean);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (val.length > 2) val = `(${val.slice(0, 2)}) ${val.slice(2)}`;
    if (val.length > 9) val = `${val.slice(0, 10)}-${val.slice(10)}`;
    setPhone(val);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-stone-800 p-6 sm:p-8 w-full max-w-md text-stone-900 dark:text-stone-100 relative overflow-hidden"
        >
          {/* Decoração sutil */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-100 dark:bg-emerald-950/40 rounded-full blur-2xl pointer-events-none" />

          <div className="text-center space-y-3 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <MessageCircle size={32} />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <Heart size={12} className="fill-emerald-500 text-emerald-500" />
              <span>{settings?.name || 'Studio Bella Beauty'}</span>
            </div>

            <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
              WhatsApp Obrigatório para Contato
            </h3>

            <p className="text-xs text-stone-600 dark:text-stone-400 max-w-sm mx-auto leading-relaxed">
              Você acessou com sua <strong>Conta Google</strong>. Para garantir o envio dos seus comprovantes, lembretes de horários e atendimento personalizado, informe seu número de WhatsApp:
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center justify-between">
                <span>Número de WhatsApp *</span>
                <span className="text-[10px] text-emerald-600 font-semibold">Com DDD</span>
              </label>
              <input
                type="tel"
                required
                autoFocus
                value={phone}
                onChange={handlePhoneChange}
                placeholder="(11) 99999-9999"
                className="w-full px-4 py-3 rounded-2xl border-2 border-emerald-400/80 bg-stone-50 dark:bg-stone-800 text-sm font-semibold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
              />
              <p className="text-[10px] text-stone-400 mt-1">
                Exemplo: (11) 98765-4321 • Apenas números com DDD
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || phone.replace(/\D/g, '').length < 10}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check size={16} />
                  <span>Confirmar WhatsApp e Continuar</span>
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <span className="inline-flex items-center gap-1.5 text-[10px] text-stone-400">
                <ShieldCheck size={13} className="text-emerald-500" />
                <span>Seus dados são protegidos por criptografia de ponta a ponta</span>
              </span>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
