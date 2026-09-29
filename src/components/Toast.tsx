import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '../store';

export function Toast() {
  const { toast } = useApp();

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-sm"
        >
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl shadow-stone-200/50 border ${
            toast.type === 'success' 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
              : 'bg-red-50 border-red-100 text-red-800'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="text-emerald-500 shrink-0" /> : <AlertCircle className="text-red-500 shrink-0" />}
            <p className="font-medium text-sm flex-1">{toast.message}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
