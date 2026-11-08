const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyze() {
  console.log('=== AUDITORIA COMPLETA DE VENDAS E CARTÕES ===');
  
  const eventos = await prisma.evento.findMany();
  console.log('Eventos encontrados:', eventos);

  for (const ev of eventos) {
    console.log(`\n==================================================`);
    console.log(`EVENTO: ${ev.nome} (ID: ${ev.id}) - Status: ${ev.status}`);
    console.log(`Data: ${ev.data}`);
    console.log(`==================================================`);

    // 1. Cartões e seus saldos
    const cartoes = await prisma.cartao.findMany({
      where: { eventoId: ev.id },
      include: { cliente: true, movimentacoes: true }
    });

    console.log(`\n--- 1. CARTÕES (${cartoes.length} total) ---`);
    let saldoTotalEmCartoes = 0;
    cartoes.forEach(c => {
      saldoTotalEmCartoes += c.saldo;
      console.log(`Cartão ${c.codigo} | Cliente: ${c.cliente?.nome} (CPF: ${c.cliente?.cpf || 'N/A'}) | Saldo Atual: R$ ${c.saldo.toFixed(2)} | Status: ${c.status} | Movimentações: ${c.movimentacoes.length}`);
    });
    console.log(`Saldo Total Restante nos Cartões: R$ ${saldoTotalEmCartoes.toFixed(2)}`);

    // 2. Movimentações detalhadas
    const movs = await prisma.movimentacao.findMany({
      where: {
        OR: [
          { cartao: { eventoId: ev.id } },
          { produto: { eventoId: ev.id } }
        ]
      },
      include: {
        cartao: { include: { cliente: true } },
        produto: true,
        operador: true
      },
      orderBy: { criadaEm: 'asc' }
    });

    console.log(`\n--- 2. TODAS AS MOVIMENTAÇÕES (${movs.length} total) ---`);
    let totalRecargas = 0;
    let totalDebitos = 0;
    let totalEstornos = 0;

    const vendasPorProduto = {};
    const vendasPorOperador = {};
    const vendasSemProduto = [];

    movs.forEach(m => {
      if (m.tipo === 'RECARGA') totalRecargas += m.valor;
      else if (m.tipo === 'DEBITO') {
        totalDebitos += m.valor;
        
        // Agrupar por produto
        const prodNome = m.produto ? m.produto.nome : (m.descricao || 'Produto Indefinido / Sem Vínculo');
        if (!vendasPorProduto[prodNome]) {
          vendasPorProduto[prodNome] = { qtd: 0, valorTotal: 0, precoUnitario: m.produto?.preco || m.valor };
        }
        vendasPorProduto[prodNome].qtd += 1;
        vendasPorProduto[prodNome].valorTotal += m.valor;

        if (!m.produtoId) {
          vendasSemProduto.push(m);
        }

        // Agrupar por operador
        const opNome = m.operadorNome || m.operador?.nome || 'Não identificado';
        if (!vendasPorOperador[opNome]) {
          vendasPorOperador[opNome] = { qtd: 0, valorTotal: 0 };
        }
        vendasPorOperador[opNome].qtd += 1;
        vendasPorOperador[opNome].valorTotal += m.valor;
      }
      else if (m.tipo === 'ESTORNO') totalEstornos += m.valor;
    });

    console.log(`Total Recarregado: R$ ${totalRecargas.toFixed(2)}`);
    console.log(`Total Consumido (Débito): R$ ${totalDebitos.toFixed(2)}`);
    console.log(`Total Estornado: R$ ${totalEstornos.toFixed(2)}`);
    console.log(`Cálculo da Conciliação Financeira: Recargas (${totalRecargas.toFixed(2)}) - Consumo (${totalDebitos.toFixed(2)}) + Estornos (${totalEstornos.toFixed(2)}) = R$ ${(totalRecargas - totalDebitos + totalEstornos).toFixed(2)} (Bate com saldo nos cartões: ${saldoTotalEmCartoes.toFixed(2)}? ${Math.abs((totalRecargas - totalDebitos + totalEstornos) - saldoTotalEmCartoes) < 0.01 ? 'SIM' : 'NÃO'})`);

    console.log(`\n--- 3. DETALHAMENTO DE PRODUTOS VENDIDOS (CONSUMO NO BAR) ---`);
    console.table(Object.keys(vendasPorProduto).map(p => ({
      Produto: p,
      Quantidade: vendasPorProduto[p].qtd,
      'Preço Base/Ref': `R$ ${vendasPorProduto[p].precoUnitario.toFixed(2)}`,
      'Total Vendido': `R$ ${vendasPorProduto[p].valorTotal.toFixed(2)}`
    })));

    console.log(`\n--- 4. VENDAS POR OPERADOR / PONTO DE VENDA ---`);
    console.table(Object.keys(vendasPorOperador).map(op => ({
      Operador: op,
      ItensVendidos: vendasPorOperador[op].qtd,
      TotalFaturado: `R$ ${vendasPorOperador[op].valorTotal.toFixed(2)}`
    })));

    // 5. Produtos cadastrados no evento vs vendidos
    const prods = await prisma.produto.findMany({
      where: { eventoId: ev.id }
    });
    console.log(`\n--- 5. PRODUTOS CADASTRADOS NO SISTEMA ---`);
    prods.forEach(p => {
      const vendidos = vendasPorProduto[p.nome]?.qtd || 0;
      const total = vendasPorProduto[p.nome]?.valorTotal || 0;
      console.log(`- [${p.grupo}] ${p.nome} (Preço: R$ ${p.preco.toFixed(2)}) | Vendidos no Sistema: ${vendidos} un (R$ ${total.toFixed(2)}) | Ativo: ${p.ativo}`);
    });

    // 6. Verificação de devoluções
    const devolucoes = await prisma.solicitacaoDevolucao.findMany({
      where: { eventoId: ev.id }
    });
    console.log(`\n--- 6. SOLICITAÇÕES DE DEVOLUÇÃO / PIX (${devolucoes.length}) ---`);
    devolucoes.forEach(d => {
      console.log(`ID: ${d.id} | Valor: R$ ${d.valor.toFixed(2)} | Status: ${d.status} | Chave Pix: ${d.chavePix}`);
    });

    // 7. Lista detalhada de cada transação de débito com timestamps
    console.log(`\n--- 7. LOG CRONOLÓGICO DE TODAS AS TRANSAÇÕES ---`);
    movs.forEach((m, idx) => {
      console.log(`[${m.criadaEm.toISOString()}] Tipo: ${m.tipo} | Valor: R$ ${m.valor.toFixed(2)} | Cartão: ${m.cartao?.codigo || 'N/A'} (${m.cartao?.cliente?.nome || 'N/A'}) | Produto: ${m.produto?.nome || m.descricao || 'N/A'} | Operador: ${m.operadorNome || m.operador?.nome || 'N/A'}`);
    });
  }
}

analyze()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
