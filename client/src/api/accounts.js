import api from './axios';

// ─── Ledger, summary and month closing ───────────────────────────────────────
export const getAccountsSummary = (params) => api.get('/accounts/summary', { params });
export const getLedger = (params) => api.get('/accounts/ledger', { params });
export const getClosedMonths = () => api.get('/accounts/closed-months');
export const closeMonth = (data) => api.post('/accounts/close-month', data);
export const reopenMonth = (data) => api.post('/accounts/reopen-month', data);

// ─── Categories ──────────────────────────────────────────────────────────────
export const getCategories = (params) => api.get('/expense-categories', { params });
export const createCategory = (data) => api.post('/expense-categories', data);
export const updateCategory = (id, data) => api.put(`/expense-categories/${id}`, data);
export const deleteCategory = (id) => api.delete(`/expense-categories/${id}`);

// ─── Recurring bills ─────────────────────────────────────────────────────────
export const getRecurring = (params) => api.get('/recurring-expenses', { params });
export const createRecurring = (data) => api.post('/recurring-expenses', data);
export const updateRecurring = (id, data) => api.put(`/recurring-expenses/${id}`, data);
export const deleteRecurring = (id) => api.delete(`/recurring-expenses/${id}`);
export const generateRecurring = () => api.post('/recurring-expenses/generate');

// ─── Expense approvals ───────────────────────────────────────────────────────
export const getPendingExpenses = () => api.get('/expenses/pending');
export const setExpenseStatus = (id, data) => api.patch(`/expenses/${id}/status`, data);

// ─── Salaries ────────────────────────────────────────────────────────────────
export const getSalarySheet = (params) => api.get('/salaries/sheet', { params });
export const paySalary = (data) => api.post('/salaries/pay', data);
export const getSalaryRecord = (id) => api.get(`/salaries/${id}`);
export const updateSalaryRecord = (id, data) => api.put(`/salaries/${id}`, data);
export const getAdvances = (params) => api.get('/salaries/advances', { params });
export const createAdvance = (data) => api.post('/salaries/advances', data);
export const cancelAdvance = (id) => api.delete(`/salaries/advances/${id}`);

// ─── Downloads ───────────────────────────────────────────────────────────────

/**
 * Fetches a report as a binary blob and saves it.
 *
 * It has to go through the axios instance rather than a plain `<a href>`: the
 * token and the campus/session headers are attached by the interceptor, and a
 * bare link would send none of them — the download would 401, or worse, return
 * another campus's figures.
 *
 * The filename comes from the server's Content-Disposition where it is readable,
 * so the report names itself.
 */
const downloadReport = async (url, params) => {
  const res = await api.get(url, { params, responseType: 'blob' });

  const disposition = res.headers['content-disposition'] || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : `report.${params.format === 'pdf' ? 'pdf' : 'xlsx'}`;

  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next tick — revoking immediately can cancel the download in
  // some browsers before it has read the blob.
  setTimeout(() => URL.revokeObjectURL(href), 1000);
  return filename;
};

export const exportPnl = (params) => downloadReport('/accounts/exports/pnl', params);
export const exportExpenseLedger = (params) => downloadReport('/accounts/exports/expenses', params);
export const exportSalarySheet = (params) => downloadReport('/salaries/exports/sheet', params);
