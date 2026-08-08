import { useState } from 'react';
import { FileDown, FileSpreadsheet, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * The Excel / PDF pair that sits above every report.
 *
 * Downloads go through the API client, not a plain link, so the auth token and
 * the campus/session headers travel with them — a bare `<a href>` would either be
 * rejected or, worse, return the wrong campus's figures.
 *
 * Each button disables only itself while it is working, so asking for the PDF
 * does not grey out the spreadsheet.
 */
export default function ExportButtons({ onExport, params = {}, disabled = false, label = 'Export' }) {
  const [busy, setBusy] = useState(null);

  const run = async (format) => {
    setBusy(format);
    try {
      const filename = await onExport({ ...params, format });
      toast.success(`${filename} downloaded`);
    } catch (e) {
      // A failed download arrives as a Blob, not JSON, because the request asked
      // for one — so the real message has to be read back out of it.
      let message = 'Export failed';
      try {
        const text = await e.response?.data?.text?.();
        if (text) message = JSON.parse(text).message || message;
      } catch { /* fall through to the generic message */ }
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => run('xlsx')}
        disabled={disabled || busy !== null}
        className="btn btn-ghost disabled:opacity-50"
        title={`${label} as Excel`}
      >
        {busy === 'xlsx' ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
        Excel
      </button>
      <button
        onClick={() => run('pdf')}
        disabled={disabled || busy !== null}
        className="btn btn-ghost disabled:opacity-50"
        title={`${label} as PDF`}
      >
        {busy === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
        PDF
      </button>
    </div>
  );
}
