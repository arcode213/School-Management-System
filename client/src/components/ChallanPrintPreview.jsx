import { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { getFee } from '../api/fees';
import { Printer, X, RotateCcw, Save, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import ChallanOverlay from './ChallanOverlay';
import ModalPortal from './ModalPortal';
import { loadCalibration, saveCalibration, DEFAULT_CALIBRATION } from '../utils/challanCalibration';

const PX_PER_MM = 3.7795;

function NumberRow({ label, value, onChange, step = 1 }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs t-muted">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className="w-20 border rounded px-2 py-1 text-right"
      />
    </label>
  );
}

export default function ChallanPrintPreview({ feeId, feesList = [], initialIndex = 0, onClose }) {
  const [fee, setFee] = useState(null);
  const [calib, setCalib] = useState(loadCalibration);
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (feesList && feesList.length > 0) {
      if (feeId) {
        const found = feesList.findIndex((f) => String(f._id) === String(feeId));
        return found >= 0 ? found : 0;
      }
      return initialIndex >= 0 && initialIndex < feesList.length ? initialIndex : 0;
    }
    return 0;
  });

  const singlePrintRef = useRef(null);
  const allPrintRef = useRef(null);
  const stageRef = useRef(null);

  // Measure stage width for responsive preview scaling
  const [stageWidth, setStageWidth] = useState(560);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      setStageWidth(Math.max(240, entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fee]);

  // Load fee data based on current index or feeId
  useEffect(() => {
    if (feesList && feesList.length > 0 && feesList[currentIndex]) {
      const active = feesList[currentIndex];
      if (active.student?.fullName || active.studentInfo?.fullName) {
        setFee(active);
      } else if (active._id) {
        getFee(active._id)
          .then((res) => setFee(res.data))
          .catch(() => setFee(active));
      }
    } else if (feeId) {
      getFee(feeId)
        .then((res) => setFee(res.data))
        .catch(() => toast.error('Failed to load challan details'));
    }
  }, [feeId, feesList, currentIndex]);

  const printPageStyle = `
    @page { 
      size: ${calib.paperWidth}mm ${calib.paperHeight}mm; 
      margin: 0; 
    }
    @media print { 
      *, *:before, *:after { box-sizing: border-box !important; }
      html, body { 
        height: auto !important; 
        min-height: 100% !important;
        overflow: visible !important; 
        overflow-x: visible !important; 
        overflow-y: visible !important; 
        margin: 0 !important; 
        padding: 0 !important; 
        background: #fff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .challan-sheet { 
        page-break-after: always !important; 
        break-after: page !important; 
        page-break-inside: avoid !important; 
        break-inside: avoid !important; 
        display: block !important;
        position: relative !important;
        margin: 0 !important;
        box-shadow: none !important;
        overflow: hidden !important;
      }
      .challan-sheet:last-child { 
        page-break-after: auto !important; 
        break-after: auto !important; 
      }
    }
  `;

  const handlePrintSingle = useReactToPrint({
    contentRef: singlePrintRef,
    documentTitle: `Challan_${fee?.challanNo || ''}`,
    pageStyle: printPageStyle,
  });

  const handlePrintAll = useReactToPrint({
    contentRef: allPrintRef,
    documentTitle: 'Fee_Challans_Batch',
    pageStyle: printPageStyle,
  });

  const set = (key, val) => setCalib((c) => ({ ...c, [key]: val }));
  const num = (key, val) => set(key, val === '' ? '' : Number(val));

  const handleDragUpdate = (type, key, x, y) => {
    setCalib((prev) => {
      const updated = { ...prev };
      if (type === 'field') {
        const currentMap = updated.fieldMap || DEFAULT_CALIBRATION.fieldMap;
        updated.fieldMap = { ...currentMap, [key]: { ...currentMap[key], x, y } };
      }
      return updated;
    });
  };

  const persist = () => {
    saveCalibration(calib);
    toast.success('Print alignment saved');
  };
  const reset = () => setCalib({ ...DEFAULT_CALIBRATION });

  if (!fee) {
    return (
      <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55">
          <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
        </div>
      </ModalPortal>
    );
  }

  const previewScale = Math.min(560, stageWidth) / (calib.paperWidth * PX_PER_MM);
  const totalInList = feesList && feesList.length > 0 ? feesList.length : 1;
  const studentDisplayName = fee.studentInfo?.fullName || fee.student?.fullName || fee.studentName || 'Student';
  const classDisplayName = fee.studentInfo?.class || fee.student?.class || fee.className || '';

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex flex-col bg-surface-2 print:bg-solid print:static print:h-auto">
        {/* Top bar */}
        <div className="bg-surface-2 t-body p-3 sm:p-4 flex flex-wrap justify-between items-center gap-3 print:hidden shadow-md flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="font-semibold text-sm sm:text-base truncate">
              <span className="hidden sm:inline">Challan Print Preview &amp; Alignment</span>
              <span className="sm:hidden">Print &amp; Align</span>
            </h2>

            {totalInList > 1 && (
              <div className="flex items-center gap-1 bg-surface-3 px-2 py-1 rounded-lg border border-line text-xs">
                <button
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  disabled={currentIndex === 0}
                  className="p-1 t-muted hover:t-body disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Previous Challan"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="font-mono font-bold px-1 t-brand">
                  {currentIndex + 1} / {totalInList}
                </span>
                <button
                  onClick={() => setCurrentIndex((i) => Math.min(totalInList - 1, i + 1))}
                  disabled={currentIndex === totalInList - 1}
                  className="p-1 t-muted hover:t-body disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Next Challan"
                >
                  <ChevronRight size={14} />
                </button>
                <span className="hidden md:inline t-muted text-[11px] ml-1 truncate max-w-[150px]">
                  ({studentDisplayName}{classDisplayName ? ` - Cl. ${classDisplayName}` : ''})
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {totalInList > 1 && (
              <button
                onClick={handlePrintAll}
                className="bg-brand hover:bg-brand px-3 sm:px-4 py-2 rounded-lg flex items-center gap-1.5 text-xs sm:text-sm font-semibold shadow-sm transition cursor-pointer"
                title={`Print all ${totalInList} challans class-wise`}
              >
                <Layers size={15} /> Print All ({totalInList})
              </button>
            )}
            <button
              onClick={handlePrintSingle}
              className={`${totalInList > 1 ? 'btn btn-ghost' : 'bg-brand hover:bg-brand'} px-3 sm:px-4 py-2 rounded-lg flex items-center gap-1.5 text-xs sm:text-sm font-semibold shadow-sm transition cursor-pointer`}
              title="Print only this single voucher"
            >
              <Printer size={15} /> {totalInList > 1 ? 'Print Current' : 'Print Voucher'}
            </button>
            <button onClick={onClose} className="hover:bg-surface-3 p-2 rounded-lg cursor-pointer" aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden print:block">
          {/* Calibration panel */}
          <div className="w-full lg:w-72 flex-shrink-0 bg-solid border-b lg:border-b-0 lg:border-r border-line p-4 space-y-4 lg:overflow-y-auto print:hidden">
            <p className="text-xs t-faint leading-relaxed">
              Load your pre-printed challan paper in the printer. You can now <strong>drag the text values with your mouse</strong> directly in the preview to align them. Once aligned, click <strong>Save</strong>.
            </p>

            <div className="space-y-2">
              <h3 className="text-xs font-bold t-body uppercase">Paper Size (mm)</h3>
              <NumberRow label="Width" value={calib.paperWidth} onChange={(v) => num('paperWidth', v)} />
              <NumberRow label="Height" value={calib.paperHeight} onChange={(v) => num('paperHeight', v)} />
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold t-body uppercase">Fine Tuning</h3>
              <NumberRow label="Move right/left (X)" value={calib.offsetX} step={0.5} onChange={(v) => num('offsetX', v)} />
              <NumberRow label="Move down/up (Y)" value={calib.offsetY} step={0.5} onChange={(v) => num('offsetY', v)} />
              <NumberRow label="Overall scale %" value={calib.scale} onChange={(v) => num('scale', v)} />
              <NumberRow label="Font size %" value={calib.fontScale} step={5} onChange={(v) => num('fontScale', v)} />
            </div>

            <label className="flex items-center gap-2 text-xs t-muted cursor-pointer select-none">
              <input type="checkbox" checked={calib.printBackground} onChange={(e) => set('printBackground', e.target.checked)} />
              Also print the form outline (plain paper)
            </label>

            <div className="flex gap-2 pt-2">
              <button onClick={persist} className="flex-1 flex items-center justify-center gap-1.5 bg-ok hover:bg-ok t-body text-xs rounded-lg py-2 font-semibold cursor-pointer">
                <Save size={14} /> Save
              </button>
              <button onClick={reset} className="flex items-center justify-center gap-1.5 bg-surface-2 hover:bg-surface-3 t-body text-xs rounded-lg py-2 px-3 cursor-pointer">
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </div>

          {/* On-screen preview */}
          <div ref={stageRef} className="flex-1 min-w-0 overflow-auto p-4 sm:p-8 flex justify-center items-start print:hidden">
            <div
              style={{
                width: `${calib.paperWidth * PX_PER_MM * previewScale}px`,
                height: `${calib.paperHeight * PX_PER_MM * previewScale}px`,
              }}
              className="shadow-xl flex-shrink-0"
            >
              <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                <ChallanOverlay fee={fee} calib={calib} showBackground onDragUpdate={handleDragUpdate} />
              </div>
            </div>
          </div>
        </div>

        {/* Off-screen Print Container for Single Challan */}
        <div style={{ position: 'fixed', top: '-10000px', left: '-10000px', width: `${calib.paperWidth}mm`, opacity: 0, pointerEvents: 'none' }}>
          <div ref={singlePrintRef}>
            <ChallanOverlay fee={fee} calib={calib} showBackground={calib.printBackground} />
          </div>
        </div>

        {/* Off-screen Print Container for All Challans in Batch */}
        <div style={{ position: 'fixed', top: '-10000px', left: '-10000px', width: `${calib.paperWidth}mm`, opacity: 0, pointerEvents: 'none' }}>
          <div ref={allPrintRef}>
            {(feesList && feesList.length > 0 ? feesList : [fee]).map((f) => (
              <ChallanOverlay key={f._id || f.challanNo} fee={f} calib={calib} showBackground={calib.printBackground} />
            ))}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
