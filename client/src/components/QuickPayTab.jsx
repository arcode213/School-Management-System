import { useState, useEffect, useRef } from 'react';
import { getFees, updateFee } from '../api/fees';
import { MONTHS, parseStartMonth, monthAt, formatDueMonths } from '../utils/feeMonths';
import toast from 'react-hot-toast';
import { Search, Wallet, CreditCard, Loader2 } from 'lucide-react';

export default function QuickPayTab({ onPaymentSaved }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedChallan, setSelectedChallan] = useState(null);
  const searchInputRef = useRef(null);

  const [form, setForm] = useState({
    discount: 0,
    monthlyPay: 0,
    annualPay: 0,
    paymentMethod: 'Cash',
    remarks: '',
  });

  const [edited, setEdited] = useState({ monthly: false, annual: false });
  const [submitting, setSubmitting] = useState(false);

  // Focus search input on mount and when selectedChallan changes
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [selectedChallan]);

  // Calculations for inputs and balances
  const newDiscount = Number(form.discount || 0);
  const monthlyPay = Number(form.monthlyPay || 0);
  const annualPay = Number(form.annualPay || 0);
  const payingTotal = monthlyPay + annualPay;

  const annualDue = selectedChallan ? (selectedChallan.annualBalance ?? 0) : 0;
  const monthlyDueRaw = selectedChallan ? (selectedChallan.monthlyBalance ?? selectedChallan.balance ?? 0) : 0;
  const monthlyDue = Math.max(0, monthlyDueRaw - newDiscount);
  const totalDue = monthlyDue + annualDue;
  const hasAnnual = annualDue > 0;

  const recurring = selectedChallan ? (selectedChallan.tuitionFee || 0) + (selectedChallan.transportFee || 0) + (selectedChallan.miscFee || 0) : 0;
  const rangeStart = selectedChallan ? parseStartMonth(selectedChallan.dueMonthRange, selectedChallan.feeMonth) : '';
  const startIdx = MONTHS.indexOf(rangeStart);
  const feeIdx = selectedChallan ? MONTHS.indexOf(selectedChallan.feeMonth) : -1;
  
  let totalMonths = 1;
  if (startIdx >= 0 && feeIdx >= 0) {
    let s = feeIdx - startIdx;
    if (s < 0) s += 12;
    totalMonths = s + 1;
  }

  const monthlyTotal = selectedChallan?.monthlyTotal ?? Math.max(0, (selectedChallan?.totalAmount || 0) - (selectedChallan?.annualTotal || 0));
  const monthlyAlreadyPaid = Math.max(0, monthlyTotal - monthlyDueRaw);
  const alreadyPaidMonths = recurring > 0 ? Math.min(totalMonths, Math.floor(monthlyAlreadyPaid / recurring)) : 0;
  const remainingMonths = Math.max(0, totalMonths - alreadyPaidMonths);
  const canPayByMonth = recurring > 0 && remainingMonths > 1;

  const monthlyPaidAfter = Math.min(Math.max(0, monthlyTotal - newDiscount), monthlyAlreadyPaid + monthlyPay);
  const monthsPaidAfter = recurring > 0 ? Math.min(totalMonths, Math.floor(monthlyPaidAfter / recurring)) : 0;
  const settlesThrough = monthsPaidAfter > 0 ? monthAt(startIdx + monthsPaidAfter - 1) : null;
  const carriesFrom = monthsPaidAfter < totalMonths ? monthAt(startIdx + monthsPaidAfter) : null;

  // Reset form and edited states when selectedChallan changes
  useEffect(() => {
    if (selectedChallan) {
      setForm({
        discount: 0,
        monthlyPay: Math.max(0, selectedChallan.monthlyBalance ?? selectedChallan.balance ?? 0),
        annualPay: selectedChallan.annualBalance ?? 0,
        paymentMethod: 'Cash',
        remarks: '',
      });
      setEdited({ monthly: false, annual: false });
    }
  }, [selectedChallan]);

  // Adjust monthlyPay to match the new monthly due after discount, if not manually edited
  useEffect(() => {
    if (!selectedChallan || edited.monthly) return;
    setForm(prev => ({
      ...prev,
      monthlyPay: Math.max(0, monthlyDueRaw - newDiscount)
    }));
  }, [newDiscount, monthlyDueRaw, edited.monthly, selectedChallan]);

  // Debounced search logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const delay = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await getFees({ search: searchQuery, page: 1, limit: 10 });
        const outstanding = (data.fees || []).filter(
          f => f.status !== 'Paid' && !f.hasBeenCarriedForward
        );
        setResults(outstanding);

        // Auto-select if there is exactly 1 match
        if (outstanding.length === 1) {
          selectChallan(outstanding[0]);
        }
      } catch (err) {
        toast.error('Search query failed');
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delay);
  }, [searchQuery]);

  const selectChallan = (challan) => {
    setSelectedChallan(challan);
  };

  const selectMonths = (value) => {
    const n = Number(value);
    if (!n) return;
    const amt = n >= remainingMonths ? monthlyDue : Math.min(monthlyDue, recurring * n);
    setEdited(e => ({ ...e, monthly: true }));
    setForm(prev => ({ ...prev, monthlyPay: amt }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedChallan) return;

    const monthlyPart = Math.max(0, Number(form.monthlyPay) || 0);
    const annualPart = Math.max(0, Number(form.annualPay) || 0);
    const discAmount = Math.max(0, Number(form.discount) || 0);

    if (monthlyPart + annualPart <= 0 && discAmount <= 0) {
      toast.error('Enter an amount to receive');
      return;
    }

    setSubmitting(true);
    try {
      const finalDiscount = (selectedChallan.discount || 0) + discAmount;
      const payload = {
        discount: finalDiscount,
        amountPaid: (selectedChallan.amountPaid || 0) + monthlyPart + annualPart,
        annualPaid: (selectedChallan.annualPaid || 0) + annualPart,
        paymentDate: new Date(),
        paymentMethod: form.paymentMethod,
        remarks: form.remarks,
      };

      await updateFee(selectedChallan._id, payload);
      toast.success(`Payment of Rs. ${(monthlyPart + annualPart).toLocaleString()} recorded successfully for ${selectedChallan.studentInfo?.fullName || 'student'}`);

      // Callback to refresh registry data
      onPaymentSaved();

      // Reset Quick Pay tab states
      setSelectedChallan(null);
      setSearchQuery('');
      setResults([]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to format values
  const fmtPKR = (v) => 'Rs ' + (Number(v) || 0).toLocaleString();

  const student = selectedChallan?.studentInfo || {};

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in-up">
      {/* Left panel: Search and Results List */}
      <div className="lg:col-span-5 flex flex-col space-y-4">
        <div className="card card-lg p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider t-body mb-3">Search Invoice</h2>
          <div className="flex bg-surface-2 border border-line rounded-xl px-3 py-2.5 text-xs items-center gap-2">
            <Search size={16} className="t-faint" />
            <input 
              type="text" 
              placeholder="Type student name or challan number..." 
              className="bg-transparent outline-none w-full t-body placeholder-faint font-semibold text-xs" 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              ref={searchInputRef}
            />
          </div>
        </div>

        <div className="card card-lg p-5 flex-1 min-h-[300px]">
          <h2 className="text-xs font-bold uppercase tracking-wider t-body mb-3">Matching Unpaid Invoices</h2>
          
          {loading ? (
            <div className="py-12 text-center flex flex-col items-center">
              <div className="animate-spin w-6 h-6 border-2 border-brand border-t-transparent rounded-full" />
              <p className="t-muted text-[10px] uppercase font-bold tracking-widest mt-2">Searching...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-16 text-center text-xs t-muted flex flex-col items-center justify-center h-full">
              <p className="font-semibold uppercase tracking-wider">No matching outstanding challans</p>
              <p className="text-[10px] t-faint mt-1">Type name or challan number to query</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {results.map(r => (
                <button
                  type="button"
                  key={r._id}
                  onClick={() => selectChallan(r)}
                  className={`w-full text-left p-3.5 rounded-xl border transition flex flex-col md:flex-row justify-between items-start md:items-center gap-2 ${
                    selectedChallan?._id === r._id 
                      ? 'border-brand bg-brand-soft t-brand' 
                      : 'border-line hover:bg-surface-2 bg-surface-3 t-body'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs truncate max-w-[200px]">{r.studentInfo?.fullName}</div>
                    <div className="text-[10px] t-muted font-mono mt-0.5">{r.challanNo} · Class {r.studentInfo?.class}</div>
                  </div>
                  <div className="text-right md:text-right flex md:flex-col justify-between w-full md:w-auto items-center md:items-end">
                    <span className="font-bold text-xs t-bad">{fmtPKR(r.balance)}</span>
                    <span className="text-[9px] t-faint font-semibold uppercase">{formatDueMonths(r.dueMonthRange, r.feeMonth, r.feeYear, r)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right panel: Embedded Details and Payment Wizard */}
      <div className="lg:col-span-7">
        {!selectedChallan ? (
          <div className="card card-lg p-16 text-center t-faint flex flex-col items-center justify-center min-h-[400px]">
            <Wallet size={48} className="t-muted mb-4 animate-pulse" />
            <p className="t-muted font-black uppercase tracking-wider text-sm">Select a Challan to pay</p>
            <p className="text-xs t-faint mt-1">Search and select a student above to load their payment slip details.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card card-lg p-6 space-y-5">
            <div className="flex justify-between items-start border-b border-line pb-4 flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold t-body">{student.fullName}</h3>
                <p className="text-[10px] t-muted font-medium mt-0.5">
                  s/o {student.fatherName} · Class {student.class} {student.section}
                </p>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-xs t-brand bg-brand-soft border border-brand-border px-2.5 py-1 rounded-lg">{selectedChallan.challanNo}</span>
                <p className="text-[9px] t-faint font-semibold uppercase tracking-wider mt-1">{formatDueMonths(selectedChallan.dueMonthRange, selectedChallan.feeMonth, selectedChallan.feeYear, selectedChallan)}</p>
              </div>
            </div>

            {/* Invoices details split */}
            <div className="surface-muted rounded-2xl p-5 space-y-2.5 text-xs">
              <h4 className="font-bold uppercase tracking-widest text-[9px] t-brand mb-1">Challan Summary</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <Row label="Tuition Fee" value={fmtPKR(selectedChallan.tuitionFee)} />
                <Row label="Transport Fee" value={fmtPKR(selectedChallan.transportFee)} />
                <Row label="Exam Fee" value={fmtPKR(selectedChallan.examFee)} />
                <Row label="Misc Fee" value={fmtPKR(selectedChallan.miscFee)} />
                <Row label="Previous Dues" value={fmtPKR(selectedChallan.previousDues)} tone="t-bad" />
                <Row label="Annual Fee" value={fmtPKR(selectedChallan.annualFee)} />
                <Row label="Previous Annual Dues" value={fmtPKR(selectedChallan.previousAnnualDues)} tone="t-bad" />
                <div className="col-span-2 divider my-1" />
                <Row label="Total Bill" value={fmtPKR(selectedChallan.totalAmount)} bold />
                <Row label="Already Paid" value={fmtPKR(selectedChallan.amountPaid)} tone="t-ok" />
                <Row label="Existing Discount" value={fmtPKR(selectedChallan.discount)} tone="t-brand" />
                <Row label="Remaining Balance" value={fmtPKR(selectedChallan.balance)} tone="t-bad" bold />
              </div>
            </div>

            {/* Split installment picker */}
            {canPayByMonth && (
              <div className="bg-surface-2 rounded-2xl p-4 border border-line">
                <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Installment Split (Number of Months)</label>
                <select onChange={e => selectMonths(e.target.value)} defaultValue=""
                  className="w-full text-xs font-semibold bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
                >
                  <option value="" disabled>Select months to pay…</option>
                  {Array.from({ length: remainingMonths }, (_, i) => i + 1).map(n => {
                    const thru = monthAt(startIdx + alreadyPaidMonths + n - 1);
                    const isAll = n === remainingMonths;
                    return (
                      <option key={n} value={n} className="bg-surface-2">
                        {n} Month{n > 1 ? 's' : ''} — settles through {thru}{isAll ? ' (clears months)' : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[10px] t-faint mt-1.5 font-medium leading-relaxed">
                  Tuition/recurring cost: {fmtPKR(recurring)} / month. This auto-fills the payment fields below.
                </p>
              </div>
            )}

            {/* Split outstanding and inputs */}
            <div className="space-y-4">
              <h4 className="font-bold uppercase tracking-widest text-[9px] t-brand border-b border-line pb-1.5">Payment Entry</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Receive Extra Discount</label>
                  <input 
                    type="number" 
                    min="0" 
                    max={monthlyDueRaw} 
                    value={form.discount}
                    onChange={e => handleDiscountChange(e.target.value)}
                    className="field font-bold text-xs"
                  />
                  <span className="text-[9px] t-faint font-semibold mt-1 block">Monthly Due: {fmtPKR(monthlyDueRaw)}</span>
                </div>
                
                <div>
                  <label className="label">
                    {hasAnnual ? 'Monthly Cash Paid' : 'Cash Received'}
                  </label>
                  <input 
                    type="number" 
                    min="0" 
                    max={monthlyDue} 
                    value={form.monthlyPay}
                    onChange={e => {
                      setEdited(prev => ({ ...prev, monthly: true }));
                      setForm({ ...form, monthlyPay: e.target.value });
                    }}
                    className="field font-bold text-xs"
                  />
                  <span className="text-[9px] t-faint font-semibold mt-1 block">Due: {fmtPKR(monthlyDue)}</span>
                </div>

                {hasAnnual && (
                  <div>
                    <label className="label">Pay Annual Share</label>
                    <input 
                      type="number" 
                      min="0" 
                      max={annualDue} 
                      value={form.annualPay}
                      onChange={e => setForm({ ...form, annualPay: e.target.value })}
                      className="field font-bold text-xs"
                    />
                    <span className="text-[9px] t-faint font-semibold mt-1 block">Due: {fmtPKR(annualDue)}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Payment Method</label>
                  <select 
                    value={form.paymentMethod}
                    onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                    className="field font-bold text-xs cursor-pointer"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank Deposit</option>
                    <option value="Online">Online Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="label">Remarks</label>
                  <input 
                    type="text" 
                    placeholder="Reference, receipt no..."
                    value={form.remarks}
                    onChange={e => setForm({ ...form, remarks: e.target.value })}
                    className="field text-xs font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Settles information */}
            {(settlesThrough || carriesFrom) && (
              <div className="bg-surface-2 rounded-2xl p-4 border border-line space-y-1">
                {settlesThrough && (
                  <div className="text-[10px] t-ok font-bold uppercase tracking-wider flex justify-between">
                    <span>Settles fee months through:</span>
                    <span>{settlesThrough}</span>
                  </div>
                )}
                {carriesFrom && (
                  <div className="text-[10px] t-bad font-bold uppercase tracking-wider flex justify-between">
                    <span>Remaining balance carries from:</span>
                    <span>{carriesFrom}</span>
                  </div>
                )}
              </div>
            )}

            {/* Summary of what is paying */}
            <div className="surface-muted rounded-2xl p-4 flex justify-between items-center flex-wrap gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider t-muted">Total Cash Received</span>
                <div className="text-xl font-black t-ok mt-0.5">{fmtPKR(payingTotal)}</div>
              </div>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => setSelectedChallan(null)}
                  className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider t-muted border border-line rounded-xl hover:bg-surface-2 transition"
                >
                  Clear / Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting || payingTotal <= 0}
                  className="btn btn-primary"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" size={14} /> Submitting
                    </>
                  ) : (
                    <>
                      <CreditCard size={14} /> Record Payment ({fmtPKR(payingTotal)})
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const Row = ({ label, value, tone = 't-muted', bold }) => (
  <div className="flex justify-between items-center gap-3 py-0.5">
    <span className="t-muted">{label}</span>
    <span className={`${bold ? 'font-bold t-body' : `font-semibold ${tone}`} text-right`}>{value}</span>
  </div>
);
