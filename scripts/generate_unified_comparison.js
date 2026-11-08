const ExcelJS = require('exceljs');
const path = require('path');
const xlsx = require('xlsx');

async function generateUnifiedComparison() {
  const compFile = 'C:\\Users\\Usuário\\Downloads\\LaMore_vs_PDV_Comparativo.xlsx';
  const wbRaw = xlsx.readFile(compFile);
  
  const lmSheet = wbRaw.Sheets['LaMore_Eventos'];
  const pdvSheet = wbRaw.Sheets['PDV_Ec34_2025'];
  
  const lmRows = xlsx.utils.sheet_to_json(lmSheet);
  const pdvRows = xlsx.utils.sheet_to_json(pdvSheet);

  console.log("LM rows count:", lmRows.length);
  console.log("PDV rows count:", pdvRows.length);

  // Mapeamento Unificado
  // Grupos / Famílias de Produtos
  const unified = [
    {
      produto: 'Refrigerante',
      categoria: 'Bebidas',
      lmItens: ['Refrigerante'],
      pdvItens: ['REFRIGERANTE COPO'],
      detalhesLM: 'Refrigerante copo/lata (1.139 un)',
      detalhesPDV: 'REFRIGERANTE COPO (1.009 un)'
    },
    {
      produto: 'Picolé',
      categoria: 'Delícias / Doces',
      lmItens: ['Picolé'],
      pdvItens: ['PICOLE'],
      detalhesLM: 'Picolé (684 un)',
      detalhesPDV: 'PICOLE (388 un)'
    },
    {
      produto: 'Pescaria',
      categoria: 'Brinquedos / Diversão',
      lmItens: ['Pescaria'],
      pdvItens: ['PESCARIA'],
      detalhesLM: 'Pescaria (509 un)',
      detalhesPDV: 'PESCARIA (663 un)'
    },
    {
      produto: 'Churrasquinho / Espetinho',
      categoria: 'Alimentos / Comidas',
      lmItens: ['Churrasquinho', 'Promo churrasquinho'],
      pdvItens: ['ESPETINHO', 'Churrasquinho'],
      detalhesLM: 'Churrasquinho normal (464 un) + Promo Churrasquinho (43 un) = 507 un',
      detalhesPDV: 'ESPETINHO (316 un) + Churrasquinho (2 un) = 318 un'
    },
    {
      produto: 'Pastel (Frito + Sem Fritar)',
      categoria: 'Alimentos / Comidas',
      lmItens: ['Pastel', 'Promo Pastel'],
      pdvItens: ['PASTEL', 'PASTEL SEM FRITAR'],
      detalhesLM: 'Pastel normal (364 un) + Promo Pastel (66 un) = 430 un',
      detalhesPDV: 'PASTEL (514 un) + PASTEL SEM FRITAR (98 un) = 612 un'
    },
    {
      produto: 'Cachorro-quente',
      categoria: 'Alimentos / Comidas',
      lmItens: ['Cachorro-quente', 'Promo cachorro '],
      pdvItens: ['CACHORRO QUENTE'],
      detalhesLM: 'Cachorro-quente (340 un) + Promo cachorro (20 un) = 360 un',
      detalhesPDV: 'CACHORRO QUENTE (344 un)'
    },
    {
      produto: 'Algodão-doce',
      categoria: 'Delícias / Doces',
      lmItens: ['Algodão-doce'],
      pdvItens: ['ALGODAO DOCE'],
      detalhesLM: 'Algodão-doce (252 un)',
      detalhesPDV: 'ALGODAO DOCE (300 un)'
    },
    {
      produto: 'Brinquedos / Brincadeiras',
      categoria: 'Brinquedos / Diversão',
      lmItens: ['Brinquedos', 'Estalinho'],
      pdvItens: ['BRINQUEDOS'],
      detalhesLM: 'Brinquedos (170 un) + Estalinho (39 un) = 209 un',
      detalhesPDV: 'BRINQUEDOS (194 un)'
    },
    {
      produto: 'Arroz Carreteiro',
      categoria: 'Alimentos / Comidas',
      lmItens: ['Arroz carreteiro', 'Promo Carreteiro  ', 'Promo carreteiro 2', 'Promo Carreteiro 2'],
      pdvItens: ['ARROZ CARRETEIRO'],
      detalhesLM: 'Carreteiro normal (192 un) + Promo 12R$ (6 un) + Promo 10R$ (6 un) + Promo 5R$ (4 un) = 208 un',
      detalhesPDV: 'ARROZ CARRETEIRO (206 un)'
    },
    {
      produto: 'Sorvetes (Pote + Combo x2)',
      categoria: 'Delícias / Doces',
      lmItens: ['Pote Sorvete ', 'Combo Sorvete'],
      pdvItens: ['SORVETE'],
      detalhesLM: 'Pote Sorvete (86 un) + Combo Sorvete duplo (58x2 = 116 sorvetes) = 202 un',
      detalhesPDV: 'SORVETE (146 un)'
    },
    {
      produto: 'Cremosinho',
      categoria: 'Delícias / Doces',
      lmItens: ['Cremosinho'],
      pdvItens: ['CREMOSINHO'],
      detalhesLM: 'Cremosinho (146 un)',
      detalhesPDV: 'CREMOSINHO (145 un)'
    },
    {
      produto: 'Galinhada',
      categoria: 'Alimentos / Comidas',
      lmItens: ['Galinhada', 'Promo galinhada 3', 'Promo galinhada '],
      pdvItens: ['GALINHADA'],
      detalhesLM: 'Galinhada normal (136 un) + Promo 8R$ (5 un) + Promo 12R$ (1 un) = 142 un',
      detalhesPDV: 'GALINHADA (154 un)'
    },
    {
      produto: 'Água Mineral',
      categoria: 'Bebidas',
      lmItens: ['Água'],
      pdvItens: ['AGUA MINERAL'],
      detalhesLM: 'Água (135 un)',
      detalhesPDV: 'AGUA MINERAL (233 un)'
    },
    {
      produto: 'Canjica',
      categoria: 'Delícias / Doces',
      lmItens: ['Canjica', 'Promo Canjica '],
      pdvItens: ['CANJICA'],
      detalhesLM: 'Canjica normal (114 un) + Promo Canjica (13 un) = 127 un',
      detalhesPDV: 'CANJICA (225 un)'
    },
    {
      produto: 'Pizza',
      categoria: 'Alimentos / Comidas',
      lmItens: ['Pizza', 'Promo Pizza '],
      pdvItens: [], // PDV Legal não teve pizza cadastrada
      detalhesLM: 'Pizza normal (104 un) + Promo Pizza (7 un) = 111 un',
      detalhesPDV: 'Sem registro no PDV Legal'
    },
    {
      produto: 'Churros',
      categoria: 'Delícias / Doces',
      lmItens: ['Churros '],
      pdvItens: ['CHURROS'],
      detalhesLM: 'Churros (104 un)',
      detalhesPDV: 'CHURROS (180 un)'
    },
    {
      produto: 'Bolo',
      categoria: 'Delícias / Doces',
      lmItens: ['Bolo'],
      pdvItens: ['BOLO'],
      detalhesLM: 'Bolo (83 un)',
      detalhesPDV: 'BOLO (72 un)'
    },
    {
      produto: 'Caldo',
      categoria: 'Alimentos / Comidas',
      lmItens: ['Caldo', 'Promo caldo '],
      pdvItens: ['CALDO'],
      detalhesLM: 'Caldo normal (57 un) + Promo Caldo (7 un) = 64 un',
      detalhesPDV: 'CALDO (101 un)'
    },
    {
      produto: 'Acarajé',
      categoria: 'Alimentos / Comidas',
      lmItens: ['Acarajé'],
      pdvItens: ['ACARAJE'],
      detalhesLM: 'Acarajé (59 un)',
      detalhesPDV: 'ACARAJE (142 un)'
    },
    {
      produto: 'Pipoca',
      categoria: 'Alimentos / Comidas',
      lmItens: ['Pipoca'],
      pdvItens: ['PIPOCA'],
      detalhesLM: 'Pipoca (54 un)',
      detalhesPDV: 'PIPOCA (57 un)'
    },
    {
      produto: 'Batata Frita',
      categoria: 'Alimentos / Comidas',
      lmItens: ['Batata frita '],
      pdvItens: ['BATATA FRITA'],
      detalhesLM: 'Batata frita porção (30 un)',
      detalhesPDV: 'BATATA FRITA (75 un)'
    },
    {
      produto: 'Embalagem / Sacolinha',
      categoria: 'Outros / Diversos',
      lmItens: ['Embalagem', 'Sacolinha'],
      pdvItens: ['EMBALAGEM'],
      detalhesLM: 'Embalagem (156 un) + Sacolinha (5 un) = 161 un',
      detalhesPDV: 'EMBALAGEM (98 un)'
    },
    {
      produto: 'Geladinho',
      categoria: 'Delícias / Doces',
      lmItens: ['Geladinho'],
      pdvItens: ['GELADINHO'],
      detalhesLM: 'Geladinho (4 un)',
      detalhesPDV: 'GELADINHO (71 un)'
    },
    {
      produto: 'Adicional',
      categoria: 'Adicional',
      lmItens: [],
      pdvItens: ['ADICIONAL'],
      detalhesLM: 'Sem registro avulso na La More',
      detalhesPDV: 'ADICIONAL (66 un)'
    },
    {
      produto: 'Chocolate Quente',
      categoria: 'Bebidas',
      lmItens: [],
      pdvItens: ['CHOCOLATE QUENTE'],
      detalhesLM: 'Sem venda registrada no evento',
      detalhesPDV: 'CHOCOLATE QUENTE (1 un)'
    }
  ];

  // Mapas de busca rápida
  const lmItemMap = {};
  lmRows.forEach(r => {
    const nome = r['Produto / Item'];
    if (nome) {
      lmItemMap[nome] = {
        qtd: parseFloat(r['Unidades Físicas (Qtd Real)']) || 0,
        bipadas: parseFloat(r['Transações (Bipadas)']) || 0,
        faturamento: parseFloat(r['Faturamento Total (R$)']) || 0,
        preco: parseFloat(r['Preço Unitário (R$)']) || 0,
        categoria: r['Categoria']
      };
    }
  });

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

  // Criando a Workbook com ExcelJS
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "La More Eventos";
  workbook.created = new Date();

  // ==========================================
  // ABA 1: COMPARATIVO UNIFICADO GERAL
  // ==========================================
  const ws1 = workbook.addWorksheet("Comparativo Unificado", { properties: { tabColor: { argb: 'FF1D3461' } } });

  // Título
  ws1.mergeCells('A1:I2');
  const t1 = ws1.getCell('A1');
  t1.value = "LA MORE EVENTOS  x  PDV LEGAL (EC 34 Ceilândia) — Relatório Comparativo Unificado de Vendas";
  t1.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };
  t1.alignment = { vertical: 'middle', horizontal: 'center' };

  ws1.getCell('A3').value = "Produtos com nomes equivalentes, promoções e variações de balcão unificados por família de item.";
  ws1.getCell('A3').font = { italic: true, size: 10, color: { argb: 'FF4B5563' } };

  // Cabeçalho da Tabela
  const hRow1 = ws1.getRow(5);
  hRow1.values = [
    "Posição",
    "Produto / Item Unificado",
    "Categoria / Grupo",
    "Qtd. La More Eventos (Unidades Físicas)",
    "Qtd. PDV Legal (EC 34)",
    "Total Combinado (Ambos os Sistemas)",
    "Diferença (La More - PDV Legal)",
    "Composição / Itens Unificados",
    "Análise Comparativa de Desempenho"
  ];
  hRow1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
  hRow1.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  hRow1.height = 28;

  ws1.columns = [
    { key: "pos", width: 10 },
    { key: "prod", width: 30 },
    { key: "cat", width: 22 },
    { key: "qtdLM", width: 22 },
    { key: "qtdPDV", width: 20 },
    { key: "total", width: 22 },
    { key: "dif", width: 20 },
    { key: "comp", width: 45 },
    { key: "analise", width: 40 }
  ];

  let somaLM = 0;
  let somaPDV = 0;
  let somaCombinado = 0;

  const calculatedRows = unified.map(u => {
    // Somar La More
    let qtdLM = 0;
    u.lmItens.forEach(it => {
      if (it === 'Combo Sorvete') {
        // Combo é duplo
        qtdLM += ((lmItemMap[it]?.qtd || 0) * 2);
      } else {
        qtdLM += (lmItemMap[it]?.qtd || 0);
      }
    });

    // Somar PDV Legal
    let qtdPDV = 0;
    u.pdvItens.forEach(it => {
      qtdPDV += (pdvItemMap[it]?.qtd || 0);
    });

    const total = qtdLM + qtdPDV;
    const dif = qtdLM - qtdPDV;

    let analise = "";
    if (qtdLM > 0 && qtdPDV === 0) {
      analise = "Exclusivo La More Eventos";
    } else if (qtdLM === 0 && qtdPDV > 0) {
      analise = "Exclusivo PDV Legal";
    } else if (dif > 0) {
      const perc = ((dif / qtdPDV) * 100).toFixed(0);
      analise = `Mais vendido na La More (+${perc}% vs. PDV)`;
    } else if (dif < 0) {
      const perc = ((Math.abs(dif) / qtdLM) * 100).toFixed(0);
      analise = `Mais vendido no PDV Legal (+${perc}% vs. La More)`;
    } else {
      analise = "Empate exato de vendas";
    }

    somaLM += qtdLM;
    somaPDV += qtdPDV;
    somaCombinado += total;

    return {
      prod: u.produto,
      cat: u.categoria,
      qtdLM,
      qtdPDV,
      total,
      dif,
      comp: `${u.detalhesLM} | PDV: ${u.detalhesPDV}`,
      analise
    };
  }).sort((a, b) => b.total - a.total);

  calculatedRows.forEach((r, idx) => {
    const row = ws1.addRow({
      pos: `${idx + 1}º`,
      prod: r.prod,
      cat: r.cat,
      qtdLM: r.qtdLM || "—",
      qtdPDV: r.qtdPDV || "—",
      total: r.total,
      dif: r.dif > 0 ? `+${r.dif}` : r.dif < 0 ? `${r.dif}` : "0",
      comp: r.comp,
      analise: r.analise
    });

    if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(4).alignment = { horizontal: 'center' };
    row.getCell(5).alignment = { horizontal: 'center' };
    row.getCell(6).alignment = { horizontal: 'center' };
    row.getCell(7).alignment = { horizontal: 'center' };

    // Cores nas diferenças
    if (r.dif > 0) {
      row.getCell(7).font = { bold: true, color: { argb: 'FF059669' } };
    } else if (r.dif < 0) {
      row.getCell(7).font = { bold: true, color: { argb: 'FFDC2626' } };
    }
  });

  // Linha de Total Geral
  const totalRow = ws1.addRow({
    pos: "TOTAL",
    prod: "TOTAL GERAL CONSOLIDADO",
    cat: "TODAS AS CATEGORIAS",
    qtdLM: somaLM,
    qtdPDV: somaPDV,
    total: somaCombinado,
    dif: somaLM - somaPDV > 0 ? `+${somaLM - somaPDV}` : `${somaLM - somaPDV}`,
    comp: "Soma de todas as 25 famílias de produtos",
    analise: `La More representou ${((somaLM / somaCombinado) * 100).toFixed(1)}% do volume total`
  });
  totalRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };
  totalRow.getCell(1).alignment = { horizontal: 'center' };
  totalRow.getCell(4).alignment = { horizontal: 'center' };
  totalRow.getCell(5).alignment = { horizontal: 'center' };
  totalRow.getCell(6).alignment = { horizontal: 'center' };
  totalRow.getCell(7).alignment = { horizontal: 'center' };

  // ==========================================
  // ABA 2: PRODUTOS LA MORE EVENTOS DETALHADO
  // ==========================================
  const ws2 = workbook.addWorksheet("La More Detalhado", { properties: { tabColor: { argb: 'FFF59E0B' } } });
  ws2.mergeCells('A1:G2');
  const t2 = ws2.getCell('A1');
  t2.value = "LA MORE EVENTOS — Relatório Detalhado de Vendas por Produto (Unidades Reais e Bipadas)";
  t2.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
  t2.alignment = { vertical: 'middle', horizontal: 'center' };

  const hRow2 = ws2.getRow(4);
  hRow2.values = ["Posição", "Produto / Item", "Categoria", "Preço Unitário (R$)", "Transações (Bipadas)", "Unidades Físicas (Qtd Real)", "Faturamento Total (R$)"];
  hRow2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };

  ws2.columns = [
    { key: "pos", width: 10 },
    { key: "prod", width: 30 },
    { key: "cat", width: 20 },
    { key: "preco", width: 22 },
    { key: "bip", width: 22 },
    { key: "qtd", width: 26 },
    { key: "fat", width: 22 }
  ];

  lmRows.forEach((r, idx) => {
    if (!r['Produto / Item']) return;
    const row = ws2.addRow({
      pos: r['Posição'] || `${idx + 1}º`,
      prod: r['Produto / Item'],
      cat: r['Categoria'],
      preco: r['Preço Unitário (R$)'],
      bip: r['Transações (Bipadas)'],
      qtd: r['Unidades Físicas (Qtd Real)'],
      fat: r['Faturamento Total (R$)']
    });
    if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    row.getCell(4).numFmt = '"R$ "#,##0.00';
    row.getCell(7).numFmt = '"R$ "#,##0.00';
  });

  // ==========================================
  // ABA 3: PRODUTOS PDV LEGAL DETALHADO
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

  // Salvar em Downloads e no projeto
  const outPath1 = 'C:\\Users\\Usuário\\Downloads\\LaMore_vs_PDV_Comparativo_Unificado.xlsx';
  const outPath2 = path.join(__dirname, '../public/LaMore_vs_PDV_Comparativo_Unificado.xlsx');

  await workbook.xlsx.writeFile(outPath1);
  await workbook.xlsx.writeFile(outPath2);
  console.log(`\n✅ PLANILHA COMPARATIVA UNIFICADA GERADA COM SUCESSO!`);
  console.log(`Arquivo 1: ${outPath1}`);
  console.log(`Arquivo 2: ${outPath2}`);
}

generateUnifiedComparison().catch(console.error);
