import { FIELD_MAP, TABLE, COPY_OFFSET_X } from '../utils/challanCalibration';

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
function Copy({ d, dx, fontMm }) {
  const at = (x, y) => ({ position: 'absolute', left: `${x + dx}%`, top: `${y}%` });
  const textStyle = (align) => ({
    fontSize: `${fontMm}mm`,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    transform: align === 'right' ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
    fontWeight: 600,
    color: '#000',
  });

  const Field = ({ k, value }) => {
    const f = FIELD_MAP[k];
    return (
      <span style={{ ...at(f.x, f.y), ...textStyle(f.align) }}>{value}</span>
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

      {/* Fee table line items */}
      {d.items.slice(0, TABLE.maxRows).map((item, i) => {
        const y = TABLE.firstRowY + i * TABLE.rowStep;
        return (
          <span key={item.title}>
            <span style={{ ...at(TABLE.titleX, y), ...textStyle('left') }}>{item.title}</span>
            <span style={{ ...at(TABLE.amountRightX, y), ...textStyle('right') }}>{fmt(item.amount)}</span>
          </span>
        );
      })}

      {/* Net payable boxes */}
      <span style={{ ...at(TABLE.amountRightX, TABLE.netByDueY), ...textStyle('right') }}>{fmt(d.netByDue)}</span>
      <span style={{ ...at(TABLE.amountRightX, TABLE.netAfterDueY), ...textStyle('right') }}>{fmt(d.netAfterDue)}</span>
    </>
  );
}

// Renders one full challan sheet (both copies) sized to the physical paper.
export default function ChallanOverlay({ fee, calib, showBackground = false }) {
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
      }}
    >
      {showBackground && (
        <img
          src="/challan.jpeg"
          alt="challan form"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }}
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
        <Copy d={d} dx={0} fontMm={fontMm} />
        <Copy d={d} dx={COPY_OFFSET_X} fontMm={fontMm} />
      </div>
    </div>
  );
}
