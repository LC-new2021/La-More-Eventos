const xlsx = require('xlsx');
const fs = require('fs');

const compFile = 'C:\\Users\\Usuário\\Downloads\\LaMore_vs_PDV_Comparativo.xlsx';
const wbComp = xlsx.readFile(compFile);

const lmData = xlsx.utils.sheet_to_json(wbComp.Sheets['La More Eventos']);
const pdvData = xlsx.utils.sheet_to_json(wbComp.Sheets['PDV Legal (Ec34)']);

console.log("=== ITENS LA MORE EVENTOS ===");
console.table(lmData);

console.log("\n=== ITENS PDV LEGAL ===");
console.table(pdvData);
