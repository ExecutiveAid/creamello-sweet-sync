export function exportToCSV<T>(data: T[], filename: string, columns?: { key: keyof T, label: string }[]) {
  if (!data.length) return;
  let csv = '';
  if (columns) {
    csv += columns.map(col => '"' + col.label + '"').join(',') + '\n';
    csv += data.map(row => columns.map(col => '"' + (row[col.key] ?? '') + '"').join(',')).join('\n');
  } else {
    const keys = Object.keys(data[0]);
    csv += keys.join(',') + '\n';
    csv += data.map(row => keys.map(k => '"' + (row[k as keyof T] ?? '') + '"').join(',')).join('\n');
  }
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
} 