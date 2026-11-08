const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable').default || require('jspdf-autotable');
const xlsx = require('xlsx');

async function generateUnifiedPDF() {
  const compFile = 'C:\\Users\\Usuário\\Downloads\\LaMore_vs_PDV_Comparativo_Unificado.xlsx';
  const wb = xlsx.readFile(compFile);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets['Comparativo Unificado'], { header: 1 });

  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(16);
  doc.setTextColor(29, 52, 97);
  doc.text("LA MORE EVENTOS  x  PDV LEGAL (EC 34 Ceilândia)", 14, 15);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Relatório Comparativo Unificado de Vendas por Família de Produtos", 14, 21);
  doc.text("Produtos com nomes equivalentes (ex: Churrasquinho/Espetinho/Promos, Pastéis, Caldos e Bebidas) unificados.", 14, 26);

  const tableData = [];
  // Linhas a partir da linha 5 (index 5)
  for (let i = 5; i < rows.length; i++) {
    const r = rows[i];
    if (r && r.length > 1) {
      tableData.push([
        r[0] || '',
        r[1] || '',
        r[2] || '',
        r[3] !== undefined ? String(r[3]) : '—',
        r[4] !== undefined ? String(r[4]) : '—',
        r[5] !== undefined ? String(r[5]) : '—',
        r[6] !== undefined ? String(r[6]) : '—',
        r[8] || ''
      ]);
    }
  }

  autoTable(doc, {
    startY: 30,
    head: [["#", "Produto / Família Unificada", "Categoria", "Qtd La More", "Qtd PDV Legal", "Total Ambos", "Diferença", "Análise de Desempenho"]],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [29, 52, 97], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 48, fontStyle: 'bold' },
      2: { cellWidth: 32 },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 24, halign: 'center' },
      5: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 20, halign: 'center' },
      7: { cellWidth: 85 }
    },
    didParseCell: function(data) {
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [220, 230, 242];
      }
    }
  });

  const pdfPath = 'C:\\Users\\Usuário\\Downloads\\LaMore_vs_PDV_Comparativo_Unificado.pdf';
  doc.save(pdfPath);
  console.log(`✅ PDF COMPARATIVO UNIFICADO GERADO: ${pdfPath}`);
}

generateUnifiedPDF().catch(console.error);
