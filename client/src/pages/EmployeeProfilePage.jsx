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
      <Link to="/employees" className="flex items-center gap-2 text-sm t-faint hover:t-body transition">
        <ArrowLeft size={16} /> Back to Employees
      </Link>

      <div className="bg-solid rounded-2xl border border-line shadow-sm p-4 sm:p-6 flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
        <div className="w-20 h-20 bg-brand rounded-2xl flex items-center justify-center t-body text-3xl font-bold shadow-lg">
          {employee.fullName.charAt(0)}
        </div>
        <div>
          <h1 className="text-xl font-bold t-body">{employee.fullName}</h1>
          <p className="t-faint text-sm mt-1">{employee.designation} • {employee.department}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs t-faint">
            <span className="flex items-center gap-1.5"><Phone size={12}/> {employee.phone || 'No phone'}</span>
            <span className="flex items-center gap-1.5"><Calendar size={12}/> Joined {new Date(employee.joiningDate).toLocaleDateString()}</span>
            {employee.leavingDate && (
              <span className="flex items-center gap-1.5 t-warn"><Calendar size={12}/> Left {new Date(employee.leavingDate).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-solid rounded-2xl border border-line shadow-sm p-4 sm:p-5">
          <h2 className="text-sm font-semibold t-body mb-4 flex items-center gap-2"><User size={14} className="t-brand"/> Personal Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><p className="text-xs t-muted">Father</p><p className="font-medium">{employee.fatherName}</p></div>
            <div><p className="text-xs t-muted">CNIC</p><p className="font-medium">{employee.cnic}</p></div>
            <div><p className="text-xs t-muted">DOB</p><p className="font-medium">{new Date(employee.dateOfBirth).toLocaleDateString()}</p></div>
            <div><p className="text-xs t-muted">Gender</p><p className="font-medium">{employee.gender}</p></div>
          </div>
        </div>
        
        <div className="bg-solid rounded-2xl border border-line shadow-sm p-4 sm:p-5">
          <h2 className="text-sm font-semibold t-body mb-4 flex items-center gap-2"><Briefcase size={14} className="t-brand"/> Employment</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><p className="text-xs t-muted">Base Salary</p><p className="font-medium t-ok">Rs. {employee.salary?.toLocaleString()}</p></div>
            <div><p className="text-xs t-muted">Status</p><p className="font-medium">{employee.status}</p></div>
            <div><p className="text-xs t-muted">Qualification</p><p className="font-medium">{employee.qualification}</p></div>
            <div><p className="text-xs t-muted">Experience</p><p className="font-medium">{employee.experience}</p></div>
          </div>
        </div>
      </div>

      <div className="bg-solid rounded-2xl border border-line shadow-sm p-4 sm:p-5">
        <h2 className="text-sm font-semibold t-body mb-4 flex items-center gap-2"><DollarSign size={14} className="t-ok"/> Salary History</h2>
        {history.length === 0 ? <p className="t-muted text-sm">No salary records.</p> : (
          <div className="table-scroll">
            <table className="w-full text-sm rtable">
              <thead className="bg-surface-2 t-faint uppercase text-xs text-left">
                <tr>
                  <th className="p-3">Month</th>
                  <th className="p-3 text-right">Base</th>
                  <th className="p-3 text-center">Leaves</th>
                  <th className="p-3 text-right">Bonus / Ded.</th>
                  <th className="p-3 text-right">Net Paid</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.map(h => {
                  const bonus = h.attendanceBonus || 0;
                  const deds = h.absenceDeduction || 0;
                  return (
                    <tr key={h._id}>
                      <td data-label="Month" className="p-3 font-medium">{h.salaryMonth} {h.salaryYear}</td>
                      <td data-label="Base" className="p-3 text-right t-faint">Rs. {h.baseSalary.toLocaleString()}</td>
                      <td data-label="Leaves" className="p-3 text-center">{h.absentDays ?? 0} d</td>
                      <td data-label="Bonus / Ded." className="p-3 text-right">
                        {bonus > 0 && <span className="t-ok font-semibold">+Rs. {bonus.toLocaleString()}</span>}
                        {deds > 0 && <span className="t-bad font-semibold">-Rs. {deds.toLocaleString()}</span>}
                        {bonus === 0 && deds === 0 && <span className="t-muted">—</span>}
                      </td>
                      <td data-label="Net Paid" className="p-3 text-right t-ok font-bold">Rs. {h.netSalary.toLocaleString()}</td>
                      <td data-label="Date" className="p-3 t-faint">{new Date(h.paymentDate).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
