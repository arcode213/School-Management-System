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
    Active:    'bg-ok-soft t-ok border-ok-border',
    Left:      'bg-bad-soft t-bad border-bad-border',
    Graduated: 'bg-brand-soft t-brand border-brand-border',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${map[status] || 'bg-surface-3 t-muted border-line'}`}>
      {status}
    </span>
  );
};

export default function StudentsPage() {
  // Every control below is drawn from what this account was granted, not from its
  // role name — the same modules the API checks on the matching request.
  const { can } = useAuth();
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
          <h1 className="text-2xl font-bold t-body tracking-tight uppercase">Students Directory</h1>
          <p className="t-muted text-xs font-semibold mt-1 uppercase tracking-wider">
            {pagination.total} registered student records
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={exportCSV} disabled={exporting}
            className="btn btn-ghost disabled:opacity-50"
          >
            <Download size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button onClick={() => setPrintOpen(true)}
            className="btn btn-ghost"
          >
            <Printer size={14} /> Print Records
          </button>
          {can('students', 'create') && (
            <button onClick={() => setImportOpen(true)}
              className="btn btn-ghost"
            >
              <Upload size={14} /> Import Data
            </button>
          )}
          {can('students', 'create') && (
            <button id="add-student-btn" onClick={openAdd}
              className="btn btn-primary"
            >
              <UserPlus size={14} /> Add Student
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card card-lg p-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 t-muted" />
            <input
              id="student-search"
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, ID, father, roll..."
              className="w-full pl-9 pr-4 py-2 bg-surface-2 border border-line rounded-xl text-xs t-body placeholder-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent font-medium"
            />
          </div>
          {/* Class filter */}
          <select id="filter-class" value={filterClass}
            onChange={e => { setFilterClass(e.target.value); setPage(1); }}
            className="bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
          >
            <option value="">All Classes</option>
            {classes.map(c => <option key={c} value={c} className="bg-surface-2">Class {c}</option>)}
          </select>
          {/* Section filter */}
          <select id="filter-section" value={filterSection}
            onChange={e => { setFilterSection(e.target.value); setPage(1); }}
            className="bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
          >
            <option value="">All Sections</option>
            {['A','B','C','D','E'].map(s => <option key={s} className="bg-surface-2">{s}</option>)}
          </select>
          {/* Status filter */}
          <select id="filter-status" value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
            className="bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
          >
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} className="bg-surface-2">{s}</option>)}
          </select>
          {/* Gender filter */}
          <select id="filter-gender" value={filterGender}
            onChange={e => { setFilterGender(e.target.value); setPage(1); }}
            className="bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
          >
            <option value="">All Genders</option>
            <option value="Male" className="bg-surface-2">Boys</option>
            <option value="Female" className="bg-surface-2">Girls</option>
            <option value="Other" className="bg-surface-2">Other</option>
          </select>
          {/* Freeship filter */}
          <select id="filter-freeship" value={filterFreeship}
            onChange={e => { setFilterFreeship(e.target.value); setPage(1); }}
            className="bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
          >
            <option value="">Fee: All</option>
            <option value="yes" className="bg-surface-2">Freeship only</option>
            <option value="no" className="bg-surface-2">Paying only</option>
          </select>
          {/* Clear */}
          {(search || filterClass || filterSection || filterStatus !== 'Active' || filterGender || filterFreeship) && (
            <button onClick={() => { setSearch(''); setFilterClass(''); setFilterSection(''); setFilterStatus('Active'); setFilterGender(''); setFilterFreeship(''); setPage(1); }}
              className="text-xs font-bold uppercase tracking-wider t-bad bg-bad-soft border border-bad-border px-4 py-2 rounded-xl transition"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card card-lg overflow-hidden">
        {loading ? (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full mx-auto" />
            <p className="t-muted text-xs mt-3 uppercase font-bold tracking-wider">Synchronizing directory...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-16 text-center">
            <Users size={40} className="t-muted mx-auto mb-3" />
            <p className="t-muted font-bold uppercase tracking-wider text-sm">No students found</p>
            <p className="t-faint text-xs mt-1 font-medium">Try adjusting your filters or record a new student</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-2 border-b border-line">
                <tr>
                  {['Student ID','Name','Father','Class','Section','Roll','Status','Phone','Actions'].map(h => (
                    <th key={h} className="text-left px-5 py-4 text-[10px] font-bold uppercase tracking-wider t-muted whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {students.map(s => (
                  <tr key={s._id} className="hover:bg-surface-2 transition group">
                    <td className="px-5 py-4 font-mono font-bold t-brand">{s.studentId}</td>
                    <td className="px-5 py-4 font-bold t-body whitespace-nowrap">
                      {s.fullName}
                      {s.isFreeship && (
                        <span className="ml-2 align-middle inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-warn-soft border border-warn-border t-warn"
                          title="Fees waived — no challan is generated or printed">
                          FREESHIP
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 t-muted whitespace-nowrap">{s.fatherName || '—'}</td>
                    <td className="px-5 py-4 t-muted font-medium">Class {s.class}</td>
                    <td className="px-5 py-4 t-muted">{s.section || '—'}</td>
                    <td className="px-5 py-4 t-muted font-mono">{s.rollNumber || '—'}</td>
                    <td className="px-5 py-4"><StatusBadge status={s.status} /></td>
                    <td className="px-5 py-4 t-muted font-medium">{s.phone || '—'}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition duration-150">
                        <Link to={`/students/${s._id}`}
                          className="p-1.5 t-muted hover:t-brand hover:bg-brand-soft border border-transparent hover:border-brand-border rounded-xl transition" title="View Profile"
                        >
                          <Eye size={14} />
                        </Link>
                        {can('students', 'edit') && (
                          <button onClick={() => openEdit(s)}
                            className="p-1.5 t-muted hover:t-warn hover:bg-warn-soft border border-transparent hover:border-warn-border rounded-xl transition" title="Edit Student"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        {can('students', 'delete') && (
                          <button onClick={() => handleDelete(s._id, s.fullName)}
                            className="p-1.5 t-muted hover:t-bad hover:bg-bad-soft border border-transparent hover:border-bad-border rounded-xl transition" title="Delete Student"
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
          <div className="px-5 py-4 border-t border-line flex items-center justify-between">
            <p className="text-xs t-muted font-medium">
              Showing {(pagination.page - 1) * 10 + 1}–{Math.min(pagination.page * 10, pagination.total)} of {pagination.total} records
            </p>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 t-muted hover:t-body disabled:opacity-20 disabled:cursor-not-allowed border border-line rounded-xl transition bg-surface-2"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === pagination.pages || Math.abs(p - page) <= 1)
                .map((p, i, arr) => (
                  <Fragment key={p}>
                    {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 t-muted text-xs">…</span>}
                    <button onClick={() => setPage(p)}
                      className={`w-7 h-7 text-xs rounded-xl border transition font-bold ${page === p ? 'bg-brand t-body border-brand shadow-md shadow-blue-500/20' : 'border-line t-muted hover:border-line-strong'}`}
                    >
                      {p}
                    </button>
                  </Fragment>
                ))}
              <button disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 t-muted hover:t-body disabled:opacity-20 disabled:cursor-not-allowed border border-line rounded-xl transition bg-surface-2"
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
