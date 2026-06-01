import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req) {
  try {
    const { valor, clienteNome, cpf, eventoId, cartaoCodigo } = await req.json();

    if (!valor || parseFloat(valor) <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    const value = parseFloat(valor);
    const host = req.headers.get("host") || "";
    let asaasApiKey = process.env.ASAAS_API_KEY;
    let asaasUrl = process.env.ASAAS_API_URL;
    
    if (!asaasUrl) {
      if (host.includes("localhost") || host.includes("127.0.0.1") || host.includes("3000") || host.includes("3001")) {
        asaasUrl = "https://sandbox.asaas.com/api";
      } else {
        asaasUrl = "https://api.asaas.com";
      }
    }

    if (eventoId) {
      const evento = await prisma.evento.findUnique({
        where: { id: eventoId },
        include: {
          usuarios: {
            where: { role: "ORGANIZADOR" }
          }
        }
      });
      const produtor = evento?.usuarios?.[0];
      if (produtor && produtor.gatewayActive === "ASAAS" && produtor.asaasToken) {
        asaasApiKey = produtor.asaasToken;
        if (produtor.asaasUrl) {
          asaasUrl = produtor.asaasUrl;
        }
      }
    }

    const txid = cartaoCodigo
      ? "RECARGA_PIX_" + cartaoCodigo.toUpperCase()
      : "TXID" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();

    // Se a chave do Asaas estiver configurada, chama a API real
    if (asaasApiKey) {
      try {
        const cleanCpf = cpf ? cpf.replace(/\D/g, "") : "";

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
          // Criar novo cliente
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

        // 2. Criar Cobrança (Pix) no Asaas
        // Definir vencimento para hoje
        const today = new Date().toISOString().split("T")[0];
        const paymentRes = await fetch(`${asaasUrl}/v3/payments`, {
          method: "POST",
          headers: {
            "access_token": asaasApiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            customer: customerId,
            billingType: "PIX",
            value: value,
            dueDate: today,
            description: `Recarga de Saldo - La More Eventos`,
            externalReference: txid
          })
        });
        const paymentData = await paymentRes.json();
        
        if (!paymentData.id) {
          throw new Error(paymentData.errors?.[0]?.description || "Erro ao criar cobrança no Asaas");
        }

        // 3. Obter QR Code e Copia e Cola
        const qrCodeRes = await fetch(`${asaasUrl}/v3/payments/${paymentData.id}/pixQrCode`, {
          headers: {
            "access_token": asaasApiKey
          }
        });
        const qrCodeData = await qrCodeRes.json();

        if (!qrCodeData.success) {
          throw new Error("Erro ao obter QR Code do Pix no Asaas");
        }

        return NextResponse.json({
          txid: paymentData.id, // Usamos o ID do Asaas para conciliação no Webhook
          pixPayload: qrCodeData.payload,
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeData.payload)}`,
          valor: value,
          isTest: false
        });
      } catch (err) {
        console.error("Falha ao comunicar com Asaas, usando fallback de teste:", err.message);
        return NextResponse.json({ error: `Erro no Asaas: ${err.message}` }, { status: 500 });
      }
    }

    // Fallback de teste (quando a API Key do Asaas não estiver configurada no .env)
    const pixPayload = `00020101021226840014br.gov.bcb.pix2562payload.asaas.com.br/pix/v2/${txid}5204000053039865405${value.toFixed(2)}5802BR5917La More Eventos6009SAO PAULO62070503***6304`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixPayload)}`;

    return NextResponse.json({
      txid,
      pixPayload,
      qrCodeUrl,
      valor: value,
      isTest: true
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
