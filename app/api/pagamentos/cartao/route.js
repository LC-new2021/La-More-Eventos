import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req) {
  try {
    const {
      valor,
      clienteNome,
      cpf,
      eventoId,
      cardName,
      cardNumber,
      cardExpiry,
      cardCvc,
      cartaoCodigo
    } = await req.json();

    if (!valor || parseFloat(valor) <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    const value = parseFloat(valor);
    const host = req.headers.get("host") || "";
    let asaasApiKey = process.env.ASAAS_API_KEY;
    let asaasUrl = process.env.ASAAS_API_URL;


    if (eventoId) {
      const evento = await prisma.evento.findUnique({
        where: { id: eventoId },
        include: {
          usuarios: {
            where: { role: "ORGANIZADOR" }
          }
        }
      });
      let produtor = evento?.usuarios?.[0];
      if (!produtor && evento?.organizadorId) {
        produtor = await prisma.usuario.findUnique({
          where: { id: evento.organizadorId }
        });
      }
      if (produtor && produtor.gatewayActive === "ASAAS" && produtor.asaasToken) {
        asaasApiKey = produtor.asaasToken;
        if (produtor.asaasUrl) {
          asaasUrl = produtor.asaasUrl;
        } else {
          asaasUrl = ""; // Force auto-detection for the producer's token
        }
      }
    }

    if (!asaasUrl) {
      if (asaasApiKey && asaasApiKey.trim().startsWith("$")) {
        asaasUrl = "https://sandbox.asaas.com/api";
      } else {
        if (host.includes("localhost") || host.includes("127.0.0.1") || host.includes("3000") || host.includes("3001")) {
          asaasUrl = "https://sandbox.asaas.com/api";
        } else {
          asaasUrl = "https://api.asaas.com";
        }
      }
    }

    const txid = "CC" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();

    // Se a chave do Asaas estiver configurada, chama a API real
    if (asaasApiKey) {
      try {
        const cleanCpf = cpf ? cpf.replace(/\D/g, "") : "";
        const [expiryMonth, expiryYear] = cardExpiry.split("/");

        // 1. Criar ou Buscar Cliente no Asaas
        let customerId = "";
        const customerSearchRes = await fetch(`${asaasUrl}/v3/customers?cpfCnpj=${cleanCpf}`, {
          headers: {
            "access_token": asaasApiKey,
            "Content-Type": "application/json"
          }
        });
        const searchData = await customerSearchRes.json();
        
        if (searchData.data && searchData.data.length > 0) {
          customerId = searchData.data[0].id;
        } else {
          const createCustomerRes = await fetch(`${asaasUrl}/v3/customers`, {
            method: "POST",
            headers: {
              "access_token": asaasApiKey,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              name: clienteNome || "Consumidor La More",
              cpfCnpj: cleanCpf || undefined,
            })
          });
          const newCustomer = await createCustomerRes.json();
          if (newCustomer.id) {
            customerId = newCustomer.id;
          } else {
            throw new Error(newCustomer.errors?.[0]?.description || "Erro ao cadastrar cliente no Asaas");
          }
        }

        // 2. Realizar pagamento via Cartão de Crédito
        const today = new Date().toISOString().split("T")[0];
        const paymentRes = await fetch(`${asaasUrl}/v3/payments`, {
          method: "POST",
          headers: {
            "access_token": asaasApiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            customer: customerId,
            billingType: "CREDIT_CARD",
            value: value,
            dueDate: today,
            description: `Recarga de Saldo - La More Eventos`,
            externalReference: txid,
            creditCard: {
              holderName: cardName,
              number: cardNumber.replace(/\s/g, ""),
              expiryMonth: expiryMonth.trim(),
              expiryYear: "20" + expiryYear.trim(), // Asaas espera ano em 4 dígitos
              ccv: cardCvc
            },
            creditCardHolderInfo: {
              name: cardName,
              email: "financeiro@lamore.com",
              cpfCnpj: cleanCpf,
              postalCode: "01001000",
              addressNumber: "123",
              phone: "11999999999"
            }
          })
        });
        
        const paymentData = await paymentRes.json();

        if (!paymentData.id) {
          throw new Error(paymentData.errors?.[0]?.description || "Transação de cartão recusada pelo Asaas");
        }

        // Se o pagamento for CONFIRMADO imediatamente
        const confirmado = paymentData.status === "CONFIRMED" || paymentData.status === "RECEIVED";

        if (confirmado && cartaoCodigo) {
          const cartao = await prisma.cartao.findUnique({ where: { codigo: cartaoCodigo.toUpperCase() } });
          if (cartao) {
            const evento = await prisma.evento.findUnique({ where: { id: cartao.eventoId } });
            const taxaPct = evento?.taxaMasterPercent || 0;
            const valorTaxaMaster = (value * taxaPct) / 100;
            await prisma.$transaction([
              prisma.cartao.update({
                where: { id: cartao.id },
                data: { saldo: { increment: value } }
              }),
              prisma.movimentacao.create({
                data: {
                  tipo: 'RECARGA',
                  valor: value,
                  descricao: `Recarga Cartão Online (Asaas)`,
                  cartaoId: cartao.id,
                  gatewayId: paymentData.id,
                  gatewayStatus: "CONFIRMADO",
                  valorTaxaMaster
                }
              })
            ]);
          }
        }

        return NextResponse.json({
          success: true,
          txid: paymentData.id,
          status: paymentData.status,
          confirmado,
          isTest: false
        });
      } catch (err) {
        console.error("Erro na transação Asaas:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    // Fallback de teste (quando sem chave no .env)
    if (cartaoCodigo) {
      const cartao = await prisma.cartao.findUnique({ where: { codigo: cartaoCodigo.toUpperCase() } });
      if (cartao) {
        await prisma.$transaction([
          prisma.cartao.update({
            where: { id: cartao.id },
            data: { saldo: { increment: value } }
          }),
          prisma.movimentacao.create({
            data: {
              tipo: 'RECARGA',
              valor: value,
              descricao: `Recarga Cartão Online (Simulado)`,
              cartaoId: cartao.id,
              gatewayStatus: "SIMULADO"
            }
          })
        ]);
      }
    }

    return NextResponse.json({
      success: true,
      txid,
      status: "CONFIRMED",
      confirmado: true,
      isTest: true
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
