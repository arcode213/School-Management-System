import { useState, useEffect, useCallback } from 'react';
import { getFees, deleteFee } from '../api/fees';
import { getClasses } from '../api/students';
import FeePaymentModal from '../components/FeePaymentModal';
import GenerateFeeModal from '../components/GenerateFeeModal';
import IndividualChallanModal from '../components/IndividualChallanModal';
import ChallanPrintPreview from '../components/ChallanPrintPreview';
import QuickPayTab from '../components/QuickPayTab';
import toast from 'react-hot-toast';
import { CreditCard, Printer, Search, ChevronLeft, ChevronRight, CopyPlus, Wallet, FilePlus, Edit2, Trash2 } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';

const STATUSES = ['Paid', 'Partial', 'Unpaid', 'Overdue'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const StatusBadge = ({ status }) => {
  const map = { 
    Paid: 'bg-ok-soft t-ok border-ok-border', 
    Partial: 'bg-warn-soft t-warn border-warn-border', 
    Unpaid: 'bg-bad-soft t-bad border-bad-border', 
    Overdue: 'bg-bad-soft t-bad border-bad-border' 
  };
  return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${map[status] || 'bg-surface-3 t-muted border-line'}`}>{status}</span>;
};

export default function FeesPage() {
  const { can } = useAuth();
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
  const [activeTab, setActiveTab] = useState('registry'); // 'registry' or 'quickpay'

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
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold t-body tracking-tight uppercase">Fee Management</h1>
          <p className="t-muted text-xs font-semibold mt-1 uppercase tracking-wider">
            {pagination.total} total invoices generated
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab === 'registry' && can('fees', 'create') && (
            <>
              <button onClick={openIndividual}
                className="btn btn-ghost"
              >
                <FilePlus size={14} /> Individual Challan
              </button>
              <button onClick={() => setGenerateOpen(true)}
                className="btn btn-primary"
              >
                <CopyPlus size={14} /> Generate Monthly Fees
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line gap-2 overflow-x-auto">
        <button onClick={() => setActiveTab('registry')} className={`pb-2.5 px-4 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${activeTab === 'registry' ? 'border-b-2 border-brand t-brand' : 't-muted hover:t-body'}`}>Challan Registry</button>
        <button onClick={() => setActiveTab('quickpay')} className={`pb-2.5 px-4 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${activeTab === 'quickpay' ? 'border-b-2 border-brand t-brand' : 't-muted hover:t-body'}`}>Quick Pay</button>
      </div>

      {activeTab === 'registry' ? (
        <>
          {/* Filters */}
          <div className="card card-lg p-4 filter-grid">
            <div className="filter-search flex bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs items-center gap-2">
              <Search size={14} className="t-faint" />
              <input type="text" placeholder="Search by name, challan no, student ID, class, roll no..." className="bg-transparent outline-none w-full t-body placeholder-faint font-medium" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setPage(1); }} className="bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer">
              <option value="">All Months</option>
              {MONTHS.map(m => <option key={m} className="bg-surface-2">{m}</option>)}
            </select>
            <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setPage(1); }} className="bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer">
              <option value="">All Classes</option>
              {classes.map(c => <option key={c} value={c} className="bg-surface-2">Class {c}</option>)}
            </select>
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer">
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s} className="bg-surface-2">{s}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="card card-lg overflow-hidden">
            {loading ? (
              <div className="p-16 text-center flex flex-col items-center">
                <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full mx-auto" />
                <p className="t-muted text-xs mt-3 uppercase font-bold tracking-wider">Loading invoices...</p>
              </div>
            ) : fees.length === 0 ? (
              <div className="p-16 text-center t-faint flex flex-col items-center">
                <Wallet size={40} className="t-muted mb-3" />
                <p className="t-muted font-bold uppercase tracking-wider text-sm">No challans found</p>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="w-full text-xs rtable">
                  <thead className="bg-surface-2 border-b border-line t-muted uppercase text-[10px] font-bold tracking-wider">
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
                  <tbody className="divide-y divide-line">
                    {fees.map(f => {
                      const student = f.studentInfo;
                      const currentFee = (f.tuitionFee||0) + (f.transportFee||0) + (f.miscFee||0) + (f.examFee||0);
                      const annualNow = f.annualFee || 0;
                      const annualPrev = f.previousAnnualDues || 0;
                      const paid = f.amountPaid || 0;
                      const due = f.balance || 0;
                      
                      return (
                        <tr key={f._id} className={`hover:bg-surface-2 transition group ${f.hasBeenCarriedForward ? 'opacity-40' : ''}`}>
                          <td data-label="Challan No" className="px-5 py-4 font-mono font-bold t-brand">{f.challanNo}</td>
                          <td data-label="Student" className="px-5 py-4 md:whitespace-nowrap">
                            <div>
                              <div className="font-bold t-body flex items-center gap-1.5 justify-end md:justify-start flex-wrap">
                                {student?.fullName || 'Unknown'}
                                {student?.isFreeship && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-warn-soft border border-warn-border t-warn"
                                    title="Fees waived — new challans are not generated and this one cannot be printed">
                                    FREESHIP
                                  </span>
                                )}
                                {f.isOpeningBalance && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-surface-3 border border-line t-muted"
                                    title="Dues brought in when the student was imported or admitted — not a challan. It is carried into the next challan you generate.">
                                    OPENING BALANCE
                                  </span>
                                )}
                              </div>
                              {student?.fatherName && <div className="text-[10px] t-muted font-medium">s/o {student.fatherName}</div>}
                              <div className="text-[10px] t-faint font-medium">Class {student?.class} {student?.section}</div>
                            </div>
                          </td>
                          <td data-label="Due Months" className="px-5 py-4 t-muted font-semibold">{f.dueMonthRange}</td>
                          <td data-label="Prev. Dues" className="px-5 py-4 t-bad font-bold">Rs {f.previousDues?.toLocaleString()}</td>
                          <td data-label="Current Fee" className="px-5 py-4 t-muted font-medium">Rs {currentFee.toLocaleString()}</td>
                          <td data-label="Annual Fee" className="px-5 py-4">
                            {annualNow === 0 && annualPrev === 0 ? (
                              <span className="t-muted">—</span>
                            ) : (
                              <div>
                                {annualNow > 0 && <div className="t-brand font-bold">Rs {annualNow.toLocaleString()}</div>}
                                {annualPrev > 0 && <div className="t-bad text-[10px] font-medium">Prev: {annualPrev.toLocaleString()}</div>}
                              </div>
                            )}
                          </td>
                          <td data-label="Total Amount" className="px-5 py-4 font-black t-body">Rs {f.totalAmount?.toLocaleString()}</td>
                          <td data-label="Paid / Due" className="px-5 py-4">
                            <div>
                              <div className="t-ok font-semibold">Paid: {paid}</div>
                              {due > 0 && <div className="t-bad font-semibold">Due: {due}</div>}
                              {f.paidUpToMonth && f.status === 'Partial' && (
                                <div className="t-faint text-[9px] font-medium">Paid thru {f.paidUpToMonth}</div>
                              )}
                            </div>
                          </td>
                          <td data-label="Status" className="px-5 py-4">
                            <div className="flex flex-col gap-1 items-end md:items-start">
                              <StatusBadge status={f.status} />
                              {f.hasBeenCarriedForward && <span className="text-[8px] font-bold uppercase tracking-widest t-faint bg-surface-3 border border-line px-1.5 py-0.5 rounded">Rolled Over</span>}
                            </div>
                          </td>
                          <td data-actions="" className="px-5 py-4">
                            <div className="row-actions">
                              <button
                                onClick={() => openPrint(f)}
                                disabled={student?.isFreeship || f.isOpeningBalance}
                                className="p-1.5 t-muted hover:t-brand hover:bg-brand-soft border border-transparent hover:border-brand-border rounded-xl transition disabled:opacity-20 disabled:hover:t-muted disabled:hover:bg-transparent disabled:cursor-not-allowed"
                                title={
                                  student?.isFreeship ? 'Freeship student — challans are not printed'
                                    : f.isOpeningBalance ? 'Opening balance — not a challan, so it cannot be printed'
                                    : 'Print Challan'
                                }>
                                <Printer size={14} />
                              </button>
                              {!f.hasBeenCarriedForward && can('fees', 'edit') && (
                                <button onClick={() => openEdit(f)} className="p-1.5 t-muted hover:t-warn hover:bg-warn-soft border border-transparent hover:border-warn-border rounded-xl transition" title="Edit Challan">
                                  <Edit2 size={14} />
                                </button>
                              )}
                              {can('fees', 'delete') && (
                                <button onClick={() => handleDelete(f)} className="p-1.5 t-muted hover:t-bad hover:bg-bad-soft border border-transparent hover:border-bad-border rounded-xl transition" title="Delete Challan">
                                  <Trash2 size={14} />
                                </button>
                              )}
                              {f.status !== 'Paid' && !f.hasBeenCarriedForward && can('fees', 'edit') && (
                                <button onClick={() => openPayment(f)} className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-ok-soft hover:bg-ok-soft t-ok border border-ok-border rounded-xl transition active:scale-95" title="Receive Payment">
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
              <div className="px-5 py-4 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs t-muted font-medium">Page {pagination.page} of {pagination.pages}</p>
                <div className="flex gap-1">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 t-muted hover:t-body disabled:opacity-20 disabled:cursor-not-allowed border border-line rounded-xl transition bg-surface-2"><ChevronLeft size={14}/></button>
                  <button disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)} className="p-1.5 t-muted hover:t-body disabled:opacity-20 disabled:cursor-not-allowed border border-line rounded-xl transition bg-surface-2"><ChevronRight size={14}/></button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <QuickPayTab onPaymentSaved={fetchFees} />
      )}

      <GenerateFeeModal open={generateOpen} onClose={() => setGenerateOpen(false)} onSaved={fetchFees} />
      <IndividualChallanModal open={individualOpen} feeRecord={editFee} onClose={() => setIndividualOpen(false)} onSaved={fetchFees} />
      <FeePaymentModal open={paymentOpen} feeRecord={selectedFee} onClose={() => setPaymentOpen(false)} onSaved={fetchFees} />
      {printOpen && <ChallanPrintPreview feeId={selectedFee?._id} onClose={() => setPrintOpen(false)} />}
    </div>
  );
}
