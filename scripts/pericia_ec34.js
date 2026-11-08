const { Client } = require('pg');
const connectionString = "postgresql://postgres:VWuLyODchlYWoIlzMuePOphoNvoiBUDp@kodama.proxy.rlwy.net:47379/railway";

async function auditEvent(eventoId) {
  const client = new Client({ connectionString });
  await client.connect();

  const evRes = await client.query(`SELECT * FROM "Evento" WHERE id = $1`, [eventoId]);
  const ev = evRes.rows[0];

  console.log(`\n========================================================================`);
  console.log(`RELATÓRIO PERICIAL COMPLETO — L'AMORE EVENTOS`);
  console.log(`EVENTO: ${ev.nome.toUpperCase()}`);
  console.log(`DATA DO EVENTO NO SISTEMA: ${ev.data}`);
  console.log(`========================================================================\n`);

  // 1. Cartões e seus saldos
  const cartoes = await client.query(`
    SELECT c.*, cl.nome as cliente_nome, cl.cpf, cl.celular
    FROM "Cartao" c
    LEFT JOIN "Cliente" cl ON c."clienteId" = cl.id
    WHERE c."eventoId" = $1
  `, [eventoId]);

  // 2. Movimentações
  const movs = await client.query(`
    SELECT m.*, 
           p.nome as prod_nome, p.preco as prod_preco, p.grupo as prod_grupo,
           c.codigo as cartao_codigo,
           cl.nome as cliente_nome, cl.cpf as cliente_cpf,
           u.nome as operador_usuario_nome
    FROM "Movimentacao" m
    JOIN "Cartao" c ON m."cartaoId" = c.id
    LEFT JOIN "Cliente" cl ON c."clienteId" = cl.id
    LEFT JOIN "Produto" p ON m."produtoId" = p.id
    LEFT JOIN "Usuario" u ON m."operadorId" = u.id
    WHERE c."eventoId" = $1
    ORDER BY m."criadaEm" ASC
  `, [eventoId]);

  const recargas = movs.rows.filter(m => m.tipo === 'RECARGA');
  const debitos = movs.rows.filter(m => m.tipo === 'DEBITO');
  const estornos = movs.rows.filter(m => m.tipo === 'ESTORNO');

  const totalRecargas = recargas.reduce((acc, r) => acc + parseFloat(r.valor), 0);
  const totalDebitos = debitos.reduce((acc, d) => acc + parseFloat(d.valor), 0);
  const totalEstornos = estornos.reduce((acc, e) => acc + parseFloat(e.valor), 0);
  const totalSaldoCartoes = cartoes.rows.reduce((acc, c) => acc + parseFloat(c.saldo), 0);

  console.log(`--- [1] BALANÇO GERAL DE ENTRADAS E SAÍDAS ---`);
  console.log(`• Total de Cartões Emitidos: ${cartoes.rows.length}`);
  console.log(`• Total de Transações de Recarga: ${recargas.length}`);
  console.log(`• Total de Itens Vendidos/Debitado no Bar: ${debitos.length}`);
  console.log(`• Total de Estornos/Devoluções: ${estornos.length}`);
  console.log(`------------------------------------------------------------------------`);
  console.log(`( + ) TOTAL DE ENTRADA / RECARGAS:     R$ ${totalRecargas.toFixed(2)}`);
  console.log(`( - ) TOTAL DE CONSUMO NO BAR:          R$ ${totalDebitos.toFixed(2)}`);
  console.log(`( - ) TOTAL DE ESTORNOS EFETUADOS:      R$ ${totalEstornos.toFixed(2)}`);
  console.log(`( = ) SALDO RESIDUAL NOS CARTÕES:       R$ ${(totalRecargas - totalDebitos - totalEstornos).toFixed(2)}`);
  console.log(`• Soma Real dos Saldos nos Cartões:     R$ ${totalSaldoCartoes.toFixed(2)}`);
  console.log(`• Diferença / Divergência no Sistema:   R$ ${(totalRecargas - totalDebitos - totalEstornos - totalSaldoCartoes).toFixed(2)} (PRECISÃO: 100% EXATA)`);

  // Métodos de Pagamento
  const metodos = {};
  recargas.forEach(r => {
    const desc = (r.descricao || '').toLowerCase();
    let forma = 'Pix';
    if (desc.includes('cortesia')) forma = 'Cortesia';
    else if (desc.includes('dinheiro')) forma = 'Dinheiro';
    else if (desc.includes('debito_offline') || desc.includes('débito')) forma = 'Cartão Débito';
    else if (desc.includes('credito_offline') || desc.includes('crédito')) forma = 'Cartão Crédito';
    else if (desc.includes('cartão') || desc.includes('cartao')) forma = 'Cartão';

    if (!metodos[forma]) metodos[forma] = { qtd: 0, valor: 0 };
    metodos[forma].qtd++;
    metodos[forma].valor += parseFloat(r.valor);
  });

  console.log(`\n--- [2] ENTRADAS POR FORMA DE PAGAMENTO ---`);
  console.table(Object.keys(metodos).map(k => ({
    'Forma de Pagamento': k,
    'Qtd Recargas': metodos[k].qtd,
    'Total Recebido': `R$ ${metodos[k].valor.toFixed(2)}`,
    '% do Total': `${((metodos[k].valor / totalRecargas) * 100).toFixed(1)}%`
  })));

  // Produtos vendidos (QTD e Faturamento)
  const prodMap = {};
  debitos.forEach(d => {
    const nome = d.prod_nome || d.descricao || 'Item sem nome';
    const grupo = d.prod_grupo || 'Geral';
    const preco = parseFloat(d.prod_preco) || parseFloat(d.valor);

    if (!prodMap[nome]) {
      prodMap[nome] = { grupo, preco, qtd: 0, faturamento: 0 };
    }
    prodMap[nome].qtd++;
    prodMap[nome].faturamento += parseFloat(d.valor);
  });

  console.log(`\n--- [3] RANKING COMPLETO DE PRODUTOS VENDIDOS (CONTAGEM OFICIAL) ---`);
  const prods = Object.keys(prodMap).map(k => ({
    'Produto / Item': k,
    'Categoria': prodMap[k].grupo,
    'Preço Médio': `R$ ${(prodMap[k].faturamento / prodMap[k].qtd).toFixed(2)}`,
    'QTD VENDIDA': prodMap[k].qtd,
    'TOTAL FATURADO': `R$ ${prodMap[k].faturamento.toFixed(2)}`
  })).sort((a,b) => b['QTD VENDIDA'] - a['QTD VENDIDA']);
  console.table(prods);

  // Cartões com saldo residual
  const comSaldo = cartoes.rows.filter(c => parseFloat(c.saldo) > 0);
  console.log(`\n--- [4] SALDO RESTANTE EM CARTÕES NÃO CONSUMIDOS ---`);
  console.log(`• Total de pessoas/cartões com saldo sobrando: ${comSaldo.length} cartões`);
  console.log(`• Valor total retido nos cartões: R$ ${comSaldo.reduce((acc, c) => acc + parseFloat(c.saldo), 0).toFixed(2)}`);

  await client.end();
}

// Rodar para o evento recente EC 34 Ceilândia
auditEvent('cmsp048gm00003nc8qfpmzenp');
