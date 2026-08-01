import { useState, useEffect, useCallback, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { getStudents, deleteStudent, getClasses } from '../api/students';
import StudentFormModal from '../components/StudentFormModal';
import StudentPrintModal from '../components/StudentPrintModal';
import ImportExcelModal from '../components/ImportExcelModal';
import { exportObjectsToCsv } from '../utils/exportCsv';
import toast from 'react-hot-toast';
import {
  UserPlus, Search, Download, Trash2, Printer, Upload,
  Edit2, Eye, ChevronLeft, ChevronRight, Users,
} from 'lucide-react';

const STATUSES = ['Active', 'Left', 'Graduated'];

const StatusBadge = ({ status }) => {
  const map = {
    Active:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Left:      'bg-rose-500/10 text-rose-400 border-rose-500/20',
    Graduated: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${map[status] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
      {status}
    </span>
  );
};

export default function StudentsPage() {
  const { user } = useAuth();
  const { currentCampus, currentSession } = useAppContext();
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterStatus, setFilterStatus] = useState('Active');
  const [filterGender, setFilterGender] = useState('');
  const [filterFreeship, setFilterFreeship] = useState('');
  const [page, setPage] = useState(1);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getStudents({
        search, class: filterClass, section: filterSection, status: filterStatus,
        gender: filterGender, freeship: filterFreeship, page, limit: 10,
      });
      setStudents(data.students);
      setPagination(data.pagination);
    } catch (e) {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [search, filterClass, filterSection, filterStatus, filterGender, filterFreeship, page]);

  useEffect(() => { 
    if (currentCampus && currentSession) fetchStudents(); 
  }, [fetchStudents, currentCampus, currentSession]);
  useEffect(() => {
    if (currentCampus && currentSession) {
      getClasses().then(r => setClasses(r.data)).catch(() => {});
    }
  }, [currentCampus, currentSession]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remove "${name}" from the system?`)) return;
    try {
      await deleteStudent(id);
      toast.success('Student removed');
      fetchStudents();
    } catch {
      toast.error('Failed to remove student');
    }
  };

  const openAdd = () => { setEditStudent(null); setModalOpen(true); };
  const openEdit = (s) => { setEditStudent(s); setModalOpen(true); };

  // CSV export — every field, for every record matching the current filters
  const [exporting, setExporting] = useState(false);
  const date10 = (d) => (d ? String(d).substring(0, 10) : '');
  const EXPORT_COLUMNS = [
    { label: 'Student ID',        get: s => s.studentId },
    { label: 'Full Name',         get: s => s.fullName },
    { label: 'Father Name',       get: s => s.fatherName },
    { label: 'Mother Name',       get: s => s.motherName },
    { label: 'Class',             get: s => s.class },
    { label: 'Section',           get: s => s.section },
    { label: 'Roll No',           get: s => s.rollNumber },
    { label: 'Status',            get: s => s.status },
    { label: 'Freeship',          get: s => (s.isFreeship ? 'Yes' : 'No') },
    { label: 'Gender',            get: s => s.gender },
    { label: 'Date of Birth',     get: s => date10(s.dateOfBirth) },
    { label: 'Place of Birth',    get: s => s.placeOfBirth },
    { label: 'Cast',              get: s => s.cast },
    { label: 'Religion',          get: s => s.religion },
    { label: 'Nationality',       get: s => s.nationality },
    { label: 'Mother Tongue',     get: s => s.motherTongue },
    { label: 'CNIC / B-Form',     get: s => s.cnic },
    { label: 'Father CNIC',       get: s => s.fatherCnic },
    { label: 'Father Occupation', get: s => s.fatherOccupation },
    { label: 'Phone',             get: s => s.phone },
    { label: 'Father Contact',    get: s => s.fatherContact },
    { label: 'Mother Contact',    get: s => s.motherContact },
    { label: 'Emergency Contact', get: s => s.emergencyContact },
    { label: 'Email',             get: s => s.email },
    { label: 'Address',           get: s => s.address },
    { label: 'Last School',       get: s => s.lastSchool },
    { label: 'Admission Date',    get: s => date10(s.admissionDate) },
  ];

  const exportCSV = async () => {
    setExporting(true);
    try {
      const { data } = await getStudents({
        search, class: filterClass, section: filterSection,
        status: filterStatus, gender: filterGender, freeship: filterFreeship,
        page: 1, limit: 100000,
      });
      const all = data.students || [];
      if (all.length === 0) { toast.error('No students match the current filters'); return; }
      exportObjectsToCsv('students.csv', EXPORT_COLUMNS, all);
      toast.success(`Exported ${all.length} students`);
    } catch {
      toast.error('Failed to export students');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase">Students Directory</h1>
          <p className="text-slate-400 text-xs font-semibold mt-1 uppercase tracking-wider">
            {pagination.total} registered student records
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={exportCSV} disabled={exporting}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl px-4 py-2.5 transition disabled:opacity-50"
          >
            <Download size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button onClick={() => setPrintOpen(true)}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl px-4 py-2.5 transition"
          >
            <Printer size={14} /> Print Records
          </button>
          {user?.role !== 'Staff' && (
            <button onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl px-4 py-2.5 transition"
            >
              <Upload size={14} /> Import Data
            </button>
          )}
          {user?.role !== 'Staff' && (
            <button id="add-student-btn" onClick={openAdd}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl px-4 py-2.5 transition shadow-lg shadow-blue-500/25 active:scale-95"
            >
              <UserPlus size={14} /> Add Student
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="student-search"
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, ID, father, roll..."
              className="w-full pl-9 pr-4 py-2 bg-slate-900/60 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
            />
          </div>
          {/* Class filter */}
          <select id="filter-class" value={filterClass}
            onChange={e => { setFilterClass(e.target.value); setPage(1); }}
            className="bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">All Classes</option>
            {classes.map(c => <option key={c} value={c} className="bg-slate-900">Class {c}</option>)}
          </select>
          {/* Section filter */}
          <select id="filter-section" value={filterSection}
            onChange={e => { setFilterSection(e.target.value); setPage(1); }}
            className="bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">All Sections</option>
            {['A','B','C','D','E'].map(s => <option key={s} className="bg-slate-900">{s}</option>)}
          </select>
          {/* Status filter */}
          <select id="filter-status" value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
            className="bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} className="bg-slate-900">{s}</option>)}
          </select>
          {/* Gender filter */}
          <select id="filter-gender" value={filterGender}
            onChange={e => { setFilterGender(e.target.value); setPage(1); }}
            className="bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">All Genders</option>
            <option value="Male" className="bg-slate-900">Boys</option>
            <option value="Female" className="bg-slate-900">Girls</option>
            <option value="Other" className="bg-slate-900">Other</option>
          </select>
          {/* Freeship filter */}
          <select id="filter-freeship" value={filterFreeship}
            onChange={e => { setFilterFreeship(e.target.value); setPage(1); }}
            className="bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">Fee: All</option>
            <option value="yes" className="bg-slate-900">Freeship only</option>
            <option value="no" className="bg-slate-900">Paying only</option>
          </select>
          {/* Clear */}
          {(search || filterClass || filterSection || filterStatus !== 'Active' || filterGender || filterFreeship) && (
            <button onClick={() => { setSearch(''); setFilterClass(''); setFilterSection(''); setFilterStatus('Active'); setFilterGender(''); setFilterFreeship(''); setPage(1); }}
              className="text-xs font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-xl transition"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
            <p className="text-slate-400 text-xs mt-3 uppercase font-bold tracking-wider">Synchronizing directory...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-16 text-center">
            <Users size={40} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-bold uppercase tracking-wider text-sm">No students found</p>
            <p className="text-slate-500 text-xs mt-1 font-medium">Try adjusting your filters or record a new student</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-white/3 border-b border-white/5">
                <tr>
                  {['Student ID','Name','Father','Class','Section','Roll','Status','Phone','Actions'].map(h => (
                    <th key={h} className="text-left px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3">
                {students.map(s => (
                  <tr key={s._id} className="hover:bg-white/3 transition group">
                    <td className="px-5 py-4 font-mono font-bold text-blue-400">{s.studentId}</td>
                    <td className="px-5 py-4 font-bold text-white whitespace-nowrap">
                      {s.fullName}
                      {s.isFreeship && (
                        <span className="ml-2 align-middle inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 text-amber-400"
                          title="Fees waived — no challan is generated or printed">
                          FREESHIP
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-400 whitespace-nowrap">{s.fatherName || '—'}</td>
                    <td className="px-5 py-4 text-slate-300 font-medium">Class {s.class}</td>
                    <td className="px-5 py-4 text-slate-400">{s.section || '—'}</td>
                    <td className="px-5 py-4 text-slate-400 font-mono">{s.rollNumber || '—'}</td>
                    <td className="px-5 py-4"><StatusBadge status={s.status} /></td>
                    <td className="px-5 py-4 text-slate-400 font-medium">{s.phone || '—'}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition duration-150">
                        <Link to={`/students/${s._id}`}
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20 rounded-xl transition" title="View Profile"
                        >
                          <Eye size={14} />
                        </Link>
                        {user?.role !== 'Staff' && (
                          <button onClick={() => openEdit(s)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 rounded-xl transition" title="Edit Student"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        {user?.role !== 'Staff' && (
                          <button onClick={() => handleDelete(s._id, s.fullName)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-xl transition" title="Delete Student"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && pagination.pages > 1 && (
          <div className="px-5 py-4 border-t border-white/5 flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium">
              Showing {(pagination.page - 1) * 10 + 1}–{Math.min(pagination.page * 10, pagination.total)} of {pagination.total} records
            </p>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-20 disabled:cursor-not-allowed border border-white/10 rounded-xl transition bg-white/3"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === pagination.pages || Math.abs(p - page) <= 1)
                .map((p, i, arr) => (
                  <Fragment key={p}>
                    {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-slate-600 text-xs">…</span>}
                    <button onClick={() => setPage(p)}
                      className={`w-7 h-7 text-xs rounded-xl border transition font-bold ${page === p ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20' : 'border-white/10 text-slate-400 hover:border-white/20'}`}
                    >
                      {p}
                    </button>
                  </Fragment>
                ))}
              <button disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-20 disabled:cursor-not-allowed border border-white/10 rounded-xl transition bg-white/3"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <StudentFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        student={editStudent}
        onSaved={fetchStudents}
      />

      <ImportExcelModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImportSuccess={fetchStudents}
        type="students"
      />

      {/* Print records */}
      <StudentPrintModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        filters={{ search, class: filterClass, section: filterSection, status: filterStatus, gender: filterGender, freeship: filterFreeship }}
      />
    </div>
  );
}
