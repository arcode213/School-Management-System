import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getStudent } from '../api/students';
import { Skeleton } from '../components/DashboardWidgets';
import { ArrowLeft, User, Phone, MapPin, Calendar, BookOpen, BadgeCheck, Edit2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import StudentFormModal from '../components/StudentFormModal';
import toast from 'react-hot-toast';

const InfoRow = ({ label, value }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</span>
    <span className="text-sm text-slate-700 font-medium">{value || '—'}</span>
  </div>
);

const StatusBadge = ({ status }) => {
  const map = { Active: 'bg-green-100 text-green-700', Left: 'bg-red-100 text-red-700', Graduated: 'bg-blue-100 text-blue-700' };
  return <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${map[status] || 'bg-slate-100'}`}>{status}</span>;
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

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
  if (!student) return null;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Back */}
      <div className="flex items-center justify-between">
        <Link to="/students" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition">
          <ArrowLeft size={16} /> Back to Students
        </Link>
        {['Admin', 'Accountant'].includes(user?.role) && (
          <button onClick={() => setEditOpen(true)}
            className="flex items-center gap-2 text-sm bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition">
            <Edit2 size={14} /> Edit Student
          </button>
        )}
      </div>

      {/* Profile header card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-start gap-5">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold flex-shrink-0 shadow-lg">
          {student.fullName?.charAt(0)?.toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800">{student.fullName}</h1>
            <StatusBadge status={student.status} />
          </div>
          <p className="text-slate-500 text-sm mt-1">
            {student.studentId} • Class {student.class}{student.section ? ` – ${student.section}` : ''} {student.rollNumber ? `• Roll #${student.rollNumber}` : ''}
          </p>
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {student.phone && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Phone size={12} /> {student.phone}
              </span>
            )}
            {student.admissionDate && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar size={12} /> Admitted {new Date(student.admissionDate).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Personal Info */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <User size={14} className="text-blue-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-700">Personal Information</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Father's Name" value={student.fatherName} />
            <InfoRow label="Mother's Name" value={student.motherName} />
            <InfoRow label="Date of Birth" value={student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-PK') : null} />
            <InfoRow label="Gender" value={student.gender} />
            <InfoRow label="Religion" value={student.religion} />
            <InfoRow label="CNIC / B-Form" value={student.cnic} />
            <InfoRow label="Email" value={student.email} />
            <InfoRow label="Emergency Contact" value={student.emergencyContact} />
          </div>
        </div>

        {/* Academic Info */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center">
              <BookOpen size={14} className="text-purple-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-700">Academic Information</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Class" value={`Class ${student.class}`} />
            <InfoRow label="Section" value={student.section} />
            <InfoRow label="Roll Number" value={student.rollNumber} />
            <InfoRow label="Status" value={student.status} />
            <InfoRow label="Admission Date" value={student.admissionDate ? new Date(student.admissionDate).toLocaleDateString('en-PK') : null} />
          </div>
        </div>

        {/* Address */}
        {student.address && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center">
                <MapPin size={14} className="text-green-600" />
              </div>
              <h2 className="text-sm font-semibold text-slate-700">Address</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{student.address}</p>
          </div>
        )}
      </div>

      <StudentFormModal open={editOpen} onClose={() => setEditOpen(false)} student={student} onSaved={fetchStudent} />
    </div>
  );
}
