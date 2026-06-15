import { useState, useEffect, useRef, useCallback } from 'react';
import { getFees } from '../api/fees';
import { getClasses } from '../api/students';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import { Printer, Search, FileText } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// The printable component
const PrintableChallan = ({ fee, index }) => {
  if (!fee || !fee.studentInfo) return null;
  const s = fee.studentInfo;
  
  const DueDate = new Date();
  DueDate.setDate(DueDate.getDate() + 10); // arbitrary due date

  const ChallanCopy = ({ copyName }) => (
    <div className="flex-1 border-r-2 border-dashed border-slate-300 pr-4 last:border-r-0 last:pr-0 pl-4 first:pl-0">
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold uppercase tracking-wider">XYZ School System</h2>
        <p className="text-xs uppercase font-semibold text-slate-500 mt-1 bg-slate-100 py-1">{copyName}</p>
      </div>

      <div className="text-xs space-y-1.5 mb-4">
        <p className="flex justify-between"><span>Challan No:</span> <span className="font-bold">{fee.receiptNumber}</span></p>
        <p className="flex justify-between"><span>Month:</span> <span className="font-bold">{fee.feeMonth} {fee.feeYear}</span></p>
        <p className="flex justify-between"><span>Due Date:</span> <span className="font-bold">{DueDate.toLocaleDateString()}</span></p>
      </div>

      <div className="border border-slate-800 rounded-lg p-2 text-xs space-y-1 mb-4 bg-slate-50">
        <p className="font-bold text-sm mb-1">{s.fullName}</p>
        <p>Father: {s.fatherName || '—'}</p>
        <p>Class: {s.class} {s.section || ''}</p>
        <p>Roll No: {s.rollNumber || '—'}</p>
        <p>Student ID: {s.studentId}</p>
      </div>

      <table className="w-full text-xs mb-4">
        <thead>
          <tr className="border-b border-slate-800"><th className="text-left py-1">Particulars</th><th className="text-right py-1">Amount (Rs)</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          <tr><td className="py-1.5">Tuition Fee</td><td className="text-right py-1.5">{fee.tuitionFee?.toLocaleString()}</td></tr>
          {fee.examFee > 0 && <tr><td className="py-1.5">Exam Fee</td><td className="text-right py-1.5">{fee.examFee.toLocaleString()}</td></tr>}
          {fee.transportFee > 0 && <tr><td className="py-1.5">Transport Fee</td><td className="text-right py-1.5">{fee.transportFee.toLocaleString()}</td></tr>}
          {fee.otherFee > 0 && <tr><td className="py-1.5">Other Fee</td><td className="text-right py-1.5">{fee.otherFee.toLocaleString()}</td></tr>}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-800 font-bold text-sm">
            <td className="py-2">Total Amount</td>
            <td className="text-right py-2">{fee.totalAmount?.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-8 text-xs text-center space-y-6">
        <div className="border-t border-slate-800 pt-1 inline-block px-4">Cashier / Officer Sign</div>
        <p className="text-[10px] text-slate-500 italic">Valid only when stamped & signed by bank.</p>
      </div>
    </div>
  );

  return (
    <div className="bg-white text-slate-900 w-full p-4 page-break-after-always">
      <div className="flex justify-between w-full mx-auto" style={{ gap: '1rem' }}>
        <ChallanCopy copyName="Bank Copy" />
        <ChallanCopy copyName="School Copy" />
        <ChallanCopy copyName="Student Copy" />
      </div>
    </div>
  );
};

export default function ChallansPage() {
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);

  // Filters
  const [filterMonth, setFilterMonth] = useState(MONTHS[new Date().getMonth()]);
  const [filterClass, setFilterClass] = useState('');
  
  // Printing state
  const [printData, setPrintData] = useState([]);
  const printRef = useRef();

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Fee_Challans',
  });

  const fetchFees = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch up to 100 unpaid/partial fees for the selected criteria to print
      const { data } = await getFees({ feeMonth: filterMonth, class: filterClass, limit: 100 });
      // Only keep unpaid/partial
      const unpaids = data.fees.filter(f => f.status !== 'Paid');
      setFees(unpaids);
    } catch {
      toast.error('Failed to load fees');
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterClass]);

  useEffect(() => { fetchFees(); }, [fetchFees]);
  useEffect(() => { getClasses().then(r => setClasses(r.data)).catch(() => {}); }, []);

  const printSingle = (fee) => {
    setPrintData([fee]);
    setTimeout(handlePrint, 100);
  };

  const printAll = () => {
    if (fees.length === 0) return toast.error('No challans to print');
    setPrintData(fees);
    setTimeout(handlePrint, 100);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Print Challans</h1>
          <p className="text-slate-400 text-sm mt-0.5">Generate printable fee vouchers</p>
        </div>
        <button onClick={printAll} disabled={fees.length === 0}
          className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 transition shadow-sm font-medium disabled:opacity-50">
          <Printer size={14} /> Print All ({fees.length})
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex gap-3">
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1">
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>
        ) : fees.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center">
            <FileText size={40} className="text-slate-300 mb-3" />
            <p>No unpaid fees found for this criteria.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Receipt No.</th>
                <th className="text-left px-4 py-3">Student</th>
                <th className="text-left px-4 py-3">Class</th>
                <th className="text-left px-4 py-3">Amount Due</th>
                <th className="text-left px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {fees.map(f => (
                <tr key={f._id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-mono text-xs">{f.receiptNumber}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{f.studentInfo?.fullName}</td>
                  <td className="px-4 py-3 text-slate-600">{f.studentInfo?.class}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">Rs. {f.totalAmount - (f.paidAmount || 0) - (f.discount || 0)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => printSingle(f)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 text-slate-700 hover:bg-blue-600 hover:text-white rounded-lg transition">
                      <Printer size={12} /> Print
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Hidden Print Container */}
      <div className="hidden">
        <div ref={printRef} className="print-container">
          <style>{`@media print { @page { size: landscape; margin: 10mm; } .page-break-after-always { page-break-after: always; } }`}</style>
          {printData.map((f, i) => <PrintableChallan key={f._id} fee={f} index={i} />)}
        </div>
      </div>
    </div>
  );
}
