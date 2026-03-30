/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  MoreVertical, 
  Plus, 
  X, 
  Delete, 
  ChevronLeft, 
  History, 
  Settings, 
  Download, 
  Trash2,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  PieChart as PieChartIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Transaction, TransactionType } from './types';

// --- Utilities ---

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount).replace('BDT', '৳');
};

const getMonthKey = (date: Date = new Date()) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getProgressColor = (percent: number) => {
  if (percent <= 35) return '#10b981'; // green-500
  if (percent >= 70) return '#ef4444'; // red-500
  
  // 35 -> 60: Green to Yellow
  if (percent <= 60) {
    const ratio = (percent - 35) / 25;
    // Green (16, 185, 129) to Yellow (234, 179, 8)
    const r = Math.round(16 + (234 - 16) * ratio);
    const g = Math.round(185 + (179 - 185) * ratio);
    const b = Math.round(129 + (8 - 129) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  }
  
  // 60 -> 70: Yellow to Red
  const ratio = (percent - 60) / 10;
  // Yellow (234, 179, 8) to Red (239, 68, 68)
  const r = Math.round(234 + (239 - 234) * ratio);
  const g = Math.round(179 + (68 - 179) * ratio);
  const b = Math.round(8 + (68 - 8) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
};

// --- Components ---

const Numpad = ({ onInput, onDelete, onClear }: { 
  onInput: (val: string) => void, 
  onDelete: () => void, 
  onClear: () => void 
}) => {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'];

  return (
    <div className="grid grid-cols-3 gap-2 w-full max-w-xs mx-auto mt-4">
      {keys.map((key) => (
        <button
          key={key}
          onClick={() => {
            if (key === 'backspace') onDelete();
            else onInput(key);
          }}
          onContextMenu={(e) => {
            if (key === 'backspace') {
              e.preventDefault();
              onClear();
            }
          }}
          className="h-14 flex items-center justify-center text-xl font-medium rounded-2xl bg-white border border-zinc-100 shadow-sm active:scale-95 active:bg-zinc-50 transition-all"
        >
          {key === 'backspace' ? <Delete size={20} className="text-zinc-400" /> : key}
        </button>
      ))}
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }: { 
  isOpen: boolean, 
  onClose: () => void, 
  title: string, 
  children: React.ReactNode 
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] p-6 pb-10 z-50 shadow-2xl max-w-lg mx-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{title}</h2>
              <button onClick={onClose} className="p-2 bg-zinc-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default function App() {
  // --- State ---
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState('0');
  const [note, setNote] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [isChartReady, setIsChartReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // --- Persistence ---
  useEffect(() => {
    const savedTransactions = localStorage.getItem('khoroch_transactions');
    if (savedTransactions) setTransactions(JSON.parse(savedTransactions));
  }, []);

  useEffect(() => {
    if (isChartOpen) {
      const timer = setTimeout(() => setIsChartReady(true), 400);
      return () => clearTimeout(timer);
    } else {
      setIsChartReady(false);
    }
  }, [isChartOpen]);

  useEffect(() => {
    localStorage.setItem('khoroch_transactions', JSON.stringify(transactions));
  }, [transactions]);

  // --- Calculations ---
  const currentMonthKey = getMonthKey();
  
  const currentMonthStats = useMemo(() => {
    const monthTransactions = transactions.filter(t => getMonthKey(new Date(t.timestamp)) === currentMonthKey);
    const spent = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => acc + t.amount, 0);
    const income = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((acc, t) => acc + t.amount, 0);
    
    const remaining = income - spent;
    const percent = income > 0 ? (spent / income) * 100 : 0;
    
    return { spent, income, remaining, percent };
  }, [transactions, currentMonthKey]);

  // --- Handlers ---
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleAddExpense = () => {
    if (currentMonthStats.income === 0) {
      showToast('Please add income first to start tracking expenses');
      return;
    }
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      type: 'expense',
      amount: numAmount,
      note: note.trim() || '',
      timestamp: Date.now(),
    };

    setTransactions([newTransaction, ...transactions]);
    setAmount('0');
    setNote('');
    showToast('Expense saved');
  };

  const handleAddIncome = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const incomeAmount = parseFloat(formData.get('amount') as string);
    const incomeNote = formData.get('note') as string;
    const incomeDate = formData.get('date') as string;

    if (isNaN(incomeAmount) || incomeAmount <= 0) return;

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      type: 'income',
      amount: incomeAmount,
      note: incomeNote.trim() || 'Salary',
      timestamp: new Date(incomeDate).getTime(),
    };

    setTransactions([newTransaction, ...transactions]);
    setIsIncomeModalOpen(false);
    showToast('Income added');
  };

  const deleteTransaction = (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
    showToast('Transaction deleted');
  };

  const handleNumpadInput = (val: string) => {
    setAmount(prev => {
      if (val === '.') {
        if (prev.includes('.')) return prev;
        return prev + '.';
      }
      if (prev === '0') return val;
      return prev + val;
    });
  };

  const handleNumpadDelete = () => {
    setAmount(prev => {
      if (prev.length === 1) return '0';
      return prev.slice(0, -1);
    });
  };

  const exportData = () => {
    const data = JSON.stringify({ transactions }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `khoroch-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast('Backup exported');
  };

  const chartData = useMemo(() => {
    const monthExpenses = transactions.filter(t => 
      t.type === 'expense' && getMonthKey(new Date(t.timestamp)) === currentMonthKey
    );
    
    const groups: Record<string, number> = {};
    monthExpenses.forEach(t => {
      const category = t.note.trim() || 'Other';
      const key = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
      groups[key] = (groups[key] || 0) + t.amount;
    });
    
    return Object.entries(groups)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, currentMonthKey]);

  const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef'];

  return (
    <div className="h-screen flex flex-col max-w-lg mx-auto bg-zinc-50 relative overflow-hidden">
      {/* --- Dashboard Card --- */}
      <header className="sticky top-0 z-40 bg-zinc-50/80 backdrop-blur-md px-4 pt-6 pb-4">
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-zinc-100">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Current Month</p>
              <h1 className="text-lg font-bold text-zinc-800">
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h1>
            </div>
            <div className="relative">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 hover:bg-zinc-50 rounded-full transition-colors"
              >
                <MoreVertical size={20} className="text-zinc-500" />
              </button>
              
              <AnimatePresence>
                {isMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-zinc-100 py-2 z-20 overflow-hidden"
                    >
                      <button 
                        onClick={() => { setIsIncomeModalOpen(true); setIsMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        <ArrowUpRight size={18} className="text-emerald-500" />
                        Add Income
                      </button>
                      <button 
                        onClick={() => { setIsHistoryOpen(true); setIsMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        <History size={18} className="text-zinc-400" />
                        History
                      </button>
                      <button 
                        onClick={() => { setIsChartOpen(true); setIsMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        <PieChartIcon size={18} className="text-zinc-400" />
                        Pie Chart Breakdown
                      </button>
                      <div className="h-px bg-zinc-100 my-1" />
                      <button 
                        onClick={() => { exportData(); setIsMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        <Download size={18} className="text-zinc-400" />
                        Export Backup
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative h-8 w-full bg-zinc-100 rounded-full overflow-hidden mb-4">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(currentMonthStats.percent, 100)}%` }}
              style={{ backgroundColor: getProgressColor(currentMonthStats.percent) }}
              className="h-full transition-all duration-500"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-zinc-800 drop-shadow-sm">
                {currentMonthStats.percent > 100 ? 'Over budget' : `${Math.round(currentMonthStats.percent)}%`}
              </span>
            </div>
          </div>

          <div className="space-y-1 text-center">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Spent this month</p>
            <p className="text-3xl font-black text-zinc-900 tracking-tighter">{formatCurrency(currentMonthStats.spent)}</p>
          </div>
          
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="flex-1 px-4 pb-8 overflow-hidden flex flex-col justify-start pt-2">
        {/* Expense Entry Section */}
        <section className="mb-8">
          <div className="pt-2 pb-4">
            <p className="text-xs font-bold text-zinc-400 mb-2 uppercase tracking-widest text-center">Amount</p>
            <div className="flex items-center justify-center bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-zinc-300">৳</span>
                <span className="text-4xl font-black text-zinc-900 tracking-tighter">{amount}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative flex items-center gap-2 bg-white border border-zinc-100 rounded-2xl pr-2 shadow-sm focus-within:ring-2 focus-within:ring-zinc-200 transition-all">
              <input 
                type="text" 
                placeholder="Note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="flex-1 bg-transparent px-5 py-4 text-sm focus:outline-none"
              />
              <button 
                onClick={handleAddExpense}
                disabled={parseFloat(amount) <= 0}
                className="px-6 py-3 bg-red-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-100 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all whitespace-nowrap"
              >
                Spent
              </button>
            </div>

            <Numpad 
              onInput={handleNumpadInput} 
              onDelete={handleNumpadDelete} 
              onClear={() => setAmount('0')} 
            />
          </div>
        </section>

      </main>

      {/* --- Modals --- */}
      
      {/* Add Income Modal */}
      <Modal isOpen={isIncomeModalOpen} onClose={() => setIsIncomeModalOpen(false)} title="Add Income">
        <form onSubmit={handleAddIncome} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Amount</label>
            <input 
              name="amount"
              type="number" 
              step="0.01"
              required
              placeholder="0.00"
              autoFocus
              className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-5 py-4 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Note</label>
            <input 
              name="note"
              type="text" 
              placeholder="Salary, Bonus, etc."
              defaultValue="Salary"
              className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Date</label>
            <input 
              name="date"
              type="date" 
              defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>
          <button 
            type="submit"
            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold mt-4 shadow-lg shadow-emerald-100 active:scale-95 transition-all"
          >
            Add Income
          </button>
        </form>
      </Modal>

      {/* Pie Chart Modal */}
      <Modal isOpen={isChartOpen} onClose={() => setIsChartOpen(false)} title="Spending Breakdown">
        <div className="h-[400px] w-full relative">
          {isChartReady && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  isAnimationActive={true}
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
                    if (percent < 0.05) return null;
                    const RADIAN = Math.PI / 180;
                    const radius = outerRadius * 1.15;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    const truncatedName = name.length > 10 ? name.slice(0, 8) + '...' : name;
                    return (
                      <text 
                        x={x} 
                        y={y} 
                        fill="#71717a" 
                        textAnchor={x > cx ? 'start' : 'end'} 
                        dominantBaseline="central"
                        style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}
                      >
                        {truncatedName}
                      </text>
                    );
                  }}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={80}
                  content={({ payload }) => (
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4 max-h-32 overflow-y-auto hide-scrollbar">
                      {payload?.map((entry: any, index: number) => (
                        <div key={`item-${index}`} className="flex items-center gap-1.5 max-w-[120px]">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter truncate" title={entry.value}>
                            {entry.value}
                          </span>
                          <span className="text-[10px] font-bold text-zinc-400 tracking-tighter shrink-0">
                            {formatCurrency(entry.payload.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
              <PieChartIcon size={48} className="mb-2 opacity-20" />
              <p className="text-sm font-medium">No expenses this month to analyze.</p>
            </div>
          )}
        </div>
      </Modal>

      {/* History Modal */}
      <Modal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} title="Transaction History">
        <div className="max-h-[60vh] overflow-y-auto hide-scrollbar space-y-3">
          {transactions.map((t) => (
            <div 
              key={t.id}
              className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-zinc-400'}`}>
                  {t.type === 'income' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-800">{t.note || (t.type === 'income' ? 'Income' : 'Expense')}</p>
                  <p className="text-[10px] font-medium text-zinc-400">
                    {new Date(t.timestamp).toLocaleString('en-US', { 
                      day: 'numeric', 
                      month: 'short', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className={`text-sm font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-zinc-800'}`}>
                  {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                </p>
                <button 
                  onClick={() => deleteTransaction(t.id)}
                  className="p-1 text-zinc-300 hover:text-red-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <p className="text-center py-10 text-zinc-400 text-sm">No transactions yet.</p>
          )}
        </div>
      </Modal>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-6 py-3 rounded-full text-sm font-bold shadow-2xl z-[100] flex items-center gap-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
