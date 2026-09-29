import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, DollarSign, ArrowUpRight, ArrowDownLeft, Calendar, 
  Printer, Plus, Trash2, Filter, CreditCard, Sparkles, PieChart, 
  FileText, CheckCircle2, Clock, AlertCircle, RefreshCw
} from 'lucide-react';
import { motion } from 'motion/react';

interface FinancialSummaryData {
  resumo: {
    faturamentoTotal: number;
    faturamentoPago: number;
    faturamentoPendente: number;
    faturamentoCancelado: number;
    totalDespesas: number;
    lucroLiquido: number;
    ticketMedio: number;
    totalAgendamentos: number;
    atendimentosConcluidos: number;
    totalDescontos: number;
  };
  porMetodoPagamento: Array<{
    metodo: string;
    total: number;
    count: number;
    percentual: number;
  }>;
  porServico: Array<{
    name: string;
    total: number;
    count: number;
  }>;
  porProfissional: Array<{
    name: string;
    total: number;
    count: number;
  }>;
  transacoes: Array<{
    id: string;
    tipo: 'entrada' | 'saida';
    data: string;
    horario: string;
    cliente: string;
    descricao: string;
    metodoPagamento: string;
    valor: number;
    status: string;
    statusPagamento: string;
    profissional: string;
  }>;
  despesas: Array<{
    id: string;
    description: string;
    category: string;
    amount: number;
    date: string;
    createdAt?: string;
  }>;
}

interface FinancialManagementProps {
  salonName?: string;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function FinancialManagement({ salonName = 'Bella Beauty', showToast }: FinancialManagementProps) {
  const [data, setData] = useState<FinancialSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'last_month' | 'year' | 'all'>('month');
  const [activeSubTab, setActiveSubTab] = useState<'balancete' | 'metricas' | 'despesas'>('balancete');

  // Nova despesa
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseCat, setNewExpenseCat] = useState('Produtos & Insumos');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseDate, setNewExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [submittingExpense, setSubmittingExpense] = useState(false);

  const fetchFinancials = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/financial-summary');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        showToast('Não foi possível carregar os dados financeiros.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao conectar com o servidor.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newExpenseAmount.replace(',', '.'));
    if (!newExpenseDesc.trim() || isNaN(val) || val <= 0) {
      showToast('Preencha a descrição e um valor válido para a despesa.', 'error');
      return;
    }

    setSubmittingExpense(true);
    try {
      const res = await fetch('/api/admin/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: newExpenseDesc.trim(),
          category: newExpenseCat,
          amount: val,
          date: newExpenseDate
        })
      });

      if (res.ok) {
        showToast('Despesa lançada com sucesso no balancete!', 'success');
        setNewExpenseDesc('');
        setNewExpenseAmount('');
        fetchFinancials();
      } else {
        showToast('Erro ao cadastrar despesa.', 'error');
      }
    } catch {
      showToast('Falha na comunicação com o servidor.', 'error');
    } finally {
      setSubmittingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Deseja realmente excluir este lançamento de despesa?')) return;
    try {
      const res = await fetch(`/api/admin/expenses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Despesa removida com sucesso.', 'success');
        fetchFinancials();
      } else {
        showToast('Erro ao excluir despesa.', 'error');
      }
    } catch {
      showToast('Falha ao excluir despesa.', 'error');
    }
  };

  const handlePrintBalancete = () => {
    window.print();
  };

  // Filtragem de transações com base no período selecionado
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMonthPrefix = todayStr.substring(0, 7); // YYYY-MM

  // Mês anterior
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthPrefix = prevMonthDate.toISOString().split('T')[0].substring(0, 7);

  // 7 dias atrás
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const currentYearPrefix = todayStr.substring(0, 4);

  const filteredTransacoes = (data?.transacoes || []).filter(t => {
    if (period === 'all') return true;
    if (period === 'today') return t.data === todayStr;
    if (period === 'week') return t.data >= sevenDaysAgo && t.data <= todayStr;
    if (period === 'month') return t.data.startsWith(currentMonthPrefix);
    if (period === 'last_month') return t.data.startsWith(prevMonthPrefix);
    if (period === 'year') return t.data.startsWith(currentYearPrefix);
    return true;
  });

  // Recalcula totais para o período filtrado
  const totalEntradasFiltrado = filteredTransacoes
    .filter(t => t.tipo === 'entrada' && t.status !== 'cancelled')
    .reduce((sum, t) => sum + t.valor, 0);

  const totalEntradasPagasFiltrado = filteredTransacoes
    .filter(t => t.tipo === 'entrada' && (t.statusPagamento === 'Confirmado' || t.status === 'completed'))
    .reduce((sum, t) => sum + t.valor, 0);

  const totalEntradasPendentesFiltrado = filteredTransacoes
    .filter(t => t.tipo === 'entrada' && t.statusPagamento === 'Pendente' && t.status !== 'cancelled')
    .reduce((sum, t) => sum + t.valor, 0);

  const totalSaidasFiltrado = filteredTransacoes
    .filter(t => t.tipo === 'saida')
    .reduce((sum, t) => sum + t.valor, 0);

  const lucroLiquidoFiltrado = totalEntradasFiltrado - totalSaidasFiltrado;
  const countAtendimentosFiltrado = filteredTransacoes.filter(t => t.tipo === 'entrada' && t.status !== 'cancelled').length;
  const ticketMedioFiltrado = countAtendimentosFiltrado > 0 ? totalEntradasFiltrado / countAtendimentosFiltrado : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Estilos para Impressão Oficial do Balancete */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #balancete-print-area, #balancete-print-area * {
            visibility: visible;
          }
          #balancete-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 20px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      {/* Header do Módulo de Gestão */}
      <div className="bg-white dark:bg-stone-900 p-6 md:p-8 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp size={22} />
            </div>
            <h3 className="font-serif text-2xl font-bold text-stone-900 dark:text-stone-100">
              Sistema de Gestão & Balancetes Financeiros
            </h3>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-2xl leading-relaxed">
            Acompanhe o faturamento bruto, valores recebidos, fluxo de caixa, despesas operacionais do salão e o balancete oficial em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={fetchFinancials}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center gap-2 hover:bg-stone-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Atualizar</span>
          </button>

          <button
            onClick={handlePrintBalancete}
            className="px-5 py-2.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-stone-800 transition-all cursor-pointer shadow-sm"
          >
            <Printer size={15} />
            <span>Imprimir Balancete (PDF)</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtro de Período */}
      <div className="bg-stone-50 dark:bg-stone-850 p-3 rounded-2xl border border-stone-200/80 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
          <Filter size={14} className="text-emerald-500" />
          <span>Período do Relatório:</span>
        </div>

        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
          {[
            { id: 'today', label: 'Hoje' },
            { id: 'week', label: 'Últimos 7 Dias' },
            { id: 'month', label: 'Este Mês' },
            { id: 'last_month', label: 'Mês Anterior' },
            { id: 'year', label: 'Este Ano' },
            { id: 'all', label: 'Todos os Registros' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                period === p.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* CARDS COM VALORES E FATURAMENTOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Faturamento Total Bruto */}
        <div className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Faturamento Bruto
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="font-serif text-2xl md:text-3xl font-bold text-stone-900 dark:text-stone-100">
            R$ {totalEntradasFiltrado.toFixed(2).replace('.', ',')}
          </div>
          <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-2 flex items-center gap-1">
            <span>{countAtendimentosFiltrado} atendimentos agendados no período</span>
          </p>
        </div>

        {/* Faturamento Confirmado / Pago */}
        <div className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Recebido / Confirmado
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="font-serif text-2xl md:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            R$ {totalEntradasPagasFiltrado.toFixed(2).replace('.', ',')}
          </div>
          <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-2 flex items-center gap-1">
            <span>Valores validados no caixa ou concluídos</span>
          </p>
        </div>

        {/* A Receber / Pendente */}
        <div className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              A Receber / No Salão
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock size={18} />
            </div>
          </div>
          <div className="font-serif text-2xl md:text-3xl font-bold text-amber-600 dark:text-amber-400">
            R$ {totalEntradasPendentesFiltrado.toFixed(2).replace('.', ',')}
          </div>
          <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-2 flex items-center gap-1">
            <span>Pagamento no ato do atendimento</span>
          </p>
        </div>

        {/* Total de Despesas do Salão */}
        <div className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Despesas Operacionais
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ArrowDownLeft size={18} />
            </div>
          </div>
          <div className="font-serif text-2xl md:text-3xl font-bold text-rose-600 dark:text-rose-400">
            - R$ {totalSaidasFiltrado.toFixed(2).replace('.', ',')}
          </div>
          <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-2 flex items-center gap-1">
            <span>Contas, insumos, produtos e manutenção</span>
          </p>
        </div>

        {/* Lucro Líquido Real */}
        <div className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Lucro Líquido Real
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
          </div>
          <div className={`font-serif text-2xl md:text-3xl font-bold ${lucroLiquidoFiltrado >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600'}`}>
            R$ {lucroLiquidoFiltrado.toFixed(2).replace('.', ',')}
          </div>
          <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-2 flex items-center gap-1">
            <span>Faturamento Bruto menos Despesas Totais</span>
          </p>
        </div>

        {/* Ticket Médio */}
        <div className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Ticket Médio
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <PieChart size={18} />
            </div>
          </div>
          <div className="font-serif text-2xl md:text-3xl font-bold text-stone-900 dark:text-stone-100">
            R$ {ticketMedioFiltrado.toFixed(2).replace('.', ',')}
          </div>
          <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-2 flex items-center gap-1">
            <span>Média gasta por cliente no período</span>
          </p>
        </div>
      </div>

      {/* Sub-abas de Navegação: Balancete | Métricas & Formas de Pagamento | Despesas */}
      <div className="flex gap-2 border-b border-stone-200 dark:border-stone-800 pb-3">
        <button
          onClick={() => setActiveSubTab('balancete')}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'balancete'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
              : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-50'
          }`}
        >
          <FileText size={15} />
          <span>Balancete Geral de Entradas & Saídas</span>
        </button>

        <button
          onClick={() => setActiveSubTab('metricas')}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'metricas'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
              : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-50'
          }`}
        >
          <CreditCard size={15} />
          <span>Faturamentos por PIX / Cartão & Serviços</span>
        </button>

        <button
          onClick={() => setActiveSubTab('despesas')}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'despesas'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
              : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-50'
          }`}
        >
          <Plus size={15} />
          <span>Lançar Despesa do Salão</span>
        </button>
      </div>

      {/* CONTEÚDO DA SUB-ABA: BALANCETE OFICIAL */}
      {activeSubTab === 'balancete' && (
        <div id="balancete-print-area" className="bg-white dark:bg-stone-900 rounded-3xl p-6 md:p-8 shadow-sm border border-stone-100 dark:border-stone-800 space-y-6">
          {/* Cabeçalho do Balancete (visível em tela e na impressão) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-stone-100 dark:border-stone-800 gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                Demonstrativo Contábil Oficial
              </span>
              <h4 className="font-serif text-2xl font-bold text-stone-900 dark:text-stone-100 mt-2">
                Balancete Financeiro • {salonName}
              </h4>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Período: <strong className="text-stone-800 dark:text-stone-200 uppercase">{period}</strong> • Emitido em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <div className="text-right sm:text-right bg-stone-50 dark:bg-stone-800/60 p-4 rounded-2xl border border-stone-200/70 dark:border-stone-700">
              <span className="text-[11px] font-bold text-stone-500 uppercase block">Saldo Líquido Consolidado</span>
              <span className={`font-serif text-xl font-bold ${lucroLiquidoFiltrado >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                R$ {lucroLiquidoFiltrado.toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>

          {/* Tabela detalhada de Lançamentos */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3">Data / Hora</th>
                  <th className="py-3 px-3">Tipo</th>
                  <th className="py-3 px-3">Descrição / Procedimento</th>
                  <th className="py-3 px-3">Cliente / Fornecedor</th>
                  <th className="py-3 px-3">Forma</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {filteredTransacoes.map((t) => (
                  <tr key={t.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-850/50 transition-colors">
                    <td className="py-3.5 px-3 font-mono text-stone-600 dark:text-stone-300">
                      {t.data.split('-').reverse().join('/')} <span className="text-[10px] text-stone-400">{t.horario}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      {t.tipo === 'entrada' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 text-[10px]">
                          <ArrowUpRight size={12} /> Entrada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800 text-[10px]">
                          <ArrowDownLeft size={12} /> Despesa
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-stone-900 dark:text-stone-100 max-w-xs truncate">
                      {t.descricao}
                    </td>
                    <td className="py-3.5 px-3 text-stone-600 dark:text-stone-300">
                      {t.cliente}
                    </td>
                    <td className="py-3.5 px-3 text-stone-500 dark:text-stone-400">
                      {t.metodoPagamento}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        t.statusPagamento === 'Confirmado' || t.statusPagamento === 'Pago'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : t.statusPagamento === 'Cancelado'
                          ? 'bg-stone-100 text-stone-400 line-through'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                      }`}>
                        {t.statusPagamento}
                      </span>
                    </td>
                    <td className={`py-3.5 px-3 text-right font-mono font-bold text-sm ${
                      t.tipo === 'entrada' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {t.tipo === 'entrada' ? '+' : '-'} R$ {t.valor.toFixed(2).replace('.', ',')}
                    </td>
                  </tr>
                ))}

                {filteredTransacoes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-stone-400 dark:text-stone-500">
                      Nenhuma movimentação registrada no período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Resumo Final no Rodapé do Balancete */}
          <div className="mt-6 pt-5 border-t border-stone-200 dark:border-stone-700 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/60">
              <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 block">Total Entradas (Receitas):</span>
              <strong className="text-emerald-700 dark:text-emerald-400 text-sm font-mono">+ R$ {totalEntradasFiltrado.toFixed(2).replace('.', ',')}</strong>
            </div>

            <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 rounded-xl border border-rose-100 dark:border-rose-900/60">
              <span className="text-[10px] uppercase font-bold text-rose-800 dark:text-rose-300 block">Total Saídas (Despesas):</span>
              <strong className="text-rose-700 dark:text-rose-400 text-sm font-mono">- R$ {totalSaidasFiltrado.toFixed(2).replace('.', ',')}</strong>
            </div>

            <div className="p-3 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 rounded-xl shadow-xs">
              <span className="text-[10px] uppercase font-bold text-stone-300 dark:text-stone-600 block">Resultado Líquido do Salão:</span>
              <strong className="text-sm font-mono font-black">R$ {lucroLiquidoFiltrado.toFixed(2).replace('.', ',')}</strong>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA SUB-ABA: FATURAMENTOS POR PIX / CARTÃO & SERVIÇOS */}
      {activeSubTab === 'metricas' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Faturamento por Forma de Pagamento */}
          <div className="bg-white dark:bg-stone-900 p-6 md:p-8 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div>
                <h4 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <CreditCard size={18} className="text-emerald-600" />
                  Faturamento por Meio de Pagamento
                </h4>
                <p className="text-xs text-stone-400">Distribuição percentual dos valores recebidos</p>
              </div>
            </div>

            <div className="space-y-4">
              {(data?.porMetodoPagamento || []).map(m => (
                <div key={m.metodo} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-800 dark:text-stone-200">{m.metodo}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-stone-400 text-[11px]">({m.count} pagamentos)</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                        R$ {m.total.toFixed(2).replace('.', ',')}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                        {m.percentual.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-stone-100 dark:bg-stone-800 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, m.percentual)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Serviços Mais Rentáveis */}
          <div className="bg-white dark:bg-stone-900 p-6 md:p-8 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div>
                <h4 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Sparkles size={18} className="text-rose-500" />
                  Procedimentos com Maior Faturamento
                </h4>
                <p className="text-xs text-stone-400">Classificação dos serviços mais lucrativos</p>
              </div>
            </div>

            <div className="space-y-3">
              {(data?.porServico || []).slice(0, 6).map((s, idx) => (
                <div key={s.name} className="flex items-center justify-between p-3 rounded-2xl bg-stone-50/70 dark:bg-stone-800/40 border border-stone-100 dark:border-stone-800">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <strong className="text-xs text-stone-900 dark:text-stone-100 block">{s.name}</strong>
                      <span className="text-[10px] text-stone-400">{s.count} atendimentos realizados</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-xs text-stone-900 dark:text-stone-100">
                    R$ {s.total.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              ))}

              {(data?.porServico || []).length === 0 && (
                <p className="text-xs text-stone-400 text-center py-6">Nenhum procedimento registrado ainda.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA SUB-ABA: LANÇAR E GERENCIAR DESPESAS DO SALÃO */}
      {activeSubTab === 'despesas' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulário de Cadastro de Despesa */}
          <div className="lg:col-span-1">
            <form onSubmit={handleAddExpense} className="bg-white dark:bg-stone-900 p-6 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-stone-100 dark:border-stone-800">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 flex items-center justify-center">
                  <Plus size={16} />
                </div>
                <h4 className="font-serif text-base font-bold text-stone-900 dark:text-stone-100">
                  Cadastrar Despesa / Saída
                </h4>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Descrição da Conta / Gasto
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Compra de Esmaltes e Lixas"
                  value={newExpenseDesc}
                  onChange={e => setNewExpenseDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Categoria
                </label>
                <select
                  value={newExpenseCat}
                  onChange={e => setNewExpenseCat(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs"
                >
                  <option value="Produtos & Insumos">Produtos & Insumos</option>
                  <option value="Aluguel">Aluguel do Espaço</option>
                  <option value="Energia & Água">Energia & Água</option>
                  <option value="Internet & Telefone">Internet & Telefone</option>
                  <option value="Café & Acomodações">Café & Acomodações</option>
                  <option value="Marketing & Divulgação">Marketing & Divulgação</option>
                  <option value="Manutenção">Manutenção & Equipamentos</option>
                  <option value="Outros">Outros Gastos Operacionais</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0,00"
                    value={newExpenseAmount}
                    onChange={e => setNewExpenseAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Data do Gasto
                  </label>
                  <input
                    type="date"
                    required
                    value={newExpenseDate}
                    onChange={e => setNewExpenseDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingExpense}
                className="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {submittingExpense ? 'Salvando...' : '+ Salvar Despesa no Balancete'}
              </button>
            </form>
          </div>

          {/* Listagem das Despesas Registradas */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
                <h4 className="font-serif text-base font-bold text-stone-900 dark:text-stone-100">
                  Despesas Lançadas no Sistema ({(data?.despesas || []).length})
                </h4>
                <span className="text-xs font-bold text-rose-600">
                  Total: R$ {(data?.despesas || []).reduce((acc, d) => acc + d.amount, 0).toFixed(2).replace('.', ',')}
                </span>
              </div>

              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {(data?.despesas || []).map(exp => (
                  <div key={exp.id} className="flex items-center justify-between p-3.5 rounded-2xl border border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/40 hover:border-stone-200 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900">
                          {exp.category}
                        </span>
                        <span className="text-[11px] text-stone-400 font-mono">
                          {exp.date.split('-').reverse().join('/')}
                        </span>
                      </div>
                      <h5 className="font-bold text-xs text-stone-900 dark:text-stone-100 mt-1">{exp.description}</h5>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm text-rose-600 dark:text-rose-400">
                        - R$ {exp.amount.toFixed(2).replace('.', ',')}
                      </span>
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="text-stone-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                        title="Excluir lançamento"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}

                {(data?.despesas || []).length === 0 && (
                  <p className="text-xs text-stone-400 text-center py-8">
                    Nenhuma despesa cadastrada ainda. Utilize o formulário ao lado para lançar gastos do salão.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
