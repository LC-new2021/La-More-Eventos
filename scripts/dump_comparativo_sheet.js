const xlsx = require('xlsx');

const comparativoPath = 'C:\\Users\\Usuário\\Downloads\\LaMore_vs_PDV_Comparativo.xlsx';
const wbComp = xlsx.readFile(comparativoPath);

console.log('SheetNames:', wbComp.SheetNames);
for (const name of wbComp.SheetNames) {
  console.log(`\n=================== ABA: ${name} ===================`);
  const sheet = wbComp.Sheets[name];
  const rows = xlsx.utils.sheet_to_json(sheet);
  console.log('Total rows:', rows.length);
  console.log('First 5 rows:', rows.slice(0, 5));
  console.log('All rows:');
  console.table(rows);
}
