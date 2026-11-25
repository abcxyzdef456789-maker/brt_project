import React, { useState, useRef } from 'react';
import { UploadCloud, File, X, ImageIcon, FileText, FileSpreadsheet } from 'lucide-react';

const ACCEPTED = [
  '.csv', '.xlsx', '.xls', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.txt',
];

function fileIcon(name) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return <ImageIcon size={18} />;
  if (['csv', 'xlsx', 'xls'].includes(ext)) return <FileSpreadsheet size={18} />;
  if (ext === 'pdf') return <FileText size={18} />;
  return <File size={18} />;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Upload() {
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const addFiles = (list) => {
    const incoming = Array.from(list);
    if (!incoming.length) return;
    const tooBig = incoming.some((f) => f.size > 50 * 1024 * 1024);
    if (tooBig) {
      setError('Some files exceed the 50 MB limit.');
      return;
    }
    setError(null);
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const unique = incoming.filter((f) => !existing.has(`${f.name}-${f.size}`));
      return [...prev, ...unique];
    });
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const isImage = (name) => {
    const ext = name.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-bold mb-1">Upload Files</h2>
        <p className="text-sm text-muted mb-4">
          Upload CSV, XLSX, PDF, TXT, or image files. Files are kept locally in your session.
        </p>

        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-accent bg-accent-soft' : 'border-border hover:bg-accent-soft'
          }`}
          style={{ borderColor: dragOver ? 'var(--accent)' : 'var(--border)' }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED.join(',')}
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <UploadCloud className="mx-auto mb-3" size={40} style={{ color: 'var(--accent)' }} />
          <p className="font-medium">Drag & drop files here, or click to browse</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            CSV · XLSX · PDF · TXT · Images — up to 50 MB each
          </p>
          {error && (
            <p className="mt-3 text-sm text-red-500">{error}</p>
          )}
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Uploaded Files ({files.length})</h3>
            <button
              className="btn btn-ghost text-xs"
              onClick={() => setFiles([])}
            >
              Clear all
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((file, idx) => (
              <div
                key={`${file.name}-${file.size}`}
                className="rounded-xl border p-3 flex flex-col gap-2"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-soft)' }}
              >
                <div className="flex items-start justify-between">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    {fileIcon(file.name)}
                  </div>
                  <button
                    onClick={() => removeFile(idx)}
                    className="p-1 rounded hover:opacity-70"
                    style={{ color: 'var(--text-muted)' }}
                    title="Remove"
                  >
                    <X size={16} />
                  </button>
                </div>

                {isImage(file.name) ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-28 object-cover rounded-lg"
                  />
                ) : (
                  <div
                    className="w-full h-28 rounded-lg flex items-center justify-center"
                    style={{ background: 'var(--bg-card)' }}
                  >
                    {fileIcon(file.name)}
                  </div>
                )}

                <p className="text-sm font-medium truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {formatSize(file.size)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {files.length === 0 && (
        <div className="card text-center py-10" style={{ color: 'var(--text-muted)' }}>
          <p>No files uploaded yet.</p>
        </div>
      )}
    </div>
  );
}

export default Upload;
