import { COPY_OFFSET_X, DEFAULT_CALIBRATION } from '../utils/challanCalibration';
import { MONTHS, parseStartMonth } from '../utils/feeMonths';

const fmt = (n) => Number(n || 0).toLocaleString();
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '');
const monthBefore = (m) => MONTHS[(MONTHS.indexOf(m) + 11) % 12];

// Accepts the fee object from either getFee (fee.student.*) or the getFees
// aggregate (fee.studentInfo.*) and returns a flat shape.
const normalize = (fee) => {
  const s = fee.student || fee.studentInfo || {};

  // Current month net charges (this month only — arrears handled separately).
  const currentAmount =
    (fee.tuitionFee || 0) + (fee.examFee || 0) + (fee.transportFee || 0) +
    (fee.miscFee || 0) + (fee.lateFine || 0) - (fee.discount || 0);

  // Arrears = dues carried in from earlier unpaid months. Derive the month
  // range they cover: from the challan's start month up to the month BEFORE
  // the current fee month (e.g. current "April" -> arrears "February - March").
  const arrearsAmount = fee.previousDues || 0;
  let arrearsLabel = 'Arrears';
  if (arrearsAmount > 0) {
    const start = parseStartMonth(fee.dueMonthRange, fee.feeMonth);
    if (start && start !== fee.feeMonth && MONTHS.includes(fee.feeMonth)) {
      const end = monthBefore(fee.feeMonth);
      arrearsLabel = `Arrears (${start === end ? start : `${start} - ${end}`})`;
    }
  }

  const total = currentAmount + arrearsAmount;

  return {
    challanNo: fee.challanNo,
    issueDate: fmtDate(fee.issueDate),
    dueDate: fmtDate(fee.dueDate),
    studentName: s.fullName || '',
    fatherName: s.fatherName || '',
    className: s.class || '',
    section: s.section || '',
    month: `${fee.dueMonthRange || fee.feeMonth} ${fee.feeYear}`,

    // Fee summary: current month, arrears (optional) and grand total.
    currentLabel: `${fee.feeMonth} ${fee.feeYear}`,
    currentAmount,
    hasArrears: arrearsAmount > 0,
    arrearsLabel,
    arrearsAmount,
    total,
  };
};

// One printed copy (left = Student, right = School). `dx` shifts the right copy.
function Copy({ d, dx, fontMm, calib, onDragUpdate }) {
  const at = (x, y) => ({ position: 'absolute', left: `${x + dx}%`, top: `${y}%` });
  const textStyle = (align) => ({
    fontSize: `${fontMm}mm`,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    transform: align === 'right' ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
    fontWeight: 600,
    color: '#000',
  });

  const fieldMap = calib?.fieldMap || DEFAULT_CALIBRATION.fieldMap;

  const Field = ({ k, value }) => {
    const f = fieldMap[k];
    if (!f) return null;

    const isDraggable = onDragUpdate && dx === 0;

    const handlePointerDown = (e) => {
      if (!isDraggable) return;
      e.stopPropagation();
      e.preventDefault();

      let startX = e.clientX;
      let startY = e.clientY;
      let currentX = f.x;
      let currentY = f.y;

      const sheet = e.currentTarget.closest('.challan-sheet');
      if (!sheet) return;
      const rect = sheet.getBoundingClientRect();
      const sheetWidthPx = rect.width;
      const sheetHeightPx = rect.height;

      const onPointerMove = (moveEv) => {
        const pctX = ((moveEv.clientX - startX) / sheetWidthPx) * 100;
        const pctY = ((moveEv.clientY - startY) / sheetHeightPx) * 100;
        onDragUpdate('field', k, currentX + pctX, currentY + pctY);
      };

      const onPointerUp = (upEv) => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        const pctX = ((upEv.clientX - startX) / sheetWidthPx) * 100;
        const pctY = ((upEv.clientY - startY) / sheetHeightPx) * 100;
        onDragUpdate('field', k, currentX + pctX, currentY + pctY, true);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };

    return (
      <span 
        onPointerDown={handlePointerDown}
        style={{ 
          ...at(f.x, f.y), 
          ...textStyle(f.align),
          cursor: isDraggable ? 'move' : 'default',
          outline: isDraggable ? '1px dotted rgba(59, 130, 246, 0.5)' : 'none',
          padding: isDraggable ? '2px' : '0',
          background: isDraggable ? 'rgba(255, 255, 255, 0.4)' : 'transparent',
          zIndex: isDraggable ? 10 : 1,
        }}
        title={isDraggable ? `Drag to move ${k}` : undefined}
      >
        {value}
      </span>
    );
  };

  return (
    <>
      <Field k="challanNo" value={d.challanNo} />
      <Field k="issueDate" value={d.issueDate} />
      <Field k="studentName" value={d.studentName} />
      <Field k="fatherName" value={d.fatherName} />
      <Field k="className" value={d.className} />
      <Field k="section" value={d.section} />
      <Field k="dueDate" value={d.dueDate} />
      <Field k="month" value={d.month} />

      {/* Fee summary — current month, arrears, total. Each label and amount is
          an independently draggable field (see fieldMap in challanCalibration). */}
      <Field k="sumCurrentLabel" value={d.currentLabel} />
      <Field k="sumCurrentAmount" value={fmt(d.currentAmount)} />
      {d.hasArrears && <Field k="sumArrearsLabel" value={d.arrearsLabel} />}
      {d.hasArrears && <Field k="sumArrearsAmount" value={fmt(d.arrearsAmount)} />}
      <Field k="sumTotalLabel" value="Total" />
      <Field k="sumTotalAmount" value={fmt(d.total)} />
    </>
  );
}

// Renders one full challan sheet (both copies) sized to the physical paper.
export default function ChallanOverlay({ fee, calib, showBackground = false, onDragUpdate }) {
  if (!fee) return null;
  const d = normalize(fee);
  // Base text size scales with the sheet width; user can fine-tune via fontScale.
  const fontMm = ((calib.paperWidth * 0.024) * (calib.fontScale || 100)) / 100;

  return (
    <div
      className="challan-sheet"
      style={{
        position: 'relative',
        width: `${calib.paperWidth}mm`,
        height: `${calib.paperHeight}mm`,
        background: '#fff',
        overflow: 'hidden',
        userSelect: onDragUpdate ? 'none' : 'auto', // prevent text selection during drag
      }}
    >
      {showBackground && (
        <img
          src="/challan.jpeg"
          alt="challan form"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none' }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${calib.offsetX}mm, ${calib.offsetY}mm) scale(${(calib.scale || 100) / 100})`,
          transformOrigin: 'top left',
        }}
      >
        <Copy d={d} dx={0} fontMm={fontMm} calib={calib} onDragUpdate={onDragUpdate} />
        <Copy d={d} dx={COPY_OFFSET_X} fontMm={fontMm} calib={calib} onDragUpdate={onDragUpdate} />
      </div>
    </div>
  );
}
