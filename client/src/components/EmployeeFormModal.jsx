import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, UserCog } from 'lucide-react';
import toast from 'react-hot-toast';
import { addEmployee, updateEmployee } from '../api/employees';
import ModalPortal from './ModalPortal';

const DESIGNATIONS = ['Teacher', 'Clerk', 'Peon', 'Guard', 'Principal', 'Admin Staff', 'Other'];
const DEPARTMENTS = ['Academics', 'Administration', 'Finance', 'Support', 'Security'];

export default function EmployeeFormModal({ open, onClose, employee, onSaved }) {
  const isEdit = !!employee;
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm();
  const currentStatus = watch('status');

  useEffect(() => {
    if (open) {
      reset(isEdit ? {
        ...employee,
        dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.substring(0, 10) : '',
        joiningDate: employee.joiningDate ? employee.joiningDate.substring(0, 10) : '',
        leavingDate: employee.leavingDate ? employee.leavingDate.substring(0, 10) : '',
      } : {
        status: 'Active',
        gender: 'Male',
        designation: 'Teacher',
        department: 'Academics',
        joiningDate: new Date().toISOString().substring(0, 10),
        leavingDate: '',
      });
    }
  }, [open, employee, reset, isEdit]);

  const onSubmit = async (data) => {
    try {
      const payload = { ...data };
      if (payload.status !== 'Active') {
        if (!payload.leavingDate) {
          payload.leavingDate = new Date().toISOString().substring(0, 10);
        }
      } else {
        payload.leavingDate = null;
      }

      if (isEdit) {
        await updateEmployee(employee._id, payload);
        toast.success('Employee updated');
      } else {
        await addEmployee(payload);
        toast.success('Employee added');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    }
  };

  if (!open) return null;

  return (
    <ModalPortal>
    <div className="modal-shell">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-box bg-solid shadow-2xl sm:max-w-2xl">
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-line flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-brand rounded-xl flex items-center justify-center flex-shrink-0">
              <UserCog className="t-body w-4 h-4" />
            </div>
            <h2 className="font-semibold t-body truncate">{isEdit ? 'Edit Employee' : 'Add New Employee'}</h2>
          </div>
          <button onClick={onClose} className="icon-btn flex-shrink-0" aria-label="Close"><X size={20} /></button>
        </div>

        <form id="emp-form" onSubmit={handleSubmit(onSubmit)} className="overflow-y-auto px-5 sm:px-6 py-5 space-y-5 flex-1">
          <Section title="Personal Info">
            <Field label="Full Name *" error={errors.fullName?.message}>
              <input {...register('fullName', { required: 'Name is required' })} className={input(errors.fullName)} placeholder="Full Name" />
            </Field>
            <Field label="Father's Name">
              <input {...register('fatherName')} className={input()} placeholder="Father's Name" />
            </Field>
            <Field label="Date of Birth">
              <input type="date" {...register('dateOfBirth')} className={input()} />
            </Field>
            <Field label="Gender">
              <select {...register('gender')} className={input()}><option>Male</option><option>Female</option><option>Other</option></select>
            </Field>
            <Field label="CNIC">
              <input {...register('cnic')} className={input()} placeholder="XXXXX-XXXXXXX-X" />
            </Field>
            <Field label="Phone">
              <input {...register('phone')} className={input()} placeholder="03XX-XXXXXXX" />
            </Field>
            <Field label="Email">
              <input type="email" {...register('email')} className={input()} placeholder="email@example.com" />
            </Field>
          </Section>

          <Section title="Employment Details">
            <Field label="Designation *" error={errors.designation?.message}>
              <select {...register('designation', { required: 'Designation required' })} className={input(errors.designation)}>
                {DESIGNATIONS.map(d => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Department">
              <select {...register('department')} className={input()}>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Subject (if Teacher)">
              <input {...register('subject')} className={input()} placeholder="e.g. Mathematics" />
            </Field>
            <Field label="Joining Date">
              <input type="date" {...register('joiningDate')} className={input()} />
            </Field>
            <Field label="Status">
              <select {...register('status')} className={input()}>
                <option>Active</option>
                <option>Leave</option>
                <option>Resigned</option>
                <option>Terminated</option>
                <option>Left</option>
              </select>
            </Field>
            {currentStatus !== 'Active' && (
              <Field label="Leaving / Resignation Date">
                <input type="date" {...register('leavingDate')} className={input()} />
              </Field>
            )}
          </Section>

          <Section title="Compensation">
            <Field label="Base Salary (Rs.)">
              <input type="number" {...register('salary')} className={input()} placeholder="0" />
            </Field>
            <Field label="Allowances (Rs.)">
              <input type="number" {...register('allowances')} className={input()} placeholder="0" />
            </Field>
            <Field label="Deductions (Rs.)">
              <input type="number" {...register('deductions')} className={input()} placeholder="0" />
            </Field>
          </Section>

          <Section title="Address & Qualifications">
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Qualification"><input {...register('qualification')} className={input()} placeholder="e.g. BSCS, M.Ed" /></Field>
              <Field label="Experience"><input {...register('experience')} className={input()} placeholder="e.g. 5 Years" /></Field>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium t-muted mb-1">Address</label>
              <textarea {...register('address')} rows={2} className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand" placeholder="Full address" />
            </div>
          </Section>
        </form>

        <div className="px-5 sm:px-6 py-4 border-t border-line modal-actions flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm t-muted border border-line rounded-lg">Cancel</button>
          <button type="submit" form="emp-form" disabled={isSubmitting} className="px-5 py-2.5 text-sm bg-brand hover:bg-purple-700 t-body font-medium rounded-lg flex items-center justify-center gap-2">
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Add Employee'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

const input = (err) => `w-full border ${err ? 'border-bad' : 'border-line'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-solid`;
const Section = ({ title, children }) => (
  <div><p className="text-xs font-semibold t-muted uppercase tracking-wide mb-3">{title}</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div></div>
);
const Field = ({ label, children, error }) => (
  <div><label className="block text-xs font-medium t-muted mb-1">{label}</label>{children}{error && <p className="text-xs t-bad mt-0.5">{error}</p>}</div>
);
