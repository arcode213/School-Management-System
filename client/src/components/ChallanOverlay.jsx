import { COPY_OFFSET_X, DEFAULT_CALIBRATION } from '../utils/challanCalibration';
import { MONTHS, parseStartMonth } from '../utils/feeMonths';

const fmt = (n) => Number(n || 0).toLocaleString();
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '');
const monthBefore = (m) => MONTHS[(MONTHS.indexOf(m) + 11) % 12];

// Accepts the fee object from either getFee (fee.student.*) or the getFees
// aggregate (fee.studentInfo.*) and returns a flat shape.
const normalize = (fee) => {
  const s = (fee.student && typeof fee.student === 'object' && (fee.student.fullName || fee.student.name))
    ? fee.student
    : (fee.studentInfo && typeof fee.studentInfo === 'object')
      ? fee.studentInfo
      : (fee.student && typeof fee.student === 'object')
        ? fee.student
        : {};

  // Current month net charges (this month only — arrears handled separately).
  const currentAmount =
    (fee.tuitionFee || 0) + (fee.examFee || 0) + (fee.transportFee || 0) +
    (fee.miscFee || 0) + (fee.lateFine || 0) - (fee.discount || 0);

  // Arrears = dues carried in from earlier unpaid months. The months they cover are
  // recorded on the challan when it is generated (arrearsFromMonth/arrearsToMonth),
  // so the printed period is exactly the period that was billed.
  //
  // Challans created before those fields existed fall back to the old inference:
  // the arrears run from the range's start month up to the month BEFORE the current
  // fee month, since feeMonth's own charges are billed on the "current" line
  // (e.g. current "April" -> arrears "February - March"). An arrears-only challan
  // (an opening balance from admission/import, with no current charges at all) is
  // the exception — there is no current line to exclude, so its arrears cover the
  // whole labelled range including feeMonth.
  const arrearsAmount = fee.previousDues || 0;
  const arrearsOnly = currentAmount === 0 && arrearsAmount > 0;
  let arrearsLabel = 'Arrears';
  if (arrearsAmount > 0) {
    let start = null;
    let end = null;

    if (MONTHS.includes(fee.arrearsFromMonth)) {
      start = fee.arrearsFromMonth;
      end = MONTHS.includes(fee.arrearsToMonth) ? fee.arrearsToMonth : start;
    } else if (MONTHS.includes(fee.feeMonth)) {
      const inferredStart = parseStartMonth(fee.dueMonthRange, fee.feeMonth);
      if (inferredStart && (arrearsOnly || inferredStart !== fee.feeMonth)) {
        start = inferredStart;
        end = arrearsOnly ? fee.feeMonth : monthBefore(fee.feeMonth);
      }
    }

    if (start) arrearsLabel = `Arrears (${start === end ? start : `${start} - ${end}`})`;
  }

  // Annual fee is its own bucket, kept apart from the recurring monthly charges so
  // the current-year and carried-forward annual amounts print as separate lines.
  const annualAmount = fee.annualFee || 0;
  const prevAnnualAmount = fee.previousAnnualDues || 0;

  const total = currentAmount + arrearsAmount + annualAmount + prevAnnualAmount;

  const studentName = s.fullName || s.name || '';
  const fatherName = s.fatherName || '';
  const className = s.class || s.className || fee.academicInfo?.className || '';
  const section = s.section || fee.academicInfo?.section || '';

  return {
    challanNo: fee.challanNo,
    issueDate: fmtDate(fee.issueDate),
    dueDate: fmtDate(fee.dueDate),
    studentName,
    fatherName,
    className,
    section,
    month: fee.dueMonthRange && (fee.dueMonthRange.includes('-') || fee.dueMonthRange.toLowerCase().includes('to') || /\d/.test(fee.dueMonthRange))
      ? fee.dueMonthRange
      : `${fee.dueMonthRange || fee.feeMonth} ${fee.feeYear}`,

    // Fee summary. Only the current-month line and the total always print; the
    // arrears and annual lines appear only when there is an amount for them.
    currentLabel: `${fee.feeMonth} ${fee.feeYear}`,
    currentAmount,

    hasArrears: arrearsAmount > 0,
    arrearsLabel,
    arrearsAmount,

    hasAnnual: annualAmount > 0,
    annualLabel: 'Annual Fee',
    annualAmount,

    hasPrevAnnual: prevAnnualAmount > 0,
    prevAnnualLabel: 'Previous Annual Fee',
    prevAnnualAmount,

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

      {/* Fee summary — current month fee, previous arrears, current annual fee,
          previous annual fee, then the total. Each label and amount is an
          independently draggable field (see fieldMap in challanCalibration). */}
      <Field k="sumCurrentLabel" value={d.currentLabel} />
      <Field k="sumCurrentAmount" value={fmt(d.currentAmount)} />
      {d.hasArrears && <Field k="sumArrearsLabel" value={d.arrearsLabel} />}
      {d.hasArrears && <Field k="sumArrearsAmount" value={fmt(d.arrearsAmount)} />}
      {d.hasAnnual && <Field k="sumAnnualLabel" value={d.annualLabel} />}
      {d.hasAnnual && <Field k="sumAnnualAmount" value={fmt(d.annualAmount)} />}
      {d.hasPrevAnnual && <Field k="sumPrevAnnualLabel" value={d.prevAnnualLabel} />}
      {d.hasPrevAnnual && <Field k="sumPrevAnnualAmount" value={fmt(d.prevAnnualAmount)} />}
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
