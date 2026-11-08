const xlsx = require('xlsx');

const comparativoPath = 'C:\\Users\\Usuário\\Downloads\\LaMore_vs_PDV_Comparativo.xlsx';
const totalPdvPath = 'C:\\Users\\Usuário\\Downloads\\Total_Produtos mais vendidos_14 e 15 de agosto 2026.xlsx';

console.log('=== LENDO LaMore_vs_PDV_Comparativo.xlsx ===');
const wbComp = xlsx.readFile(comparativoPath);
wbComp.SheetNames.forEach(name => {
  console.log(`\n--- ABA: ${name} ---`);
  const rows = xlsx.utils.sheet_to_json(wbComp.Sheets[name]);
  console.log(`Total linhas: ${rows.length}`);
  console.table(rows.slice(0, 40));
});

console.log('\n=== LENDO Total_Produtos mais vendidos_14 e 15 de agosto 2026.xlsx ===');
const wbPdv = xlsx.readFile(totalPdvPath);
wbPdv.SheetNames.forEach(name => {
  console.log(`\n--- ABA: ${name} ---`);
  const rows = xlsx.utils.sheet_to_json(wbPdv.Sheets[name]);
  console.log(`Total linhas: ${rows.length}`);
  console.table(rows);
});
