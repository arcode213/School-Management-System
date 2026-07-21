import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getStudent } from '../api/students';
import { Skeleton } from '../components/DashboardWidgets';
import {
  ArrowLeft, User, Phone, MapPin, Calendar, BookOpen, Edit2, Printer,
  Wallet, GraduationCap, Mail, IdCard, Users2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import StudentFormModal from '../components/StudentFormModal';
import toast from 'react-hot-toast';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
const fmtRs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

const InfoRow = ({ label, value }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">{label}</span>
    <span className="text-sm text-slate-700 font-medium break-words">{value || '—'}</span>
  </div>
);

const StatusBadge = ({ status }) => {
  const map = { Active: 'bg-green-100 text-green-700', Left: 'bg-red-100 text-red-700', Graduated: 'bg-blue-100 text-blue-700' };
  return <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${map[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>;
};

const Card = ({ icon: Icon, title, tint = 'blue', children, className = '' }) => {
  const tints = {
    blue: 'bg-blue-50 text-blue-600', purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600', indigo: 'bg-indigo-50 text-indigo-600',
  };
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${tints[tint]}`}>
          <Icon size={14} />
        </div>
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      </div>
      {children}
    </div>
  );
};

const esc = (v) => String(v ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Formatted, printable single-student record (opens in a new window).
const printHTML = (s) => {
  const fee = s.feeInfo;
  const campusName = s.academicHistory?.[0]?.campus?.name || '';
  const row = (label, val) => `<tr><td class="lbl">${esc(label)}</td><td class="val">${esc(val ?? '—')}</td></tr>`;

  const histRows = (s.academicHistory || []).map(h => `
    <tr>
      <td>${esc(h.academicSession?.name)}</td>
      <td>${esc(h.className)}</td>
      <td>${esc(h.section)}</td>
      <td>${esc(h.rollNumber)}</td>
      <td>${esc(h.status)}</td>
      <td>${(h.status === 'Left' || h.status === 'Graduated') && h.statusDate ? esc(fmtDate(h.statusDate)) : '—'}</td>
      <td>${esc(h.promotionStatus)}</td>
    </tr>`).join('');

  const feeBlock = fee ? `
    <div class="fee">
      <div>
        <div class="fee-label">Monthly Tuition Fee (Class ${esc(fee.className)})</div>
        <div class="fee-sub">Transport ${esc(fmtRs(fee.transportFee))} &nbsp;•&nbsp; Misc ${esc(fmtRs(fee.miscFee))} &nbsp;•&nbsp; Monthly total ${esc(fmtRs(fee.monthlyTotal))}${fee.hasOverride ? ' &nbsp;•&nbsp; (custom fee)' : ''}</div>
      </div>
      <div class="fee-amt">${esc(fmtRs(fee.tuitionFee))}</div>
    </div>` : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Student Record - ${esc(s.fullName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color:#1e293b; margin:0; padding:32px; }
    .doc { max-width: 820px; margin:0 auto; }
    .head { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #2563eb; padding-bottom:12px; margin-bottom:22px; }
    .head h1 { margin:0; font-size:22px; }
    .head .sub { color:#64748b; font-size:12px; margin-top:2px; }
    .head .school { text-align:right; font-size:12px; color:#475569; }
    .head .school strong { display:block; font-size:14px; color:#1e293b; }
    .fee { background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:14px 18px; margin-bottom:22px; display:flex; justify-content:space-between; align-items:center; }
    .fee-label { font-size:12px; color:#1e40af; font-weight:600; text-transform:uppercase; letter-spacing:.03em; }
    .fee-sub { font-size:12px; color:#475569; margin-top:3px; }
    .fee-amt { font-size:26px; font-weight:800; color:#1d4ed8; white-space:nowrap; }
    .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; }
    .card { border:1px solid #e2e8f0; border-radius:10px; padding:14px 18px; break-inside:avoid; }
    .card h2 { font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:#2563eb; margin:0 0 10px; border-bottom:1px solid #f1f5f9; padding-bottom:6px; }
    table.info { width:100%; border-collapse:collapse; font-size:12.5px; }
    table.info td { padding:4px 0; vertical-align:top; }
    table.info td.lbl { color:#64748b; width:46%; }
    table.info td.val { font-weight:600; }
    .full { grid-column: 1 / -1; }
    table.hist { width:100%; border-collapse:collapse; font-size:11px; margin-top:6px; }
    table.hist th, table.hist td { border:1px solid #cbd5e1; padding:5px 8px; text-align:left; }
    table.hist th { background:#f1f5f9; text-transform:uppercase; font-size:10px; letter-spacing:.03em; }
    .foot { margin-top:24px; text-align:center; font-size:10px; color:#94a3b8; }
    @media print { body { padding:0; } @page { margin:14mm; } }
  </style></head><body>
  <div class="doc">
    <div class="head">
      <div>
        <h1>Student Record</h1>
        <div class="sub">${esc(s.fullName)} &nbsp;•&nbsp; ${esc(s.studentId)} &nbsp;•&nbsp; Class ${esc(s.class)}${s.section ? ' - ' + esc(s.section) : ''}${s.rollNumber ? ' • Roll #' + esc(s.rollNumber) : ''}</div>
      </div>
      <div class="school">${campusName ? '<strong>' + esc(campusName) + '</strong>' : ''}Status: ${esc(s.status)}</div>
    </div>

    ${feeBlock}

    <div class="grid2">
      <div class="card">
        <h2>Personal Information</h2>
        <table class="info">
          ${row("Father's Name", s.fatherName)}
          ${row("Mother's Name", s.motherName)}
          ${row("Date of Birth", fmtDate(s.dateOfBirth))}
          ${row("Place of Birth", s.placeOfBirth)}
          ${row("Gender", s.gender)}
          ${row("Religion", s.religion)}
          ${row("Cast", s.cast)}
          ${row("Nationality", s.nationality)}
          ${row("Mother Tongue", s.motherTongue)}
          ${row("CNIC / B-Form", s.cnic)}
          ${row("Father's CNIC", s.fatherCnic)}
          ${row("Father's Occupation", s.fatherOccupation)}
        </table>
      </div>
      <div class="card">
        <h2>Academic &amp; Contact</h2>
        <table class="info">
          ${row("Class", s.class)}
          ${row("Section", s.section)}
          ${row("Roll Number", s.rollNumber)}
          ${row("Status", s.status)}
          ${(s.status === 'Left' || s.status === 'Graduated') && s.statusDate ? row(`${s.status} On`, fmtDate(s.statusDate)) : ''}
          ${row("Admission Date", fmtDate(s.admissionDate))}
          ${row("Last School", s.lastSchool)}
          ${row("Student Phone", s.phone)}
          ${row("Father Contact", s.fatherContact)}
          ${row("Mother Contact", s.motherContact)}
          ${row("Emergency Contact", s.emergencyContact)}
          ${row("Email", s.email)}
        </table>
      </div>
      <div class="card full">
        <h2>Address</h2>
        <div style="font-size:12.5px;">${esc(s.address)}</div>
      </div>
      ${(s.academicHistory || []).length ? `
      <div class="card full">
        <h2>Academic History</h2>
        <table class="hist">
          <thead><tr><th>Session</th><th>Class</th><th>Section</th><th>Roll</th><th>Status</th><th>Left/Grad On</th><th>Promotion</th></tr></thead>
          <tbody>${histRows}</tbody>
        </table>
      </div>` : ''}
    </div>

    <div class="foot">Generated ${esc(new Date().toLocaleString())}</div>
  </div>
  <script>window.onload = function(){ window.print(); }</script>
  </body></html>`;
};

export default function StudentProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const fetchStudent = async () => {
    try {
      const { data } = await getStudent(id);
      setStudent(data);
    } catch {
      toast.error('Student not found');
      navigate('/students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStudent(); }, [id]);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) { toast.error('Allow pop-ups to print the record'); return; }
    win.document.write(printHTML(student));
    win.document.close();
  };

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
  if (!student) return null;

  const fee = student.feeInfo;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link to="/students" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition">
          <ArrowLeft size={16} /> Back to Students
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint}
            className="flex items-center gap-2 text-sm bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl hover:border-slate-300 transition shadow-sm">
            <Printer size={14} /> Print Record
          </button>
          {user?.role !== 'Staff' && (
            <button onClick={() => setEditOpen(true)}
              className="flex items-center gap-2 text-sm bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition shadow-sm">
              <Edit2 size={14} /> Edit Student
            </button>
          )}
        </div>
      </div>

      {/* Hero card */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700" />
        <div className="relative p-6 flex items-start gap-5 text-white">
          <div className="w-20 h-20 bg-white/15 backdrop-blur border border-white/30 rounded-2xl flex items-center justify-center text-3xl font-bold flex-shrink-0 shadow-lg">
            {student.fullName?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{student.fullName}</h1>
              <StatusBadge status={student.status} />
            </div>
            {student.fatherName && <p className="text-blue-100 text-sm mt-0.5">s/o {student.fatherName}</p>}
            <div className="flex items-center gap-x-5 gap-y-1.5 mt-3 flex-wrap text-xs text-blue-50">
              <span className="flex items-center gap-1.5"><IdCard size={13} /> {student.studentId}</span>
              <span className="flex items-center gap-1.5"><GraduationCap size={13} /> Class {student.class}{student.section ? ` – ${student.section}` : ''}</span>
              {student.rollNumber && <span className="flex items-center gap-1.5"><BookOpen size={13} /> Roll #{student.rollNumber}</span>}
              {student.phone && <span className="flex items-center gap-1.5"><Phone size={13} /> {student.phone}</span>}
              <span className="flex items-center gap-1.5"><Calendar size={13} /> Admitted {fmtDate(student.admissionDate)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly fee highlight */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
            <Wallet size={14} className="text-emerald-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-700">Fee Details <span className="text-slate-400 font-normal">(set by admin for Class {student.class})</span></h2>
        </div>
        {fee && fee.hasStructure ? (
          <div className="flex flex-wrap items-stretch gap-4">
            <div className="flex-1 min-w-[180px] bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-4">
              <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wide">Monthly Tuition Fee</p>
              <p className="text-3xl font-bold text-emerald-700 mt-1">{fmtRs(fee.tuitionFee)}</p>
              {fee.hasOverride && <span className="inline-block mt-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Custom fee applied</span>}
            </div>
            <div className="flex-[2] min-w-[240px] grid grid-cols-2 sm:grid-cols-4 gap-3">
              <FeeStat label="Transport" value={fmtRs(fee.transportFee)} />
              <FeeStat label="Misc" value={fmtRs(fee.miscFee)} />
              <FeeStat label="Exam" value={fmtRs(fee.examFee)} />
              <FeeStat label="Monthly Total" value={fmtRs(fee.monthlyTotal)} highlight />
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-500">
            No fee structure has been set for <strong>Class {student.class}</strong> in the current session.
            {user?.role !== 'Staff' && <> Set it in <Link to="/fee-structures" className="text-blue-600 hover:underline">Fee Structures</Link>.</>}
          </div>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card icon={User} title="Personal Information" tint="blue">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Father's Name" value={student.fatherName} />
            <InfoRow label="Mother's Name" value={student.motherName} />
            <InfoRow label="Date of Birth" value={fmtDate(student.dateOfBirth)} />
            <InfoRow label="Place of Birth" value={student.placeOfBirth} />
            <InfoRow label="Gender" value={student.gender} />
            <InfoRow label="Religion" value={student.religion} />
            <InfoRow label="Cast" value={student.cast} />
            <InfoRow label="Nationality" value={student.nationality} />
            <InfoRow label="CNIC / B-Form" value={student.cnic} />
            <InfoRow label="Father's CNIC" value={student.fatherCnic} />
            <InfoRow label="Father's Occupation" value={student.fatherOccupation} />
            <InfoRow label="Mother Tongue" value={student.motherTongue} />
          </div>
        </Card>

        <Card icon={Phone} title="Contact Information" tint="green">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Student Phone" value={student.phone} />
            <InfoRow label="Father Contact" value={student.fatherContact} />
            <InfoRow label="Mother Contact" value={student.motherContact} />
            <InfoRow label="Emergency Contact" value={student.emergencyContact} />
            <InfoRow label="Email" value={student.email} />
            <InfoRow label="Last School" value={student.lastSchool} />
          </div>
        </Card>

        <Card icon={GraduationCap} title="Academic Information" tint="purple">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Class" value={`Class ${student.class}`} />
            <InfoRow label="Section" value={student.section} />
            <InfoRow label="Roll Number" value={student.rollNumber} />
            <InfoRow label="Status" value={student.status} />
            {(student.status === 'Left' || student.status === 'Graduated') && student.statusDate && (
              <InfoRow label={`${student.status} On`} value={fmtDate(student.statusDate)} />
            )}
            <InfoRow label="Admission Date" value={fmtDate(student.admissionDate)} />
          </div>
        </Card>

        {student.address && (
          <Card icon={MapPin} title="Address" tint="green">
            <p className="text-sm text-slate-600 leading-relaxed">{student.address}</p>
          </Card>
        )}
      </div>

      {/* Academic History Timeline */}
      {student.academicHistory && student.academicHistory.length > 0 && (
        <Card icon={Calendar} title="Academic History Timeline" tint="indigo">
          <div className="relative border-l border-slate-200 ml-3 space-y-6 mt-2">
            {student.academicHistory.map((record, index) => (
              <div key={record._id} className="relative pl-6">
                <div className={`absolute -left-1.5 top-1.5 w-3 h-3 rounded-full border-2 border-white ${index === 0 ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-800">{record.academicSession?.name || 'Unknown Session'}</h3>
                  {record.academicSession?.isActive && (
                    <span className="bg-green-100 text-green-700 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">Active</span>
                  )}
                  <StatusBadge status={record.status} />
                </div>
                <div className="text-sm text-slate-600">
                  <span className="font-semibold">Class {record.className}</span> {record.section && `(Sec ${record.section})`} • Roll: {record.rollNumber || '—'}
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                  <Users2 size={12} /> {record.campus?.name} {record.promotionStatus && `• Promotion: ${record.promotionStatus}`}
                  {(record.status === 'Left' || record.status === 'Graduated') && record.statusDate && ` • ${record.status} on ${fmtDate(record.statusDate)}`}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <StudentFormModal open={editOpen} onClose={() => setEditOpen(false)} student={student} onSaved={fetchStudent} />
    </div>
  );
}

const FeeStat = ({ label, value, highlight }) => (
  <div className={`rounded-xl p-3 border ${highlight ? 'bg-slate-800 border-slate-800 text-white' : 'bg-slate-50 border-slate-100'}`}>
    <p className={`text-[11px] font-medium uppercase tracking-wide ${highlight ? 'text-slate-300' : 'text-slate-400'}`}>{label}</p>
    <p className={`text-base font-bold mt-0.5 ${highlight ? 'text-white' : 'text-slate-700'}`}>{value}</p>
  </div>
);
