import { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { getFee } from '../api/fees';
import { Printer, X, RotateCcw, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import ChallanOverlay from './ChallanOverlay';
import ModalPortal from './ModalPortal';
import { loadCalibration, saveCalibration, DEFAULT_CALIBRATION } from '../utils/challanCalibration';

const PX_PER_MM = 3.7795;

// Defined at module level so editing one input doesn't remount (and unfocus) the others.
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

export default function ChallanPrintPreview({ feeId, onClose }) {
  const [fee, setFee] = useState(null);
  const [calib, setCalib] = useState(loadCalibration);
  const printRef = useRef();
  const stageRef = useRef(null);

  // The preview used to be drawn at a fixed 560px, which on a phone put the
  // right-hand side of the challan off-screen — and dragging a field to align it
  // is impossible if you cannot see where it lands. The paper is now scaled to
  // whatever room the stage actually has, never above the 560px it was designed
  // at on a laptop.
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

  useEffect(() => {
    if (feeId) {
      getFee(feeId).then((res) => setFee(res.data)).catch(() => toast.error('Failed to load challan details'));
    }
  }, [feeId]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Challan_${fee?.challanNo || ''}`,
    pageStyle: `@page { size: ${calib.paperWidth}mm ${calib.paperHeight}mm; margin: 0; }
                @media print { body { margin: 0; } }`,
  });

  const set = (key, val) => setCalib((c) => ({ ...c, [key]: val }));
  const num = (key, val) => set(key, val === '' ? '' : Number(val));

  const handleDragUpdate = (type, key, x, y, isFinal = false) => {
    setCalib(prev => {
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

  return (
    /* Portalled to <body>: every page wrapper carries `animate-fade-in-up`, whose
       lingering transform makes itself the containing block for `position: fixed`
       children. Left in place, this workspace was measured against the scrolled
       content area instead of the screen — it opened offset below the header and
       grew to its own content height rather than filling the viewport. */
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-2 print:bg-solid print:static print:h-auto">
      {/* Top bar */}
      <div className="bg-surface-2 t-body p-3 sm:p-4 flex justify-between items-center gap-3 print:hidden shadow-md flex-shrink-0">
        <h2 className="font-semibold text-sm sm:text-base truncate">
          <span className="hidden sm:inline">Challan Print Preview &amp; Alignment</span>
          <span className="sm:hidden">Print &amp; Align</span>
        </h2>
        <div className="flex gap-2 sm:gap-3 flex-shrink-0">
          <button onClick={handlePrint} className="bg-brand hover:bg-brand px-4 py-2 rounded flex items-center gap-2 text-sm">
            <Printer size={16} /> Print
          </button>
          <button onClick={onClose} className="hover:bg-surface-3 p-2 rounded" aria-label="Close"><X size={20} /></button>
        </div>
      </div>

      {/* Below lg the alignment controls sit above the preview and the whole
          workspace scrolls as one column — a 288px panel beside a paper preview
          leaves neither usable on a phone. */}
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

          <label className="flex items-center gap-2 text-xs t-muted">
            <input type="checkbox" checked={calib.printBackground} onChange={(e) => set('printBackground', e.target.checked)} />
            Also print the form outline (plain paper)
          </label>

          <div className="flex gap-2 pt-2">
            <button onClick={persist} className="flex-1 flex items-center justify-center gap-1.5 bg-ok hover:bg-ok t-body text-xs rounded-lg py-2">
              <Save size={14} /> Save
            </button>
            <button onClick={reset} className="flex items-center justify-center gap-1.5 bg-surface-2 hover:bg-surface-3 t-body text-xs rounded-lg py-2 px-3">
              <RotateCcw size={14} /> Reset
            </button>
          </div>
        </div>

        {/* On-screen preview (form shown as guide) */}
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

      {/* Hidden full-size print target */}
      <div className="hidden print:block">
        <div ref={printRef}>
          <ChallanOverlay fee={fee} calib={calib} showBackground={calib.printBackground} />
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
