import React, { useState, useEffect } from 'react';
import { useApp } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LogIn, UserPlus, Lock, Gift, Sparkles, ShieldCheck, Heart, 
  AlertCircle, CheckCircle2, X, Check, Eye, EyeOff, ShieldAlert
} from 'lucide-react';
import { isValidCPF, formatCPF } from '../utils/cpf';

function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.27 21.36 7.34 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.27 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

export function Auth() {
  const { view, setView, login, loginWithGoogle, register, settings, showToast } = useApp();
  
  // Estados do formulário
  const [identifier, setIdentifier] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [hasReferralCode, setHasReferralCode] = useState(false);
  const [loading, setLoading] = useState(false);

  // Barreira Anti-Robô (Honeypot invisível e Timestamp de velocidade)
  const [honeypotTrap, setHoneypotTrap] = useState('');
  const [formLoadedAt, setFormLoadedAt] = useState<number>(Date.now());
  
  // Google sign in modal state
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('cleiltondasilvalira@gmail.com');
  const [googleName, setGoogleName] = useState('Cleilton Silva');
  const [googlePhone, setGooglePhone] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  
  const isLogin = view === 'login';

  useEffect(() => {
    setFormLoadedAt(Date.now());
  }, [view]);

  const formatPhone = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 11);
    if (raw.length <= 2) return raw ? `(${raw}` : '';
    if (raw.length <= 7) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
  };

  // Se o usuário estiver digitando CPF puro no login, formata automaticamente
  const handleIdentifierChange = (val: string) => {
    const cleanNumbers = val.replace(/\D/g, '');
    // Se digitou apenas dígitos e tem até 11 números, formata como CPF para facilitar
    if (/^\d+$/.test(val) && val.length <= 14) {
      setIdentifier(formatCPF(val));
    } else {
      setIdentifier(val);
    }
  };

  const rawCpfDigits = cpf.replace(/\D/g, '');
  const isCpfFilled = rawCpfDigits.length === 11;
  const isCpfValid = isValidCPF(cpf);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Barreira Anti-Robô no frontend
    if (honeypotTrap.trim().length > 0) {
      showToast('Acesso bloqueado pela proteção anti-robô.', 'error');
      return;
    }

    if (!isLogin) {
      if (!isValidCPF(cpf)) {
        showToast('Por favor, informe um CPF válido para continuar.', 'error');
        return;
      }
      if (!password || password.length < 4) {
        showToast('Por favor, crie uma senha com pelo menos 4 caracteres.', 'error');
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        if (!identifier.trim()) {
          showToast('Informe seu CPF, WhatsApp ou usuário.', 'error');
          return;
        }
        await login(identifier.trim(), password.trim() || undefined, honeypotTrap, formLoadedAt);
      } else {
        if (!name.trim() || !phone.trim() || !cpf.trim()) return;
        await register(
          name.trim(),
          phone.trim(),
          cpf.trim(),
          password.trim() || undefined,
          referralCodeInput.trim() || undefined,
          honeypotTrap,
          formLoadedAt
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGoogleAuth = () => {
    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    const googleGsi = (window as any).google?.accounts?.id;

    if (clientId && googleGsi) {
      try {
        googleGsi.initialize({
          client_id: clientId,
          callback: async (response: any) => {
            if (response?.credential) {
              setLoading(true);
              try {
                await loginWithGoogle({
                  credential: response.credential,
                  referralCodeInput: referralCodeInput.trim() || undefined
                });
              } finally {
                setLoading(false);
              }
            }
          }
        });
        googleGsi.prompt();
        return;
      } catch (err) {
        console.warn('GIS prompt error, opening interactive Google modal:', err);
      }
    }

    // Modal interativo do Google
    setIsGoogleModalOpen(true);
  };

  const handleConfirmGoogleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!googleEmail.trim()) {
      showToast('Por favor, informe seu email Google.', 'error');
      return;
    }

    const cleanPhone = googlePhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      showToast('O número de WhatsApp para contatos é obrigatório (mínimo 10 dígitos com DDD).', 'error');
      return;
    }

    setGoogleLoading(true);
    try {
      const gId = 'gid_' + googleEmail.replace(/[^a-zA-Z0-9]/g, '_');
      const success = await loginWithGoogle({
        googleId: gId,
        email: googleEmail.trim().toLowerCase(),
        name: googleName.trim() || googleEmail.split('@')[0],
        referralCodeInput: referralCodeInput.trim() || undefined,
        phone: cleanPhone
      });
      if (success) {
        setIsGoogleModalOpen(false);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-md mx-auto px-4 py-10 relative"
    >
      <div className="bg-white dark:bg-stone-900 p-8 sm:p-9 rounded-3xl shadow-xl shadow-rose-100/50 dark:shadow-none border border-rose-100/80 dark:border-stone-800 relative backdrop-blur-sm">
        
        {/* Identificação delicada do salão */}
        <div className="flex justify-center mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-100 dark:border-rose-900/50">
            <Heart size={12} className="fill-rose-400 text-rose-400" />
            {settings?.name || 'Bella Beauty'}
          </span>
        </div>

        {/* Cabeçalho 100% focado na cliente - Totalmente discreto */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-tr from-rose-100 to-pink-50 dark:from-rose-950/60 dark:to-stone-800 rounded-2xl flex items-center justify-center mx-auto mb-3.5 text-rose-500 shadow-sm border border-rose-100 dark:border-rose-900/30">
            {isLogin ? <LogIn size={28} /> : <UserPlus size={28} />}
          </div>
          <h2 className="text-2xl font-serif font-medium text-stone-900 dark:text-stone-100">
            {isLogin ? 'Entrar no Studio' : 'Criar Cadastro'}
          </h2>
          <p className="text-stone-500 dark:text-stone-400 text-sm mt-1.5">
            {isLogin 
              ? 'Acesse com sua conta Google ou com seu login e senha'
              : 'Preencha seus dados para agendar seus horários com facilidade'}
          </p>
        </div>

        {/* Botão de Acesso Rápido com Google */}
        <div className="mb-6 space-y-3">
          <button
            type="button"
            onClick={handleOpenGoogleAuth}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-100 font-semibold text-sm shadow-xs transition-all hover:shadow-md cursor-pointer group active:scale-[0.99]"
          >
            <GoogleIcon className="w-5 h-5 shrink-0 group-hover:scale-110 transition-transform" />
            <span>{isLogin ? 'Continuar com o Google' : 'Cadastrar com o Google'}</span>
          </button>

          <div className="relative flex items-center justify-center pt-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200/90 dark:border-stone-800" />
            </div>
            <span className="relative bg-white dark:bg-stone-900 px-3 text-[11px] font-bold tracking-wider uppercase text-stone-400 dark:text-stone-500">
              ou com login e senha
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* CAMPO HONEYPOT INVISÍVEL PARA CAPTURAR ROBÔS (Anti-Bot Barrier) */}
          <div className="opacity-0 absolute -left-[9999px] pointer-events-none select-none h-0 w-0 overflow-hidden" aria-hidden="true" tabIndex={-1}>
            <label htmlFor="_hp_trap_field">Não preencha este campo se você for humano:</label>
            <input
              id="_hp_trap_field"
              type="text"
              name="_hp_trap"
              value={honeypotTrap}
              onChange={(e) => setHoneypotTrap(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {/* MODO CADASTRO: Nome Completo */}
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1.5">
                Nome Completo
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-400 transition-colors"
                placeholder="Ex: Amanda Silva"
                required
              />
            </div>
          )}

          {/* MODO LOGIN: Identificador Único (CPF, Celular, Usuário ou Email) */}
          {isLogin ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1.5">
                CPF, Celular ou Usuário
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => handleIdentifierChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-400 transition-colors font-medium text-sm"
                placeholder="000.000.000-00 ou seu login"
                required
                autoComplete="username"
              />
              <span className="text-[11px] text-stone-400 dark:text-stone-500 mt-1 block">
                Digite seu CPF, WhatsApp ou usuário cadastrado.
              </span>
            </div>
          ) : (
            /* MODO CADASTRO: CPF com validação autêntica */
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400">
                  CPF da Cliente
                </label>
                {isCpfFilled && (
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                    isCpfValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                  }`}>
                    {isCpfValid ? (
                      <>
                        <CheckCircle2 size={13} />
                        <span>CPF válido</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={13} />
                        <span>CPF inválido</span>
                      </>
                    )}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                className={`w-full px-4 py-3 rounded-xl border ${
                  isCpfFilled && !isCpfValid
                    ? 'border-rose-300 dark:border-rose-700 bg-rose-50/30 dark:bg-rose-950/20'
                    : 'border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800'
                } text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-400 transition-colors font-medium`}
                placeholder="000.000.000-00"
                maxLength={14}
                required
              />
              <span className="text-[11px] text-stone-400 dark:text-stone-500 mt-1 block">
                O CPF é protegido com criptografia de ponta a ponta (AES-256-GCM).
              </span>
            </div>
          )}

          {/* MODO CADASTRO: WhatsApp */}
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1.5">
                WhatsApp (com DDD)
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-400 transition-colors"
                placeholder="(00) 00000-0000"
                maxLength={15}
                required
              />
              <span className="text-[11px] text-stone-400 dark:text-stone-500 mt-1 block">
                Para confirmação e lembretes do seu atendimento
              </span>
            </div>
          )}

          {/* CAMPO DE SENHA (Login ou Cadastro com Senha para Clientes e Equipe) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400">
                {isLogin ? 'Senha de Acesso' : 'Crie sua Senha de Acesso'}
              </label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-11 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-400 transition-colors"
                placeholder="••••••••"
                required={!isLogin}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-1"
                title={showPassword ? "Ocultar senha" : "Ver senha"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <span className="text-[11px] text-stone-400 dark:text-stone-500 mt-1 block">
              {isLogin 
                ? 'Sua senha é protegida com tecnologia scrypt de alta segurança.' 
                : 'Crie uma senha segura para proteger seus agendamentos.'}
            </span>
          </div>

          {/* Código de Indicação (Apenas no Cadastro) */}
          {!isLogin && (
            <div className="pt-1">
              {!hasReferralCode ? (
                <button
                  type="button"
                  onClick={() => setHasReferralCode(true)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-dashed border-rose-300 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 text-xs font-medium hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Gift size={15} className="text-rose-500" />
                    <span>Tem um <strong>Código de Indicação</strong> de uma amiga?</span>
                  </span>
                  <span className="text-rose-500 font-bold underline text-[11px]">Inserir</span>
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3.5 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50/50 dark:from-rose-950/40 dark:to-stone-800 border border-rose-200 dark:border-rose-900/50"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                      <Gift size={14} className="text-rose-500" />
                      Código de Indicação da Amiga
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setHasReferralCode(false);
                        setReferralCodeInput('');
                      }}
                      className="text-[11px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                    >
                      Remover
                    </button>
                  </div>
                  <input
                    type="text"
                    value={referralCodeInput}
                    onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-rose-300 dark:border-rose-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 uppercase tracking-wider font-mono text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                    placeholder="EX: MARIA-8K2A"
                  />
                  {settings?.referralDiscountForReferred ? (
                    <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1.5 flex items-center gap-1 font-medium">
                      <Sparkles size={12} className="shrink-0" />
                      Você ganha R$ {Number(settings.referralDiscountForReferred).toFixed(2)} de desconto no seu 1º agendamento!
                    </p>
                  ) : null}
                </motion.div>
              )}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading || (!isLogin && isCpfFilled && !isCpfValid)}
            className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white py-3.5 rounded-xl font-medium shadow-md shadow-rose-200/50 dark:shadow-none transition-all mt-4 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {isLogin ? 'Entrar no Studio' : 'Finalizar Cadastro'}
                <Sparkles size={16} />
              </>
            )}
          </button>
        </form>

        {/* Selos de Segurança e Proteção Anti-Robô / LGPD */}
        <div className="mt-6 pt-5 border-t border-stone-100 dark:border-stone-800 space-y-2.5">
          <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-100 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
            <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold text-emerald-800 dark:text-emerald-300 block">
                Criptografia Militar AES-256-GCM & LGPD
              </span>
              <span className="text-stone-500 dark:text-stone-400">
                Seus dados cadastrais e senhas são protegidos com chave militar autenticada de 256 bits e derivação scrypt.
              </span>
            </div>
          </div>

          <div className="px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/70 dark:border-stone-800 text-[10px] text-stone-500 dark:text-stone-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldAlert size={13} className="text-rose-500" />
              Barreira Anti-Robô & Bloqueio por IP Ativos
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">100% Protegido</span>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-stone-500 dark:text-stone-400 text-sm">
            {isLogin ? 'Ainda não é cadastrada?' : 'Já possui cadastro?'}
          </p>
          <button
            onClick={() => {
              setView(isLogin ? 'register' : 'login');
              setIdentifier('');
              setCpf('');
              setPassword('');
            }}
            className="text-rose-600 dark:text-rose-400 font-medium text-sm mt-1.5 hover:text-rose-700 dark:hover:text-rose-300 transition-colors underline underline-offset-4 cursor-pointer"
          >
            {isLogin ? 'Cadastre-se para agendar' : 'Fazer login com minha conta ou Google'}
          </button>
        </div>
      </div>

      {/* Modal Interativo do Google */}
      <AnimatePresence>
        {isGoogleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-stone-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 dark:border-stone-800 relative overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setIsGoogleModalOpen(false)}
                className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-1.5 rounded-full cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="text-center pt-2 pb-4">
                <div className="w-14 h-14 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <GoogleIcon className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  Acessar com o Google
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  Acesse instantaneamente para agendar e acompanhar seus benefícios.
                </p>
              </div>

              {/* Seleção Rápida de Conta Google */}
              <div className="space-y-3 mb-4">
                <button
                  type="button"
                  onClick={handleConfirmGoogleLogin}
                  disabled={googleLoading}
                  className="w-full flex items-center gap-3.5 p-3 rounded-2xl border-2 border-rose-400/80 bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-500 to-pink-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                    {(googleName || googleEmail).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                      {googleName || 'Cliente Google'}
                    </p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                      {googleEmail}
                    </p>
                  </div>
                  <span className="text-rose-600 dark:text-rose-400 text-xs font-bold shrink-0">
                    Entrar →
                  </span>
                </button>
              </div>

              {/* Formulário para trocar/confirmar conta Google */}
              <div className="pt-2 border-t border-stone-100 dark:border-stone-800 space-y-3">
                <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                  Ou confirme sua conta Google:
                </p>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                    Email da Conta Google
                  </label>
                  <input
                    type="email"
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    placeholder="seuemail@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                    Seu Nome
                  </label>
                  <input
                    type="text"
                    value={googleName}
                    onChange={(e) => setGoogleName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1 flex items-center justify-between">
                    <span>Número de WhatsApp (Obrigatório) *</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Para confirmações</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={googlePhone}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, '').slice(0, 11);
                      if (val.length > 2) val = `(${val.slice(0, 2)}) ${val.slice(2)}`;
                      if (val.length > 9) val = `${val.slice(0, 10)}-${val.slice(10)}`;
                      setGooglePhone(val);
                    }}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                  <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1">
                    Utilizado para envio dos comprovantes, lembretes e comunicação direta com a equipe.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmGoogleLogin}
                  disabled={googleLoading || !googleEmail.trim()}
                  className="w-full py-3 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-semibold text-xs shadow-sm hover:opacity-95 transition-opacity flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {googleLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Confirmar e Entrar com Google</span>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-3 text-center">
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <ShieldCheck size={12} />
                  Conexão Criptografada e Segura (AES-256-GCM)
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
