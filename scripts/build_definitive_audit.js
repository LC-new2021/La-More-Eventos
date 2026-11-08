const ExcelJS = require('exceljs');
const path = require('path');

async function buildDefinitiveAuditSpreadsheet() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "La More Eventos";
  workbook.created = new Date();

  // Dados consolidados do evento EC 34 Ceilândia
  const familias = [
    {
      pos: "1º",
      familia: "Refrigerante",
      categoria: "Bebidas",
      qtdNormal: 1139,
      fatNormal: 2278.00,
      precoNormal: 2.00,
      qtdPromo: 0,
      fatPromo: 0.00,
      precoPromoDesc: "—",
      qtdTotal: 1139,
      fatTotal: 2278.00,
      detalhamento: "1.139 latas/copos a R$ 2,00 cada (621 bipadas)"
    },
    {
      pos: "2º",
      familia: "Picolé",
      categoria: "Delícias / Doces",
      qtdNormal: 684,
      fatNormal: 1368.00,
      precoNormal: 2.00,
      qtdPromo: 0,
      fatPromo: 0.00,
      precoPromoDesc: "—",
      qtdTotal: 684,
      fatTotal: 1368.00,
      detalhamento: "684 picolés a R$ 2,00 cada (333 bipadas)"
    },
    {
      pos: "3º",
      familia: "Churrasquinho / Espetinho",
      categoria: "Alimentos / Comidas",
      qtdNormal: 464,
      fatNormal: 4640.00,
      precoNormal: 10.00,
      qtdPromo: 43,
      fatPromo: 344.00,
      precoPromoDesc: "Promo R$ 8,00",
      qtdTotal: 507,
      fatTotal: 4984.00,
      detalhamento: "Normal: 464 espetinhos a R$ 10,00 (R$ 4.640) + Promoção: 43 espetinhos a R$ 8,00 (R$ 344) = 507 espetinhos"
    },
    {
      pos: "4º",
      familia: "Pescaria",
      categoria: "Brinquedos / Diversão",
      qtdNormal: 509,
      fatNormal: 4072.00,
      precoNormal: 8.00,
      qtdPromo: 0,
      fatPromo: 0.00,
      precoPromoDesc: "—",
      qtdTotal: 509,
      fatTotal: 4072.00,
      detalhamento: "509 fichas de pescaria a R$ 8,00 cada (344 bipadas)"
    },
    {
      pos: "5º",
      familia: "Pastel",
      categoria: "Alimentos / Comidas",
      qtdNormal: 364,
      fatNormal: 2912.00,
      precoNormal: 8.00,
      qtdPromo: 66,
      fatPromo: 330.00,
      precoPromoDesc: "Promo R$ 5,00",
      qtdTotal: 430,
      fatTotal: 3242.00,
      detalhamento: "Normal: 364 pastéis a R$ 8,00 (R$ 2.912) + Promoção: 66 pastéis a R$ 5,00 (R$ 330) = 430 pastéis"
    },
    {
      pos: "6º",
      familia: "Cachorro-quente",
      categoria: "Alimentos / Comidas",
      qtdNormal: 340,
      fatNormal: 2720.00,
      precoNormal: 8.00,
      qtdPromo: 20,
      fatPromo: 100.00,
      precoPromoDesc: "Promo R$ 5,00",
      qtdTotal: 360,
      fatTotal: 2820.00,
      detalhamento: "Normal: 340 lanches a R$ 8,00 (R$ 2.720) + Promoção: 20 lanches a R$ 5,00 (R$ 100) = 360 lanches"
    },
    {
      pos: "7º",
      familia: "Algodão-doce",
      categoria: "Delícias / Doces",
      qtdNormal: 252,
      fatNormal: 756.00,
      precoNormal: 3.00,
      qtdPromo: 0,
      fatPromo: 0.00,
      precoPromoDesc: "—",
      qtdTotal: 252,
      fatTotal: 756.00,
      detalhamento: "252 algodões-doces a R$ 3,00 cada (179 bipadas)"
    },
    {
      pos: "8º",
      familia: "Brinquedos / Estalinho",
      categoria: "Brinquedos / Diversão",
      qtdNormal: 170,
      fatNormal: 1360.00,
      precoNormal: 8.00,
      qtdPromo: 39,
      fatPromo: 78.00,
      precoPromoDesc: "Estalinho R$ 2,00",
      qtdTotal: 209,
      fatTotal: 1438.00,
      detalhamento: "Brinquedos: 170 fichas a R$ 8,00 (R$ 1.360) + Estalinhos: 39 caixinhas a R$ 2,00 (R$ 78) = 209 unidades"
    },
    {
      pos: "9º",
      familia: "Arroz Carreteiro",
      categoria: "Alimentos / Comidas",
      qtdNormal: 192,
      fatNormal: 2880.00,
      precoNormal: 15.00,
      qtdPromo: 16,
      fatPromo: 152.00,
      precoPromoDesc: "Promos R$ 12/10/5",
      qtdTotal: 208,
      fatTotal: 3032.00,
      detalhamento: "Normal: 192 porções a R$ 15,00 (R$ 2.880) + Promo R$12 (6 un) + Promo R$10 (6 un) + Promo R$5 (4 un) = 208 porções"
    },
    {
      pos: "10º",
      familia: "Sorvetes (Pote + Combo Leve 2)",
      categoria: "Delícias / Doces",
      qtdNormal: 86,
      fatNormal: 516.00,
      precoNormal: 6.00,
      qtdPromo: 116,
      fatPromo: 580.00,
      precoPromoDesc: "Combo R$ 10 (2 potes = R$ 5 un)",
      qtdTotal: 202,
      fatTotal: 1096.00,
      detalhamento: "Pote avulso: 86 un a R$ 6,00 (R$ 516) + Combo Compre 1 Leve 2 a R$ 10: 58 combos comprados = 116 potes entregues (R$ 580) = 202 potes"
    },
    {
      pos: "11º",
      familia: "Embalagem / Sacolinha",
      categoria: "Outros / Diversos",
      qtdNormal: 156,
      fatNormal: 156.00,
      precoNormal: 1.00,
      qtdPromo: 5,
      fatPromo: 1.00,
      precoPromoDesc: "Sacolinha R$ 0,20",
      qtdTotal: 161,
      fatTotal: 157.00,
      detalhamento: "Embalagens: 156 un a R$ 1,00 (R$ 156) + Sacolinhas: 5 un a R$ 0,20 (R$ 1) = 161 unidades"
    },
    {
      pos: "12º",
      familia: "Cremosinho",
      categoria: "Delícias / Doces",
      qtdNormal: 146,
      fatNormal: 292.00,
      precoNormal: 2.00,
      qtdPromo: 0,
      fatPromo: 0.00,
      precoPromoDesc: "—",
      qtdTotal: 146,
      fatTotal: 292.00,
      detalhamento: "146 cremosinhos a R$ 2,00 cada (83 bipadas)"
    },
    {
      pos: "13º",
      familia: "Galinhada",
      categoria: "Alimentos / Comidas",
      qtdNormal: 136,
      fatNormal: 2040.00,
      precoNormal: 15.00,
      qtdPromo: 6,
      fatPromo: 52.00,
      precoPromoDesc: "Promos R$ 8/12",
      qtdTotal: 142,
      fatTotal: 2092.00,
      detalhamento: "Normal: 136 porções a R$ 15,00 (R$ 2.040) + Promo R$8 (5 un) + Promo R$12 (1 un) = 142 porções"
    },
    {
      pos: "14º",
      familia: "Água Mineral",
      categoria: "Bebidas",
      qtdNormal: 135,
      fatNormal: 405.00,
      precoNormal: 3.00,
      qtdPromo: 0,
      fatPromo: 0.00,
      precoPromoDesc: "—",
      qtdTotal: 135,
      fatTotal: 405.00,
      detalhamento: "135 garrafas de água a R$ 3,00 cada (113 bipadas)"
    },
    {
      pos: "15º",
      familia: "Canjica",
      categoria: "Delícias / Doces",
      qtdNormal: 114,
      fatNormal: 912.00,
      precoNormal: 8.00,
      qtdPromo: 13,
      fatPromo: 65.00,
      precoPromoDesc: "Promo R$ 5,00",
      qtdTotal: 127,
      fatTotal: 977.00,
      detalhamento: "Normal: 114 potes a R$ 8,00 (R$ 912) + Promoção: 13 potes a R$ 5,00 (R$ 65) = 127 potes"
    },
    {
      pos: "16º",
      familia: "Pizza",
      categoria: "Alimentos / Comidas",
      qtdNormal: 104,
      fatNormal: 832.00,
      precoNormal: 8.00,
      qtdPromo: 7,
      fatPromo: 42.00,
      precoPromoDesc: "Promo R$ 6,00",
      qtdTotal: 111,
      fatTotal: 874.00,
      detalhamento: "Normal: 104 fatias a R$ 8,00 (R$ 832) + Promoção: 7 fatias a R$ 6,00 (R$ 42) = 111 fatias"
    },
    {
      pos: "17º",
      familia: "Churros",
      categoria: "Delícias / Doces",
      qtdNormal: 104,
      fatNormal: 832.00,
      precoNormal: 8.00,
      qtdPromo: 0,
      fatPromo: 0.00,
      precoPromoDesc: "—",
      qtdTotal: 104,
      fatTotal: 832.00,
      detalhamento: "104 churros a R$ 8,00 cada (79 bipadas)"
    },
    {
      pos: "18º",
      familia: "Bolo",
      categoria: "Delícias / Doces",
      qtdNormal: 83,
      fatNormal: 830.00,
      precoNormal: 10.00,
      qtdPromo: 0,
      fatPromo: 0.00,
      precoPromoDesc: "—",
      qtdTotal: 83,
      fatTotal: 830.00,
      detalhamento: "83 fatias de bolo a R$ 10,00 cada (66 bipadas)"
    },
    {
      pos: "19º",
      familia: "Caldo",
      categoria: "Alimentos / Comidas",
      qtdNormal: 57,
      fatNormal: 456.00,
      precoNormal: 8.00,
      qtdPromo: 7,
      fatPromo: 35.00,
      precoPromoDesc: "Promo R$ 5,00",
      qtdTotal: 64,
      fatTotal: 491.00,
      detalhamento: "Normal: 57 caldos a R$ 8,00 (R$ 456) + Promoção: 7 caldos a R$ 5,00 (R$ 35) = 64 caldos"
    },
    {
      pos: "20º",
      familia: "Acarajé",
      categoria: "Alimentos / Comidas",
      qtdNormal: 59,
      fatNormal: 708.00,
      precoNormal: 12.00,
      qtdPromo: 0,
      fatPromo: 0.00,
      precoPromoDesc: "—",
      qtdTotal: 59,
      fatTotal: 708.00,
      detalhamento: "59 acarajés a R$ 12,00 cada (53 bipadas)"
    },
    {
      pos: "21º",
      familia: "Pipoca",
      categoria: "Alimentos / Comidas",
      qtdNormal: 54,
      fatNormal: 108.00,
      precoNormal: 2.00,
      qtdPromo: 0,
      fatPromo: 0.00,
      precoPromoDesc: "—",
      qtdTotal: 54,
      fatTotal: 108.00,
      detalhamento: "54 saquinhos de pipoca a R$ 2,00 cada (40 bipadas)"
    },
    {
      pos: "22º",
      familia: "Batata Frita",
      categoria: "Alimentos / Comidas",
      qtdNormal: 30,
      fatNormal: 450.00,
      precoNormal: 15.00,
      qtdPromo: 0,
      fatPromo: 0.00,
      precoPromoDesc: "—",
      qtdTotal: 30,
      fatTotal: 450.00,
      detalhamento: "30 porções de batata frita a R$ 15,00 cada (30 bipadas)"
    },
    {
      pos: "23º",
      familia: "Geladinho",
      categoria: "Delícias / Doces",
      qtdNormal: 4,
      fatNormal: 4.00,
      precoNormal: 1.00,
      qtdPromo: 0,
      fatPromo: 0.00,
      precoPromoDesc: "—",
      qtdTotal: 4,
      fatTotal: 4.00,
      detalhamento: "4 geladinhos a R$ 1,00 cada (4 bipadas)"
    }
  ];

  // =========================================================================
  // ABA 1: CONSOLIDAÇÃO EXECUTIVA (NORMAL + PROMOÇÕES + TOTAL REAL)
  // =========================================================================
  const ws1 = workbook.addWorksheet("Consolidação Geral de Vendas", { properties: { tabColor: { argb: 'FF1D3461' } } });

  ws1.mergeCells('A1:L2');
  const t1 = ws1.getCell('A1');
  t1.value = "LA MORE EVENTOS — Relatório Consolidado de Vendas (Normal x Promoções x Totalidade Física)";
  t1.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };
  t1.alignment = { vertical: 'middle', horizontal: 'center' };

  ws1.getCell('A3').value = "Evento: EC 34 Ceilândia | Quantidades físicas reais calculadas por comanda/valor unitário + Combos desmembrados.";
  ws1.getCell('A3').font = { italic: true, size: 10, color: { argb: 'FF4B5563' } };

  const hRow1 = ws1.getRow(5);
  hRow1.values = [
    "Posição",
    "Produto / Família de Item",
    "Categoria",
    "Preço Base (R$)",
    "Qtd. Valor Normal",
    "Faturamento Normal (R$)",
    "Regra Promoção / Combo",
    "Qtd. em Promoção / Combo",
    "Faturamento Promo (R$)",
    "QUANTIDADE TOTAL VENDIDA",
    "FATURAMENTO TOTAL (R$)",
    "Detalhamento e Composição das Vendas"
  ];
  hRow1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
  hRow1.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  hRow1.height = 28;

  ws1.columns = [
    { key: "pos", width: 10 },
    { key: "familia", width: 30 },
    { key: "cat", width: 22 },
    { key: "precoBase", width: 16 },
    { key: "qtdNormal", width: 18 },
    { key: "fatNormal", width: 22 },
    { key: "precoPromoDesc", width: 26 },
    { key: "qtdPromo", width: 22 },
    { key: "fatPromo", width: 22 },
    { key: "qtdTotal", width: 24 },
    { key: "fatTotal", width: 22 },
    { key: "detalhamento", width: 60 }
  ];

  let sumQtdNormal = 0;
  let sumFatNormal = 0;
  let sumQtdPromo = 0;
  let sumFatPromo = 0;
  let sumQtdTotal = 0;
  let sumFatTotal = 0;

  familias.forEach((f, idx) => {
    sumQtdNormal += f.qtdNormal;
    sumFatNormal += f.fatNormal;
    sumQtdPromo += f.qtdPromo;
    sumFatPromo += f.fatPromo;
    sumQtdTotal += f.qtdTotal;
    sumFatTotal += f.fatTotal;

    const row = ws1.addRow({
      pos: f.pos,
      familia: f.familia,
      cat: f.categoria,
      precoBase: f.precoNormal,
      qtdNormal: f.qtdNormal,
      fatNormal: f.fatNormal,
      precoPromoDesc: f.precoPromoDesc,
      qtdPromo: f.qtdPromo > 0 ? f.qtdPromo : "—",
      fatPromo: f.fatPromo > 0 ? f.fatPromo : "—",
      qtdTotal: f.qtdTotal,
      fatTotal: f.fatTotal,
      detalhamento: f.detalhamento
    });

    if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(4).numFmt = '"R$ "#,##0.00';
    row.getCell(5).alignment = { horizontal: 'center' };
    row.getCell(6).numFmt = '"R$ "#,##0.00';
    row.getCell(7).alignment = { horizontal: 'center' };
    row.getCell(8).alignment = { horizontal: 'center' };
    if (f.fatPromo > 0) row.getCell(9).numFmt = '"R$ "#,##0.00';
    else row.getCell(9).alignment = { horizontal: 'center' };
    
    // Destaque nas colunas totais
    row.getCell(10).alignment = { horizontal: 'center' };
    row.getCell(10).font = { bold: true, color: { argb: 'FF1D3461' }, size: 11 };
    row.getCell(11).numFmt = '"R$ "#,##0.00';
    row.getCell(11).font = { bold: true, color: { argb: 'FF059669' }, size: 11 };
  });

  // Linha de Total Geral
  const totalRow = ws1.addRow({
    pos: "TOTAL",
    familia: "TOTAL GERAL DA FESTA",
    cat: "TODOS OS ITENS",
    precoBase: "",
    qtdNormal: sumQtdNormal,
    fatNormal: sumFatNormal,
    precoPromoDesc: "Soma Promos/Combos",
    qtdPromo: sumQtdPromo,
    fatPromo: sumFatPromo,
    qtdTotal: sumQtdTotal,
    fatTotal: sumFatTotal,
    detalhamento: `Total físico consolidado: ${sumQtdTotal} unidades vendidas faturando R$ ${sumFatTotal.toFixed(2)}`
  });
  totalRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };
  totalRow.getCell(1).alignment = { horizontal: 'center' };
  totalRow.getCell(5).alignment = { horizontal: 'center' };
  totalRow.getCell(6).numFmt = '"R$ "#,##0.00';
  totalRow.getCell(7).alignment = { horizontal: 'center' };
  totalRow.getCell(8).alignment = { horizontal: 'center' };
  totalRow.getCell(9).numFmt = '"R$ "#,##0.00';
  totalRow.getCell(10).alignment = { horizontal: 'center' };
  totalRow.getCell(11).numFmt = '"R$ "#,##0.00';

  // =========================================================================
  // ABA 2: RAIO-X ESPECÍFICO (CHURRASQUINHO, PICOLÉ E SORVETES)
  // =========================================================================
  const ws2 = workbook.addWorksheet("Perícia Espetinho & Picolé", { properties: { tabColor: { argb: 'FFF59E0B' } } });
  ws2.mergeCells('A1:G2');
  const t2 = ws2.getCell('A1');
  t2.value = "PARECER TÉCNICO PERICIAL — ITENS QUESTIONADOS PELA CLIENTE";
  t2.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
  t2.alignment = { vertical: 'middle', horizontal: 'center' };

  const hRow2 = ws2.getRow(4);
  hRow2.values = ["Item Questionado", "Estoque Alegado pela Cliente", "Vendas La More Eventos", "Vendas PDV Legal (Parceiro)", "TOTAL VENDIDO NO EVENTO", "Diferença vs. Estoque Alegado", "Conclusão Contábil"];
  hRow2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };

  ws2.columns = [
    { key: "item", width: 28 },
    { key: "est", width: 26 },
    { key: "lm", width: 24 },
    { key: "pdv", width: 26 },
    { key: "tot", width: 26 },
    { key: "dif", width: 28 },
    { key: "conc", width: 45 }
  ];

  const periciaItems = [
    {
      item: "Churrasquinho / Espetinho",
      est: "700 espetinhos comprados",
      lm: "507 unidades (R$ 4.984)",
      pdv: "318 unidades (R$ 3.058)",
      tot: "825 unidades (R$ 8.042)",
      dif: "+125 unidades acima do estoque alegado",
      conc: "Comprovado: o estoque de 700 espetinhos acabou integralmente, tendo sido vendidos 825 espetinhos no total dos dois sistemas."
    },
    {
      item: "Picolé",
      est: "710 picolés comprados",
      lm: "684 unidades (R$ 1.368)",
      pdv: "388 unidades (R$ 776)",
      tot: "1.072 unidades (R$ 2.144)",
      dif: "+362 unidades acima do estoque alegado",
      conc: "Comprovado: os 710 picolés foram 100% vendidos, alcançando 1.072 unidades somando La More e PDV Legal."
    },
    {
      item: "Sorvete (Potes + Combos)",
      est: "Potes avulsos e combos 2 por 1",
      lm: "202 potes (R$ 1.096)",
      pdv: "146 unidades (R$ 730)",
      tot: "348 potes (R$ 1.826)",
      dif: "Atendimento pleno da promoção",
      conc: "58 combos 'compre 1 leve 2' vendidos a R$ 10 (116 potes a R$ 5) + 86 potes a R$ 6 = 202 potes entregues na La More."
    },
    {
      item: "Pastel",
      est: "Comprados para fritar e cru",
      lm: "430 unidades (R$ 3.242)",
      pdv: "612 unidades (R$ 4.238)",
      tot: "1.042 unidades (R$ 7.480)",
      dif: "Mais de 1.000 pastéis vendidos",
      conc: "La More vendeu 364 normais (R$ 8) + 66 na promoção (R$ 5). PDV vendeu 514 fritos + 98 crus."
    }
  ];

  periciaItems.forEach((p, idx) => {
    const row = ws2.addRow(p);
    if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    row.getCell(3).font = { bold: true };
    row.getCell(4).font = { bold: true };
    row.getCell(5).font = { bold: true, color: { argb: 'FF059669' } };
  });

  const out1 = 'C:\\Users\\Usuário\\Downloads\\LaMore_Auditoria_Definitiva_EC34.xlsx';
  const out2 = path.join(__dirname, '../public/LaMore_Auditoria_Definitiva_EC34.xlsx');

  await workbook.xlsx.writeFile(out1);
  await workbook.xlsx.writeFile(out2);

  console.log("✅ PLANILHA DEFINITIVA CRIADA COM SUCESSO!");
  console.log("Arquivo 1:", out1);
  console.log("Arquivo 2:", out2);
}

buildDefinitiveAuditSpreadsheet().catch(console.error);
