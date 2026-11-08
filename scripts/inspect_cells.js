const xlsx = require('xlsx');

const compFile = 'C:\\Users\\Usuário\\Downloads\\LaMore_vs_PDV_Comparativo.xlsx';
const wbComp = xlsx.readFile(compFile);

console.log("SheetNames:", wbComp.SheetNames);
wbComp.SheetNames.forEach(name => {
  const ws = wbComp.Sheets[name];
  console.log(`\nSheet: ${name}, ref: ${ws['!ref']}`);
  const keys = Object.keys(ws).filter(k => !k.startsWith('!'));
  console.log(`Total cells: ${keys.length}`);
  keys.slice(0, 30).forEach(k => {
    console.log(`${k} = ${ws[k].v}`);
  });
});
