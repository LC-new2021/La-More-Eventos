const xlsx = require('xlsx');
const path = require('path');

const files = [
  'C:\\Users\\Usuário\\Downloads\\LaMore_vs_PDV_Comparativo.xlsx',
  'C:\\Users\\Usuário\\Downloads\\Total_Produtos mais vendidos_14 e 15 de agosto 2026.xlsx',
  'C:\\Users\\Usuário\\Downloads\\Produtos mais vendidos_15-08-2026_igreja deDeus.xlsx',
  'C:\\Users\\Usuário\\Downloads\\Produtos mais vendidos_14-08-2026-igrejadeDeus.xlsx',
  'C:\\Users\\Usuário\\Downloads\\Produtos mais vendidos_14-08-2026.xls',
  'C:\\Users\\Usuário\\Downloads\\ResumoGeralVendas_14-08-26.xlsx'
];

for (const file of files) {
  try {
    console.log(`\n======================================================`);
    console.log(`ARQUIVO: ${file}`);
    console.log(`======================================================`);
    const wb = xlsx.readFile(file);
    console.log('Abas:', wb.SheetNames);
    for (const sheetName of wb.SheetNames) {
      console.log(`--- ABA: ${sheetName} ---`);
      const data = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
      console.log(data.slice(0, 15));
    }
  } catch (e) {
    console.error(`Erro ao ler ${file}:`, e.message);
  }
}
