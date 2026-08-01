import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../api/expenses';
import toast from 'react-hot-toast';
import { 
  Plus, Pencil, Trash2, Search, DollarSign, 
  AlertCircle, RefreshCw, Calendar, Tag, FileText, ChevronLeft, ChevronRight
} from 'lucide-react';

const CATEGORIES = ['Utilities', 'Maintenance', 'Rent', 'Salary', 'Stationery', 'Food', 'Other'];

export default function ExpensesPage() {
  const { user } = useAuth();
  const { currentCampus, currentSession } = useAppContext();
  
  const [expenses, setExpenses] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(1);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  
  // Form State
  const [form, setForm] = useState({ title: '', category: 'Other', amount: '', date: '', description: '' });

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getExpenses({
        search,
        category: filterCategory,
        page,
        limit: 10
      });
      setExpenses(data.expenses);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [search, filterCategory, page]);

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
        toast.success('Expense record updated');
      } else {
        await createExpense(form);
        toast.success('Expense recorded successfully');
      }
      setModalOpen(false);
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save expense');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense record?')) return;
    try {
      await deleteExpense(id);
      toast.success('Expense record deleted');
      fetchExpenses();
    } catch {
      toast.error('Failed to delete expense');
    }
  };

  const openAdd = () => {
    setEditingExpense(null);
    setForm({ title: '', category: 'Other', amount: '', date: new Date().toISOString().substring(0, 10), description: '' });
    setModalOpen(true);
  };

  const openEdit = (exp) => {
    setEditingExpense(exp);
    setForm({
      title: exp.title,
      category: exp.category,
      amount: exp.amount,
      date: exp.date ? new Date(exp.date).toISOString().substring(0, 10) : '',
      description: exp.description || ''
    });
    setModalOpen(true);
  };

  // Screen Analytics
  const pageTotal = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses]);

  const categoryBreakdown = useMemo(() => {
    const counts = {};
    expenses.forEach(e => {
      counts[e.category] = (counts[e.category] || 0) + (e.amount || 0);
    });
    return Object.entries(counts)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }, [expenses]);

  const fmtRs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase flex items-center gap-2">
            <DollarSign className="text-blue-500" /> Accounts &amp; Expenses
          </h1>
          <p className="text-slate-400 text-xs font-semibold mt-1 uppercase tracking-wider">
            Manage school operations expenditures, utilities, and invoices
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl px-4 py-2.5 transition shadow-lg shadow-blue-500/25 active:scale-95 self-start md:self-auto"
        >
          <Plus size={16} /> Record Expense
        </button>
      </div>

      {/* Screen Analytics Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-start gap-4 shadow-xl">
          <div className="bg-gradient-to-tr from-blue-600/80 to-blue-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <DollarSign className="text-white w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Page Expenses Sum</p>
            <p className="text-2xl font-extrabold text-blue-400 mt-0.5 tracking-tight">{fmtRs(pageTotal)}</p>
            <p className="text-slate-500 text-xs mt-1 font-medium">Billed sum in current page view</p>
          </div>
        </div>

        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-start gap-4 shadow-xl">
          <div className="bg-gradient-to-tr from-purple-600/80 to-purple-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Tag className="text-white w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Top Page Category</p>
            <p className="text-2xl font-extrabold text-purple-400 mt-0.5 tracking-tight truncate">
              {categoryBreakdown[0] ? categoryBreakdown[0].name : '—'}
            </p>
            <p className="text-slate-500 text-xs mt-1 font-medium truncate">
              {categoryBreakdown[0] ? `${fmtRs(categoryBreakdown[0].amount)} allocated` : 'No category logged'}
            </p>
          </div>
        </div>

        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-start gap-4 shadow-xl">
          <div className="bg-gradient-to-tr from-rose-600/80 to-rose-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <AlertCircle className="text-white w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Transactions</p>
            <p className="text-2xl font-extrabold text-rose-400 mt-0.5 tracking-tight">{pagination.total} receipts</p>
            <p className="text-slate-500 text-xs mt-1 font-medium">Logged operational vouchers</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48 bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs flex items-center gap-2">
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
          className="bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-32"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-slate-900">{cat}</option>)}
        </select>
        {(search || filterCategory) && (
          <button 
            onClick={() => { setSearch(''); setFilterCategory(''); setPage(1); }}
            className="text-xs font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-xl transition"
          >
            Clear Filters
          </button>
        )}
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
            <p className="text-slate-300 font-bold uppercase tracking-wider text-sm">No expenses recorded</p>
            <p className="text-xs text-slate-500 mt-1">Select class or context parameters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-white/3 border-b border-white/5 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Title</th>
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
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border bg-slate-800 text-slate-300 border-slate-700">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-400 font-medium max-w-xs truncate" title={e.description}>
                      {e.description || '—'}
                    </td>
                    <td className="px-5 py-4 text-slate-400 font-semibold">{e.recordedBy?.name || 'Unknown'}</td>
                    <td className="px-5 py-4 text-right font-black text-white">{fmtRs(e.amount)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition duration-150">
                        <button 
                          onClick={() => openEdit(e)} 
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20 rounded-xl transition" 
                          title="Edit Expense"
                        >
                          <Pencil size={14} />
                        </button>
                        {user?.role !== 'Staff' && (
                          <button 
                            onClick={() => handleDelete(e._id)} 
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-xl transition" 
                            title="Delete Expense"
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
                {editingExpense ? 'Edit Expense Record' : 'Record Operation Expense'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-200"><Plus size={24} className="rotate-45" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Expense Title *</label>
                <input 
                  type="text" 
                  value={form.title} 
                  onChange={e => setForm({...form, title: e.target.value})} 
                  placeholder="e.g. Electricity Bill Jan" 
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
                    {CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-slate-900">{cat}</option>)}
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
                  {editingExpense ? 'Update Record' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
