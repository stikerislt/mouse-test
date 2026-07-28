/** PDF report export — no external libraries. */

export function exportPDF({ title = 'Report', lines = [] }) {
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  const objects = [];
  let y = 750;
  let stream = `BT /F1 16 Tf 50 ${y} Td (${esc(title)}) Tj ET\n`;
  y -= 24;
  stream += `BT /F1 9 Tf 50 ${y} Td (${esc('Generated: ' + new Date().toLocaleString())}) Tj ET\n`;

  for (const line of lines) {
    y -= 14;
    if (y < 60) break;
    stream += `BT /F1 9 Tf 50 ${y} Td (${esc(line)}) Tj ET\n`;
  }

  const resources = `<< /Font << /F1 5 0 R >> >>`;

  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objects[2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources ${resources} >>`;
  objects[3] = `<< /Length ${stream.length} >>\nstream\n${stream}endstream`;
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  downloadBlob(new Blob([pdf], { type: 'application/pdf' }), 'calibra-mouse-check.pdf');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildReportData(session, score) {
  const lines = [
    `Session: ${session.name || 'Mouse check'}`,
    `Overall: ${score?.overall ?? 'N/A'} / 100`,
    `Summary: ${score?.items?.length ? 'See checks below' : 'Incomplete'}`,
    '',
    '--- Checks ---',
  ];
  for (const item of score?.items || []) {
    lines.push(`${item.label}: ${item.status?.toUpperCase() || '—'} — ${item.summary || ''}`);
    if (item.fix) lines.push(`  Tip: ${item.fix}`);
  }
  if (score?.recommendations?.length) {
    lines.push('', '--- What to do ---');
    for (const r of score.recommendations) lines.push(`• ${r}`);
  }
  return lines;
}
