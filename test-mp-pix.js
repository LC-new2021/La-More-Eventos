const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const evento = await prisma.evento.findFirst({
    where: { nome: 'La More Summer Party' }
  });
  console.log("Token:", evento.mercadoPagoAccessToken);
  
  if (!evento.mercadoPagoAccessToken) return console.log("No token");

  const mpPayload = {
    transaction_amount: 50.00,
    description: "Recarga de Saldo - La More Eventos",
    payment_method_id: "pix",
    payer: {
      email: "financeiro@lamore.com.br",
      first_name: "Consumidor Teste",
      identification: {
        type: "CPF",
        number: "00000000000"
      }
    },
    external_reference: "TESTE123"
  };

  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${evento.mercadoPagoAccessToken.trim()}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": "TESTE123-" + Date.now()
    },
    body: JSON.stringify(mpPayload)
  });

  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Data:", data);
}

test();
