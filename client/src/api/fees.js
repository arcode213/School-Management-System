import api from './axios';

export const getFees        = (params) => api.get('/fees', { params });
export const addFee         = (data)   => api.post('/fees', data);
export const addBulkFees    = (data)   => api.post('/fees/bulk', data);
export const getStudentFees = (id)     => api.get(`/fees/student/${id}`);
export const getFee         = (id)     => api.get(`/fees/${id}`);
export const getDues        = ()       => api.get('/fees/dues');
export const updateFee      = (id, data) => api.put(`/fees/${id}`, data);
export const deleteFee      = (id)     => api.delete(`/fees/${id}`);

// Fee Structures
export const getFeeStructures = () => api.get('/fee-structures');
export const saveFeeStructure = (data) => api.post('/fee-structures', data);
export const getFeeOverrides  = () => api.get('/fee-structures/overrides');
export const saveFeeOverride  = (data) => api.post('/fee-structures/overrides', data);
export const deleteFeeOverride= (id) => api.delete(`/fee-structures/overrides/${id}`);
export const rolloverFeeStructure = (data) => api.post('/fee-structures/rollover', data);

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
  setTimeout(() => URL.revokeObjectURL(href), 1000);
  return filename;
};

export const exportFeeSummary = (params) => downloadReport('/fees/exports/summary', params);
