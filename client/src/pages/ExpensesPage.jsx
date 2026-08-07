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
  const { can } = useAuth();
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
          <h1 className="text-2xl font-bold t-body tracking-tight uppercase flex items-center gap-2">
            <DollarSign className="t-brand" /> Professional Transaction Ledger
          </h1>
          <p className="t-muted text-xs font-semibold mt-1 uppercase tracking-wider">
            Register and analyze school operational incomes and expenses
          </p>
        </div>
        {can('expenses', 'create') && (
          <button
            onClick={openAdd}
            className="btn btn-primary self-start md:self-auto"
          >
            <Plus size={16} /> Record Transaction
          </button>
        )}
      </div>

      {/* Screen Analytics Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-emerald-600/80 to-emerald-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <TrendingUp className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Total Income</p>
            <p className="text-2xl font-extrabold t-ok mt-0.5 tracking-tight">{fmtRs(totals.income)}</p>
            <p className="t-faint text-xs mt-1 font-medium">Billed revenue in current context</p>
          </div>
        </div>

        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-rose-600/80 to-rose-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <TrendingDown className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Total Expenses</p>
            <p className="text-2xl font-extrabold t-bad mt-0.5 tracking-tight">{fmtRs(totals.expense)}</p>
            <p className="t-faint text-xs mt-1 font-medium">Billed operational custom expenses</p>
          </div>
        </div>

        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-blue-600/80 to-blue-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <DollarSign className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Net Balance</p>
            <p className={`text-2xl font-extrabold mt-0.5 tracking-tight ${totals.balance >= 0 ? 't-brand' : 't-bad'}`}>
              {fmtRs(totals.balance)}
            </p>
            <p className="t-faint text-xs mt-1 font-medium">Ledger cash flow ratio status</p>
          </div>
        </div>
      </div>

      {/* Filters & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Type tabs */}
        <div className="flex gap-2 bg-surface-2 border border-line p-1 rounded-xl">
          <button 
            onClick={() => { setFilterType(''); setPage(1); }} 
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${filterType === '' ? 'bg-brand t-body shadow' : 't-muted hover:t-body'}`}
          >
            All Ledger
          </button>
          <button 
            onClick={() => { setFilterType('Income'); setPage(1); }} 
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${filterType === 'Income' ? 'bg-ok t-body shadow' : 't-muted hover:t-body'}`}
          >
            Incomes
          </button>
          <button 
            onClick={() => { setFilterType('Expense'); setPage(1); }} 
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${filterType === 'Expense' ? 'bg-rose-600 t-body shadow' : 't-muted hover:t-body'}`}
          >
            Expenses
          </button>
        </div>

        {/* Filters */}
        <div className="card card-lg p-3 flex flex-wrap gap-3 flex-1 w-full md:w-auto md:justify-end">
          <div className="relative flex-1 max-w-xs bg-surface-2 border border-line rounded-xl px-3 py-1.5 text-xs flex items-center gap-2">
            <Search size={14} className="t-faint" />
            <input 
              type="text" 
              value={search} 
              onChange={e => { setSearch(e.target.value); setPage(1); }} 
              placeholder="Search by title or description..." 
              className="bg-transparent w-full t-body placeholder-faint focus:outline-none font-medium" 
            />
          </div>
          <select 
            value={filterCategory} 
            onChange={e => { setFilterCategory(e.target.value); setPage(1); }} 
            className="bg-surface-2 border border-line rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-wider t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer min-w-32"
          >
            <option value="">All Categories</option>
            {filterType === 'Income' ? (
              INCOME_CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-surface-2">{cat}</option>)
            ) : filterType === 'Expense' ? (
              EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-surface-2">{cat}</option>)
            ) : (
              [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].filter((v, i, a) => a.indexOf(v) === i).map(cat => (
                <option key={cat} value={cat} className="bg-surface-2">{cat}</option>
              ))
            )}
          </select>
          {(search || filterCategory) && (
            <button 
              onClick={() => { setSearch(''); setFilterCategory(''); setPage(1); }}
              className="text-xs font-bold uppercase tracking-wider t-bad bg-bad-soft border border-bad-border px-3 py-1 rounded-xl transition"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Grid Table */}
      <div className="card card-lg overflow-hidden">
        {loading ? (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full mx-auto" />
            <p className="t-muted text-xs mt-3 uppercase font-bold tracking-wider">Synchronizing ledger...</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-16 text-center t-faint flex flex-col items-center">
            <FileText size={40} className="t-muted mb-3" />
            <p className="t-muted font-bold uppercase tracking-wider text-sm">No transaction records found</p>
            <p className="text-xs t-faint mt-1">Change category or type limits</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-2 border-b border-line t-muted uppercase text-[10px] font-bold tracking-wider">
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
              <tbody className="divide-y divide-line t-muted">
                {expenses.map(e => (
                  <tr key={e._id} className="hover:bg-surface-2 transition group">
                    <td className="px-5 py-4 font-mono font-bold t-muted">
                      {e.date ? new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-5 py-4 font-bold t-body whitespace-nowrap">{e.title}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                        e.type === 'Income' ? 'bg-ok-soft t-ok border-ok-border' : 'bg-bad-soft t-bad border-bad-border'
                      }`}>
                        {e.type}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-surface-3 t-muted">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-5 py-4 t-muted font-medium max-w-xs truncate" title={e.description}>
                      {e.description || '—'}
                    </td>
                    <td className="px-5 py-4 t-muted font-semibold">{e.recordedBy?.name || 'Unknown'}</td>
                    <td className={`px-5 py-4 text-right font-black ${e.type === 'Income' ? 't-ok' : 't-bad'}`}>
                      {e.type === 'Income' ? '+' : '-'}{fmtRs(e.amount)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition duration-150">
                        {can('expenses', 'edit') && (
                          <button
                            onClick={() => openEdit(e)}
                            className="p-1.5 t-muted hover:t-brand hover:bg-brand-soft border border-transparent hover:border-brand-border rounded-xl transition"
                            title="Edit transaction"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {can('expenses', 'delete') && (
                          <button 
                            onClick={() => handleDelete(e._id)} 
                            className="p-1.5 t-muted hover:t-bad hover:bg-bad-soft border border-transparent hover:border-bad-border rounded-xl transition" 
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
          <div className="px-5 py-4 border-t border-line flex items-center justify-between">
            <p className="text-xs t-muted font-medium">Page {pagination.page} of {pagination.pages}</p>
            <div className="flex gap-1">
              <button 
                disabled={page === 1} 
                onClick={() => setPage(p => p - 1)} 
                className="p-1.5 t-muted hover:t-body disabled:opacity-20 disabled:cursor-not-allowed border border-line rounded-xl transition bg-surface-2"
              >
                <ChevronLeft size={14}/>
              </button>
              <button 
                disabled={page === pagination.pages} 
                onClick={() => setPage(p => p + 1)} 
                className="p-1.5 t-muted hover:t-body disabled:opacity-20 disabled:cursor-not-allowed border border-line rounded-xl transition bg-surface-2"
              >
                <ChevronRight size={14}/>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in-up">
          <div className="card card-lg w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-line bg-surface-2 flex justify-between items-center">
              <h2 className="text-sm font-bold uppercase tracking-wider t-body">
                {editingExpense ? 'Edit Transaction Record' : 'Record Operation Ledger'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="t-muted hover:t-body"><Plus size={24} className="rotate-45" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Transaction Type *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-semibold t-muted cursor-pointer">
                    <input 
                      type="radio" 
                      name="type" 
                      value="Expense" 
                      checked={form.type === 'Expense'} 
                      onChange={e => handleTypeChange(e.target.value)} 
                      className="t-brand focus:ring-brand w-4 h-4 bg-surface-2 border-line" 
                    />
                    Expense
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold t-muted cursor-pointer">
                    <input 
                      type="radio" 
                      name="type" 
                      value="Income" 
                      checked={form.type === 'Income'} 
                      onChange={e => handleTypeChange(e.target.value)} 
                      className="t-brand focus:ring-brand w-4 h-4 bg-surface-2 border-line" 
                    />
                    Income
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Transaction Title *</label>
                <input 
                  type="text" 
                  value={form.title} 
                  onChange={e => setForm({...form, title: e.target.value})} 
                  placeholder={form.type === 'Income' ? 'e.g. Tuition Collection Bulk' : 'e.g. Electricity Bill Jan'} 
                  required 
                  className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body focus:outline-none focus:ring-2 focus:ring-brand" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Category *</label>
                  <select 
                    value={form.category} 
                    onChange={e => setForm({...form, category: e.target.value})} 
                    className="w-full text-xs font-semibold bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body outline-none focus:ring-2 focus:ring-brand cursor-pointer"
                  >
                    {form.type === 'Income' ? (
                      INCOME_CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-surface-2">{cat}</option>)
                    ) : (
                      EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-surface-2">{cat}</option>)
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Amount (Rs) *</label>
                  <input 
                    type="number" 
                    value={form.amount} 
                    onChange={e => setForm({...form, amount: Number(e.target.value)})} 
                    placeholder="e.g. 5000" 
                    required 
                    min="0"
                    className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body focus:outline-none focus:ring-2 focus:ring-brand" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Transaction Date *</label>
                <input 
                  type="date" 
                  value={form.date} 
                  onChange={e => setForm({...form, date: e.target.value})} 
                  required 
                  className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body focus:outline-none focus:ring-2 focus:ring-brand" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Description / Memo</label>
                <textarea 
                  value={form.description} 
                  onChange={e => setForm({...form, description: e.target.value})} 
                  placeholder="Additional details..." 
                  rows="3"
                  className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body focus:outline-none focus:ring-2 focus:ring-brand" 
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-line">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-bold uppercase tracking-wider t-muted hover:bg-surface-2 rounded-xl transition">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
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
