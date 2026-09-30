import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageCircle, Send, X, Check, CheckCheck, Clock, User, 
  Sparkles, ExternalLink, MessageSquare, Search, ChevronLeft
} from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialClientId?: string; // Para quando a administradora abre o chat de um cliente específico
  targetBookingId?: string;
}

export function ChatModal({ isOpen, onClose, initialClientId, targetBookingId }: ChatModalProps) {
  const { user, messages, sendMessage, markMessagesRead, settings, showToast, setView } = useApp();
  const [inputText, setInputText] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAdminOrStaff = user?.role === 'admin' || user?.role === 'staff';

  useEffect(() => {
    if (initialClientId) {
      setSelectedClientId(initialClientId);
    }
  }, [initialClientId]);

  // Se for admin e tiver clientes, seleciona o primeiro se nenhum selecionado
  const clientConversations = React.useMemo(() => {
    if (!isAdminOrStaff) return [];
    const clientMap = new Map<string, { id: string; name: string; lastMessage: ChatMessage; unreadCount: number }>();

    messages.forEach(m => {
      const isClientSender = m.senderRole === 'client';
      const clientId = isClientSender ? m.senderId : m.receiverId;
      const clientName = isClientSender ? m.senderName : m.receiverName;

      if (!clientId || clientId === 'admin') return;

      const existing = clientMap.get(clientId);
      const isUnread = !m.read && m.senderRole === 'client';

      if (!existing) {
        clientMap.set(clientId, {
          id: clientId,
          name: clientName || 'Cliente',
          lastMessage: m,
          unreadCount: isUnread ? 1 : 0
        });
      } else {
        if (new Date(m.createdAt).getTime() > new Date(existing.lastMessage.createdAt).getTime()) {
          existing.lastMessage = m;
        }
        if (isUnread) {
          existing.unreadCount += 1;
        }
      }
    });

    return Array.from(clientMap.values()).sort(
      (a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );
  }, [messages, isAdminOrStaff]);

  // Define cliente ativo para o admin
  useEffect(() => {
    if (isAdminOrStaff) {
      if (initialClientId) {
        setSelectedClientId(initialClientId);
      } else if (!selectedClientId && clientConversations.length > 0) {
        setSelectedClientId(clientConversations[0].id);
      }
    }
  }, [isAdminOrStaff, initialClientId, clientConversations, selectedClientId]);

  // Mensagens filtradas para a conversa atual
  const activeThread = React.useMemo(() => {
    if (!user) return [];
    if (!isAdminOrStaff) {
      // Cliente visualiza suas mensagens trocadas com o salão/equipe
      return messages.filter(m => m.senderId === user.id || m.receiverId === user.id);
    }
    // Admin visualiza mensagens com o cliente selecionado
    if (!selectedClientId) return [];
    return messages.filter(m => 
      (m.senderId === selectedClientId) || 
      (m.receiverId === selectedClientId)
    );
  }, [messages, user, isAdminOrStaff, selectedClientId]);

  // Rolar para a última mensagem
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      // Marcar mensagens como lidas
      if (isAdminOrStaff && selectedClientId) {
        markMessagesRead(selectedClientId);
      } else if (!isAdminOrStaff) {
        markMessagesRead('admin');
      }
    }
  }, [isOpen, activeThread.length, isAdminOrStaff, selectedClientId]);

  if (!isOpen) return null;

  if (!user) {
    const salonPhone = settings?.phone ? settings.phone.replace(/\D/g, '') : '';
    const waUrl = salonPhone ? `https://wa.me/55${salonPhone}?text=${encodeURIComponent('Olá! Gostaria de falar com o Studio Bella Beauty ✨')}` : '';

    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-stone-800 p-6 sm:p-8 w-full max-w-md text-stone-900 dark:text-stone-100 text-center relative overflow-hidden"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-1 rounded-full cursor-pointer"
            >
              <X size={20} />
            </button>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rose-500/25">
              <MessageCircle size={28} />
            </div>
            <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100 mb-2">
              Chat com a Especialista
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed mb-6">
              Para conversar em tempo real com nossa equipe e acompanhar suas mensagens, acesse sua conta ou fale conosco diretamente pelo WhatsApp oficial.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  onClose();
                  setView('login');
                }}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <User size={16} />
                <span>Entrar ou Cadastrar para Chat</span>
              </button>
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle size={16} />
                  <span>Conversar no WhatsApp Agora</span>
                </a>
              )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanText = inputText.trim();
    if (!cleanText || isSending) return;

    setIsSending(true);
    try {
      let receiverId = 'admin';
      let receiverName = 'Studio Bella Beauty';

      if (isAdminOrStaff) {
        if (!selectedClientId) {
          showToast('Selecione um cliente para responder.', 'error');
          return;
        }
        const clientItem = clientConversations.find(c => c.id === selectedClientId);
        receiverId = selectedClientId;
        receiverName = clientItem ? clientItem.name : 'Cliente';
      }

      await sendMessage({
        text: cleanText,
        receiverId,
        receiverName,
        bookingId: targetBookingId || ''
      });

      setInputText('');
    } finally {
      setIsSending(false);
    }
  };

  const selectedClientInfo = clientConversations.find(c => c.id === selectedClientId);

  const quickQuestions = [
    'Olá! Gostaria de tirar uma dúvida sobre meu horário.',
    'Já cheguei no salão!',
    'Qual a duração estimada do meu procedimento?',
    'Posso trocar meu serviço na hora?'
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4 bg-stone-900/70 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-stone-800 w-full max-w-4xl h-[88vh] max-h-[720px] flex flex-col overflow-hidden text-stone-900 dark:text-stone-100"
        >
          {/* Header do Chat */}
          <div className="bg-gradient-to-r from-rose-600 via-pink-600 to-rose-700 text-white p-4 sm:px-6 flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
                <MessageCircle size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif font-bold text-base sm:text-lg">
                    {isAdminOrStaff 
                      ? (selectedClientInfo ? `Chat com ${selectedClientInfo.name}` : 'Central de Mensagens')
                      : 'Atendimento & Profissionais'}
                  </h3>
                  <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-500/80 px-2 py-0.5 rounded-full text-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-rose-100">
                  {isAdminOrStaff 
                    ? 'Responda dúvidas de clientes em tempo real' 
                    : (settings?.name || 'Studio Bella Beauty')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Atalho para WhatsApp Oficial */}
              {settings?.phone && (
                <a
                  href={`https://wa.me/55${settings.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Olá! Gostaria de conversar com a equipe do Studio Bella Beauty ✨')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden sm:flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors"
                  title="Abrir no WhatsApp"
                >
                  <ExternalLink size={13} />
                  <span>WhatsApp</span>
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Fechar Chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Layout Principal: Admin (2 colunas) vs Cliente (1 coluna) */}
          <div className="flex-1 flex overflow-hidden">
            {/* Barra lateral da Administradora / Profissionais com lista de clientes */}
            {isAdminOrStaff && (
              <div className="w-full sm:w-72 border-r border-stone-200 dark:border-stone-800 flex flex-col bg-stone-50/70 dark:bg-stone-900/50 shrink-0">
                <div className="p-3 border-b border-stone-200 dark:border-stone-800">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Buscar cliente..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800">
                  {clientConversations.length === 0 ? (
                    <div className="p-6 text-center text-stone-400 text-xs">
                      Nenhuma conversa registrada ainda.
                    </div>
                  ) : (
                    clientConversations
                      .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(c => {
                        const isSelected = selectedClientId === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedClientId(c.id);
                              markMessagesRead(c.id);
                            }}
                            className={`w-full p-3 text-left transition-colors flex items-start gap-3 cursor-pointer ${
                              isSelected 
                                ? 'bg-rose-50 dark:bg-rose-950/40 border-l-4 border-rose-500' 
                                : 'hover:bg-stone-100 dark:hover:bg-stone-800/60'
                            }`}
                          >
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-rose-400 to-pink-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs truncate text-stone-900 dark:text-stone-100">
                                  {c.name}
                                </span>
                                <span className="text-[10px] text-stone-400">
                                  {new Date(c.lastMessage.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                                {c.lastMessage.text}
                              </p>
                            </div>
                            {c.unreadCount > 0 && (
                              <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                                {c.unreadCount}
                              </span>
                            )}
                          </button>
                        );
                      })
                  )}
                </div>
              </div>
            )}

            {/* Painel de Mensagens Ativo */}
            <div className="flex-1 flex flex-col bg-stone-50/40 dark:bg-stone-950/30">
              {/* Thread de Mensagens */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {activeThread.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400 space-y-2">
                    <MessageSquare size={36} className="text-rose-300 dark:text-stone-700 animate-pulse" />
                    <p className="text-sm font-medium text-stone-600 dark:text-stone-300">
                      {isAdminOrStaff ? 'Nenhuma mensagem selecionada.' : 'Inicie sua conversa com o Studio Bella Beauty!'}
                    </p>
                    <p className="text-xs max-w-sm">
                      {isAdminOrStaff 
                        ? 'Selecione uma cliente na coluna ao lado para visualizar o histórico.' 
                        : 'Tire dúvidas sobre procedimentos, confirme sua chegada ou solicite auxílio para seu atendimento.'}
                    </p>
                  </div>
                ) : (
                  activeThread.map(m => {
                    const isMe = m.senderId === user.id;

                    return (
                      <div 
                        key={m.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[10px] font-bold text-stone-400">
                            {isMe ? 'Você' : m.senderName}
                          </span>
                          {!isMe && m.senderRole !== 'client' && (
                            <span className="text-[9px] bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 px-1.5 py-0.2 rounded-md font-semibold">
                              Profissional
                            </span>
                          )}
                        </div>

                        <div 
                          className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs shadow-xs leading-relaxed whitespace-pre-wrap ${
                            isMe 
                              ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-tr-xs' 
                              : 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 border border-stone-200 dark:border-stone-700 rounded-tl-xs'
                          }`}
                        >
                          <p>{m.text}</p>
                          <div className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${isMe ? 'text-rose-100' : 'text-stone-400'}`}>
                            <span>
                              {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMe && (
                              m.read ? <CheckCheck size={11} className="text-white" /> : <Check size={11} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Sugestões rápidas de mensagens para a cliente */}
              {!isAdminOrStaff && (
                <div className="px-3 py-1.5 bg-stone-100/70 dark:bg-stone-900/60 border-t border-stone-200/60 dark:border-stone-800 overflow-x-auto flex gap-1.5 scrollbar-hide">
                  {quickQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setInputText(q)}
                      className="px-2.5 py-1 rounded-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-[10px] text-stone-600 dark:text-stone-300 hover:text-rose-600 dark:hover:text-rose-400 whitespace-nowrap cursor-pointer transition-colors shadow-2xs"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Barra de Envio */}
              <form onSubmit={handleSend} className="p-3 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 flex items-center gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={isAdminOrStaff ? 'Digite sua resposta para a cliente...' : 'Digite sua mensagem para a profissional...'}
                  className="flex-1 px-4 py-2.5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs focus:outline-none focus:ring-2 focus:ring-rose-400"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="p-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 active:scale-95"
                  title="Enviar mensagem"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
