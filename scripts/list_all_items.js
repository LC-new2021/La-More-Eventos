const xlsx = require('xlsx');

const compFile = 'C:\\Users\\Usuário\\Downloads\\LaMore_vs_PDV_Comparativo.xlsx';
const wbComp = xlsx.readFile(compFile);

const lmRows = xlsx.utils.sheet_to_json(wbComp.Sheets['LaMore_Eventos']);
const pdvRows = xlsx.utils.sheet_to_json(wbComp.Sheets['PDV_Ec34_2025']);

console.log("=== TODOS OS PRODUTOS DA LA MORE ===");
console.table(lmRows);

console.log("\n=== TODOS OS PRODUTOS DO PDV LEGAL ===");
console.table(pdvRows);
