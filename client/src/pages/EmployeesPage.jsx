import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { getEmployees, deleteEmployee } from '../api/employees';
import EmployeeFormModal from '../components/EmployeeFormModal';
import SalaryModal from '../components/SalaryModal';
import ImportExcelModal from '../components/ImportExcelModal';
import toast from 'react-hot-toast';
import {
  UserPlus, Search, Download, Trash2, Edit2, Eye, Upload,
  ChevronLeft, ChevronRight, Users, Briefcase, DollarSign, Layers
} from 'lucide-react';

const DESIGNATIONS = ['Teacher', 'Clerk', 'Peon', 'Guard', 'Principal', 'Admin Staff', 'Other'];
const DEPARTMENTS = ['Academics', 'Administration', 'Finance', 'Support', 'Security'];

const StatusBadge = ({ status }) => {
  const map = { 
    Active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', 
    Resigned: 'bg-amber-500/10 text-amber-400 border-amber-500/20', 
    Terminated: 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${map[status] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
      {status}
    </span>
  );
};

export default function EmployeesPage() {
  const { currentCampus } = useAppContext();
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterDesig, setFilterDesig] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [page, setPage] = useState(1);

  // Modals
  const [empModal, setEmpModal] = useState({ open: false, data: null });
  const [salaryModal, setSalaryModal] = useState({ open: false, emp: null });
  const [importOpen, setImportOpen] = useState(false);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getEmployees({ search, designation: filterDesig, department: filterDept, page, limit: 10 });
      setEmployees(data.employees);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [search, filterDesig, filterDept, page]);

  useEffect(() => { 
    if (currentCampus) fetchEmployees(); 
  }, [fetchEmployees, currentCampus]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Terminate/Remove ${name}?`)) return;
    try {
      await deleteEmployee(id);
      toast.success('Employee removed');
      fetchEmployees();
    } catch {
      toast.error('Failed to remove');
    }
  };

  // Screen Analytics Calculations
  const activeCount = employees.filter(e => e.status === 'Active').length;
  const teachersCount = employees.filter(e => e.designation === 'Teacher').length;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase">Staff Directory</h1>
          <p className="text-slate-400 text-xs font-semibold mt-1 uppercase tracking-wider">{pagination.total} registered staff members</p>
        </div>
        <div className="flex items-center gap-2.5">
          {user?.role !== 'Staff' && (
            <button onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl px-4 py-2.5 transition"
            >
              <Upload size={14} /> Import Data
            </button>
          )}
          <button onClick={() => setEmpModal({ open: true, data: null })}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl px-4 py-2.5 transition shadow-lg shadow-purple-500/25 active:scale-95"
          >
            <UserPlus size={14} /> Add Employee
          </button>
        </div>
      </div>

      {/* Screen Analytics: Financial Summary Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-start gap-4 shadow-xl">
          <div className="bg-gradient-to-tr from-purple-600/80 to-purple-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Users className="text-white w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Active Staff</p>
            <p className="text-2xl font-extrabold text-purple-400 mt-0.5 tracking-tight">{activeCount} active</p>
            <p className="text-slate-500 text-xs mt-1 font-medium">Logged operational teachers/staff</p>
          </div>
        </div>

        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-start gap-4 shadow-xl">
          <div className="bg-gradient-to-tr from-blue-600/80 to-blue-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Briefcase className="text-white w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Teachers Count</p>
            <p className="text-2xl font-extrabold text-blue-400 mt-0.5 tracking-tight">{teachersCount} tutors</p>
            <p className="text-slate-500 text-xs mt-1 font-medium">Academic course instructors</p>
          </div>
        </div>

        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-start gap-4 shadow-xl">
          <div className="bg-gradient-to-tr from-emerald-600/80 to-emerald-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Layers className="text-white w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Headcount</p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-0.5 tracking-tight">{pagination.total} registered</p>
            <p className="text-slate-500 text-xs mt-1 font-medium">All department records</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48 bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs flex items-center gap-2">
          <Search size={14} className="text-slate-500" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search staff name, ID..." className="bg-transparent w-full text-white placeholder-slate-500 focus:outline-none font-medium" />
        </div>
        <select value={filterDesig} onChange={e => { setFilterDesig(e.target.value); setPage(1); }} className="bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-32">
          <option value="">All Designations</option>
          {DESIGNATIONS.map(d => <option key={d} className="bg-slate-900">{d}</option>)}
        </select>
        <select value={filterDept} onChange={e => { setFilterDept(e.target.value); setPage(1); }} className="bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-32">
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d} className="bg-slate-900">{d}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto" />
            <p className="text-slate-400 text-xs mt-3 uppercase font-bold tracking-wider">Synchronizing directory...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-16 text-center text-slate-500 flex flex-col items-center">
            <Users size={40} className="text-slate-600 mb-3" />
            <p className="text-slate-300 font-bold uppercase tracking-wider text-sm">No employees found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-white/3 border-b border-white/5 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-4">Employee ID</th>
                  <th className="px-5 py-4">Name</th>
                  <th className="px-5 py-4">Designation / Dept</th>
                  <th className="px-5 py-4">Contact</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3 text-slate-300">
                {employees.map(e => (
                  <tr key={e._id} className="hover:bg-white/3 transition group">
                    <td className="px-5 py-4 font-mono font-bold text-purple-400">{e.employeeId}</td>
                    <td className="px-5 py-4 font-bold text-white whitespace-nowrap">{e.fullName}</td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-200">{e.designation}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-medium">{e.department}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-400 font-medium font-mono">{e.phone || '—'}</td>
                    <td className="px-5 py-4"><StatusBadge status={e.status} /></td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition duration-150">
                        {user?.role !== 'Staff' && (
                          <button onClick={() => setSalaryModal({ open: true, emp: e })} className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20 rounded-xl transition" title="Pay Salary">
                            <DollarSign size={14} />
                          </button>
                        )}
                        <Link to={`/employees/${e._id}`} className="p-1.5 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 border border-transparent hover:border-purple-500/20 rounded-xl transition" title="View Profile">
                          <Eye size={14} />
                        </Link>
                        <button onClick={() => setEmpModal({ open: true, data: e })} className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 rounded-xl transition" title="Edit Employee">
                          <Edit2 size={14} />
                        </button>
                        {user?.role !== 'Staff' && (
                          <button onClick={() => handleDelete(e._id, e.fullName)} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-xl transition" title="Remove Employee">
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
            <p className="text-xs text-slate-400 font-medium">Page {pagination.page} of {pagination.pages}</p>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-20 disabled:cursor-not-allowed border border-white/10 rounded-xl transition bg-white/3"><ChevronLeft size={14}/></button>
              <button disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)} className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-20 disabled:cursor-not-allowed border border-white/10 rounded-xl transition bg-white/3"><ChevronRight size={14}/></button>
            </div>
          </div>
        )}
      </div>

      <EmployeeFormModal open={empModal.open} employee={empModal.data} onClose={() => setEmpModal({ open: false })} onSaved={fetchEmployees} />
      <SalaryModal open={salaryModal.open} employee={salaryModal.emp} onClose={() => setSalaryModal({ open: false })} onSaved={() => {}} />
      <ImportExcelModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImportSuccess={fetchEmployees}
        type="employees"
      />
    </div>
  );
}
