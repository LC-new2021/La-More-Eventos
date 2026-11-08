const xlsx = require('xlsx');
const comparativoPath = 'C:\\Users\\Usuário\\Downloads\\LaMore_vs_PDV_Comparativo.xlsx';
const wbComp = xlsx.readFile(comparativoPath);

console.log("SheetNames:", wbComp.SheetNames);
wbComp.SheetNames.forEach(name => {
  console.log(`\n=================== ABA: ${name} ===================`);
  const raw = xlsx.utils.sheet_to_json(wbComp.Sheets[name], { header: 1 });
  raw.forEach((row, i) => {
    if (row && row.length > 0) {
      console.log(`[${i}]`, JSON.stringify(row));
    }
  });
});
