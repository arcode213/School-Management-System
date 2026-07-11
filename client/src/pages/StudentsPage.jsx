import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { getStudents, deleteStudent, getClasses } from '../api/students';
import StudentFormModal from '../components/StudentFormModal';
import StudentPrintModal from '../components/StudentPrintModal';
import ImportExcelModal from '../components/ImportExcelModal';
import toast from 'react-hot-toast';
import {
  UserPlus, Search, Filter, Download, Trash2, Printer, Upload,
  Edit2, Eye, ChevronLeft, ChevronRight, Users,
} from 'lucide-react';

const STATUSES = ['Active', 'Left', 'Graduated'];

const StatusBadge = ({ status }) => {
  const map = {
    Active:    'bg-green-100 text-green-700',
    Left:      'bg-red-100 text-red-700',
    Graduated: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-slate-100 text-slate-600'}`}>
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
  const [filterStatus, setFilterStatus] = useState('');
  const [filterGender, setFilterGender] = useState('');
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
        search, class: filterClass, section: filterSection, status: filterStatus, gender: filterGender, page, limit: 10,
      });
      setStudents(data.students);
      setPagination(data.pagination);
    } catch (e) {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [search, filterClass, filterSection, filterStatus, filterGender, page]);

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

  // CSV export
  const exportCSV = () => {
    const headers = ['Student ID', 'Full Name', 'Father Name', 'Class', 'Section', 'Roll No', 'Status', 'Phone', 'Admission Date'];
    const rows = students.map(s => [
      s.studentId, s.fullName, s.fatherName, s.class, s.section, s.rollNumber,
      s.status, s.phone, s.admissionDate?.substring(0, 10),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'students.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Students</h1>
          <p className="text-slate-400 text-sm mt-0.5">{pagination.total} total records</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2 hover:border-slate-300 transition shadow-sm">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => setPrintOpen(true)}
            className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2 hover:border-slate-300 transition shadow-sm">
            <Printer size={14} /> Print Records
          </button>
          {user?.role !== 'Staff' && (
            <button onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2 hover:border-slate-300 transition shadow-sm">
              <Upload size={14} /> Import Data
            </button>
          )}
          {user?.role !== 'Staff' && (
            <button id="add-student-btn" onClick={openAdd}
              className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 transition shadow-sm font-medium">
              <UserPlus size={14} /> Add Student
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
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
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {/* Class filter */}
          <select id="filter-class" value={filterClass}
            onChange={e => { setFilterClass(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Classes</option>
            {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
          {/* Section filter */}
          <select id="filter-section" value={filterSection}
            onChange={e => { setFilterSection(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Sections</option>
            {['A','B','C','D','E'].map(s => <option key={s}>{s}</option>)}
          </select>
          {/* Status filter */}
          <select id="filter-status" value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          {/* Gender filter */}
          <select id="filter-gender" value={filterGender}
            onChange={e => { setFilterGender(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Genders</option>
            <option value="Male">Boys</option>
            <option value="Female">Girls</option>
            <option value="Other">Other</option>
          </select>
          {/* Clear */}
          {(search || filterClass || filterSection || filterStatus || filterGender) && (
            <button onClick={() => { setSearch(''); setFilterClass(''); setFilterSection(''); setFilterStatus(''); setFilterGender(''); setPage(1); }}
              className="text-xs text-red-500 hover:text-red-700 px-3 py-2 border border-red-200 rounded-lg transition">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
            <p className="text-slate-400 text-sm mt-3">Loading students...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No students found</p>
            <p className="text-slate-400 text-xs mt-1">Try adjusting your filters or add a new student</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Student ID','Name','Father','Class','Section','Roll','Status','Phone','Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {students.map(s => (
                  <tr key={s._id} className="hover:bg-slate-50 transition group">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 font-medium">{s.studentId}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{s.fullName}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{s.fatherName || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">Class {s.class}</td>
                    <td className="px-4 py-3 text-slate-600">{s.section || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{s.rollNumber || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 text-slate-500">{s.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <Link to={`/students/${s._id}`}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="View">
                          <Eye size={14} />
                        </Link>
                        {user?.role !== 'Staff' && (
                          <button onClick={() => openEdit(s)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition" title="Edit">
                            <Edit2 size={14} />
                          </button>
                        )}
                        {user?.role !== 'Staff' && (
                          <button onClick={() => handleDelete(s._id, s.fullName)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
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
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Showing {(pagination.page - 1) * 10 + 1}–{Math.min(pagination.page * 10, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-200 rounded-lg transition">
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === pagination.pages || Math.abs(p - page) <= 1)
                .map((p, i, arr) => (
                  <>
                    {i > 0 && arr[i - 1] !== p - 1 && <span key={`dots-${p}`} className="px-1 text-slate-300 text-xs">…</span>}
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-7 h-7 text-xs rounded-lg border transition ${page === p ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}>
                      {p}
                    </button>
                  </>
                ))}
              <button disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-200 rounded-lg transition">
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

      {/* Print records (respects current filters) */}
      <StudentPrintModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        filters={{ search, class: filterClass, section: filterSection, status: filterStatus, gender: filterGender }}
      />
    </div>
  );
}
