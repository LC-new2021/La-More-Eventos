const xlsx = require('xlsx');

const compFile = 'C:\\Users\\Usuário\\Downloads\\LaMore_vs_PDV_Comparativo.xlsx';
const wbComp = xlsx.readFile(compFile);

const lmRaw = xlsx.utils.sheet_to_json(wbComp.Sheets['La More Eventos'], { header: 1 });
const pdvRaw = xlsx.utils.sheet_to_json(wbComp.Sheets['PDV Legal (Ec34)'], { header: 1 });

console.log("=== LA MORE RAW ===");
lmRaw.forEach((r, i) => console.log(i, JSON.stringify(r)));

console.log("\n=== PDV RAW ===");
pdvRaw.forEach((r, i) => console.log(i, JSON.stringify(r)));
