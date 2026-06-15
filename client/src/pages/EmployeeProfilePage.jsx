import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getEmployee, getSalaryHistory } from '../api/employees';
import { Skeleton } from '../components/DashboardWidgets';
import { ArrowLeft, User, Phone, MapPin, Calendar, Briefcase, DollarSign, Download } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EmployeeProfilePage() {
  const { id } = useParams();
  const [employee, setEmployee] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getEmployee(id), getSalaryHistory(id)])
      .then(([eRes, hRes]) => { setEmployee(eRes.data); setHistory(hRes.data); })
      .catch(() => toast.error('Error loading employee'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !employee) return <div className="space-y-4"><Skeleton className="h-10 w-48"/><Skeleton className="h-48 w-full"/></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <Link to="/employees" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition">
        <ArrowLeft size={16} /> Back to Employees
      </Link>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-start gap-5">
        <div className="w-20 h-20 bg-purple-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg">
          {employee.fullName.charAt(0)}
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{employee.fullName}</h1>
          <p className="text-slate-500 text-sm mt-1">{employee.designation} • {employee.department}</p>
          <div className="flex gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><Phone size={12}/> {employee.phone || 'No phone'}</span>
            <span className="flex items-center gap-1.5"><Calendar size={12}/> Joined {new Date(employee.joiningDate).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2"><User size={14} className="text-purple-600"/> Personal Info</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-xs text-slate-400">Father</p><p className="font-medium">{employee.fatherName}</p></div>
            <div><p className="text-xs text-slate-400">CNIC</p><p className="font-medium">{employee.cnic}</p></div>
            <div><p className="text-xs text-slate-400">DOB</p><p className="font-medium">{new Date(employee.dateOfBirth).toLocaleDateString()}</p></div>
            <div><p className="text-xs text-slate-400">Gender</p><p className="font-medium">{employee.gender}</p></div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2"><Briefcase size={14} className="text-blue-600"/> Employment</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-xs text-slate-400">Base Salary</p><p className="font-medium text-green-600">Rs. {employee.salary?.toLocaleString()}</p></div>
            <div><p className="text-xs text-slate-400">Status</p><p className="font-medium">{employee.status}</p></div>
            <div><p className="text-xs text-slate-400">Qualification</p><p className="font-medium">{employee.qualification}</p></div>
            <div><p className="text-xs text-slate-400">Experience</p><p className="font-medium">{employee.experience}</p></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2"><DollarSign size={14} className="text-green-600"/> Salary History</h2>
        {history.length === 0 ? <p className="text-slate-400 text-sm">No salary records.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs text-left">
              <tr><th className="p-3">Month</th><th className="p-3">Base</th><th className="p-3">Net Paid</th><th className="p-3">Date</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {history.map(h => (
                <tr key={h._id}>
                  <td className="p-3 font-medium">{h.salaryMonth} {h.salaryYear}</td>
                  <td className="p-3 text-slate-500">Rs. {h.baseSalary.toLocaleString()}</td>
                  <td className="p-3 text-green-600 font-bold">Rs. {h.netSalary.toLocaleString()}</td>
                  <td className="p-3 text-slate-500">{new Date(h.paymentDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
