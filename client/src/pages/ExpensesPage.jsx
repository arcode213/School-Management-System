import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../api/expenses';
import toast from 'react-hot-toast';
import { 
  Plus, Pencil, Trash2, Search, DollarSign, 
  AlertCircle, RefreshCw, Calendar, Tag, FileText, ChevronLeft, ChevronRight, TrendingUp, TrendingDown
} from 'lucide-react';

const INCOME_CATEGORIES = ['Tuition', 'Donation', 'Grant', 'Other'];
const EXPENSE_CATEGORIES = ['Utilities', 'Maintenance', 'Rent', 'Salary', 'Stationery', 'Food', 'Other'];

export default function ExpensesPage() {
  const { user } = useAuth();
  const { currentCampus, currentSession } = useAppContext();
  
  const [expenses, setExpenses] = useState([]);
  const [totals, setTotals] = useState({ income: 0, expense: 0, balance: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState(''); // 'Income' | 'Expense' | ''
  const [page, setPage] = useState(1);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  
  // Form State
  const [form, setForm] = useState({ title: '', type: 'Expense', category: 'Other', amount: '', date: '', description: '' });

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getExpenses({
        search,
        category: filterCategory,
        type: filterType,
        page,
        limit: 10
      });
      setExpenses(data.expenses);
      setTotals(data.totals || { income: 0, expense: 0, balance: 0 });
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load transaction ledger');
    } finally {
      setLoading(false);
    }
  }, [search, filterCategory, filterType, page]);

  useEffect(() => {
    if (currentCampus && currentSession) fetchExpenses();
  }, [fetchExpenses, currentCampus, currentSession]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.amount) {
      return toast.error('Please fill out all required fields');
    }

    try {
      if (editingExpense) {
        await updateExpense(editingExpense._id, form);
        toast.success('Record updated successfully');
      } else {
        await createExpense(form);
        toast.success('Transaction logged successfully');
      }
      setModalOpen(false);
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save transaction');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this ledger record?')) return;
    try {
      await deleteExpense(id);
      toast.success('Record deleted');
      fetchExpenses();
    } catch {
      toast.error('Failed to delete transaction');
    }
  };

  const openAdd = () => {
    setEditingExpense(null);
    setForm({ title: '', type: 'Expense', category: 'Other', amount: '', date: new Date().toISOString().substring(0, 10), description: '' });
    setModalOpen(true);
  };

  const openEdit = (exp) => {
    setEditingExpense(exp);
    setForm({
      title: exp.title,
      type: exp.type || 'Expense',
      category: exp.category,
      amount: exp.amount,
      date: exp.date ? new Date(exp.date).toISOString().substring(0, 10) : '',
      description: exp.description || ''
    });
    setModalOpen(true);
  };

  const handleTypeChange = (typeVal) => {
    const defaultCat = typeVal === 'Income' ? INCOME_CATEGORIES[3] : EXPENSE_CATEGORIES[6]; // 'Other' for both
    setForm(prev => ({ ...prev, type: typeVal, category: defaultCat }));
  };

  const fmtRs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase flex items-center gap-2">
            <DollarSign className="text-blue-500" /> Professional Transaction Ledger
          </h1>
          <p className="text-slate-400 text-xs font-semibold mt-1 uppercase tracking-wider">
            Register and analyze school operational incomes and expenses
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl px-4 py-2.5 transition shadow-lg shadow-blue-500/25 active:scale-95 self-start md:self-auto"
        >
          <Plus size={16} /> Record Transaction
        </button>
      </div>

      {/* Screen Analytics Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-start gap-4 shadow-xl">
          <div className="bg-gradient-to-tr from-emerald-600/80 to-emerald-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <TrendingUp className="text-white w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Income</p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-0.5 tracking-tight">{fmtRs(totals.income)}</p>
            <p className="text-slate-500 text-xs mt-1 font-medium">Billed revenue in current context</p>
          </div>
        </div>

        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-start gap-4 shadow-xl">
          <div className="bg-gradient-to-tr from-rose-600/80 to-rose-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <TrendingDown className="text-white w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Expenses</p>
            <p className="text-2xl font-extrabold text-rose-400 mt-0.5 tracking-tight">{fmtRs(totals.expense)}</p>
            <p className="text-slate-500 text-xs mt-1 font-medium">Billed operational custom expenses</p>
          </div>
        </div>

        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-start gap-4 shadow-xl">
          <div className="bg-gradient-to-tr from-blue-600/80 to-blue-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <DollarSign className="text-white w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Net Balance</p>
            <p className={`text-2xl font-extrabold mt-0.5 tracking-tight ${totals.balance >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
              {fmtRs(totals.balance)}
            </p>
            <p className="text-slate-500 text-xs mt-1 font-medium">Ledger cash flow ratio status</p>
          </div>
        </div>
      </div>

      {/* Filters & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Type tabs */}
        <div className="flex gap-2 bg-slate-900/60 border border-white/5 p-1 rounded-xl">
          <button 
            onClick={() => { setFilterType(''); setPage(1); }} 
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${filterType === '' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            All Ledger
          </button>
          <button 
            onClick={() => { setFilterType('Income'); setPage(1); }} 
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${filterType === 'Income' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Incomes
          </button>
          <button 
            onClick={() => { setFilterType('Expense'); setPage(1); }} 
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${filterType === 'Expense' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Expenses
          </button>
        </div>

        {/* Filters */}
        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-3 flex flex-wrap gap-3 flex-1 w-full md:w-auto md:justify-end">
          <div className="relative flex-1 max-w-xs bg-slate-900/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs flex items-center gap-2">
            <Search size={14} className="text-slate-500" />
            <input 
              type="text" 
              value={search} 
              onChange={e => { setSearch(e.target.value); setPage(1); }} 
              placeholder="Search by title or description..." 
              className="bg-transparent w-full text-white placeholder-slate-500 focus:outline-none font-medium" 
            />
          </div>
          <select 
            value={filterCategory} 
            onChange={e => { setFilterCategory(e.target.value); setPage(1); }} 
            className="bg-slate-900/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-32"
          >
            <option value="">All Categories</option>
            {filterType === 'Income' ? (
              INCOME_CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-slate-900">{cat}</option>)
            ) : filterType === 'Expense' ? (
              EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-slate-900">{cat}</option>)
            ) : (
              [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].filter((v, i, a) => a.indexOf(v) === i).map(cat => (
                <option key={cat} value={cat} className="bg-slate-900">{cat}</option>
              ))
            )}
          </select>
          {(search || filterCategory) && (
            <button 
              onClick={() => { setSearch(''); setFilterCategory(''); setPage(1); }}
              className="text-xs font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-xl transition"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Grid Table */}
      <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
            <p className="text-slate-400 text-xs mt-3 uppercase font-bold tracking-wider">Synchronizing ledger...</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-16 text-center text-slate-500 flex flex-col items-center">
            <FileText size={40} className="text-slate-600 mb-3" />
            <p className="text-slate-300 font-bold uppercase tracking-wider text-sm">No transaction records found</p>
            <p className="text-xs text-slate-500 mt-1">Change category or type limits</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-white/3 border-b border-white/5 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Title</th>
                  <th className="px-5 py-4">Type</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4">Description</th>
                  <th className="px-5 py-4">Recorded By</th>
                  <th className="px-5 py-4 text-right">Amount</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3 text-slate-300">
                {expenses.map(e => (
                  <tr key={e._id} className="hover:bg-white/3 transition group">
                    <td className="px-5 py-4 font-mono font-bold text-slate-400">
                      {e.date ? new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-5 py-4 font-bold text-white whitespace-nowrap">{e.title}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                        e.type === 'Income' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {e.type}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-400 font-medium max-w-xs truncate" title={e.description}>
                      {e.description || '—'}
                    </td>
                    <td className="px-5 py-4 text-slate-400 font-semibold">{e.recordedBy?.name || 'Unknown'}</td>
                    <td className={`px-5 py-4 text-right font-black ${e.type === 'Income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {e.type === 'Income' ? '+' : '-'}{fmtRs(e.amount)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition duration-150">
                        <button 
                          onClick={() => openEdit(e)} 
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20 rounded-xl transition" 
                          title="Edit transaction"
                        >
                          <Pencil size={14} />
                        </button>
                        {user?.role !== 'Staff' && (
                          <button 
                            onClick={() => handleDelete(e._id)} 
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-xl transition" 
                            title="Delete transaction"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && pagination.pages > 1 && (
          <div className="px-5 py-4 border-t border-white/5 flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium">Page {pagination.page} of {pagination.pages}</p>
            <div className="flex gap-1">
              <button 
                disabled={page === 1} 
                onClick={() => setPage(p => p - 1)} 
                className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-20 disabled:cursor-not-allowed border border-white/10 rounded-xl transition bg-white/3"
              >
                <ChevronLeft size={14}/>
              </button>
              <button 
                disabled={page === pagination.pages} 
                onClick={() => setPage(p => p + 1)} 
                className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-20 disabled:cursor-not-allowed border border-white/10 rounded-xl transition bg-white/3"
              >
                <ChevronRight size={14}/>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-[#080c14]/65 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in-up">
          <div className="bg-[#111827] border border-white/5 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 bg-white/3 flex justify-between items-center">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                {editingExpense ? 'Edit Transaction Record' : 'Record Operation Ledger'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-200"><Plus size={24} className="rotate-45" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Transaction Type *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                    <input 
                      type="radio" 
                      name="type" 
                      value="Expense" 
                      checked={form.type === 'Expense'} 
                      onChange={e => handleTypeChange(e.target.value)} 
                      className="text-blue-500 focus:ring-blue-500 w-4 h-4 bg-slate-900 border-white/10" 
                    />
                    Expense
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                    <input 
                      type="radio" 
                      name="type" 
                      value="Income" 
                      checked={form.type === 'Income'} 
                      onChange={e => handleTypeChange(e.target.value)} 
                      className="text-blue-500 focus:ring-blue-500 w-4 h-4 bg-slate-900 border-white/10" 
                    />
                    Income
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Transaction Title *</label>
                <input 
                  type="text" 
                  value={form.title} 
                  onChange={e => setForm({...form, title: e.target.value})} 
                  placeholder={form.type === 'Income' ? 'e.g. Tuition Collection Bulk' : 'e.g. Electricity Bill Jan'} 
                  required 
                  className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Category *</label>
                  <select 
                    value={form.category} 
                    onChange={e => setForm({...form, category: e.target.value})} 
                    className="w-full text-xs font-semibold bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {form.type === 'Income' ? (
                      INCOME_CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-slate-900">{cat}</option>)
                    ) : (
                      EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-slate-900">{cat}</option>)
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Amount (Rs) *</label>
                  <input 
                    type="number" 
                    value={form.amount} 
                    onChange={e => setForm({...form, amount: Number(e.target.value)})} 
                    placeholder="e.g. 5000" 
                    required 
                    min="0"
                    className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Transaction Date *</label>
                <input 
                  type="date" 
                  value={form.date} 
                  onChange={e => setForm({...form, date: e.target.value})} 
                  required 
                  className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Description / Memo</label>
                <textarea 
                  value={form.description} 
                  onChange={e => setForm({...form, description: e.target.value})} 
                  placeholder="Additional details..." 
                  rows="3"
                  className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-white/5">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:bg-white/5 rounded-xl transition">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-lg shadow-blue-500/25">
                  {editingExpense ? 'Update Record' : 'Record Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
