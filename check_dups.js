const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const eventos = await prisma.evento.findMany({
    where: { nome: { contains: 'Riacho Fundo' } }
  });
  console.log('Eventos:', eventos.map(e => ({ id: e.id, nome: e.nome })));
  
  const eventoId = eventos[0]?.id;
  if(eventoId) {
    const movs = await prisma.movimentacao.findMany({
      where: { cartao: { eventoId } },
      include: { produto: true }
    });
    console.log('Movs:', movs.length);
    
    const dups = {};
    for(const m of movs) {
      if(m.tipo === 'DEBITO') {
        // grouping by card, product, value and the exact minute
        const key = `${m.cartaoId}-${m.produtoId}-${m.valor}-${m.criadaEm.toISOString().substring(0, 16)}`;
        if(!dups[key]) dups[key] = [];
        dups[key].push(m);
      }
    }
    
    const duplicados = Object.entries(dups).filter(([k,v]) => v.length > 1);
    console.log(`Encontrados ${duplicados.length} grupos de duplicatas.`);
    
    for (const [k, v] of duplicados.slice(0, 5)) {
      console.log('Grupo:', k);
      v.forEach(m => console.log(`  ID: ${m.id} | Data: ${m.criadaEm} | Op: ${m.operadorNome} | Desc: ${m.descricao}`));
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
