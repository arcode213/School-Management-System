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
  const map = { 
    Paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', 
    Partial: 'bg-amber-500/10 text-amber-400 border-amber-500/20', 
    Unpaid: 'bg-red-500/10 text-red-400 border-red-500/20', 
    Overdue: 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
  };
  return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${map[status] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>{status}</span>;
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
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Modals
  const [generateOpen, setGenerateOpen] = useState(false);
  const [individualOpen, setIndividualOpen] = useState(false);
  const [editFee, setEditFee] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState(null);

  // Debounce the free-text search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchFees = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getFees({
        feeMonth: filterMonth, class: filterClass, status: filterStatus, search: debouncedSearch, page, limit: 10
      });
      setFees(data.fees);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load fees');
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterClass, filterStatus, debouncedSearch, page]);

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
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase">Fee Management</h1>
          <p className="text-slate-400 text-xs font-semibold mt-1 uppercase tracking-wider">
            {pagination.total} total invoices generated
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={openIndividual}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl px-4 py-2.5 transition"
          >
            <FilePlus size={14} /> Individual Challan
          </button>
          <button onClick={() => setGenerateOpen(true)}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl px-4 py-2.5 transition shadow-lg shadow-blue-500/25 active:scale-95"
          >
            <CopyPlus size={14} /> Generate Monthly Fees
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-4 flex flex-wrap gap-3 items-center">
        <div className="flex bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs flex-1 min-w-48 items-center gap-2">
          <Search size={14} className="text-slate-500" />
          <input type="text" placeholder="Search by name, challan no, student ID, class, roll no..." className="bg-transparent outline-none w-full text-white placeholder-slate-500 font-medium" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setPage(1); }} className="bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
          <option value="">All Months</option>
          {MONTHS.map(m => <option key={m} className="bg-slate-900">{m}</option>)}
        </select>
        <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setPage(1); }} className="bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c} value={c} className="bg-slate-900">Class {c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} className="bg-slate-900">{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
            <p className="text-slate-400 text-xs mt-3 uppercase font-bold tracking-wider">Loading invoices...</p>
          </div>
        ) : fees.length === 0 ? (
          <div className="p-16 text-center text-slate-500 flex flex-col items-center">
            <Wallet size={40} className="text-slate-600 mb-3" />
            <p className="text-slate-300 font-bold uppercase tracking-wider text-sm">No challans found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-white/3 border-b border-white/5 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="text-left px-5 py-4">Challan No</th>
                  <th className="text-left px-5 py-4">Student</th>
                  <th className="text-left px-5 py-4">Due Months</th>
                  <th className="text-left px-5 py-4">Prev. Dues</th>
                  <th className="text-left px-5 py-4">Current Fee</th>
                  <th className="text-left px-5 py-4">Annual Fee</th>
                  <th className="text-left px-5 py-4">Total Amount</th>
                  <th className="text-left px-5 py-4">Paid / Due</th>
                  <th className="text-left px-5 py-4">Status</th>
                  <th className="text-left px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3">
                {fees.map(f => {
                  const student = f.studentInfo;
                  const currentFee = (f.tuitionFee||0) + (f.transportFee||0) + (f.miscFee||0) + (f.examFee||0);
                  const annualNow = f.annualFee || 0;
                  const annualPrev = f.previousAnnualDues || 0;
                  const paid = f.amountPaid || 0;
                  const due = f.balance || 0;
                  
                  return (
                    <tr key={f._id} className={`hover:bg-white/3 transition group ${f.hasBeenCarriedForward ? 'opacity-40' : ''}`}>
                      <td className="px-5 py-4 font-mono font-bold text-blue-400">{f.challanNo}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          {student?.fullName || 'Unknown'}
                          {student?.isFreeship && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 text-amber-400"
                              title="Fees waived — new challans are not generated and this one cannot be printed">
                              FREESHIP
                            </span>
                          )}
                          {f.isOpeningBalance && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-slate-800 border border-white/5 text-slate-400"
                              title="Dues brought in when the student was imported or admitted — not a challan. It is carried into the next challan you generate.">
                              OPENING BALANCE
                            </span>
                          )}
                        </div>
                        {student?.fatherName && <div className="text-[10px] text-slate-400 font-medium">s/o {student.fatherName}</div>}
                        <div className="text-[10px] text-slate-500 font-medium">Class {student?.class} {student?.section}</div>
                      </td>
                      <td className="px-5 py-4 text-slate-300 font-semibold">{f.dueMonthRange}</td>
                      <td className="px-5 py-4 text-rose-400 font-bold">Rs {f.previousDues?.toLocaleString()}</td>
                      <td className="px-5 py-4 text-slate-300 font-medium">Rs {currentFee.toLocaleString()}</td>
                      <td className="px-5 py-4">
                        {annualNow === 0 && annualPrev === 0 ? (
                          <span className="text-slate-600">—</span>
                        ) : (
                          <>
                            {annualNow > 0 && <div className="text-indigo-400 font-bold">Rs {annualNow.toLocaleString()}</div>}
                            {annualPrev > 0 && <div className="text-rose-400 text-[10px] font-medium">Prev: {annualPrev.toLocaleString()}</div>}
                          </>
                        )}
                      </td>
                      <td className="px-5 py-4 font-black text-white">Rs {f.totalAmount?.toLocaleString()}</td>
                      <td className="px-5 py-4">
                        <div className="text-emerald-400 font-semibold">Paid: {paid}</div>
                        {due > 0 && <div className="text-rose-400 font-semibold">Due: {due}</div>}
                        {f.paidUpToMonth && f.status === 'Partial' && (
                          <div className="text-slate-500 text-[9px] font-medium">Paid thru {f.paidUpToMonth}</div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <StatusBadge status={f.status} />
                          {f.hasBeenCarriedForward && <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500 bg-slate-800/50 border border-white/5 px-1.5 py-0.5 rounded">Rolled Over</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition duration-150">
                          <button
                            onClick={() => openPrint(f)}
                            disabled={student?.isFreeship || f.isOpeningBalance}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20 rounded-xl transition disabled:opacity-20 disabled:hover:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                            title={
                              student?.isFreeship ? 'Freeship student — challans are not printed'
                                : f.isOpeningBalance ? 'Opening balance — not a challan, so it cannot be printed'
                                : 'Print Challan'
                            }>
                            <Printer size={14} />
                          </button>
                          {!f.hasBeenCarriedForward && (
                            <button onClick={() => openEdit(f)} className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 rounded-xl transition" title="Edit Challan">
                              <Edit2 size={14} />
                            </button>
                          )}
                          {user?.role !== 'Staff' && (
                            <button onClick={() => handleDelete(f)} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-xl transition" title="Delete Challan">
                              <Trash2 size={14} />
                            </button>
                          )}
                          {f.status !== 'Paid' && !f.hasBeenCarriedForward && (
                            <button onClick={() => openPayment(f)} className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl transition active:scale-95" title="Receive Payment">
                              <CreditCard size={12} /> Pay
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
          <div className="px-5 py-4 border-t border-white/5 flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium">Page {pagination.page} of {pagination.pages}</p>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-20 disabled:cursor-not-allowed border border-white/10 rounded-xl transition bg-white/3"><ChevronLeft size={14}/></button>
              <button disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)} className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-20 disabled:cursor-not-allowed border border-white/10 rounded-xl transition bg-white/3"><ChevronRight size={14}/></button>
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
