import React, { ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

export class ErrorBoundary extends React.Component<any, any> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, info: any) {
    console.error('ErrorBoundary error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 p-4">
          <div className="max-w-md w-full bg-white dark:bg-stone-900 rounded-3xl p-8 shadow-xl border border-stone-100 dark:border-stone-800 text-center space-y-4">
            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/50 rounded-full flex items-center justify-center mx-auto text-rose-500">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-2xl font-serif font-bold text-stone-900 dark:text-stone-100">Ops! Algo deu errado.</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Ocorreu um imprevisto ao processar sua solicitação. Clique no botão abaixo para recarregar o sistema e continuar.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 px-6 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-stone-800 transition-colors cursor-pointer shadow-md"
            >
              <RotateCcw size={16} />
              <span>Recarregar Sistema</span>
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
