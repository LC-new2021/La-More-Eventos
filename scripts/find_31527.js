const xlsx = require('xlsx');

const file1 = 'C:\\Users\\Usuário\\Downloads\\LaMore_Auditoria_Definitiva_EC34.xlsx';
const file2 = 'C:\\Users\\Usuário\\Downloads\\LaMore_vs_PDV_Comparativo_Unificado.xlsx';
const file3 = 'C:\\Users\\Usuário\\Downloads\\LaMore_vs_PDV_Comparativo.xlsx';

function inspectSheetTotals(filename) {
  console.log(`\n======================================================`);
  console.log(`ARQUIVO: ${filename}`);
  console.log(`======================================================`);
  try {
    const wb = xlsx.readFile(filename);
    wb.SheetNames.forEach(sheetName => {
      console.log(`--- ABA: ${sheetName} ---`);
      const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
      rows.forEach((r, idx) => {
        const str = JSON.stringify(r);
        if (str.includes('31527') || str.includes('31.527') || str.includes('33306') || str.includes('33.306') || str.includes('TOTAL') || str.includes('Subtotal')) {
          console.log(`Linha ${idx}:`, r);
        }
      });
    });
  } catch (e) {
    console.error(`Erro ao ler ${filename}:`, e.message);
  }
}

inspectSheetTotals(file1);
inspectSheetTotals(file2);
inspectSheetTotals(file3);
