import { useState, useEffect, useRef, useCallback } from 'react';
import { getFees } from '../api/fees';
import { getClasses } from '../api/students';
import { useAppContext } from '../context/AppContext';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import { Printer, FileText, SlidersHorizontal, Layers, Landmark } from 'lucide-react';
import ChallanOverlay from '../components/ChallanOverlay';
import ChallanPrintPreview from '../components/ChallanPrintPreview';
import { loadCalibration } from '../utils/challanCalibration';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function ChallansPage() {
  const { currentCampus, currentSession } = useAppContext();
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

  // Re-read saved alignment whenever the preview dialog closes
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
      const { data } = await getFees({
        feeMonth: filterMonth, class: filterClass, limit: 100, excludeOpening: true,
      });
      const printable = data.fees.filter(f => f.status !== 'Paid' && !f.studentInfo?.isFreeship);
      setFees(printable);
    } catch {
      toast.error('Failed to load fees');
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterClass]);

  useEffect(() => {
    if (currentCampus && currentSession) fetchFees();
  }, [fetchFees, currentCampus, currentSession]);
  useEffect(() => {
    if (currentCampus && currentSession) getClasses().then(r => setClasses(r.data)).catch(() => {});
  }, [currentCampus, currentSession]);

  const printSingle = (fee) => {
    setPrintData([fee]);
    setTimeout(handlePrint, 100);
  };

  const printAll = () => {
    if (fees.length === 0) return toast.error('No challans to print');
    setPrintData(fees);
    setTimeout(handlePrint, 100);
  };

  const fmtRs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;
  const totalPrintValue = fees.reduce((sum, f) => sum + (f.balance || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold t-body tracking-tight uppercase">Print Challans</h1>
          <p className="t-muted text-xs font-semibold mt-1 uppercase tracking-wider">Generate and align printable student fee vouchers</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={() => fees[0] ? setPreviewId(fees[0]._id) : toast.error('No challans to align')}
            className="btn btn-ghost"
          >
            <SlidersHorizontal size={14} /> Preview & Align
          </button>
          <button onClick={printAll} disabled={fees.length === 0}
            className="btn btn-primary disabled:opacity-50"
          >
            <Printer size={14} /> Print All ({fees.length})
          </button>
        </div>
      </div>

      {/* Screen Analytics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-blue-600/80 to-blue-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Layers className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Vouchers in Queue</p>
            <p className="text-xl sm:text-2xl font-extrabold t-brand mt-0.5 tracking-tight break-words">{fees.length} printable</p>
            <p className="t-faint text-xs mt-1 font-medium">Unpaid and active vouchers</p>
          </div>
        </div>

        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-emerald-600/80 to-emerald-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Landmark className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Queue Value</p>
            <p className="text-xl sm:text-2xl font-extrabold t-ok mt-0.5 tracking-tight break-words">{fmtRs(totalPrintValue)}</p>
            <p className="t-faint text-xs mt-1 font-medium">Outstanding sum in active queue</p>
          </div>
        </div>

        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-purple-600/80 to-purple-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Printer className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Print Limit status</p>
            <p className="text-xl sm:text-2xl font-extrabold t-brand mt-0.5 tracking-tight break-words">
              {fees.length >= 100 ? 'Queue Capped' : 'Uncapped'}
            </p>
            <p className="t-faint text-xs mt-1 font-medium">
              {fees.length >= 100 ? 'Vite printing queue set at 100 limit' : 'All filtered vouchers load correctly'}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card card-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer flex-1">
          {MONTHS.map(m => <option key={m} className="bg-surface-2">{m}</option>)}
        </select>
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer flex-1">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c} value={c} className="bg-surface-2">Class {c}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="card card-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full mx-auto" />
            <p className="t-muted text-xs mt-3 uppercase font-bold tracking-wider">Synchronizing print queue...</p>
          </div>
        ) : fees.length === 0 ? (
          <div className="p-16 text-center t-faint flex flex-col items-center">
            <FileText size={40} className="t-muted mb-3" />
            <p className="t-muted font-bold uppercase tracking-wider text-sm">No printable challans found</p>
            <p className="text-xs t-faint mt-1">Adjust filters or select class. Freeship students are automatically excluded.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-xs text-left rtable">
              <thead className="bg-surface-2 border-b border-line t-muted uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-4">Challan No.</th>
                  <th className="px-5 py-4">Student</th>
                  <th className="px-5 py-4">Class</th>
                  <th className="px-5 py-4">Amount Due</th>
                  <th className="px-5 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line t-muted">
                {fees.map(f => (
                  <tr key={f._id} className="hover:bg-surface-2 transition group">
                    <td data-label="Challan No." className="px-5 py-4 font-mono font-bold t-brand">{f.challanNo}</td>
                    <td data-label="Student" className="px-5 py-4 md:whitespace-nowrap">
                      <div>
                        <div className="font-bold t-body">{f.studentInfo?.fullName}</div>
                        {f.studentInfo?.fatherName && (
                          <div className="text-[10px] t-muted mt-0.5">s/o {f.studentInfo.fatherName}</div>
                        )}
                      </div>
                    </td>
                    <td data-label="Class" className="px-5 py-4 t-muted font-medium">Class {f.studentInfo?.class}</td>
                    <td data-label="Amount Due" className="px-5 py-4 font-black t-body">Rs. {(f.balance ?? 0).toLocaleString()}</td>
                    <td data-actions="" className="px-5 py-4">
                      <div className="row-actions">
                        <button onClick={() => setPreviewId(f._id)} className="btn btn-ghost gap-1 px-3 py-1.5 text-[10px]">
                          <SlidersHorizontal size={12} /> Preview
                        </button>
                        <button onClick={() => printSingle(f)} className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-brand-soft hover:bg-brand hover:t-body t-brand border border-brand-border rounded-xl transition">
                          <Printer size={12} /> Print
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hidden Print Container */}
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
