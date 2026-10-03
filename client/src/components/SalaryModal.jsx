import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { postSalary } from '../api/employees';
import ModalPortal from './ModalPortal';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function SalaryModal({ open, onClose, employee, onSaved }) {
  const { register, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm();
  
  const base = Number(watch('baseSalary') || 0);
  const allow = Number(watch('allowances') || 0);
  const ded = Number(watch('deductions') || 0);
  const sec = Number(watch('securityDeposit') || 0);
  const net = base + allow - ded - sec;

  useEffect(() => {
    if (open && employee) {
      const now = new Date();
      reset({
        employeeId: employee._id,
        salaryMonth: MONTHS[now.getMonth()],
        salaryYear: now.getFullYear(),
        baseSalary: employee.salary || 0,
        allowances: employee.allowances || 0,
        deductions: employee.deductions || 0,
        securityDeposit: 0,
        paymentMethod: 'Bank Transfer',
        remarks: ''
      });
    }
  }, [open, employee, reset]);

  const onSubmit = async (data) => {
    try {
      await postSalary(data);
      toast.success(`Salary posted for ${data.salaryMonth}`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post salary');
    }
  };

  if (!open) return null;

  return (
    <ModalPortal>
    <div className="modal-shell">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-box bg-solid shadow-2xl sm:max-w-md">
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-line flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-ok rounded-xl flex items-center justify-center flex-shrink-0">
              <DollarSign className="t-body w-4 h-4" />
            </div>
            <h2 className="font-semibold t-body truncate">Post Salary</h2>
          </div>
          <button onClick={onClose} className="icon-btn flex-shrink-0" aria-label="Close"><X size={20} /></button>
        </div>

        <form id="salary-form" onSubmit={handleSubmit(onSubmit)} className="px-5 sm:px-6 py-5 space-y-4 overflow-y-auto">
          <div className="bg-surface-2 p-3 rounded-xl border border-line mb-2">
            <p className="text-sm font-semibold t-body">{employee?.fullName}</p>
            <p className="text-xs t-faint">{employee?.designation}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium t-muted mb-1">Month</label>
              <select {...register('salaryMonth')} className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand">
                {MONTHS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium t-muted mb-1">Year</label>
              <input type="number" {...register('salaryYear')} className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium t-muted mb-1">Base (Rs.)</label>
              <input type="number" min="0" {...register('baseSalary')} className="w-full border border-line rounded-lg px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium t-muted mb-1">Allowances (Rs.)</label>
              <input type="number" min="0" {...register('allowances')} className="w-full border border-line rounded-lg px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium t-muted mb-1">Sec. Deposit (Rs.)</label>
              <input type="number" min="0" {...register('securityDeposit')} placeholder="0" className="w-full border border-line rounded-lg px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium t-muted mb-1">Other Deductions (Rs.)</label>
              <input type="number" min="0" {...register('deductions')} className="w-full border border-bad-border rounded-lg px-2 py-2 text-sm t-bad bg-bad-soft" />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-ok-soft rounded-lg border border-ok-border mt-2">
            <span className="text-sm font-semibold t-ok">Net Payable:</span>
            <span className="text-lg font-bold t-ok">Rs. {net.toLocaleString()}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium t-muted mb-1">Method</label>
              <select {...register('paymentMethod')} className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand">
                <option>Bank Transfer</option><option>Cash</option><option>Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium t-muted mb-1">Remarks</label>
              <input {...register('remarks')} className="w-full border border-line rounded-lg px-3 py-2 text-sm" placeholder="Optional" />
            </div>
          </div>
        </form>

        <div className="px-5 sm:px-6 py-4 border-t border-line modal-actions flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm t-muted border border-line rounded-lg">Cancel</button>
          <button type="submit" form="salary-form" disabled={isSubmitting} className="px-5 py-2.5 text-sm bg-ok hover:bg-ok t-body font-medium rounded-lg flex items-center justify-center gap-2">
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            Confirm Payment
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
