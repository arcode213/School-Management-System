import { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { getFee } from '../api/fees';
import { Printer, X, RotateCcw, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import ChallanOverlay from './ChallanOverlay';
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55">
        <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  const previewScale = 560 / (calib.paperWidth * PX_PER_MM);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-2 print:bg-solid">
      {/* Top bar */}
      <div className="bg-surface-2 t-body p-4 flex justify-between items-center print:hidden shadow-md">
        <h2 className="font-semibold">Challan Print Preview & Alignment</h2>
        <div className="flex gap-3">
          <button onClick={handlePrint} className="bg-brand hover:bg-brand px-4 py-2 rounded flex items-center gap-2 text-sm">
            <Printer size={16} /> Print
          </button>
          <button onClick={onClose} className="hover:bg-surface-3 p-2 rounded"><X size={20} /></button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden print:block">
        {/* Calibration panel */}
        <div className="w-72 bg-solid border-r border-line p-4 space-y-4 overflow-y-auto print:hidden">
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
        <div className="flex-1 overflow-auto p-8 flex justify-center items-start print:hidden">
          <div
            style={{
              width: `${calib.paperWidth * PX_PER_MM * previewScale}px`,
              height: `${calib.paperHeight * PX_PER_MM * previewScale}px`,
            }}
            className="shadow-xl"
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
  );
}
