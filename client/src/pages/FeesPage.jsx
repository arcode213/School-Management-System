import { useState, useEffect, useCallback } from 'react';
import { getFees, deleteFee } from '../api/fees';
import { getClasses } from '../api/students';
import FeePaymentModal from '../components/FeePaymentModal';
import GenerateFeeModal from '../components/GenerateFeeModal';
import IndividualChallanModal from '../components/IndividualChallanModal';
import ChallanPrintPreview from '../components/ChallanPrintPreview';
import toast from 'react-hot-toast';
import { CreditCard, Printer, Search, ChevronLeft, ChevronRight, CopyPlus, Wallet, FilePlus, Edit2, Trash2 } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';

const STATUSES = ['Paid', 'Partial', 'Unpaid', 'Overdue'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const StatusBadge = ({ status }) => {
  const map = { Paid: 'bg-green-100 text-green-700', Partial: 'bg-amber-100 text-amber-700', Unpaid: 'bg-red-100 text-red-700', Overdue: 'bg-rose-100 text-rose-700' };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-slate-100'}`}>{status}</span>;
};

export default function FeesPage() {
  const { user } = useAuth();
  const { currentCampus, currentSession } = useAppContext();
  const [fees, setFees] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);

  // Filters
  const [filterMonth, setFilterMonth] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchChallan, setSearchChallan] = useState('');
  const [page, setPage] = useState(1);

  // Modals
  const [generateOpen, setGenerateOpen] = useState(false);
  const [individualOpen, setIndividualOpen] = useState(false);
  const [editFee, setEditFee] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState(null);

  const fetchFees = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getFees({
        feeMonth: filterMonth, class: filterClass, status: filterStatus, challanNo: searchChallan, page, limit: 10
      });
      setFees(data.fees);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load fees');
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterClass, filterStatus, searchChallan, page]);

  // Refetch whenever the campus/session context changes, so switching the
  // active session in the top bar always reloads this campus/session's challans.
  useEffect(() => {
    if (currentCampus && currentSession) fetchFees();
  }, [fetchFees, currentCampus, currentSession]);
  useEffect(() => {
    if (currentCampus && currentSession) getClasses().then(r => setClasses(r.data)).catch(() => {});
  }, [currentCampus, currentSession]);

  const openPayment = (fee) => { setSelectedFee(fee); setPaymentOpen(true); };
  const openPrint = (fee) => { setSelectedFee(fee); setPrintOpen(true); };
  const openIndividual = () => { setEditFee(null); setIndividualOpen(true); };
  const openEdit = (fee) => { setEditFee(fee); setIndividualOpen(true); };

  const handleDelete = async (fee) => {
    if (!window.confirm(`Delete challan ${fee.challanNo}? This cannot be undone.`)) return;
    try {
      await deleteFee(fee._id);
      toast.success('Challan deleted');
      fetchFees();
    } catch {
      toast.error('Failed to delete challan');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Fee Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">{pagination.total} challans</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openIndividual}
            className="flex items-center gap-2 text-sm bg-white border border-slate-200 text-slate-700 rounded-xl px-4 py-2 transition shadow-sm font-medium hover:border-blue-300 hover:text-blue-600">
            <FilePlus size={16} /> Individual Challan
          </button>
          <button onClick={() => setGenerateOpen(true)}
            className="flex items-center gap-2 text-sm bg-blue-600 text-white rounded-xl px-4 py-2 transition shadow-sm font-medium hover:bg-blue-700">
            <CopyPlus size={16} /> Generate Monthly Fees
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="flex bg-slate-50 border rounded-lg px-3 py-2 text-sm flex-1 min-w-48 items-center gap-2">
          <Search size={16} className="text-slate-400" />
          <input type="text" placeholder="Search Challan No" className="bg-transparent outline-none w-full" value={searchChallan} onChange={e => { setSearchChallan(e.target.value); setPage(1); }} />
        </div>
        <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm min-w-32">
          <option value="">All Months</option>
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm min-w-32">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm min-w-32">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>
        ) : fees.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center">
            <Wallet size={40} className="text-slate-300 mb-3" />
            <p>No challans found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-[11px] font-semibold tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Challan No</th>
                  <th className="text-left px-4 py-3">Student</th>
                  <th className="text-left px-4 py-3">Due Months</th>
                  <th className="text-left px-4 py-3">Prev. Dues</th>
                  <th className="text-left px-4 py-3">Current Fee</th>
                  <th className="text-left px-4 py-3">Total Amount</th>
                  <th className="text-left px-4 py-3">Paid / Due</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {fees.map(f => {
                  const student = f.studentInfo;
                  const currentFee = (f.tuitionFee||0) + (f.transportFee||0) + (f.miscFee||0) + (f.examFee||0);
                  const paid = f.amountPaid || 0;
                  const due = f.balance || 0;
                  
                  return (
                    <tr key={f._id} className={`hover:bg-slate-50 transition group ${f.hasBeenCarriedForward ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-blue-600 font-medium">{f.challanNo}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{student?.fullName || 'Unknown'}</div>
                        <div className="text-xs text-slate-500">Class {student?.class} {student?.section}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">{f.dueMonthRange}</td>
                      <td className="px-4 py-3 text-rose-500 font-medium">Rs {f.previousDues?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-600">Rs {currentFee.toLocaleString()}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">Rs {f.totalAmount?.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="text-emerald-600 text-xs font-semibold">Paid: {paid}</div>
                        {due > 0 && <div className="text-rose-500 text-xs font-semibold">Due: {due}</div>}
                        {f.paidUpToMonth && f.status === 'Partial' && (
                          <div className="text-slate-400 text-[10px]">Paid thru {f.paidUpToMonth}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={f.status} />
                          {f.hasBeenCarriedForward && <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded text-center">Rolled Over</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openPrint(f)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Print Challan">
                            <Printer size={16} />
                          </button>
                          {!f.hasBeenCarriedForward && (
                            <button onClick={() => openEdit(f)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Edit Challan">
                              <Edit2 size={16} />
                            </button>
                          )}
                          {user?.role !== 'Staff' && (
                            <button onClick={() => handleDelete(f)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete Challan">
                              <Trash2 size={16} />
                            </button>
                          )}
                          {f.status !== 'Paid' && !f.hasBeenCarriedForward && (
                            <button onClick={() => openPayment(f)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-medium transition" title="Receive Payment">
                              <CreditCard size={14} /> Pay
                            </button>
                          )}
                        </div>
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

      <GenerateFeeModal open={generateOpen} onClose={() => setGenerateOpen(false)} onSaved={fetchFees} />
      <IndividualChallanModal open={individualOpen} feeRecord={editFee} onClose={() => setIndividualOpen(false)} onSaved={fetchFees} />
      <FeePaymentModal open={paymentOpen} feeRecord={selectedFee} onClose={() => setPaymentOpen(false)} onSaved={fetchFees} />
      {printOpen && <ChallanPrintPreview feeId={selectedFee?._id} onClose={() => setPrintOpen(false)} />}
    </div>
  );
}
