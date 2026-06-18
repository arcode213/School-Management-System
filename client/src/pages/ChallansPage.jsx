import { useState, useEffect, useRef, useCallback } from 'react';
import { getFees } from '../api/fees';
import { getClasses } from '../api/students';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import { Printer, FileText, SlidersHorizontal } from 'lucide-react';
import ChallanOverlay from '../components/ChallanOverlay';
import ChallanPrintPreview from '../components/ChallanPrintPreview';
import { loadCalibration } from '../utils/challanCalibration';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function ChallansPage() {
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);

  // Filters
  const [filterMonth, setFilterMonth] = useState(MONTHS[new Date().getMonth()]);
  const [filterClass, setFilterClass] = useState('');
  
  // Printing state
  const [printData, setPrintData] = useState([]);
  const [calib, setCalib] = useState(loadCalibration);
  const [previewId, setPreviewId] = useState(null);
  const printRef = useRef();

  // Re-read saved alignment whenever the preview dialog closes (it may have changed it).
  useEffect(() => { if (!previewId) setCalib(loadCalibration()); }, [previewId]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Fee_Challans',
    pageStyle: `@page { size: ${calib.paperWidth}mm ${calib.paperHeight}mm; margin: 0; }
                @media print { body { margin: 0; } .challan-sheet { page-break-after: always; } }`,
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
        <div className="flex gap-2">
          <button onClick={() => fees[0] ? setPreviewId(fees[0]._id) : toast.error('No challans to align')}
            className="flex items-center gap-2 text-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl px-4 py-2 transition shadow-sm font-medium">
            <SlidersHorizontal size={14} /> Preview & Align
          </button>
          <button onClick={printAll} disabled={fees.length === 0}
            className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 transition shadow-sm font-medium disabled:opacity-50">
            <Printer size={14} /> Print All ({fees.length})
          </button>
        </div>
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
                <th className="text-left px-4 py-3">Challan No.</th>
                <th className="text-left px-4 py-3">Student</th>
                <th className="text-left px-4 py-3">Class</th>
                <th className="text-left px-4 py-3">Amount Due</th>
                <th className="text-left px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {fees.map(f => (
                <tr key={f._id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-mono text-xs">{f.challanNo}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{f.studentInfo?.fullName}</td>
                  <td className="px-4 py-3 text-slate-600">{f.studentInfo?.class}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">Rs. {(f.balance ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => setPreviewId(f._id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition">
                        <SlidersHorizontal size={12} /> Preview
                      </button>
                      <button onClick={() => printSingle(f)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 text-slate-700 hover:bg-blue-600 hover:text-white rounded-lg transition">
                        <Printer size={12} /> Print
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Hidden Print Container — values only, overlaid on the pre-printed challan */}
      <div className="hidden print:block">
        <div ref={printRef}>
          {printData.map((f) => (
            <ChallanOverlay key={f._id} fee={f} calib={calib} showBackground={calib.printBackground} />
          ))}
        </div>
      </div>

      {previewId && <ChallanPrintPreview feeId={previewId} onClose={() => setPreviewId(null)} />}
    </div>
  );
}
