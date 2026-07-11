import { COPY_OFFSET_X, DEFAULT_CALIBRATION } from '../utils/challanCalibration';

const fmt = (n) => Number(n || 0).toLocaleString();
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '');

// Accepts the fee object from either getFee (fee.student.*) or the getFees
// aggregate (fee.studentInfo.*) and returns a flat shape.
const normalize = (fee) => {
  const s = fee.student || fee.studentInfo || {};
  return {
    challanNo: fee.challanNo,
    issueDate: fmtDate(fee.issueDate),
    dueDate: fmtDate(fee.dueDate),
    studentName: s.fullName || '',
    fatherName: s.fatherName || '',
    className: s.class || '',
    section: s.section || '',
    month: `${fee.dueMonthRange || fee.feeMonth} ${fee.feeYear}`,
    items: [
      { title: 'Tuition Fee', amount: fee.tuitionFee },
      { title: 'Transport Fee', amount: fee.transportFee },
      { title: 'Exam Fee', amount: fee.examFee },
      { title: 'Misc Charges', amount: fee.miscFee },
      { title: 'Previous Arrears', amount: fee.previousDues },
      { title: 'Discount', amount: fee.discount ? -fee.discount : 0 },
    ].filter((i) => i.amount),
    netByDue: (fee.totalAmount || 0) - (fee.lateFine || 0),
    netAfterDue: fee.totalAmount || 0,
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
  const tableMap = calib?.tableMap || DEFAULT_CALIBRATION.tableMap;

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

      {/* Fee table line items */}
      {d.items.slice(0, tableMap.maxRows).map((item, i) => {
        const y = tableMap.firstRowY + i * tableMap.rowStep;
        return (
          <span key={item.title}>
            <span style={{ ...at(tableMap.titleX, y), ...textStyle('left') }}>{item.title}</span>
            <span style={{ ...at(tableMap.amountRightX, y), ...textStyle('right') }}>{fmt(item.amount)}</span>
          </span>
        );
      })}

      {/* Net payable boxes */}
      <span style={{ ...at(tableMap.amountRightX, tableMap.netByDueY), ...textStyle('right') }}>{fmt(d.netByDue)}</span>
      <span style={{ ...at(tableMap.amountRightX, tableMap.netAfterDueY), ...textStyle('right') }}>{fmt(d.netAfterDue)}</span>
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
