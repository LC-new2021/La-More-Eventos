const xlsx = require('xlsx');

const comparativoPath = 'C:\\Users\\Usuário\\Downloads\\LaMore_vs_PDV_Comparativo.xlsx';
const wbComp = xlsx.readFile(comparativoPath);
const sheet = wbComp.Sheets[wbComp.SheetNames[0]];
const raw = xlsx.utils.sheet_to_json(sheet, { header: 1 });

console.log("=== LINHAS BRUTAS DO COMPARATIVO ===");
raw.forEach((row, i) => {
  if (row && row.length > 0) {
    console.log(`[${i}]`, JSON.stringify(row));
  }
});
