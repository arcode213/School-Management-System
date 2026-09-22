import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { getEmployees, deleteEmployee } from '../api/employees';
import EmployeeFormModal from '../components/EmployeeFormModal';
import EmployeePrintModal from '../components/EmployeePrintModal';
import SalaryModal from '../components/SalaryModal';
import ImportExcelModal from '../components/ImportExcelModal';
import { exportObjectsToCsv } from '../utils/exportCsv';
import toast from 'react-hot-toast';
import {
  UserPlus, Search, Download, Printer, Trash2, Edit2, Eye, Upload,
  ChevronLeft, ChevronRight, Users, Briefcase, DollarSign, Layers
} from 'lucide-react';

const DESIGNATIONS = ['Teacher', 'Clerk', 'Peon', 'Guard', 'Principal', 'Admin Staff', 'Other'];
const DEPARTMENTS = ['Academics', 'Administration', 'Finance', 'Support', 'Security'];
const STATUSES = ['Active', 'Resigned', 'Terminated'];

const StatusBadge = ({ status }) => {
  const map = { 
    Active: 'bg-ok-soft t-ok border-ok-border', 
    Resigned: 'bg-warn-soft t-warn border-warn-border', 
    Terminated: 'bg-bad-soft t-bad border-bad-border' 
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${map[status] || 'bg-surface-3 t-muted border-line'}`}>
      {status}
    </span>
  );
};

export default function EmployeesPage() {
  const { currentCampus } = useAppContext();
  const { can } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterDesig, setFilterDesig] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);

  // Modals & Actions
  const [empModal, setEmpModal] = useState({ open: false, data: null });
  const [salaryModal, setSalaryModal] = useState({ open: false, emp: null });
  const [importOpen, setImportOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getEmployees({
        search,
        designation: filterDesig,
        department: filterDept,
        status: filterStatus,
        page,
        limit: 10
      });
      setEmployees(data.employees);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [search, filterDesig, filterDept, filterStatus, page]);

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

  // CSV export
  const date10 = (d) => (d ? String(d).substring(0, 10) : '');
  const EXPORT_COLUMNS = [
    { label: 'Employee ID',   get: e => e.employeeId },
    { label: 'Full Name',     get: e => e.fullName },
    { label: 'Father Name',   get: e => e.fatherName },
    { label: 'CNIC',          get: e => e.cnic },
    { label: 'Designation',   get: e => e.designation },
    { label: 'Department',    get: e => e.department },
    { label: 'Subject',       get: e => e.subject },
    { label: 'Joining Date',  get: e => date10(e.joiningDate) },
    { label: 'Status',        get: e => e.status },
    { label: 'Salary',        get: e => e.salary },
    { label: 'Allowances',    get: e => e.allowances },
    { label: 'Deductions',    get: e => e.deductions },
    { label: 'Phone',         get: e => e.phone },
    { label: 'Email',         get: e => e.email },
    { label: 'Address',       get: e => e.address },
    { label: 'Qualification', get: e => e.qualification },
    { label: 'Experience',    get: e => e.experience },
    { label: 'Date of Birth', get: e => date10(e.dateOfBirth) },
    { label: 'Gender',        get: e => e.gender },
  ];

  const exportCSV = async () => {
    setExporting(true);
    try {
      const { data } = await getEmployees({
        search,
        designation: filterDesig,
        department: filterDept,
        status: filterStatus,
        page: 1,
        limit: 100000,
      });
      const all = data.employees || [];
      if (all.length === 0) {
        toast.error('No staff records match the current filters');
        return;
      }
      exportObjectsToCsv('staff_directory.csv', EXPORT_COLUMNS, all);
      toast.success(`Exported ${all.length} staff records`);
    } catch {
      toast.error('Failed to export staff records');
    } finally {
      setExporting(false);
    }
  };

  // Screen Analytics Calculations
  const activeCount = employees.filter(e => e.status === 'Active').length;
  const teachersCount = employees.filter(e => e.designation === 'Teacher').length;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold t-body tracking-tight uppercase">Staff & Teachers Directory</h1>
          <p className="t-muted text-xs font-semibold mt-1 uppercase tracking-wider">{pagination.total} registered staff members</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={exportCSV}
            disabled={exporting}
            className="btn btn-ghost disabled:opacity-50"
            title="Export CSV"
          >
            <Download size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            onClick={() => setPrintOpen(true)}
            className="btn btn-ghost"
            title="Print Records"
          >
            <Printer size={14} /> Print Records
          </button>
          {can('employees', 'create') && (
            <button onClick={() => setImportOpen(true)}
              className="btn btn-ghost"
            >
              <Upload size={14} /> Import Data
            </button>
          )}
          {can('employees', 'create') && (
            <button onClick={() => setEmpModal({ open: true, data: null })}
              className="btn btn-primary"
            >
              <UserPlus size={14} /> Add Employee
            </button>
          )}
        </div>
      </div>

      {/* Screen Analytics: Financial Summary Panels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-purple-600/80 to-purple-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Users className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Active Staff</p>
            <p className="text-xl sm:text-2xl font-extrabold t-brand mt-0.5 tracking-tight break-words">{activeCount} active</p>
            <p className="t-faint text-xs mt-1 font-medium">Logged operational teachers/staff</p>
          </div>
        </div>

        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-blue-600/80 to-blue-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Briefcase className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Teachers Count</p>
            <p className="text-xl sm:text-2xl font-extrabold t-brand mt-0.5 tracking-tight break-words">{teachersCount} tutors</p>
            <p className="t-faint text-xs mt-1 font-medium">Academic course instructors</p>
          </div>
        </div>

        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-emerald-600/80 to-emerald-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Layers className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Total Headcount</p>
            <p className="text-xl sm:text-2xl font-extrabold t-ok mt-0.5 tracking-tight break-words">{pagination.total} registered</p>
            <p className="t-faint text-xs mt-1 font-medium">All department records</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card card-lg p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="sm:col-span-2 relative bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs flex items-center gap-2">
          <Search size={14} className="t-faint" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search staff name, ID, phone, CNIC..." className="bg-transparent w-full t-body placeholder-faint focus:outline-none font-medium" />
        </div>
        <select value={filterDesig} onChange={e => { setFilterDesig(e.target.value); setPage(1); }} className="bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer min-w-32">
          <option value="">All Designations</option>
          {DESIGNATIONS.map(d => <option key={d} className="bg-surface-2">{d}</option>)}
        </select>
        <select value={filterDept} onChange={e => { setFilterDept(e.target.value); setPage(1); }} className="bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer min-w-32">
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d} className="bg-surface-2">{d}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card card-lg overflow-hidden">
        {loading ? (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto" />
            <p className="t-muted text-xs mt-3 uppercase font-bold tracking-wider">Synchronizing directory...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-16 text-center t-faint flex flex-col items-center">
            <Users size={40} className="t-muted mb-3" />
            <p className="t-muted font-bold uppercase tracking-wider text-sm">No employees found</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-xs text-left rtable">
              <thead className="bg-surface-2 border-b border-line t-muted uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-4">Employee ID</th>
                  <th className="px-5 py-4">Name</th>
                  <th className="px-5 py-4">Designation / Dept</th>
                  <th className="px-5 py-4">Contact</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line t-muted">
                {employees.map(e => (
                  <tr key={e._id} className="hover:bg-surface-2 transition group">
                    <td data-label="Employee ID" className="px-5 py-4 font-mono font-bold t-brand">{e.employeeId}</td>
                    <td data-label="Name" className="px-5 py-4 font-bold t-body md:whitespace-nowrap">{e.fullName}</td>
                    <td data-label="Designation / Dept" className="px-5 py-4 md:whitespace-nowrap">
                      <div>
                        <div className="font-semibold t-body">{e.designation}</div>
                        <div className="text-[10px] t-muted mt-0.5 font-medium">{e.department}</div>
                      </div>
                    </td>
                    <td data-label="Contact" className="px-5 py-4 t-muted font-medium font-mono">{e.phone || '—'}</td>
                    <td data-label="Status" className="px-5 py-4"><StatusBadge status={e.status} /></td>
                    <td data-actions="" className="px-5 py-4">
                      <div className="row-actions">
                        {can('salaries', 'create') && (
                          <button onClick={() => setSalaryModal({ open: true, emp: e })} className="p-1.5 t-muted hover:t-ok hover:bg-ok-soft border border-transparent hover:border-ok-border rounded-xl transition" title="Pay Salary">
                            <DollarSign size={14} />
                          </button>
                        )}
                        <Link to={`/employees/${e._id}`} className="p-1.5 t-muted hover:t-brand hover:bg-brand-soft border border-transparent hover:border-brand-border rounded-xl transition" title="View Profile">
                          <Eye size={14} />
                        </Link>
                        {can('employees', 'edit') && (
                          <button onClick={() => setEmpModal({ open: true, data: e })} className="p-1.5 t-muted hover:t-warn hover:bg-warn-soft border border-transparent hover:border-warn-border rounded-xl transition" title="Edit Employee">
                            <Edit2 size={14} />
                          </button>
                        )}
                        {can('employees', 'delete') && (
                          <button onClick={() => handleDelete(e._id, e.fullName)} className="p-1.5 t-muted hover:t-bad hover:bg-bad-soft border border-transparent hover:border-bad-border rounded-xl transition" title="Remove Employee">
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
          <div className="px-5 py-4 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs t-muted font-medium">Page {pagination.page} of {pagination.pages}</p>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 t-muted hover:t-body disabled:opacity-20 disabled:cursor-not-allowed border border-line rounded-xl transition bg-surface-2"><ChevronLeft size={14}/></button>
              <button disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)} className="p-1.5 t-muted hover:t-body disabled:opacity-20 disabled:cursor-not-allowed border border-line rounded-xl transition bg-surface-2"><ChevronRight size={14}/></button>
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
      <EmployeePrintModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        filters={{ search, designation: filterDesig, department: filterDept, status: filterStatus }}
      />
    </div>
  );
}

