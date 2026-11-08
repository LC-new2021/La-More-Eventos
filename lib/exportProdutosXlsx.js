export async function exportarPlanilhaProdutosMaster({ eventoId, eventoNome }) {
  if (!eventoId) {
    alert('Selecione um evento antes de exportar a planilha de produtos.');
    return;
  }

  const res = await fetch(`/api/produtos?eventoId=${eventoId}&includeInactive=true&includeDeleted=true`);
  if (!res.ok) {
    throw new Error('Não foi possível carregar os produtos do evento.');
  }
  const produtos = await res.json();

  if (!Array.isArray(produtos) || produtos.length === 0) {
    alert('Nenhum produto cadastrado neste evento para exportar.');
    return;
  }

  const ExcelJS = (await import('exceljs')).default;
  const { saveAs } = await import('file-saver');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'La More Eventos - Master';
  wb.created = new Date();

  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };
  const subHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B4C7E' } };
  const zebraFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  const inactiveFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
  const headerFont = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  const titleFont = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  const bodyFont = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
  const currencyFormat = '"R$ "#,##0.00';

  const applyBorders = (cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
  };

  const totalAtivos = produtos.filter((p) => p.ativo && !p.excluido).length;
  const totalDesativados = produtos.filter((p) => !p.ativo && !p.excluido).length;
  const totalExcluidos = produtos.filter((p) => p.excluido).length;
  const totalComAlteracao = produtos.filter((p) => (p.historicoPrecos || []).length > 0).length;

  // ==========================================
  // ABA 1: CARDÁPIO COMPLETO (ATIVOS E DESATIVADOS)
  // ==========================================
  const ws = wb.addWorksheet('Produtos (Ativos e Inativos)');

  ws.mergeCells('A1:L1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `LA MORE EVENTOS — PLANILHA OFICIAL DE PRODUTOS (${(eventoNome || 'EVENTO').toUpperCase()})`;
  titleCell.fill = headerFill;
  titleCell.font = titleFont;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:L2');
  const subTitleCell = ws.getCell('A2');
  subTitleCell.value = `Exportado em: ${new Date().toLocaleString('pt-BR')} | Ativos: ${totalAtivos} | Desativados: ${totalDesativados}${totalExcluidos > 0 ? ` | Excluídos: ${totalExcluidos}` : ''} | Com Alteração de Preço: ${totalComAlteracao}`;
  subTitleCell.fill = subHeaderFill;
  subTitleCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFE2E8F0' } };
  subTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 22;

  const headers = [
    'Status',
    'Categoria / Grupo',
    'Produto',
    'Modalidade',
    'Valor Inicial (R$)',
    'Valor Atual (R$)',
    'Teve Alteração?',
    'Histórico de Alterações de Valor',
    'Observação',
    'Cadastrado Por',
    'Última Ação Por',
    'Data Cadastro',
  ];

  const headerRow = ws.getRow(4);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    applyBorders(cell);
  });
  headerRow.height = 26;

  produtos.forEach((p, idx) => {
    const hist = Array.isArray(p.historicoPrecos) ? p.historicoPrecos : [];
    const valorInicial = hist.length > 0 && hist[0].de !== null ? Number(hist[0].de) : Number(p.preco || 0);
    const valorAtual = Number(p.preco || 0);
    const teveAlteracao = hist.length > 0;

    const resumoHistorico = teveAlteracao
      ? hist
          .map((h) => {
            const dt = h.data ? new Date(h.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
            const deStr = Number(h.de || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            const paraStr = Number(h.para || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            return `[${dt}] R$ ${deStr} → R$ ${paraStr} (${h.por || 'Sistema'})`;
          })
          .join(' | ')
      : 'Sem alterações (Valor original mantido)';

    const statusLabel = p.excluido ? 'EXCLUÍDO' : p.ativo ? 'ATIVO' : 'DESATIVADO';

    const row = ws.addRow([
      statusLabel,
      p.grupo || 'Outros',
      `${p.imagem || '📦'} ${p.nome}`,
      p.precoVariavel ? 'Valor Variável' : 'Preço Fixo',
      valorInicial,
      valorAtual,
      teveAlteracao ? `SIM (${hist.length}x)` : 'NÃO',
      resumoHistorico,
      p.observacao || '-',
      p.criadoPorNome || 'Sistema',
      p.atualizadoPorNome || p.criadoPorNome || '-',
      p.criadoEm ? new Date(p.criadoEm).toLocaleString('pt-BR') : '-',
    ]);

    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { ...bodyFont };
      if (!p.ativo || p.excluido) {
        cell.fill = inactiveFill;
      } else if (idx % 2 === 1) {
        cell.fill = zebraFill;
      }
      applyBorders(cell);

      if (colNumber === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (p.excluido) {
          cell.font = { ...bodyFont, bold: true, color: { argb: 'FFDC2626' } };
        } else if (p.ativo) {
          cell.font = { ...bodyFont, bold: true, color: { argb: 'FF15803D' } };
        } else {
          cell.font = { ...bodyFont, bold: true, color: { argb: 'FFB45309' } };
        }
      } else if (colNumber === 5 || colNumber === 6) {
        cell.numFmt = currencyFormat;
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.font = { ...bodyFont, bold: colNumber === 6 };
      } else if (colNumber === 4 || colNumber === 7 || colNumber === 12) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (colNumber === 7 && teveAlteracao) {
          cell.font = { ...bodyFont, bold: true, color: { argb: 'FF1D4ED8' } };
        }
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: colNumber === 8 };
      }
    });
  });

  const colWidths = [15, 22, 32, 16, 18, 18, 16, 48, 25, 20, 20, 20];
  colWidths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  // ==========================================
  // ABA 2: HISTÓRICO DETALHADO DE ALTERAÇÕES DE VALORES
  // ==========================================
  const wsHist = wb.addWorksheet('Alterações de Valores');
  wsHist.mergeCells('A1:H1');
  const histTitle = wsHist.getCell('A1');
  histTitle.value = `HISTÓRICO DE ALTERAÇÕES DE PREÇOS — ${(eventoNome || 'EVENTO').toUpperCase()}`;
  histTitle.fill = headerFill;
  histTitle.font = titleFont;
  histTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  wsHist.getRow(1).height = 28;

  const histHeaders = [
    'Produto',
    'Categoria / Grupo',
    'Status Atual',
    'Valor Anterior (R$)',
    'Novo Valor (R$)',
    'Variação (R$)',
    'Alterado Por',
    'Data e Hora da Alteração',
  ];

  const histHeaderRow = wsHist.getRow(3);
  histHeaders.forEach((h, i) => {
    const cell = histHeaderRow.getCell(i + 1);
    cell.value = h;
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    applyBorders(cell);
  });
  histHeaderRow.height = 24;

  let countAlteracoes = 0;
  produtos.forEach((p) => {
    const hist = Array.isArray(p.historicoPrecos) ? p.historicoPrecos : [];
    hist.forEach((h) => {
      countAlteracoes++;
      const deVal = Number(h.de || 0);
      const paraVal = Number(h.para || 0);
      const diff = paraVal - deVal;
      const statusLabel = p.excluido ? 'EXCLUÍDO' : p.ativo ? 'ATIVO' : 'DESATIVADO';

      const row = wsHist.addRow([
        `${p.imagem || '📦'} ${p.nome}`,
        p.grupo || 'Outros',
        statusLabel,
        deVal,
        paraVal,
        diff,
        h.por || 'Sistema',
        h.data ? new Date(h.data).toLocaleString('pt-BR') : '-',
      ]);
      row.height = 20;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { ...bodyFont };
        if (countAlteracoes % 2 === 0) cell.fill = zebraFill;
        applyBorders(cell);
        if (colNumber >= 4 && colNumber <= 6) {
          cell.numFmt = currencyFormat;
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          if (colNumber === 6) {
            cell.font = {
              ...bodyFont,
              bold: true,
              color: { argb: diff >= 0 ? 'FF15803D' : 'FFDC2626' },
            };
          }
        } else if (colNumber === 3 || colNumber === 8) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      });
    });
  });

  if (countAlteracoes === 0) {
    const emptyRow = wsHist.addRow([
      'Nenhuma alteração de preço registrada nos produtos deste evento até o momento.',
      '-',
      '-',
      0,
      0,
      0,
      '-',
      '-',
    ]);
    emptyRow.eachCell((cell) => {
      cell.font = { ...bodyFont, italic: true };
      applyBorders(cell);
    });
  }

  [30, 22, 16, 20, 20, 18, 22, 22].forEach((w, i) => {
    wsHist.getColumn(i + 1).width = w;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const safeName = String(eventoNome || 'Evento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, `Produtos_LaMore_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
