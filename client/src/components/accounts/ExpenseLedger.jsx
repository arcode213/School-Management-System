import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAppContext } from '../../context/AppContext';
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../../api/expenses';
import { getCategories } from '../../api/accounts';
import { fmtPKR, formatMonthKey } from '../../utils/money';
import toast from 'react-hot-toast';
import { 
  Plus, Pencil, Trash2, Search, DollarSign, 
  AlertCircle, RefreshCw, Calendar, Tag, FileText, ChevronLeft, ChevronRight, TrendingUp, TrendingDown
} from 'lucide-react';

// The fixed category lists this screen used to carry are gone: categories are now
// configurable per campus and come from /api/expense-categories. The seeded
// defaults claim the old enum values, so records written under the old lists
// still resolve to a named category without any of them being rewritten.

export default function ExpenseLedger({ month, isClosed }) {
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
  const [filterMethod, setFilterMethod] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // The configurable categories from the accounts module.
  const [categories, setCategories] = useState([]);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  // Reset custom date filters and page when selected month changes
  useEffect(() => {
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }, [month]);

  // Form State
  const [form, setForm] = useState({
    title: '', type: 'Expense', categoryRef: '', subCategory: '',
    amount: '', date: '', description: '', paymentMethod: 'Cash', paidTo: '',
  });

  useEffect(() => {
    if (!currentCampus) return;
    getCategories()
      .then(r => setCategories(r.data))
      .catch(() => { /* the picker falls back to an empty list */ });
  }, [currentCampus]);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getExpenses({
        search,
        categoryRef: filterCategory || undefined,
        type: filterType,
        paymentMethod: filterMethod || undefined,
        month: (dateFrom || dateTo) ? undefined : month,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
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
  }, [search, filterCategory, filterType, filterMethod, month, dateFrom, dateTo, page]);

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
    const today = new Date().toISOString().substring(0, 10);
    const todayMonth = today.slice(0, 7);
    const defaultDate = (month && month !== todayMonth) ? `${month}-01` : today;
    setForm({
      title: '', type: 'Expense', categoryRef: '', subCategory: '', amount: '',
      date: defaultDate, description: '',
      paymentMethod: 'Cash', paidTo: '',
    });
    setModalOpen(true);
  };

  const openEdit = (exp) => {
    setEditingExpense(exp);
    setForm({
      title: exp.title,
      type: exp.type || 'Expense',
      // A record written before the accounts module has no categoryRef; the picker
      // simply opens unselected and the legacy `category` string is left as it is
      // unless a new category is chosen.
      categoryRef: exp.categoryRef?._id || exp.categoryRef || '',
      subCategory: exp.subCategory || '',
      amount: exp.amount,
      date: exp.date ? new Date(exp.date).toISOString().substring(0, 10) : '',
      description: exp.description || '',
      paymentMethod: exp.paymentMethod || 'Cash',
      paidTo: exp.paidTo || '',
    });
    setModalOpen(true);
  };

  const handleTypeChange = (typeVal) => {
    // Categories are per type, so switching clears a selection that no longer applies.
    setForm(prev => ({ ...prev, type: typeVal, categoryRef: '' }));
  };

  const visibleCategories = categories.filter(c => c.type === form.type && c.isActive);
  const selectedCategory = categories.find(c => c._id === form.categoryRef);
  const fmtRs = fmtPKR;

  return (
    <div className="space-y-4">
      {/* This register lives inside Accounts & Ledger, which already shows the
          month's income, expenses and balance above — so the page heading and the
          three summary cards this screen used to carry are gone rather than
          repeated a few hundred pixels apart. */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="t-muted text-xs font-semibold uppercase tracking-wider">
            {month ? (
              <>Showing transactions for <strong className="t-brand font-bold">{formatMonthKey(month)}</strong></>
            ) : (
              'Every income and expense entry'
            )}
          </p>
          {(dateFrom || dateTo) && (
            <p className="text-[10px] t-warn font-semibold mt-0.5">
              Filtered by custom range: {dateFrom || 'Start'} → {dateTo || 'End'}
            </p>
          )}
        </div>
        {can('expenses', 'create') && !isClosed && (
          <button onClick={openAdd} className="btn btn-primary self-start">
            <Plus size={16} /> Record Transaction
          </button>
        )}
      </div>

      {/* Filters & Tabs */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
        {/* Type tabs */}
        <div className="tab-strip gap-2 bg-surface-2 border border-line p-1 rounded-xl self-start max-w-full">
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
        <div className="card card-lg p-3 grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 flex-1 w-full lg:justify-end">
          <div className="relative lg:max-w-xs lg:flex-1 bg-surface-2 border border-line rounded-xl px-3 py-1.5 text-xs flex items-center gap-2">
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
            {categories
              .filter(c => !filterType || c.type === filterType)
              .map(c => <option key={c._id} value={c._id} className="bg-surface-2">{c.name}</option>)}
          </select>

          <select
            value={filterMethod}
            onChange={e => { setFilterMethod(e.target.value); setPage(1); }}
            className="bg-surface-2 border border-line rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-wider t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer min-w-32"
          >
            <option value="">Any Method</option>
            {['Cash', 'Bank', 'Cheque', 'Online'].map(m => (
              <option key={m} value={m} className="bg-surface-2">{m}</option>
            ))}
          </select>

          {/* Date range. Filtering the ledger by period is the question an
              accountant actually asks of it. */}
          <div className="flex items-center gap-1.5 min-w-0">
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              title="From date"
              className="min-w-0 flex-1 bg-surface-2 border border-line rounded-xl px-3 py-1.5 text-xs font-semibold t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer" />
            <span className="t-faint text-xs flex-shrink-0">→</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
              title="To date"
              className="min-w-0 flex-1 bg-surface-2 border border-line rounded-xl px-3 py-1.5 text-xs font-semibold t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer" />
          </div>

          {(search || filterCategory || filterMethod || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setSearch(''); setFilterCategory(''); setFilterMethod('');
                setDateFrom(''); setDateTo(''); setPage(1);
              }}
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
          <div className="table-scroll">
            <table className="w-full text-xs text-left rtable">
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
                    <td data-label="Date" className="px-5 py-4 font-mono font-bold t-muted">
                      {e.date ? new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td data-label="Title" className="px-5 py-4 font-bold t-body md:whitespace-nowrap">{e.title}</td>
                    <td data-label="Type" className="px-5 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                        e.type === 'Income' ? 'bg-ok-soft t-ok border-ok-border' : 'bg-bad-soft t-bad border-bad-border'
                      }`}>
                        {e.type}
                      </span>
                    </td>
                    <td data-label="Category" className="px-5 py-4">
                      <div>
                        {/* `resolvedCategory` is the configurable category where the
                            row has one, and the legacy string where it does not —
                            resolved on the server so nothing had to be migrated. */}
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-surface-3 t-muted">
                          {e.resolvedCategory || e.category}
                        </span>
                        {e.subCategory && (
                          <span className="block text-[10px] t-faint mt-1">{e.subCategory}</span>
                        )}
                        {e.paymentMethod && (
                          <span className="block text-[10px] t-faint mt-0.5">{e.paymentMethod}</span>
                        )}
                      </div>
                    </td>
                    <td data-label="Description" className="px-5 py-4 t-muted font-medium md:max-w-xs md:truncate" title={e.description}>
                      {e.description || '—'}
                    </td>
                    <td data-label="Recorded By" className="px-5 py-4 t-muted font-semibold">{e.recordedBy?.name || 'Unknown'}</td>
                    <td data-label="Amount" className={`px-5 py-4 text-right font-black ${e.type === 'Income' ? 't-ok' : 't-bad'}`}>
                      {e.type === 'Income' ? '+' : '-'}{fmtRs(e.amount)}
                    </td>
                    <td data-actions="" className="px-5 py-4">
                      <div className="row-actions">
                        {can('expenses', 'edit') && !isClosed && (
                          <button
                            onClick={() => openEdit(e)}
                            className="p-1.5 t-muted hover:t-brand hover:bg-brand-soft border border-transparent hover:border-brand-border rounded-xl transition"
                            title="Edit transaction"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {can('expenses', 'delete') && !isClosed && (
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
          <div className="px-5 py-4 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3">
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
        <div className="modal-shell bg-black/55 backdrop-blur-sm animate-fade-in-up">
          <div className="card card-lg modal-box sm:max-w-md">
            <div className="px-5 sm:px-6 py-4 border-b border-line bg-surface-2 flex justify-between items-center flex-shrink-0">
              <h2 className="text-sm font-bold uppercase tracking-wider t-body">
                {editingExpense ? 'Edit Transaction Record' : 'Record Operation Ledger'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="t-muted hover:t-body"><Plus size={24} className="rotate-45" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Category *</label>
                  <select
                    required
                    value={form.categoryRef}
                    onChange={e => setForm({ ...form, categoryRef: e.target.value, subCategory: '' })}
                    className="w-full text-xs font-semibold bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body outline-none focus:ring-2 focus:ring-brand cursor-pointer"
                  >
                    <option value="">Select a category</option>
                    {visibleCategories.map(c => (
                      <option key={c._id} value={c._id} className="bg-surface-2">{c.name}</option>
                    ))}
                  </select>
                  {visibleCategories.length === 0 && (
                    <p className="t-warn text-[10px] mt-1 font-medium">
                      No active {form.type.toLowerCase()} categories — add one under Accounts &amp; Ledger.
                    </p>
                  )}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Transaction Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    required
                    // A payment cannot have happened tomorrow. The server refuses
                    // one anyway; stopping it here saves the round trip.
                    max={new Date().toISOString().substring(0, 10)}
                    className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Payment Method</label>
                  <select
                    value={form.paymentMethod}
                    onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                    className="w-full text-xs font-semibold bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body outline-none focus:ring-2 focus:ring-brand cursor-pointer"
                  >
                    {['Cash', 'Bank', 'Cheque', 'Online'].map(m => (
                      <option key={m} value={m} className="bg-surface-2">{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Sub-category</label>
                  <input
                    list="expense-subcategories"
                    value={form.subCategory}
                    onChange={e => setForm({ ...form, subCategory: e.target.value })}
                    placeholder={selectedCategory?.suggested?.[0] || 'Optional'}
                    className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  {/* Hints from the chosen category, but free text — a school types
                      whatever its bills actually say. */}
                  <datalist id="expense-subcategories">
                    {(selectedCategory?.suggested || []).map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Paid To</label>
                  <input
                    value={form.paidTo}
                    onChange={e => setForm({ ...form, paidTo: e.target.value })}
                    placeholder="Vendor or staff name"
                    className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
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

              <div className="pt-4 border-t border-line modal-actions">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider t-muted hover:bg-surface-2 border border-line rounded-xl transition">
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
