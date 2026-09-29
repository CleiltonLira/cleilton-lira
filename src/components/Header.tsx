import { Menu, X, User as UserIcon, LogOut, Settings as SettingsIcon, Bell, Check, Calendar, AlertCircle, Sun, Moon, Sparkles } from 'lucide-react';
import { useApp } from '../store';
import { useState, useRef, useEffect } from 'react';
import { View } from '../types';

export function Header() {
  const { setView, settings, user, logout, notifications, markNotificationRead, refreshNotifications, themeMode, toggleTheme } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Poll notifications when user is logged in
  useEffect(() => {
    if (user) {
      refreshNotifications();
      const interval = setInterval(refreshNotifications, 15000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const navLinks: { label: string, view: View }[] = [
    { label: 'Início', view: 'home' },
    { label: 'Agendar', view: 'booking' },
  ];

  if (user) {
    const isStaffOrAdmin = user.role === 'admin' || user.role === 'staff';
    navLinks.push({ 
      label: user.role === 'admin' ? 'Painel Admin' : (user.role === 'staff' ? 'Atendimento / Equipe' : 'Meus Agendamentos'), 
      view: isStaffOrAdmin ? 'admin' : 'client' 
    });
  }

  const handleNav = (view: View) => {
    setView(view);
    setMobileMenuOpen(false);
    setProfileOpen(false);
    setNotificationsOpen(false);
  };

  const handleLogout = () => {
    logout();
    setProfileOpen(false);
    setMobileMenuOpen(false);
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md border-b border-rose-100/70 dark:border-stone-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
        
        {/* Logo and store title */}
        <div 
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={() => handleNav('home')}
        >
          {settings?.storeIconUrl ? (
            <img src={settings.storeIconUrl} alt={settings.name} className="w-12 h-12 object-cover rounded-2xl shadow-sm group-hover:scale-105 transition-transform" />
          ) : (
            <div className="w-12 h-12 bg-gradient-to-tr from-rose-200 via-pink-100 to-rose-50 dark:from-rose-950 dark:via-pink-900/40 dark:to-stone-800 text-rose-600 dark:text-rose-300 rounded-2xl flex items-center justify-center font-serif text-2xl italic font-bold group-hover:scale-105 transition-transform border border-rose-200/60 dark:border-rose-900/40 shadow-sm">
              {settings?.name?.charAt(0) || 'B'}
            </div>
          )}
          <div>
            <h1 className="font-serif font-bold text-lg md:text-xl text-stone-900 dark:text-stone-100 leading-tight flex items-center gap-1.5">
              {settings?.name || 'Bella Beauty'}
              <Sparkles size={14} className="text-rose-400 opacity-80" />
            </h1>
            <p className="text-xs md:text-sm text-stone-500 dark:text-stone-400">{settings?.subtitle || 'Espaço de Beleza'}</p>
          </div>
        </div>

        {/* Desktop Nav & Actions */}
        <div className="hidden md:flex items-center gap-5">
          <nav className="flex items-center gap-6">
            <button 
              onClick={() => handleNav('home')} 
              className="text-sm font-medium text-stone-700 dark:text-stone-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
            >
              Início
            </button>
            <button 
              onClick={() => handleNav('booking')} 
              className="text-sm font-medium text-stone-700 dark:text-stone-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
            >
              Agendar
            </button>
            {user && (
              <button 
                onClick={() => handleNav((user.role === 'admin' || user.role === 'staff') ? 'admin' : 'client')} 
                className="text-sm font-medium text-stone-700 dark:text-stone-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
              >
                {user.role === 'admin' ? 'Painel Admin' : (user.role === 'staff' ? 'Atendimento / Equipe' : 'Meus Agendamentos')}
              </button>
            )}
          </nav>

          <div className="h-6 w-px bg-stone-200 dark:bg-stone-800"></div>

          {/* Theme Toggle Button (Sun / Moon) */}
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-full hover:bg-rose-50 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer relative"
            title={themeMode === 'dark' ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
          >
            {themeMode === 'dark' ? (
              <Sun size={20} className="text-amber-400 transition-transform rotate-0 hover:rotate-90 duration-300" />
            ) : (
              <Moon size={20} className="text-stone-600 hover:text-rose-600 transition-transform -rotate-12 hover:rotate-0 duration-300" />
            )}
          </button>

          {/* Notifications Bell */}
          {user && (
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2.5 rounded-full hover:bg-rose-50 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition-colors relative cursor-pointer"
                title="Notificações"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {notificationsOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-rose-100 dark:border-stone-800 overflow-hidden py-3 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-5 py-2 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
                    <h4 className="font-serif font-bold text-stone-800 dark:text-stone-200">Notificações</h4>
                    {unreadCount > 0 && (
                      <span className="text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full">
                        {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-stone-50 dark:divide-stone-800">
                    {notifications.length === 0 ? (
                      <p className="p-6 text-center text-stone-400 dark:text-stone-500 text-sm">Nenhuma notificação no momento.</p>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          className={`p-4 transition-colors flex items-start justify-between gap-3 ${n.read ? 'bg-white dark:bg-stone-900 opacity-70' : 'bg-rose-50/40 dark:bg-rose-950/30'}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              n.type.includes('confirmed') ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' :
                              n.type.includes('cancelled') ? 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400' :
                              'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                            }`}>
                              {n.type.includes('confirmed') ? <Check size={16} /> :
                               n.type.includes('cancelled') ? <AlertCircle size={16} /> :
                               <Calendar size={16} />}
                            </div>
                            <div>
                              <p className="text-xs text-stone-800 dark:text-stone-200 leading-relaxed font-medium">{n.message}</p>
                              <span className="text-[10px] text-stone-400 dark:text-stone-500 mt-1 block">
                                {new Date(n.createdAt).toLocaleDateString('pt-BR')} às {new Date(n.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>

                          {!n.read && (
                            <button
                              onClick={() => markNotificationRead(n.id)}
                              className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-1 cursor-pointer"
                              title="Marcar como lida"
                            >
                              <Check size={14} />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Account / Profile Menu */}
          {!user ? (
            <button 
              onClick={() => handleNav('login')} 
              className="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white px-5 py-2.5 rounded-full text-sm font-medium transition-all shadow-sm shadow-rose-200/50 dark:shadow-none cursor-pointer"
            >
              <UserIcon size={16} /> Entrar / Cadastrar
            </button>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setProfileOpen(!profileOpen)}
                className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold flex items-center justify-center border-2 border-rose-200/60 dark:border-rose-900/50 hover:border-rose-400 transition-all cursor-pointer shadow-sm text-sm overflow-hidden"
                title={user.name}
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  getInitials(user.name)
                )}
              </button>
              
              {profileOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-rose-100 dark:border-stone-800 overflow-hidden py-2 z-50">
                  <div className="px-4 py-3 border-b border-stone-100 dark:border-stone-800 bg-rose-50/30 dark:bg-stone-800/40">
                    <p className="text-sm font-bold text-stone-800 dark:text-stone-200 truncate">{user.name}</p>
                    {user.email && <p className="text-xs text-stone-500 dark:text-stone-400 truncate">{user.email}</p>}
                    {user.phone && <p className="text-xs text-stone-500 dark:text-stone-400 truncate">{user.phone}</p>}
                    {user.cpf && <p className="text-[10px] text-stone-400 dark:text-stone-500 truncate mt-0.5">CPF: {user.cpf}</p>}
                    {user.authProvider === 'google' && (
                      <span className="inline-block mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        ✓ Conta Google Verificada
                      </span>
                    )}
                    {user.referralCode && (
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 bg-rose-100/70 dark:bg-rose-950/80 rounded-md text-[11px] font-mono text-rose-700 dark:text-rose-300 font-semibold">
                        <span>Código: {user.referralCode}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="py-1">
                    {user.role === 'admin' ? (
                      <button 
                        onClick={() => handleNav('admin')} 
                        className="w-full text-left px-4 py-2.5 text-sm text-stone-700 dark:text-stone-300 hover:bg-rose-50/50 dark:hover:bg-stone-800 flex items-center gap-2.5 cursor-pointer font-medium"
                      >
                        <SettingsIcon size={16} className="text-stone-500 dark:text-stone-400" /> Painel Administrativo
                      </button>
                    ) : user.role === 'staff' ? (
                      <button 
                        onClick={() => handleNav('admin')} 
                        className="w-full text-left px-4 py-2.5 text-sm text-rose-700 dark:text-rose-300 hover:bg-rose-50/50 dark:hover:bg-stone-800 flex items-center gap-2.5 cursor-pointer font-medium"
                      >
                        <SettingsIcon size={16} className="text-rose-500" /> Painel de Atendimento (Equipe)
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleNav('client')} 
                        className="w-full text-left px-4 py-2.5 text-sm text-stone-700 dark:text-stone-300 hover:bg-rose-50/50 dark:hover:bg-stone-800 flex items-center gap-2.5 cursor-pointer font-medium"
                      >
                        <Calendar size={16} className="text-stone-500 dark:text-stone-400" /> Meus Agendamentos
                      </button>
                    )}
                    
                    <button 
                      onClick={() => handleNav('profile')} 
                      className="w-full text-left px-4 py-2.5 text-sm text-stone-700 dark:text-stone-300 hover:bg-rose-50/50 dark:hover:bg-stone-800 flex items-center gap-2.5 cursor-pointer font-medium"
                    >
                      <UserIcon size={16} className="text-stone-500 dark:text-stone-400" /> Alterar meus dados
                    </button>
                  </div>
                  
                  <div className="border-t border-stone-100 dark:border-stone-800 pt-1">
                    <button 
                      onClick={handleLogout} 
                      className="w-full text-left px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 cursor-pointer font-medium"
                    >
                      <LogOut size={16} /> Sair da conta
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Mobile Nav Top Bar controls */}
        <div className="md:hidden flex items-center gap-1.5">
          {/* Theme Toggle on mobile */}
          <button
            onClick={toggleTheme}
            className="p-2 text-stone-600 dark:text-stone-300 cursor-pointer"
            title="Alternar Tema"
          >
            {themeMode === 'dark' ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} />}
          </button>

          {user && (
            <button 
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setMobileMenuOpen(false);
              }} 
              className="p-2 text-stone-600 dark:text-stone-300 relative cursor-pointer"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          )}

          {user ? (
            <button 
              onClick={() => handleNav('profile')} 
              className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold flex items-center justify-center text-xs shadow-sm"
            >
              {getInitials(user.name)}
            </button>
          ) : (
            <button 
              onClick={() => handleNav('login')} 
              className="px-3 py-1.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white text-xs font-semibold rounded-full flex items-center gap-1"
            >
              <UserIcon size={13} /> Entrar
            </button>
          )}

          <button 
            className="p-2 text-stone-600 dark:text-stone-300 cursor-pointer"
            onClick={() => {
              setMobileMenuOpen(!mobileMenuOpen);
              setNotificationsOpen(false);
            }}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

      </div>

      {/* Mobile Notifications dropdown */}
      {notificationsOpen && (
        <div className="md:hidden border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-4 py-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-serif font-bold text-stone-800 dark:text-stone-200">Notificações</h4>
            <button onClick={() => setNotificationsOpen(false)} className="text-stone-400 p-1">
              <X size={18} />
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {notifications.length === 0 ? (
              <p className="text-center text-stone-400 dark:text-stone-500 text-sm py-4">Nenhuma notificação.</p>
            ) : (
              notifications.map(n => (
                <div key={n.id} className="p-3 bg-stone-50 dark:bg-stone-800 rounded-2xl flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-stone-700 dark:text-stone-300 font-medium">{n.message}</p>
                    <span className="text-[10px] text-stone-400 dark:text-stone-500">
                      {new Date(n.createdAt).toLocaleDateString('pt-BR')} às {new Date(n.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {!n.read && (
                    <button onClick={() => markNotificationRead(n.id)} className="text-stone-400 p-1">
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <nav className="md:hidden border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-4 py-4 flex flex-col gap-2 shadow-lg absolute w-full z-50">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => handleNav(link.view)}
              className="text-left font-medium text-stone-700 dark:text-stone-300 py-3 px-4 rounded-xl hover:bg-rose-50 dark:hover:bg-stone-800 cursor-pointer"
            >
              {link.label}
            </button>
          ))}
          
          {user && (
            <button
              onClick={() => handleNav('profile')}
              className="text-left font-medium text-stone-700 dark:text-stone-300 py-3 px-4 rounded-xl hover:bg-rose-50 dark:hover:bg-stone-800 flex items-center gap-2 cursor-pointer"
            >
              <UserIcon size={16} /> Alterar meus dados
            </button>
          )}

          {!user ? (
            <button 
              onClick={() => handleNav('login')} 
              className="mt-2 flex justify-center items-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white px-5 py-3 rounded-xl font-medium cursor-pointer shadow-md shadow-rose-200/50"
            >
              <UserIcon size={18} /> Entrar / Cadastrar
            </button>
          ) : (
            <button 
              onClick={handleLogout} 
              className="mt-2 flex justify-center items-center gap-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-5 py-3 rounded-xl font-medium cursor-pointer border border-rose-200 dark:border-rose-900/50"
            >
              <LogOut size={18} /> Sair da conta
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
