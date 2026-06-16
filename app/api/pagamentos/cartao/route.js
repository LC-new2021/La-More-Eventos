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
      cartaoCodigo,
      useSavedCard
    } = await req.json();

    if (!valor || parseFloat(valor) <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    const value = parseFloat(valor);
    const host = req.headers.get("host") || "";
    let asaasApiKey = process.env.ASAAS_API_KEY;
    let asaasUrl = process.env.ASAAS_API_URL;
    let pagbankToken = process.env.PAGBANK_TOKEN;
    let isPagbankActive = false;

    if (eventoId) {
      const evento = await prisma.evento.findUnique({
        where: { id: eventoId }
      });
      if (evento) {
        if (evento.gatewayActive === "ASAAS" && evento.asaasToken) {
          asaasApiKey = evento.asaasToken;
          if (evento.asaasUrl) {
            asaasUrl = evento.asaasUrl;
          } else {
            asaasUrl = ""; // Force auto-detection
          }
        } else if (evento.gatewayActive === "PAGBANK" && evento.pagbankToken) {
          pagbankToken = evento.pagbankToken;
          isPagbankActive = true;
        }
      }
    }

    if (!asaasUrl) {
      if (asaasApiKey) {
        const cleanKey = asaasApiKey.trim();
        if (cleanKey.startsWith("$aact_sandbox_") || cleanKey.startsWith("$aae.")) {
          asaasUrl = "https://sandbox.asaas.com/api";
        } else if (cleanKey.startsWith("$aact_prod_")) {
          asaasUrl = "https://api.asaas.com";
        } else {
          // Formato antigo ou indefinido
          if (cleanKey.startsWith("$")) {
            asaasUrl = "https://sandbox.asaas.com/api";
          } else {
            if (host.includes("localhost") || host.includes("127.0.0.1") || host.includes("3000") || host.includes("3001")) {
              asaasUrl = "https://sandbox.asaas.com/api";
            } else {
              asaasUrl = "https://api.asaas.com";
            }
          }
        }
      } else {
        asaasUrl = "https://api.asaas.com";
      }
    }

    const txid = "CC" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();

    // Roteamento para PagBank
    if (isPagbankActive && pagbankToken) {
      try {
        let clientRecord = null;
        const cleanCpf = cpf ? cpf.replace(/\D/g, "") : "";
        if (cleanCpf) {
          clientRecord = await prisma.cliente.findFirst({ where: { cpf: cleanCpf } });
        }

        let cartao = null;
        if (cartaoCodigo) {
          cartao = await prisma.cartao.findUnique({
            where: { codigo: cartaoCodigo.toUpperCase() },
            include: { cliente: true }
          });
        }

        if (useSavedCard) {
          throw new Error("A recarga com 1 clique ainda não está disponível neste evento. Por favor, digite os dados do cartão.");
        }

        const cleanToken = pagbankToken.trim();
        const pagbankUrl = (cleanToken.includes("SANDBOX") || host.includes("localhost")) 
          ? "https://sandbox.api.pagseguro.com/orders" 
          : "https://api.pagseguro.com/orders";
        
        const [expiryMonth, expiryYear] = cardExpiry.split("/");
        
        const pagbankPayload = {
          reference_id: txid,
          customer: {
            name: clienteNome || clientRecord?.nome || "Consumidor La More",
            email: clientRecord?.email || "financeiro@lamore.com.br",
            tax_id: cleanCpf || "00000000000",
            phones: [
              {
                country: "55",
                area: "11",
                number: clientRecord?.celular ? clientRecord.celular.replace(/\D/g, "").slice(-9) : "999999999",
                type: "MOBILE"
              }
            ]
          },
          charges: [
            {
              reference_id: txid,
              description: "Recarga de Saldo - La More",
              amount: {
                value: Math.round(value * 100),
                currency: "BRL"
              },
              payment_method: {
                type: "CREDIT_CARD",
                installments: 1,
                capture: true,
                card: {
                  number: cardNumber.replace(/\s/g, ""),
                  exp_month: expiryMonth.trim(),
                  exp_year: "20" + expiryYear.trim(),
                  security_code: cardCvc,
                  holder: {
                    name: cardName
                  }
                }
              }
            }
          ]
        };

        const res = await fetch(pagbankUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${cleanToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(pagbankPayload)
        });

        const data = await res.json();

        if (!res.ok || !data.charges || !data.charges[0]) {
          const errorDesc = data.error_messages?.[0]?.description || data.message || "Transação recusada no PagBank";
          throw new Error(errorDesc);
        }

        const charge = data.charges[0];
        if (charge.status === "DECLINED" || charge.status === "CANCELED") {
           throw new Error(charge.payment_response?.message || "Cartão recusado pelo banco emissor.");
        }

        const confirmado = charge.status === "PAID" || charge.status === "AUTHORIZED";

        if (confirmado && cartaoCodigo) {
          const cartaoDb = cartao || await prisma.cartao.findUnique({ where: { codigo: cartaoCodigo.toUpperCase() } });
          if (cartaoDb) {
            const evento = await prisma.evento.findUnique({ where: { id: cartaoDb.eventoId } });
            const taxaPct = evento?.taxaMasterPercent || 0;
            const valorTaxaMaster = (value * taxaPct) / 100;
            await prisma.$transaction([
              prisma.cartao.update({
                where: { id: cartaoDb.id },
                data: { saldo: { increment: value } }
              }),
              prisma.movimentacao.create({
                data: {
                  tipo: 'RECARGA',
                  valor: value,
                  descricao: `Recarga Cartão Online (PagBank)`,
                  cartaoId: cartaoDb.id,
                  gatewayId: data.id,
                  gatewayStatus: charge.status,
                  valorTaxaMaster
                }
              })
            ]);
          }
        }

        return NextResponse.json({
          success: true,
          txid: data.id,
          status: charge.status,
          confirmado,
          isTest: pagbankUrl.includes("sandbox")
        });

      } catch (err) {
        console.error("Erro na transação PagBank:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    // Se a chave do Asaas estiver configurada, chama a API real
    if (asaasApiKey && !isPagbankActive) {
      try {
        let clientRecord = null;
        const cleanCpf = cpf ? cpf.replace(/\D/g, "") : "";
        if (cleanCpf) {
          clientRecord = await prisma.cliente.findFirst({ where: { cpf: cleanCpf } });
        }

        let cartao = null;
        if (cartaoCodigo) {
          cartao = await prisma.cartao.findUnique({
            where: { codigo: cartaoCodigo.toUpperCase() },
            include: { cliente: true }
          });
          if (!clientRecord && cartao?.cliente) {
            clientRecord = cartao.cliente;
          }
        }

        if (useSavedCard) {
          if (!clientRecord || !clientRecord.creditCardToken) {
            throw new Error("Nenhum cartão salvo localizado para este cliente.");
          }
        }

        // 1. Criar ou Buscar Cliente no Asaas
        let customerId = "";
        let searchData = { data: [] };
        const queryCpf = cleanCpf || clientRecord?.cpf || "";

        if (queryCpf) {
          const customerSearchRes = await fetch(`${asaasUrl}/v3/customers?cpfCnpj=${queryCpf}`, {
            headers: {
              "access_token": asaasApiKey,
              "Content-Type": "application/json"
            }
          });
          searchData = await customerSearchRes.json();
        }
        
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
              name: clienteNome || clientRecord?.nome || "Consumidor La More",
              cpfCnpj: queryCpf || undefined,
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
        const paymentPayload = {
          customer: customerId,
          billingType: "CREDIT_CARD",
          value: value,
          dueDate: today,
          description: `Recarga de Saldo - La More Eventos`,
          externalReference: txid,
        };

        if (useSavedCard && clientRecord?.creditCardToken) {
          paymentPayload.creditCardToken = clientRecord.creditCardToken;
        } else {
          const [expiryMonth, expiryYear] = cardExpiry.split("/");
          paymentPayload.creditCard = {
            holderName: cardName,
            number: cardNumber.replace(/\s/g, ""),
            expiryMonth: expiryMonth.trim(),
            expiryYear: "20" + expiryYear.trim(), // Asaas espera ano em 4 dígitos
            ccv: cardCvc
          };
          paymentPayload.creditCardHolderInfo = {
            name: cardName,
            email: clientRecord?.email || "financeiro@lamore.com",
            cpfCnpj: cleanCpf || clientRecord?.cpf || "",
            postalCode: "01001000",
            addressNumber: "123",
            phone: clientRecord?.celular || "11999999999"
          };
        }

        const paymentRes = await fetch(`${asaasUrl}/v3/payments`, {
          method: "POST",
          headers: {
            "access_token": asaasApiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(paymentPayload)
        });
        
        const paymentData = await paymentRes.json();

        if (!paymentData.id) {
          throw new Error(paymentData.errors?.[0]?.description || "Transação de cartão recusada pelo Asaas");
        }

        // Se o pagamento foi efetuado com sucesso e não estávamos usando cartão salvo, salva o token
        if (!useSavedCard && paymentData.creditCardToken && clientRecord) {
          const token = paymentData.creditCardToken;
          const brand = paymentData.creditCard?.creditCardBrand || "CARTÃO";
          const lastDigits = paymentData.creditCard?.creditCardNumber
            ? paymentData.creditCard.creditCardNumber.slice(-4)
            : "";
          
          await prisma.cliente.update({
            where: { id: clientRecord.id },
            data: {
              creditCardToken: token,
              creditCardBrand: brand,
              creditCardLastDigits: lastDigits
            }
          });
        }

        const confirmado = paymentData.status === "CONFIRMED" || paymentData.status === "RECEIVED";

        if (confirmado && cartaoCodigo) {
          const cartaoDb = cartao || await prisma.cartao.findUnique({ where: { codigo: cartaoCodigo.toUpperCase() } });
          if (cartaoDb) {
            const evento = await prisma.evento.findUnique({ where: { id: cartaoDb.eventoId } });
            const taxaPct = evento?.taxaMasterPercent || 0;
            const valorTaxaMaster = (value * taxaPct) / 100;
            await prisma.$transaction([
              prisma.cartao.update({
                where: { id: cartaoDb.id },
                data: { saldo: { increment: value } }
              }),
              prisma.movimentacao.create({
                data: {
                  tipo: 'RECARGA',
                  valor: value,
                  descricao: useSavedCard ? `Recarga Cartão Salvo (Asaas)` : `Recarga Cartão Online (Asaas)`,
                  cartaoId: cartaoDb.id,
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
