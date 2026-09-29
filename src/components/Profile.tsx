import React, { useState } from 'react';
import { useApp } from '../store';
import { motion } from 'motion/react';
import { User, Save, ArrowLeft } from 'lucide-react';

export function Profile() {
  const { user, updateProfile, setView } = useApp();
  
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile(name, phone);
  };

  if (!user) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto px-4 py-12"
    >
      <button 
        onClick={() => setView(user.role === 'admin' ? 'admin' : 'client')}
        className="flex items-center gap-2 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft size={16} /> Voltar
      </button>
      
      <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl shadow-xl shadow-stone-200/50 dark:shadow-none border border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center">
            <User size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-stone-900 dark:text-stone-100">Meu Perfil</h2>
            <p className="text-stone-500 dark:text-stone-400 text-sm">Gerencie suas informações pessoais</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Nome e Sobrenome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-colors"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">WhatsApp</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">CPF</label>
            <input
              type="text"
              value={user.cpf || 'Não informado'}
              disabled
              className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 text-stone-500 dark:text-stone-400 cursor-not-allowed"
            />
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">O CPF não pode ser alterado após o cadastro.</p>
          </div>

          <button 
            type="submit"
            className="w-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-medium py-3 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer shadow-md"
          >
            <Save size={18} /> Salvar Alterações
          </button>
        </form>
      </div>
    </motion.div>
  );
}
