const ExcelJS = require('exceljs');
const path = require('path');
const xlsx = require('xlsx');

async function generateUnifiedComparisonUpdated() {
  const compFile = 'C:\\Users\\Usuário\\Downloads\\LaMore_vs_PDV_Comparativo.xlsx';
  const wbRaw = xlsx.readFile(compFile);
  
  const lmSheet = wbRaw.Sheets['LaMore_Eventos'];
  const pdvSheet = wbRaw.Sheets['PDV_Ec34_2025'];
  
  const lmRows = xlsx.utils.sheet_to_json(lmSheet);
  const pdvRows = xlsx.utils.sheet_to_json(pdvSheet);

  console.log("LM rows count:", lmRows.length);
  console.log("PDV rows count:", pdvRows.length);

  // Mapas de busca rápida
  const lmItemMap = {};
  lmRows.forEach(r => {
    const nome = r['Produto / Item'];
    if (nome) {
      lmItemMap[nome] = {
        qtdOriginal: parseFloat(r['Unidades Físicas (Qtd Real)']) || 0,
        bipadas: parseFloat(r['Transações (Bipadas)']) || 0,
        faturamento: parseFloat(r['Faturamento Total (R$)']) || 0,
        preco: parseFloat(r['Preço Unitário (R$)']) || 0,
        categoria: r['Categoria']
      };
    }
  });

  // Ajuste do Combo Sorvete na base da La More:
  // O item "Combo Sorvete" teve 52 transações / 58 unidades registradas a R$ 10 (faturamento R$ 580).
  // Cada combo comprado entrega 2 potes de sorvete (compre 1 leve 2) a R$ 5 cada pote.
  // Portanto, unidades físicas de sorvete = 58 x 2 = 116 potes de sorvete (R$ 580 / 116 = R$ 5,00 cada).
  if (lmItemMap['Combo Sorvete']) {
    lmItemMap['Combo Sorvete'].unidadesFisicasReais = lmItemMap['Combo Sorvete'].qtdOriginal * 2; // 116 potes
    lmItemMap['Combo Sorvete'].precoEfetivoPorPote = 5.00;
  }

  const pdvItemMap = {};
  pdvRows.forEach(r => {
    const nome = r['Produto'];
    if (nome) {
      pdvItemMap[nome] = {
        qtd: parseFloat(r['Quantidade']) || 0,
        vendas: parseFloat(r['Nº Vendas']) || 0,
        valor: parseFloat(r['Valor (R$)']) || 0,
        grupo: r['Grupo']
      };
    }
  });

  // Mapeamento Unificado de Famílias
  const unified = [
    {
      produto: 'Refrigerante',
      categoria: 'Bebidas',
      lmItens: ['Refrigerante'],
      pdvItens: ['REFRIGERANTE COPO'],
      detalhesLM: 'Refrigerante (1.139 un - R$ 2.278,00)',
      detalhesPDV: 'REFRIGERANTE COPO (1.009 un - R$ 2.018,00)'
    },
    {
      produto: 'Picolé',
      categoria: 'Delícias / Doces',
      lmItens: ['Picolé'],
      pdvItens: ['PICOLE'],
      detalhesLM: 'Picolé (684 un - R$ 1.368,00)',
      detalhesPDV: 'PICOLE (388 un - R$ 776,00)'
    },
    {
      produto: 'Pescaria',
      categoria: 'Brinquedos / Diversão',
      lmItens: ['Pescaria'],
      pdvItens: ['PESCARIA'],
      detalhesLM: 'Pescaria (509 un - R$ 4.072,00)',
      detalhesPDV: 'PESCARIA (663 un - R$ 3.932,00)'
    },
    {
      produto: 'Churrasquinho / Espetinho',
      categoria: 'Alimentos / Comidas',
      lmItens: ['Churrasquinho', 'Promo churrasquinho'],
      pdvItens: ['ESPETINHO', 'Churrasquinho'],
      detalhesLM: 'Churrasquinho R$10 (464 un - R$ 4.640) + Promo R$8 (43 un - R$ 344) = 507 un (R$ 4.984,00)',
      detalhesPDV: 'ESPETINHO (316 un - R$ 3.038) + Churrasquinho (2 un - R$ 20) = 318 un (R$ 3.058,00)'
    },
    {
      produto: 'Pastel (Frito + Sem Fritar)',
      categoria: 'Alimentos / Comidas',
      lmItens: ['Pastel', 'Promo Pastel'],
      pdvItens: ['PASTEL', 'PASTEL SEM FRITAR'],
      detalhesLM: 'Pastel R$8 (364 un - R$ 2.912) + Promo R$5 (66 un - R$ 330) = 430 un (R$ 3.242,00)',
      detalhesPDV: 'PASTEL (514 un - R$ 3.944) + PASTEL SEM FRITAR (98 un - R$ 294) = 612 un (R$ 4.238,00)'
    },
    {
      produto: 'Cachorro-quente',
      categoria: 'Alimentos / Comidas',
      lmItens: ['Cachorro-quente', 'Promo cachorro '],
      pdvItens: ['CACHORRO QUENTE'],
      detalhesLM: 'Cachorro-quente R$8 (340 un - R$ 2.720) + Promo R$5 (20 un - R$ 100) = 360 un (R$ 2.820,00)',
      detalhesPDV: 'CACHORRO QUENTE (344 un - R$ 2.670,00)'
    },
    {
      produto: 'Algodão-doce',
      categoria: 'Delícias / Doces',
      lmItens: ['Algodão-doce'],
      pdvItens: ['ALGODAO DOCE'],
      detalhesLM: 'Algodão-doce (252 un - R$ 756,00)',
      detalhesPDV: 'ALGODAO DOCE (300 un - R$ 600,00)'
    },
    {
      produto: 'Brinquedos / Diversão',
      categoria: 'Brinquedos / Diversão',
      lmItens: ['Brinquedos', 'Estalinho'],
      pdvItens: ['BRINQUEDOS'],
      detalhesLM: 'Brinquedos (170 un - R$ 1.360) + Estalinho (39 un - R$ 78) = 209 un (R$ 1.438,00)',
      detalhesPDV: 'BRINQUEDOS (194 un - R$ 970,00)'
    },
    {
      produto: 'Arroz Carreteiro',
      categoria: 'Alimentos / Comidas',
      lmItens: ['Arroz carreteiro', 'Promo Carreteiro  ', 'Promo carreteiro 2', 'Promo Carreteiro 2'],
      pdvItens: ['ARROZ CARRETEIRO'],
      detalhesLM: 'Normal R$15 (192 un) + Promos R$12/10/5 (16 un) = 208 un (R$ 3.032,00)',
      detalhesPDV: 'ARROZ CARRETEIRO (206 un - R$ 3.048,00)'
    },
    {
      produto: 'Sorvetes (Pote + Combo Leve 2)',
      categoria: 'Delícias / Doces',
      lmItens: ['Pote Sorvete ', 'Combo Sorvete'],
      pdvItens: ['SORVETE'],
      detalhesLM: 'Pote Avulso R$6 (86 un - R$ 516) + Combo Compre 1 Leve 2 a R$10 (58 combos = 116 potes a R$5 cada - R$ 580) = 202 potes (R$ 1.096,00)',
      detalhesPDV: 'SORVETE (146 un - R$ 730,00)'
    },
    {
      produto: 'Cremosinho',
      categoria: 'Delícias / Doces',
      lmItens: ['Cremosinho'],
      pdvItens: ['CREMOSINHO'],
      detalhesLM: 'Cremosinho (146 un - R$ 292,00)',
      detalhesPDV: 'CREMOSINHO (145 un - R$ 290,00)'
    },
    {
      produto: 'Galinhada',
      categoria: 'Alimentos / Comidas',
      lmItens: ['Galinhada', 'Promo galinhada 3', 'Promo galinhada '],
      pdvItens: ['GALINHADA'],
      detalhesLM: 'Galinhada R$15 (136 un) + Promos R$8/12 (6 un) = 142 un (R$ 2.092,00)',
      detalhesPDV: 'GALINHADA (154 un - R$ 2.096,00)'
    },
    {
      produto: 'Água Mineral',
      categoria: 'Bebidas',
      lmItens: ['Água'],
      pdvItens: ['AGUA MINERAL'],
      detalhesLM: 'Água (135 un - R$ 405,00)',
      detalhesPDV: 'AGUA MINERAL (233 un - R$ 466,00)'
    },
    {
      produto: 'Canjica',
      categoria: 'Delícias / Doces',
      lmItens: ['Canjica', 'Promo Canjica '],
      pdvItens: ['CANJICA'],
      detalhesLM: 'Canjica R$8 (114 un) + Promo R$5 (13 un) = 127 un (R$ 977,00)',
      detalhesPDV: 'CANJICA (225 un - R$ 1.073,00)'
    },
    {
      produto: 'Pizza',
      categoria: 'Alimentos / Comidas',
      lmItens: ['Pizza', 'Promo Pizza '],
      pdvItens: [],
      detalhesLM: 'Pizza R$8 (104 un) + Promo R$6 (7 un) = 111 un (R$ 874,00)',
      detalhesPDV: 'Sem registro no PDV Legal'
    },
    {
      produto: 'Churros',
      categoria: 'Delícias / Doces',
      lmItens: ['Churros '],
      pdvItens: ['CHURROS'],
      detalhesLM: 'Churros (104 un - R$ 832,00)',
      detalhesPDV: 'CHURROS (180 un - R$ 864,00)'
    },
    {
      produto: 'Bolo',
      categoria: 'Delícias / Doces',
      lmItens: ['Bolo'],
      pdvItens: ['BOLO'],
      detalhesLM: 'Bolo (83 un - R$ 830,00)',
      detalhesPDV: 'BOLO (72 un - R$ 576,00)'
    },
    {
      produto: 'Caldo',
      categoria: 'Alimentos / Comidas',
      lmItens: ['Caldo', 'Promo caldo '],
      pdvItens: ['CALDO'],
      detalhesLM: 'Caldo R$8 (57 un) + Promo R$5 (7 un) = 64 un (R$ 491,00)',
      detalhesPDV: 'CALDO (101 un - R$ 504,00)'
    },
    {
      produto: 'Acarajé',
      categoria: 'Alimentos / Comidas',
      lmItens: ['Acarajé'],
      pdvItens: ['ACARAJE'],
      detalhesLM: 'Acarajé (59 un - R$ 708,00)',
      detalhesPDV: 'ACARAJE (142 un - R$ 1.704,00)'
    },
    {
      produto: 'Pipoca',
      categoria: 'Alimentos / Comidas',
      lmItens: ['Pipoca'],
      pdvItens: ['PIPOCA'],
      detalhesLM: 'Pipoca (54 un - R$ 108,00)',
      detalhesPDV: 'PIPOCA (57 un - R$ 114,00)'
    },
    {
      produto: 'Batata Frita',
      categoria: 'Alimentos / Comidas',
      lmItens: ['Batata frita '],
      pdvItens: ['BATATA FRITA'],
      detalhesLM: 'Batata frita (30 un - R$ 450,00)',
      detalhesPDV: 'BATATA FRITA (75 un - R$ 900,00)'
    },
    {
      produto: 'Embalagem / Sacolinha',
      categoria: 'Outros / Diversos',
      lmItens: ['Embalagem', 'Sacolinha'],
      pdvItens: ['EMBALAGEM'],
      detalhesLM: 'Embalagem R$1 (156 un) + Sacolinha R$0,20 (5 un) = 161 un (R$ 157,00)',
      detalhesPDV: 'EMBALAGEM (98 un - R$ 98,00)'
    },
    {
      produto: 'Geladinho',
      categoria: 'Delícias / Doces',
      lmItens: ['Geladinho'],
      pdvItens: ['GELADINHO'],
      detalhesLM: 'Geladinho (4 un - R$ 4,00)',
      detalhesPDV: 'GELADINHO (71 un - R$ 71,00)'
    },
    {
      produto: 'Adicional',
      categoria: 'Adicional',
      lmItens: [],
      pdvItens: ['ADICIONAL'],
      detalhesLM: 'Sem registro avulso na La More',
      detalhesPDV: 'ADICIONAL (66 un - R$ 328,00)'
    },
    {
      produto: 'Chocolate Quente',
      categoria: 'Bebidas',
      lmItens: [],
      pdvItens: ['CHOCOLATE QUENTE'],
      detalhesLM: 'Sem venda registrada no evento',
      detalhesPDV: 'CHOCOLATE QUENTE (1 un - R$ 8,00)'
    }
  ];

  // Criando a Workbook com ExcelJS
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "La More Eventos";
  workbook.created = new Date();

  // ==========================================
  // ABA 1: COMPARATIVO UNIFICADO GERAL
  // ==========================================
  const ws1 = workbook.addWorksheet("Comparativo Unificado", { properties: { tabColor: { argb: 'FF1D3461' } } });

  // Título
  ws1.mergeCells('A1:K2');
  const t1 = ws1.getCell('A1');
  t1.value = "LA MORE EVENTOS  x  PDV LEGAL (EC 34 Ceilândia) — Relatório Comparativo Unificado de Quantidades e Faturamento";
  t1.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };
  t1.alignment = { vertical: 'middle', horizontal: 'center' };

  ws1.getCell('A3').value = "Produtos com nomes equivalentes, promoções e combos (ex: Combo Sorvete Compre 1 Leve 2 = 2 potes a R$5) unificados com soma de quantidades e valores.";
  ws1.getCell('A3').font = { italic: true, size: 10, color: { argb: 'FF4B5563' } };

  // Cabeçalho da Tabela
  const hRow1 = ws1.getRow(5);
  hRow1.values = [
    "Posição",
    "Produto / Item Unificado",
    "Categoria / Grupo",
    "Qtd. La More (Unidades Físicas)",
    "Faturamento La More (R$)",
    "Qtd. PDV Legal",
    "Faturamento PDV (R$)",
    "Total Unidades (Ambos)",
    "Faturamento Total (Ambos R$)",
    "Diferença Qtd (LM - PDV)",
    "Detalhamento e Composição do Item"
  ];
  hRow1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
  hRow1.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  hRow1.height = 28;

  ws1.columns = [
    { key: "pos", width: 10 },
    { key: "prod", width: 32 },
    { key: "cat", width: 22 },
    { key: "qtdLM", width: 22 },
    { key: "fatLM", width: 20 },
    { key: "qtdPDV", width: 18 },
    { key: "fatPDV", width: 20 },
    { key: "totQtd", width: 20 },
    { key: "totFat", width: 22 },
    { key: "difQtd", width: 20 },
    { key: "comp", width: 50 }
  ];

  let somaLMQtd = 0;
  let somaLMFat = 0;
  let somaPDVQtd = 0;
  let somaPDVFat = 0;
  let somaGeralQtd = 0;
  let somaGeralFat = 0;

  const calculatedRows = unified.map(u => {
    let qtdLM = 0;
    let fatLM = 0;
    u.lmItens.forEach(it => {
      if (it === 'Combo Sorvete') {
        qtdLM += ((lmItemMap[it]?.qtdOriginal || 0) * 2);
        fatLM += (lmItemMap[it]?.faturamento || 0);
      } else {
        qtdLM += (lmItemMap[it]?.qtdOriginal || 0);
        fatLM += (lmItemMap[it]?.faturamento || 0);
      }
    });

    let qtdPDV = 0;
    let fatPDV = 0;
    u.pdvItens.forEach(it => {
      qtdPDV += (pdvItemMap[it]?.qtd || 0);
      fatPDV += (pdvItemMap[it]?.valor || 0);
    });

    const totQtd = qtdLM + qtdPDV;
    const totFat = fatLM + fatPDV;
    const difQtd = qtdLM - qtdPDV;

    somaLMQtd += qtdLM;
    somaLMFat += fatLM;
    somaPDVQtd += qtdPDV;
    somaPDVFat += fatPDV;
    somaGeralQtd += totQtd;
    somaGeralFat += totFat;

    return {
      prod: u.produto,
      cat: u.categoria,
      qtdLM,
      fatLM,
      qtdPDV,
      fatPDV,
      totQtd,
      totFat,
      difQtd,
      comp: `${u.detalhesLM} | PDV: ${u.detalhesPDV}`
    };
  }).sort((a, b) => b.totQtd - a.totQtd);

  calculatedRows.forEach((r, idx) => {
    const row = ws1.addRow({
      pos: `${idx + 1}º`,
      prod: r.prod,
      cat: r.cat,
      qtdLM: r.qtdLM || "—",
      fatLM: r.fatLM,
      qtdPDV: r.qtdPDV || "—",
      fatPDV: r.fatPDV,
      totQtd: r.totQtd,
      totFat: r.totFat,
      difQtd: r.difQtd > 0 ? `+${r.difQtd}` : r.difQtd < 0 ? `${r.difQtd}` : "0",
      comp: r.comp
    });

    if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(4).alignment = { horizontal: 'center' };
    row.getCell(5).numFmt = '"R$ "#,##0.00';
    row.getCell(6).alignment = { horizontal: 'center' };
    row.getCell(7).numFmt = '"R$ "#,##0.00';
    row.getCell(8).alignment = { horizontal: 'center' };
    row.getCell(8).font = { bold: true };
    row.getCell(9).numFmt = '"R$ "#,##0.00';
    row.getCell(9).font = { bold: true };
    row.getCell(10).alignment = { horizontal: 'center' };

    if (r.difQtd > 0) {
      row.getCell(10).font = { bold: true, color: { argb: 'FF059669' } };
    } else if (r.difQtd < 0) {
      row.getCell(10).font = { bold: true, color: { argb: 'FFDC2626' } };
    }
  });

  // Linha Total Geral
  const totalRow = ws1.addRow({
    pos: "TOTAL",
    prod: "TOTAL GERAL CONSOLIDADO",
    cat: "TODAS AS 25 FAMÍLIAS",
    qtdLM: somaLMQtd,
    fatLM: somaLMFat,
    qtdPDV: somaPDVQtd,
    fatPDV: somaPDVFat,
    totQtd: somaGeralQtd,
    totFat: somaGeralFat,
    difQtd: somaLMQtd - somaPDVQtd > 0 ? `+${somaLMQtd - somaPDVQtd}` : `${somaLMQtd - somaPDVQtd}`,
    comp: "Soma de todas as categorias unificadas"
  });
  totalRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };
  totalRow.getCell(1).alignment = { horizontal: 'center' };
  totalRow.getCell(4).alignment = { horizontal: 'center' };
  totalRow.getCell(5).numFmt = '"R$ "#,##0.00';
  totalRow.getCell(6).alignment = { horizontal: 'center' };
  totalRow.getCell(7).numFmt = '"R$ "#,##0.00';
  totalRow.getCell(8).alignment = { horizontal: 'center' };
  totalRow.getCell(9).numFmt = '"R$ "#,##0.00';
  totalRow.getCell(10).alignment = { horizontal: 'center' };

  // ==========================================
  // ABA 2: LA MORE DETALHADO (COM AJUSTE COMBO)
  // ==========================================
  const ws2 = workbook.addWorksheet("La More Detalhado", { properties: { tabColor: { argb: 'FFF59E0B' } } });
  ws2.mergeCells('A1:H2');
  const t2 = ws2.getCell('A1');
  t2.value = "LA MORE EVENTOS — Relatório Detalhado de Vendas por Produto (com Combos Desmembrados)";
  t2.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
  t2.alignment = { vertical: 'middle', horizontal: 'center' };

  const hRow2 = ws2.getRow(4);
  hRow2.values = [
    "Posição",
    "Produto / Item",
    "Categoria",
    "Preço de Cadastro (R$)",
    "Transações (Bipadas)",
    "Unidades Registradas",
    "Unidades Físicas Reais (Combos x2)",
    "Faturamento Total (R$)"
  ];
  hRow2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };

  ws2.columns = [
    { key: "pos", width: 10 },
    { key: "prod", width: 30 },
    { key: "cat", width: 20 },
    { key: "preco", width: 22 },
    { key: "bip", width: 22 },
    { key: "qtdReg", width: 22 },
    { key: "qtdReal", width: 26 },
    { key: "fat", width: 22 }
  ];

  lmRows.forEach((r, idx) => {
    if (!r['Produto / Item']) return;
    const nome = r['Produto / Item'];
    const isCombo = nome === 'Combo Sorvete';
    const qtdReg = parseFloat(r['Unidades Físicas (Qtd Real)']) || 0;
    const qtdReal = isCombo ? qtdReg * 2 : qtdReg;

    const row = ws2.addRow({
      pos: r['Posição'] || `${idx + 1}º`,
      prod: isCombo ? 'Combo Sorvete (Compre 1 Leve 2)' : nome,
      cat: r['Categoria'],
      preco: r['Preço Unitário (R$)'],
      bip: r['Transações (Bipadas)'],
      qtdReg: qtdReg,
      qtdReal: qtdReal,
      fat: r['Faturamento Total (R$)']
    });
    if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    row.getCell(4).numFmt = '"R$ "#,##0.00';
    row.getCell(8).numFmt = '"R$ "#,##0.00';
  });

  // ==========================================
  // ABA 3: PDV LEGAL DETALHADO
  // ==========================================
  const ws3 = workbook.addWorksheet("PDV Legal Detalhado", { properties: { tabColor: { argb: 'FF10B981' } } });
  ws3.mergeCells('A1:H2');
  const t3 = ws3.getCell('A1');
  t3.value = "PDV LEGAL (EC 34 Ceilândia) — Relatório Original de Vendas por Produto";
  t3.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  t3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
  t3.alignment = { vertical: 'middle', horizontal: 'center' };

  const hRow3 = ws3.getRow(4);
  hRow3.values = ["Código", "Produto", "Cód. Filial", "Nome Loja", "Grupo", "Nº Vendas", "Quantidade", "Valor (R$)"];
  hRow3.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hRow3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };

  ws3.columns = [
    { key: "cod", width: 10 },
    { key: "prod", width: 28 },
    { key: "filial", width: 14 },
    { key: "loja", width: 28 },
    { key: "grupo", width: 20 },
    { key: "vendas", width: 14 },
    { key: "qtd", width: 16 },
    { key: "val", width: 18 }
  ];

  pdvRows.forEach((r, idx) => {
    const row = ws3.addRow({
      cod: r['Código'],
      prod: r['Produto'],
      filial: r['Cód. Filial'],
      loja: r['Nome Loja'],
      grupo: r['Grupo'],
      vendas: r['Nº Vendas'],
      qtd: r['Quantidade'],
      val: r['Valor (R$)']
    });
    if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    row.getCell(8).numFmt = '"R$ "#,##0.00';
  });

  // Salvar em Downloads e no public do Next.js
  const outDownloads = 'C:\\Users\\Usuário\\Downloads\\LaMore_vs_PDV_Comparativo_Unificado.xlsx';
  const outPublic = path.join(__dirname, '../public/LaMore_vs_PDV_Comparativo_Unificado.xlsx');

  await workbook.xlsx.writeFile(outDownloads);
  await workbook.xlsx.writeFile(outPublic);

  console.log(`\n✅ PLANILHA ATUALIZADA COM SUCESSO!`);
  console.log(`Salvo em: ${outDownloads}`);
  console.log(`Salvo em: ${outPublic}`);
}

generateUnifiedComparisonUpdated().catch(console.error);
