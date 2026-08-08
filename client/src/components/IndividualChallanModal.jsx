import { useState, useEffect, useCallback, useMemo } from 'react';
import { addFee, updateFee, getFeeStructures, getFeeOverrides } from '../api/fees';
import { getStudents } from '../api/students';
import toast from 'react-hot-toast';
import { X, Search, Loader2, FileText } from 'lucide-react';
import ModalPortal from './ModalPortal';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const blankForm = () => ({
  feeMonth: MONTHS[new Date().getMonth()],
  feeYear: new Date().getFullYear(),
  dueDate: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString().split('T')[0],
  tuitionFee: 0,
  examFee: 0,
  transportFee: 0,
  miscFee: 0,
  previousDues: 0,
  // Annual fee is opt-in per challan.
  chargeAnnualFee: false,
  annualFee: 0,
  previousAnnualDues: 0,
});

// Dual-purpose modal: create an individual challan (with student search) or
// edit an existing challan's charges (feeRecord supplied).
export default function IndividualChallanModal({ open, onClose, onSaved, feeRecord }) {
  const isEdit = Boolean(feeRecord);

  const [form, setForm] = useState(blankForm());
  const [loading, setLoading] = useState(false);
  // Only true once the user overtypes the auto-detected annual fee.
  const [annualEdited, setAnnualEdited] = useState(false);

  // Student selection (create mode only)
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Class fee structures + per-student overrides, used to auto-fill the fee
  // fields when a student is picked (create mode only).
  const [feeStructures, setFeeStructures] = useState([]);
  const [feeOverrides, setFeeOverrides] = useState([]);

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setForm({
        feeMonth: feeRecord.feeMonth,
        feeYear: feeRecord.feeYear,
        dueDate: feeRecord.dueDate ? feeRecord.dueDate.substring(0, 10) : blankForm().dueDate,
        tuitionFee: feeRecord.tuitionFee || 0,
        examFee: feeRecord.examFee || 0,
        transportFee: feeRecord.transportFee || 0,
        miscFee: feeRecord.miscFee || 0,
        previousDues: feeRecord.previousDues || 0,
        chargeAnnualFee: (feeRecord.annualFee || 0) > 0,
        annualFee: feeRecord.annualFee || 0,
        previousAnnualDues: feeRecord.previousAnnualDues || 0,
      });
      setSelectedStudent({
        _id: feeRecord.student?._id || feeRecord.student,
        fullName: feeRecord.studentInfo?.fullName || feeRecord.student?.fullName,
        fatherName: feeRecord.studentInfo?.fatherName || feeRecord.student?.fatherName,
        class: feeRecord.studentInfo?.class,
        section: feeRecord.studentInfo?.section,
        isFreeship: feeRecord.studentInfo?.isFreeship,
      });
    } else {
      setForm(blankForm());
      setSelectedStudent(null);
      setQuery('');
      setResults([]);
    }
    setAnnualEdited(false);
  }, [open, feeRecord, isEdit]);

  // Load class fee structures + student overrides once the modal opens in
  // create mode, so selecting a student can auto-fill their fees.
  useEffect(() => {
    if (!open || isEdit) return;
    Promise.all([getFeeStructures(), getFeeOverrides()])
      .then(([sRes, oRes]) => {
        setFeeStructures(sRes.data || []);
        setFeeOverrides(oRes.data || []);
      })
      .catch(() => {});
  }, [open, isEdit]);

  const pick = (custom, base) =>
    custom !== undefined && custom !== null ? Number(custom) : Number(base || 0);

  // Fill the recurring fee fields from the student's class fee structure,
  // letting any per-student override win — mirrors the bulk fee generator so
  // individual and monthly challans stay consistent.
  const applyStudentFees = (student) => {
    if (!student) return;
    const struct = feeStructures.find(s => s.className === student.class);
    const override = feeOverrides.find(
      o => String(o.student?._id || o.student) === String(student._id)
    );

    setForm(f => ({
      ...f,
      tuitionFee: pick(override?.customTuitionFee, struct?.tuitionFee),
      transportFee: pick(override?.customTransportFee, struct?.transportFee),
      miscFee: pick(override?.customMiscFee, struct?.miscFee),
    }));
  };

  // The annual fee configured for this student — their own annual fee override if
  // they have one, otherwise their class's annual fee from Fee Structures.
  //
  // DERIVED rather than copied into the form when the student is picked: the
  // structures and overrides load asynchronously, so a copy taken at selection time
  // was 0 whenever the user picked a student before they arrived, and the amount then
  // had to be typed in by hand.
  const autoAnnualFee = useMemo(() => {
    if (isEdit || !selectedStudent) return 0;
    const struct = feeStructures.find(s => s.className === selectedStudent.class);
    const override = feeOverrides.find(
      o => String(o.student?._id || o.student) === String(selectedStudent._id)
    );
    return pick(override?.customAnnualFee, struct?.annualFee);
  }, [isEdit, selectedStudent, feeStructures, feeOverrides]);

  // True when this student's amount comes from their own override rather than the
  // class default — worth saying so on screen, since it explains a differing figure.
  const hasAnnualOverride = useMemo(() => {
    if (isEdit || !selectedStudent) return false;
    const override = feeOverrides.find(
      o => String(o.student?._id || o.student) === String(selectedStudent._id)
    );
    return override?.customAnnualFee !== undefined && override?.customAnnualFee !== null;
  }, [isEdit, selectedStudent, feeOverrides]);

  // Debounced student search
  const runSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const { data } = await getStudents({ search: q, status: 'Active', limit: 8 });
      setResults(data.students);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (isEdit || !open) return;
    const t = setTimeout(() => runSearch(query), 350);
    return () => clearTimeout(t);
  }, [query, isEdit, open, runSearch]);

  if (!open) return null;

  const setNum = (key, v) => setForm(f => ({ ...f, [key]: v === '' ? '' : Number(v) }));

  // Freeship students never receive a challan. Blocked here for immediate feedback;
  // the server rejects it too.
  const blockedByFreeship = !isEdit && !!selectedStudent?.isFreeship;

  // In create mode the amount comes from Fee Structures unless the user overtyped it;
  // in edit mode it is whatever the challan already carries.
  const annualBase = isEdit || annualEdited ? (Number(form.annualFee) || 0) : autoAnnualFee;
  const annualCharge = form.chargeAnnualFee ? annualBase : 0;

  const currentTotal =
    (Number(form.tuitionFee) || 0) + (Number(form.examFee) || 0) +
    (Number(form.transportFee) || 0) + (Number(form.miscFee) || 0) +
    annualCharge +
    (isEdit ? (Number(form.previousDues) || 0) + (Number(form.previousAnnualDues) || 0) : 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !selectedStudent) {
      toast.error('Please select a student');
      return;
    }
    if (blockedByFreeship) {
      toast.error('This student is on Freeship — their fees are waived, so no challan can be generated.');
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        await updateFee(feeRecord._id, {
          feeMonth: form.feeMonth,
          feeYear: form.feeYear,
          dueDate: form.dueDate,
          tuitionFee: Number(form.tuitionFee) || 0,
          examFee: Number(form.examFee) || 0,
          transportFee: Number(form.transportFee) || 0,
          miscFee: Number(form.miscFee) || 0,
          annualFee: annualCharge,
          previousDues: Number(form.previousDues) || 0,
          previousAnnualDues: Number(form.previousAnnualDues) || 0,
        });
        toast.success('Challan updated successfully');
      } else {
        const res = await addFee({
          student: selectedStudent._id,
          studentAcademicRecord: selectedStudent.academicRecordId,
          feeMonth: form.feeMonth,
          feeYear: form.feeYear,
          dueDate: form.dueDate,
          tuitionFee: Number(form.tuitionFee) || 0,
          examFee: Number(form.examFee) || 0,
          transportFee: Number(form.transportFee) || 0,
          miscFee: Number(form.miscFee) || 0,
          // Sending 0 for an un-edited amount lets the server resolve it from this
          // student's annual fee override, then their class fee structure — the same
          // resolution the class batch uses, so both paths always agree.
          chargeAnnualFee: form.chargeAnnualFee,
          annualFee: form.chargeAnnualFee && annualEdited ? annualCharge : 0,
        });
        // The server drops a duplicate annual fee and says so; surface that rather
        // than a plain success, or the smaller total looks like a bug.
        toast.success(res.data?.notice || 'Challan generated successfully');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save challan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal>
    <div className="modal-shell">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-box bg-solid shadow-2xl sm:max-w-lg">
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-line flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-brand rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText className="t-body w-4 h-4" />
            </div>
            <h2 className="font-semibold t-body truncate">{isEdit ? `Edit Challan ${feeRecord.challanNo}` : 'Generate Individual Challan'}</h2>
          </div>
          <button onClick={onClose} className="icon-btn flex-shrink-0" aria-label="Close"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 sm:px-6 py-5 space-y-4 overflow-y-auto">
          {/* Student selector */}
          {isEdit ? (
            <div className="bg-surface-2 rounded-xl p-3 border border-line text-sm">
              <span className="t-faint">Student: </span>
              <span className="font-semibold t-body">
                {selectedStudent?.fullName} {selectedStudent?.class ? `(Class ${selectedStudent.class}${selectedStudent.section ? ' ' + selectedStudent.section : ''})` : ''}
              </span>
              {selectedStudent?.fatherName && (
                <span className="block text-xs t-faint">s/o {selectedStudent.fatherName}</span>
              )}
            </div>
          ) : selectedStudent ? (
            <div className={`rounded-xl p-3 border text-sm ${blockedByFreeship ? 'bg-warn-soft border-warn-border' : 'bg-ok-soft border-ok-border'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="t-faint">Student: </span>
                  <span className="font-semibold t-body">
                    {selectedStudent.fullName} (Class {selectedStudent.class}{selectedStudent.section ? ' ' + selectedStudent.section : ''})
                  </span>
                  {selectedStudent.fatherName && (
                    <span className="block text-xs t-faint">s/o {selectedStudent.fatherName}</span>
                  )}
                </div>
                <button type="button" onClick={() => setSelectedStudent(null)} className="text-xs t-brand hover:underline">Change</button>
              </div>
              {blockedByFreeship && (
                <p className="text-xs t-warn mt-2 font-medium">
                  This student is on <strong>Freeship</strong> — their fees are waived, so no challan can be generated.
                  Remove the Freeship flag from their record first if this is wrong.
                </p>
              )}
            </div>
          ) : (
            <div className="relative">
              <label className="block text-xs font-medium t-muted mb-1">Find Student</label>
              <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-surface-2">
                <Search size={16} className="t-muted" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search by name, ID, father, roll..."
                  className="bg-transparent outline-none w-full text-sm"
                />
                {searching && <Loader2 size={14} className="animate-spin t-muted" />}
              </div>
              {results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-solid border border-line rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {results.map(s => (
                    <button
                      key={s.academicRecordId || s._id}
                      type="button"
                      onClick={() => { setSelectedStudent(s); applyStudentFees(s); setResults([]); setQuery(''); }}
                      className="w-full text-left px-3 py-2 hover:bg-surface-2 text-sm border-b border-line last:border-0"
                    >
                      <div className="font-medium t-body flex items-center gap-1.5">
                        {s.fullName}
                        {s.isFreeship && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-warn-soft t-warn">
                            FREESHIP
                          </span>
                        )}
                      </div>
                      {s.fatherName && <div className="text-xs t-faint">s/o {s.fatherName}</div>}
                      <div className="text-xs t-faint">{s.studentId} • Class {s.class}{s.section ? ' ' + s.section : ''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium t-muted mb-1">Fee Month</label>
              <select value={form.feeMonth} onChange={e => setForm({ ...form, feeMonth: e.target.value })} className="w-full text-sm border rounded-lg px-3 py-2 bg-surface-2">
                {MONTHS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium t-muted mb-1">Fee Year</label>
              <input type="number" value={form.feeYear} onChange={e => setNum('feeYear', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 bg-surface-2" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium t-muted mb-1">Tuition Fee</label>
              <input type="number" value={form.tuitionFee} onChange={e => setNum('tuitionFee', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 bg-surface-2" />
            </div>
            <div>
              <label className="block text-xs font-medium t-muted mb-1">Transport Fee</label>
              <input type="number" value={form.transportFee} onChange={e => setNum('transportFee', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 bg-surface-2" />
            </div>
            <div>
              <label className="block text-xs font-medium t-muted mb-1">Exam Fee</label>
              <input type="number" value={form.examFee} onChange={e => setNum('examFee', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 bg-surface-2" />
            </div>
            <div>
              <label className="block text-xs font-medium t-muted mb-1">Misc Fee</label>
              <input type="number" value={form.miscFee} onChange={e => setNum('miscFee', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 bg-surface-2" />
            </div>
          </div>

          {/* Annual fee — opt in for this challan */}
          <div className={`rounded-lg border px-3 py-3 transition ${form.chargeAnnualFee ? 'border-brand-border bg-brand-soft' : 'border-line bg-surface-2'}`}>
            <label htmlFor="chal-chargeAnnual" className="flex items-start gap-2.5 cursor-pointer">
              <input
                id="chal-chargeAnnual"
                type="checkbox"
                checked={form.chargeAnnualFee}
                onChange={e => setForm(f => ({ ...f, chargeAnnualFee: e.target.checked }))}
                className="mt-0.5 flex-shrink-0"
              />
              <span>
                <span className="block text-sm font-medium t-body">Charge the annual fee on this challan</span>
                <span className="block text-xs t-faint mt-0.5">
                  Prints as its own “Annual Fee” line.
                  {!isEdit && ' The amount is taken from Fee Structures automatically. Charged once per session — if this student was already charged it, it will not be added again.'}
                </span>
              </span>
            </label>
            {form.chargeAnnualFee && (
              <div className="mt-3 pl-7">
                {/* Create mode shows the amount already resolved for this student, so
                    nothing has to be typed or looked up. Edit mode keeps a plain input:
                    it is changing what the challan already carries, not picking a new
                    amount from Fee Structures. */}
                {!isEdit && !annualEdited ? (
                  <div className="flex items-center justify-between gap-3 bg-solid border border-brand-border rounded-lg px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium t-faint uppercase tracking-wide">Annual Fee</p>
                      <p className="text-lg font-bold t-brand leading-tight">
                        Rs. {autoAnnualFee.toLocaleString()}
                      </p>
                      <p className="text-[11px] t-faint mt-0.5">
                        {!selectedStudent
                          ? 'Select a student to load their annual fee'
                          : hasAnnualOverride
                            ? "This student's custom annual fee"
                            : `From Fee Structures${selectedStudent.class ? ` — Class ${selectedStudent.class}` : ''}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setAnnualEdited(true); setNum('annualFee', autoAnnualFee); }}
                      className="flex-shrink-0 text-xs font-medium t-brand hover:t-brand hover:underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium t-muted">Annual Fee Amount (Rs.)</label>
                      {!isEdit && (
                        <button
                          type="button"
                          onClick={() => { setAnnualEdited(false); setNum('annualFee', 0); }}
                          className="text-xs font-medium t-faint hover:t-body hover:underline"
                        >
                          Use Fee Structures
                        </button>
                      )}
                    </div>
                    <input type="number" min="0" value={form.annualFee} onChange={e => setNum('annualFee', e.target.value)}
                      className="w-full text-sm border rounded-lg px-3 py-2 bg-solid" placeholder="e.g. 3000" />
                  </>
                )}

                {!isEdit && !annualEdited && selectedStudent && autoAnnualFee === 0 && (
                  <p className="text-[11px] t-warn bg-warn-soft border border-warn-border rounded px-2 py-1.5 mt-2">
                    No annual fee is set for Class {selectedStudent.class} in Fee Structures, and this
                    student has no annual fee override. Use “Change” to enter an amount.
                  </p>
                )}
              </div>
            )}
          </div>

          {isEdit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium t-muted mb-1">Previous Dues (monthly)</label>
                <input type="number" value={form.previousDues} onChange={e => setNum('previousDues', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 bg-surface-2" />
              </div>
              <div>
                <label className="block text-xs font-medium t-muted mb-1">Previous Annual Fee</label>
                <input type="number" value={form.previousAnnualDues} onChange={e => setNum('previousAnnualDues', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 bg-surface-2" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium t-muted mb-1">Due Date</label>
            <input type="date" required value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="w-full text-sm border rounded-lg px-3 py-2 bg-surface-2" />
          </div>

          <div className="flex justify-between items-center bg-surface-2 px-3 py-2 rounded-lg text-sm">
            <span className="t-faint">{isEdit ? 'New Total Amount' : 'Current Charges'}:</span>
            <span className="font-bold t-body">Rs. {currentTotal.toLocaleString()}</span>
          </div>
          {!isEdit && (
            <p className="text-xs t-muted">
              Fees are auto-filled from the student's class fee structure (and any override) — edit if needed.
              Any unpaid previous dues are automatically rolled into the new challan.
            </p>
          )}

          <div className="pt-2 modal-actions">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium t-muted hover:bg-surface-2 border border-line rounded-xl transition">Cancel</button>
            <button type="submit" disabled={loading || blockedByFreeship} className="px-5 py-2.5 text-sm font-medium bg-brand t-body rounded-xl hover:bg-brand transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? 'Update Challan' : 'Generate Challan'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}
