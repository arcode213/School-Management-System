import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { postSalary } from '../api/employees';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function SalaryModal({ open, onClose, employee, onSaved }) {
  const { register, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm();
  
  const base = Number(watch('baseSalary') || 0);
  const allow = Number(watch('allowances') || 0);
  const ded = Number(watch('deductions') || 0);
  const net = base + allow - ded;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center">
              <DollarSign className="text-white w-4 h-4" />
            </div>
            <h2 className="font-semibold text-slate-800">Post Salary</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition"><X size={20} /></button>
        </div>

        <form id="salary-form" onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-2">
            <p className="text-sm font-semibold text-slate-700">{employee?.fullName}</p>
            <p className="text-xs text-slate-500">{employee?.designation}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Month</label>
              <select {...register('salaryMonth')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500">
                {MONTHS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
              <input type="number" {...register('salaryYear')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Base</label>
              <input type="number" {...register('baseSalary')} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Allowances</label>
              <input type="number" {...register('allowances')} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Deductions</label>
              <input type="number" {...register('deductions')} className="w-full border border-red-200 rounded-lg px-2 py-2 text-sm text-red-600 bg-red-50" />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200 mt-2">
            <span className="text-sm font-semibold text-green-800">Net Payable:</span>
            <span className="text-lg font-bold text-green-700">Rs. {net.toLocaleString()}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Method</label>
              <select {...register('paymentMethod')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500">
                <option>Bank Transfer</option><option>Cash</option><option>Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Remarks</label>
              <input {...register('remarks')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Optional" />
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg">Cancel</button>
          <button type="submit" form="salary-form" disabled={isSubmitting} className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg flex items-center gap-2">
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            Confirm Payment
          </button>
        </div>
      </div>
    </div>
  );
}
