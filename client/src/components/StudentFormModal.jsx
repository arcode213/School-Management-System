import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { addStudent, updateStudent } from '../api/students';
import { CLASSES, SECTIONS } from '../utils/constants';

export default function StudentFormModal({ open, onClose, student, onSaved }) {
  const isEdit = !!student;
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  useEffect(() => {
    if (open) {
      reset(isEdit ? {
        ...student,
        dateOfBirth: student.dateOfBirth ? student.dateOfBirth.substring(0, 10) : '',
        admissionDate: student.admissionDate ? student.admissionDate.substring(0, 10) : '',
      } : {
        status: 'Active',
        gender: 'Male',
        admissionDate: new Date().toISOString().substring(0, 10),
      });
    }
  }, [open, student, reset, isEdit]);

  const onSubmit = async (data) => {
    try {
      if (isEdit) {
        await updateStudent(student._id, data);
        toast.success('Student updated successfully');
      } else {
        await addStudent(data);
        toast.success('Student added successfully');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <User className="text-white w-4 h-4" />
            </div>
            <h2 className="font-semibold text-slate-800">{isEdit ? 'Edit Student' : 'Add New Student'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form id="student-form" onSubmit={handleSubmit(onSubmit)} className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
          {/* Personal Info */}
          <Section title="Personal Information">
            <Field label="Full Name" error={errors.fullName?.message}>
              <input id="std-fullName" {...register('fullName')} className={input()} placeholder="Muhammad Ali" />
            </Field>
            <Field label="Father's Name">
              <input id="std-fatherName" {...register('fatherName')} className={input()} placeholder="Father's full name" />
            </Field>
            <Field label="Father's Occupation">
              <input id="std-fatherOccupation" {...register('fatherOccupation')} className={input()} placeholder="e.g. Engineer" />
            </Field>
            <Field label="Date of Birth">
              <input id="std-dob" type="date" {...register('dateOfBirth')} className={input()} />
            </Field>
            <Field label="Place of Birth">
              <input id="std-pob" {...register('placeOfBirth')} className={input()} placeholder="e.g. Lahore" />
            </Field>
            <Field label="Gender">
              <select id="std-gender" {...register('gender')} className={input()}>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </Field>
            <Field label="Cast">
              <input id="std-cast" {...register('cast')} className={input()} placeholder="e.g. Rajput" />
            </Field>
            <Field label="Religion">
              <input id="std-religion" {...register('religion')} className={input()} placeholder="e.g. Islam" />
            </Field>
            <Field label="Nationality">
              <input id="std-nationality" {...register('nationality')} className={input()} placeholder="e.g. Pakistani" />
            </Field>
            <Field label="Mother Tongue">
              <input id="std-motherTongue" {...register('motherTongue')} className={input()} placeholder="e.g. Urdu" />
            </Field>
            <Field label="CNIC / B-Form">
              <input id="std-cnic" {...register('cnic')} className={input()} placeholder="XXXXX-XXXXXXX-X" />
            </Field>
            <Field label="Father's CNIC">
              <input id="std-fatherCnic" {...register('fatherCnic')} className={input()} placeholder="XXXXX-XXXXXXX-X" />
            </Field>
          </Section>

          {/* Contact Info */}
          <Section title="Contact Information">
            <Field label="Student Phone">
              <input id="std-phone" {...register('phone')} className={input()} placeholder="03XX-XXXXXXX" />
            </Field>
            <Field label="Father Contact">
              <input id="std-fatherContact" {...register('fatherContact')} className={input()} placeholder="03XX-XXXXXXX" />
            </Field>
            <Field label="Mother Contact">
              <input id="std-motherContact" {...register('motherContact')} className={input()} placeholder="03XX-XXXXXXX" />
            </Field>
            <Field label="Emergency Contact">
              <input id="std-emergency" {...register('emergencyContact')} className={input()} placeholder="03XX-XXXXXXX" />
            </Field>
          </Section>

          {/* Academic Info */}
          <Section title="Academic Information">
            <Field label="Class" error={errors.class?.message}>
              <select id="std-class" {...register('class')} className={input()}>
                <option value="">Select class</option>
                {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </Field>
            <Field label="Section">
              <select id="std-section" {...register('section')} className={input()}>
                <option value="">Select section</option>
                {SECTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Last School">
              <input id="std-lastSchool" {...register('lastSchool')} className={input()} placeholder="Previous school name" />
            </Field>
            <Field label="Roll Number">
              <input id="std-roll" {...register('rollNumber')} className={input()} placeholder="e.g. 23" />
            </Field>
            <Field label="Admission Date">
              <input id="std-admDate" type="date" {...register('admissionDate')} className={input()} />
            </Field>
            <Field label="Status">
              <select id="std-status" {...register('status')} className={input()}>
                <option>Active</option><option>Left</option><option>Graduated</option>
              </select>
            </Field>
            <Field label="Previous Dues (Arrears)">
              <input id="std-previousDues" type="number" min="0" {...register('previousDues', { valueAsNumber: true })} className={input()} placeholder="e.g. 1500" disabled={isEdit} />
            </Field>
          </Section>

          {/* Address */}
          <Section title="Address">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
              <textarea id="std-address" {...register('address')} rows={2}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Full address" />
            </div>
          </Section>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg transition">
            Cancel
          </button>
          <button type="submit" form="student-form" disabled={isSubmitting}
            className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition flex items-center gap-2 disabled:opacity-60">
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Add Student'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────
const input = (err) =>
  `w-full border ${err ? 'border-red-400' : 'border-slate-200'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`;

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{title}</p>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({ label, children, error }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}
