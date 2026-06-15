import { useState, useEffect, useCallback } from 'react';
import { getFees } from '../api/fees';
import { getClasses } from '../api/students';
import FeePaymentModal from '../components/FeePaymentModal';
import BulkFeeModal from '../components/BulkFeeModal';
import toast from 'react-hot-toast';
import {
  CreditCard, Search, ChevronLeft, ChevronRight, CopyPlus, Wallet
} from 'lucide-react';

const STATUSES = ['Paid', 'Partial', 'Unpaid'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const StatusBadge = ({ status }) => {
  const map = { Paid: 'bg-green-100 text-green-700', Partial: 'bg-amber-100 text-amber-700', Unpaid: 'bg-red-100 text-red-700' };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-slate-100'}`}>{status}</span>;
};

export default function FeesPage() {
  const [fees, setFees] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);

  // Filters
  const [filterMonth, setFilterMonth] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);

  // Modals
  const [bulkOpen, setBulkOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState(null);

  const fetchFees = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getFees({
        feeMonth: filterMonth, class: filterClass, status: filterStatus, page, limit: 10
      });
      setFees(data.fees);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load fees');
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterClass, filterStatus, page]);

  useEffect(() => { fetchFees(); }, [fetchFees]);
  useEffect(() => { getClasses().then(r => setClasses(r.data)).catch(() => {}); }, []);

  const openPayment = (fee) => {
    setSelectedFee(fee);
    setPaymentOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Fee Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">{pagination.total} fee records</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setBulkOpen(true)}
            className="flex items-center gap-2 text-sm bg-white border border-slate-200 text-slate-700 rounded-xl px-4 py-2 transition shadow-sm font-medium hover:bg-slate-50">
            <CopyPlus size={14} /> Generate Bulk Fees
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3">
        <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-32">
          <option value="">All Months</option>
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-32">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-32">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto" /></div>
        ) : fees.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center">
            <Wallet size={40} className="text-slate-300 mb-3" />
            <p>No fee records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Receipt No.</th>
                  <th className="text-left px-4 py-3">Student</th>
                  <th className="text-left px-4 py-3">Month</th>
                  <th className="text-left px-4 py-3">Total Amount</th>
                  <th className="text-left px-4 py-3">Paid / Due</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {fees.map(f => {
                  const student = f.studentInfo;
                  const total = f.totalAmount;
                  const paid = (f.paidAmount || 0) + (f.discount || 0);
                  const due = total - paid;
                  
                  return (
                    <tr key={f._id} className="hover:bg-slate-50 transition group">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{f.receiptNumber}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{student?.fullName || 'Unknown'}</div>
                        <div className="text-xs text-slate-400">Class {student?.class} {student?.section}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{f.feeMonth} {f.feeYear}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">Rs. {total.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="text-green-600 text-xs">Paid: {paid}</div>
                        {due > 0 && <div className="text-red-500 text-xs font-medium">Due: {due}</div>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                      <td className="px-4 py-3">
                        {f.status !== 'Paid' && (
                          <button onClick={() => openPayment(f)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-medium transition">
                            <CreditCard size={12} /> Receive
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination */}
        {!loading && pagination.pages > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <p className="text-xs text-slate-400">Page {pagination.page} of {pagination.pages}</p>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1 border rounded hover:bg-slate-50 disabled:opacity-30"><ChevronLeft size={16}/></button>
              <button disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)} className="p-1 border rounded hover:bg-slate-50 disabled:opacity-30"><ChevronRight size={16}/></button>
            </div>
          </div>
        )}
      </div>

      <BulkFeeModal open={bulkOpen} onClose={() => setBulkOpen(false)} onSaved={fetchFees} />
      <FeePaymentModal open={paymentOpen} feeRecord={selectedFee} onClose={() => setPaymentOpen(false)} onSaved={fetchFees} />
    </div>
  );
}
