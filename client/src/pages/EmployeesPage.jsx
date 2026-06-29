import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { getEmployees, deleteEmployee } from '../api/employees';
import EmployeeFormModal from '../components/EmployeeFormModal';
import SalaryModal from '../components/SalaryModal';
import toast from 'react-hot-toast';
import {
  UserPlus, Search, Download, Trash2, Edit2, Eye,
  ChevronLeft, ChevronRight, Users, Briefcase, DollarSign
} from 'lucide-react';

const DESIGNATIONS = ['Teacher', 'Clerk', 'Peon', 'Guard', 'Principal', 'Admin Staff', 'Other'];
const DEPARTMENTS = ['Academics', 'Administration', 'Finance', 'Support', 'Security'];

const StatusBadge = ({ status }) => {
  const map = { Active: 'bg-green-100 text-green-700', Resigned: 'bg-amber-100 text-amber-700', Terminated: 'bg-red-100 text-red-700' };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-slate-100'}`}>{status}</span>;
};

export default function EmployeesPage() {
  const { currentCampus } = useAppContext();
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Employees</h1>
          <p className="text-slate-400 text-sm mt-0.5">{pagination.total} staff members</p>
        </div>
        <button onClick={() => setEmpModal({ open: true, data: null })}
          className="flex items-center gap-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-4 py-2 transition shadow-sm font-medium">
          <UserPlus size={14} /> Add Employee
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, ID..." className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
        </div>
        <select value={filterDesig} onChange={e => { setFilterDesig(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Designations</option>
          {DESIGNATIONS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select value={filterDept} onChange={e => { setFilterDept(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto" /></div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No employees found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs">
              <tr><th className="text-left px-4 py-3">ID</th><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Role</th><th className="text-left px-4 py-3">Contact</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {employees.map(e => (
                <tr key={e._id} className="hover:bg-slate-50 transition group">
                  <td className="px-4 py-3 font-mono text-xs text-purple-600">{e.employeeId}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{e.fullName}</td>
                  <td className="px-4 py-3 text-slate-600"><div className="font-medium">{e.designation}</div><div className="text-xs text-slate-400">{e.department}</div></td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{e.phone || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      {user?.role !== 'Staff' && (
                        <button onClick={() => setSalaryModal({ open: true, emp: e })} className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Pay Salary"><DollarSign size={14} /></button>
                      )}
                      <Link to={`/employees/${e._id}`} className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg"><Eye size={14} /></Link>
                      <button onClick={() => setEmpModal({ open: true, data: e })} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Edit2 size={14} /></button>
                      {user?.role !== 'Staff' && (
                        <button onClick={() => handleDelete(e._id, e.fullName)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <EmployeeFormModal open={empModal.open} employee={empModal.data} onClose={() => setEmpModal({ open: false })} onSaved={fetchEmployees} />
      <SalaryModal open={salaryModal.open} employee={salaryModal.emp} onClose={() => setSalaryModal({ open: false })} onSaved={() => {}} />
    </div>
  );
}
