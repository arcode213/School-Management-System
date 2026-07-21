import { useState } from 'react';
import { X, UploadCloud, FileSpreadsheet, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import * as xlsx from 'xlsx';
import api from '../api/axios';

export default function ImportExcelModal({ open, onClose, onImportSuccess, type }) {
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  if (!open) return null;

  const downloadTemplate = () => {
    let headers = [];
    let fileName = '';
    
    if (type === 'students') {
      headers = [
        'fullName', 'fatherName', 'fatherOccupation', 'dateOfBirth', 'placeOfBirth', 'gender', 
        'cast', 'religion', 'nationality', 'motherTongue', 'cnic', 'fatherCnic', 
        'phone', 'fatherContact', 'motherContact', 'emergencyContact', 
        'class', 'section', 'lastSchool', 'rollNumber', 'admissionDate', 'status', 'previousDues', 'address'
      ];
      fileName = 'students_template.xlsx';
    } else if (type === 'employees') {
      headers = [
        'fullName', 'fatherName', 'dateOfBirth', 'gender', 'cnic', 'phone', 'email', 
        'designation', 'department', 'subject', 'joiningDate', 'status', 
        'salary', 'allowances', 'deductions', 'qualification', 'experience', 'address'
      ];
      fileName = 'employees_template.xlsx';
    }

    const ws = xlsx.utils.aoa_to_sheet([headers]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Template");
    xlsx.writeFile(wb, fileName);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file) => {
    if (!file) return;
    
    if (!file.name.match(/\.(xlsx|xls|csv)$/)) {
      toast.error('Please upload a valid Excel or CSV file.');
      return;
    }

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = xlsx.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const parsedData = xlsx.utils.sheet_to_json(sheet, { defval: '' });

      if (parsedData.length === 0) {
        toast.error('The file is empty.');
        setLoading(false);
        return;
      }

      // NOTE: the axios instance already has baseURL '.../api', so paths here must
      // NOT be prefixed with '/api' (doing so produced '/api/api/...' -> 404).
      const endpoint = type === 'students' ? '/students/bulk' : '/employees/bulk';
      const payloadKey = type === 'students' ? 'students' : 'employees';
      
      const res = await api.post(endpoint, { [payloadKey]: parsedData });
      
      toast.success(res.data.message || 'Imported successfully!');
      onImportSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to import data');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">
            Import {type === 'students' ? 'Students' : 'Employees'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          <div className="flex justify-between items-center bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="text-blue-500" size={24} />
              <div>
                <p className="text-sm font-semibold text-slate-700">Download Template</p>
                <p className="text-xs text-slate-500">Fill your data according to the format.</p>
              </div>
            </div>
            <button 
              onClick={downloadTemplate}
              className="px-4 py-2 bg-white text-blue-600 text-sm font-medium border border-blue-200 rounded-lg shadow-sm hover:bg-blue-50 transition">
              Download
            </button>
          </div>

          <div
            className={`relative flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-2xl transition ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={loading}
            />
            <div className="flex flex-col items-center pointer-events-none">
              <UploadCloud size={40} className={`mb-3 ${dragActive ? 'text-blue-500' : 'text-slate-400'}`} />
              <p className="text-sm font-medium text-slate-700">Drag & Drop file here</p>
              <p className="text-xs text-slate-500 mt-1">or click to browse (.xlsx, .csv)</p>
            </div>
          </div>
          
          <div className="mt-4 flex items-start gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg text-xs">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <p>Make sure the header names exactly match the template. Invalid data may cause the entire import to fail.</p>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
          <button type="button" onClick={onClose} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">
            Cancel
          </button>
        </div>
        
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mb-3" />
            <p className="text-sm font-medium text-slate-700">Processing File...</p>
          </div>
        )}
      </div>
    </div>
  );
}
