import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { processarCartaoAsaas } from "@/lib/asaas";
import {
  detectarBandeiraCartao,
  criarCardTokenMercadoPago,
  processarCartaoMercadoPago,
} from "@/lib/mercadopago";
import { processarRecargaIdempotente, buscarCartao } from "@/lib/recarga-service";

export const dynamic = "force-dynamic";

async function obterTokensGateway(evento) {
  let asaasToken = (evento?.asaasToken || process.env.ASAAS_API_KEY || "").trim();
  let mpToken = (evento?.mercadoPagoAccessToken || process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
  let pagbankToken = (evento?.pagbankToken || process.env.PAGBANK_TOKEN || "").trim();

  if (!asaasToken || !mpToken) {
    const eventos = await prisma.evento.findMany();
    for (const ev of eventos) {
      if (!asaasToken && ev.asaasToken && ev.asaasToken.trim().length > 10) {
        asaasToken = ev.asaasToken.trim();
      }
      if (!mpToken && ev.mercadoPagoAccessToken && ev.mercadoPagoAccessToken.trim().length > 10 && ev.mercadoPagoAccessToken.trim() !== "lamore2026") {
        mpToken = ev.mercadoPagoAccessToken.trim();
      }
    }
  }

  return { asaasToken, mpToken, pagbankToken };
}

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
      tipoCartao = "CREDITO", // 'CREDITO' | 'DEBITO'
      parcelas = 1,
      cartaoCodigo,
      useSavedCard,
    } = await req.json();

    if (!valor || parseFloat(valor) <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    const value = parseFloat(valor);
    const isDebito = String(tipoCartao).toUpperCase() === "DEBITO";
    const modalidadeLabel = isDebito ? "Débito" : "Crédito";
    const host = req.headers.get("host") || "";

    let evento = null;
    if (eventoId) {
      evento = await prisma.evento.findUnique({
        where: { id: eventoId },
      });
    }

    const { asaasToken, mpToken, pagbankToken } = await obterTokensGateway(evento);
    const gatewayConfig = (evento?.gatewayActive || "ASAAS").toUpperCase();

    const cleanCpf = cpf ? String(cpf).replace(/\D/g, "") : "";
    let clientRecord = null;
    if (cartaoCodigo) {
      const cartaoRef = await buscarCartao(cartaoCodigo);
      if (cartaoRef?.cliente) {
        clientRecord = cartaoRef.cliente;
      }
    }
    if (!clientRecord && cleanCpf && cleanCpf !== "00000000000") {
      clientRecord = await prisma.cliente.findFirst({ where: { cpf: cleanCpf } });
    }

    const txid =
      "CC" +
      Date.now().toString(36).toUpperCase() +
      Math.random().toString(36).substring(2, 5).toUpperCase();

    const payer = {
      nomeCompleto: clienteNome || clientRecord?.nome || cardName || "Consumidor La More",
      cpf: cleanCpf,
      email: clientRecord?.email || "financeiro@grupolamore.com.br",
      celular: clientRecord?.celular || "61993688095",
    };

    const dadosCartao = {
      nomeTitular: cardName || payer.nomeCompleto,
      numero: cardNumber,
      validade: cardExpiry,
      cvv: cardCvc,
      cpfTitular: cleanCpf,
    };

    // =========================================================================
    // 1. ROTEAMENTO PARA PAGBANK (SE ATIVO)
    // =========================================================================
    if (gatewayConfig === "PAGBANK" && pagbankToken) {
      try {
        if (useSavedCard) {
          throw new Error(
            "A recarga com 1 clique ainda não está disponível neste gateway. Por favor, digite os dados do cartão."
          );
        }

        const pagbankUrl =
          pagbankToken.includes("SANDBOX") || host.includes("localhost")
            ? "https://sandbox.api.pagseguro.com/orders"
            : "https://api.pagseguro.com/orders";

        const [expiryMonth, expiryYearRaw] = String(cardExpiry || "").split("/");
        const expiryYear =
          expiryYearRaw && expiryYearRaw.trim().length === 2
            ? "20" + expiryYearRaw.trim()
            : (expiryYearRaw || "").trim();

        const pagbankPayload = {
          reference_id: txid,
          customer: {
            name: payer.nomeCompleto,
            email: payer.email,
            tax_id: cleanCpf || "00000000000",
            phones: [
              {
                country: "55",
                area: "61",
                number: payer.celular.replace(/\D/g, "").slice(-9) || "993688095",
                type: "MOBILE",
              },
            ],
          },
          charges: [
            {
              reference_id: txid,
              description: `Recarga de Saldo (${modalidadeLabel}) - La More`,
              amount: {
                value: Math.round(value * 100),
                currency: "BRL",
              },
              payment_method: {
                type: isDebito ? "DEBIT_CARD" : "CREDIT_CARD",
                installments: isDebito ? 1 : Math.max(1, Number(parcelas) || 1),
                capture: true,
                card: {
                  number: String(cardNumber || "").replace(/\s/g, ""),
                  exp_month: (expiryMonth || "").trim(),
                  exp_year: expiryYear,
                  security_code: cardCvc,
                  holder: {
                    name: cardName,
                  },
                },
              },
            },
          ],
        };

        const res = await fetch(pagbankUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${pagbankToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(pagbankPayload),
        });

        const data = await res.json();

        if (!res.ok || !data.charges || !data.charges[0]) {
          const errorDesc =
            data.error_messages?.[0]?.description ||
            data.message ||
            "Transação recusada no PagBank";
          throw new Error(errorDesc);
        }

        const charge = data.charges[0];
        if (charge.status === "DECLINED" || charge.status === "CANCELED") {
          throw new Error(
            charge.payment_response?.message || "Cartão recusado pelo banco emissor."
          );
        }

        const confirmado = charge.status === "PAID" || charge.status === "AUTHORIZED";
        let resultadoRecarga = null;

        if (confirmado && cartaoCodigo) {
          resultadoRecarga = await processarRecargaIdempotente({
            cartaoCodigo,
            valor: value,
            gatewayId: data.id ? String(data.id) : txid,
            gatewayStatus: "CONFIRMADO",
            descricao: `Recarga Cartão ${modalidadeLabel} Integrado (PagBank)`,
            operadorNome: `PagBank ${modalidadeLabel}`,
          });
        }

        return NextResponse.json({
          success: true,
          txid: data.id || txid,
          status: charge.status,
          confirmado,
          gateway: "PAGBANK",
          cartao: resultadoRecarga?.cartao || null,
          novoSaldo: resultadoRecarga?.novoSaldo,
          isTest: pagbankUrl.includes("sandbox"),
        });
      } catch (err) {
        console.error("Erro na transação PagBank:", err.message);
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }

    // =========================================================================
    // 2. ROTEAMENTO PARA MERCADO PAGO (QUANDO GATEWAY ATIVO FOR MERCADO_PAGO)
    // =========================================================================
    if (gatewayConfig === "MERCADO_PAGO" && mpToken) {
      try {
        if (useSavedCard) {
          throw new Error(
            "Para esta transação no Mercado Pago, informe os dados do cartão."
          );
        }

        const cardToken = await criarCardTokenMercadoPago({
          token: mpToken,
          dadosCartao,
        });

        const bandeiraBase = detectarBandeiraCartao(cardNumber);
        const codigoPedido = `REC-${(cartaoCodigo || "CARTAO").toUpperCase()}-${Date.now()}`;

        const mpRes = await processarCartaoMercadoPago({
          token: mpToken,
          valor: value,
          descricao: `Recarga Cartão ${modalidadeLabel} - ${cartaoCodigo || "La More"}`,
          codigoPedido,
          parcelas: isDebito ? 1 : parcelas,
          tipoCartao,
          cardToken,
          bandeira: bandeiraBase,
          payer,
          appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://eventos.grupolamore.com.br",
        });

        if (mpRes.status === "rejected" || mpRes.status === "cancelled") {
          throw new Error("Cartão recusado pelo banco emissor. Verifique os dados ou tente outro cartão.");
        }

        const confirmado = mpRes.status === "approved" || mpRes.status === "in_process";
        let resultadoRecarga = null;

        if (confirmado && cartaoCodigo) {
          resultadoRecarga = await processarRecargaIdempotente({
            cartaoCodigo,
            valor: value,
            gatewayId: String(mpRes.paymentId),
            gatewayStatus: "CONFIRMADO",
            descricao: `Recarga Cartão ${modalidadeLabel} Integrado (Mercado Pago)`,
            operadorNome: `Mercado Pago ${modalidadeLabel}`,
          });
        }

        return NextResponse.json({
          success: true,
          txid: String(mpRes.paymentId),
          status: mpRes.status,
          confirmado,
          gateway: "MERCADO_PAGO",
          cartao: resultadoRecarga?.cartao || null,
          novoSaldo: resultadoRecarga?.novoSaldo,
          isTest: false,
        });
      } catch (errMp) {
        console.error("Erro na transação Mercado Pago:", errMp.message);
        return NextResponse.json({ error: errMp.message }, { status: 400 });
      }
    }

    // =========================================================================
    // 3. ROTEAMENTO OFICIAL PARA ASAAS (GATEWAY PADRÃO ATIVO)
    // =========================================================================
    if (asaasToken) {
      try {
        if (useSavedCard && (!clientRecord || !clientRecord.creditCardToken)) {
          throw new Error("Nenhum cartão salvo localizado para este cliente.");
        }

        const forwardedFor = req.headers.get("x-forwarded-for");
        const remoteIp = forwardedFor ? forwardedFor.split(",")[0].trim() : undefined;
        const codigoPedido = `REC-${(cartaoCodigo || "CARTAO").toUpperCase()}-${Date.now()}`;

        const cobrancaAsaas = await processarCartaoAsaas({
          token: asaasToken,
          valor: value,
          descricao: `Recarga Cartão ${modalidadeLabel} Integrado - ${cartaoCodigo || "La More Eventos"}`,
          codigoPedido,
          parcelas: isDebito ? 1 : parcelas,
          tipoCartao,
          dadosCartao,
          creditCardToken: useSavedCard ? clientRecord.creditCardToken : null,
          payer,
          remoteIp,
        });

        // Se o pagamento retornou creditCardToken e temos o registro do cliente, salva para 1-Click futuro
        if (!useSavedCard && cobrancaAsaas.creditCardToken && clientRecord) {
          const lastDigits = String(cobrancaAsaas.numeroMascara || cardNumber || "")
            .replace(/\D/g, "")
            .slice(-4);
          const updateData = {
            creditCardToken: cobrancaAsaas.creditCardToken,
            creditCardBrand: cobrancaAsaas.bandeira || "CARTAO",
            creditCardLastDigits: lastDigits,
          };
          if (!clientRecord.cpf && cleanCpf && cleanCpf.length === 11 && cleanCpf !== "00000000000") {
            updateData.cpf = cleanCpf;
          }
          await prisma.cliente
            .update({
              where: { id: clientRecord.id },
              data: updateData,
            })
            .catch(() => {});
        }

        const confirmado =
          cobrancaAsaas.status === "CONFIRMED" ||
          cobrancaAsaas.status === "RECEIVED" ||
          cobrancaAsaas.status === "PENDING";

        let resultadoRecarga = null;
        if (confirmado && cartaoCodigo) {
          resultadoRecarga = await processarRecargaIdempotente({
            cartaoCodigo,
            valor: value,
            gatewayId: cobrancaAsaas.paymentId ? String(cobrancaAsaas.paymentId) : txid,
            gatewayStatus: "CONFIRMADO",
            descricao: useSavedCard
              ? `Recarga Cartão ${modalidadeLabel} Salvo (Asaas)`
              : `Recarga Cartão ${modalidadeLabel} Integrado (Asaas)`,
            operadorNome: `Asaas ${modalidadeLabel}`,
          });
        }

        return NextResponse.json({
          success: true,
          txid: cobrancaAsaas.paymentId || txid,
          status: cobrancaAsaas.status,
          confirmado,
          gateway: "ASAAS",
          cartao: resultadoRecarga?.cartao || null,
          novoSaldo: resultadoRecarga?.novoSaldo,
          isTest: false,
        });
      } catch (errAsaas) {
        console.error("Erro na transação Asaas:", errAsaas.message);
        // Se for recarga menor que R$ 5,00 (onde Asaas exige mínimo R$ 5 no cartão) e houver Mercado Pago configurado, faz fallback automático
        if (!useSavedCard && value < 5 && mpToken) {
          console.log("[CARTAO ROUTE] Fallback automático para Mercado Pago (valor < R$ 5,00)");
        } else {
          return NextResponse.json({ error: errAsaas.message }, { status: 400 });
        }
      }
    }

    // =========================================================================
    // 4. FALLBACK MERCADO PAGO CASO ASAAS NÃO ESTEJA CONFIGURADO
    // =========================================================================
    if (mpToken) {
      try {
        const cardToken = await criarCardTokenMercadoPago({
          token: mpToken,
          dadosCartao,
        });

        const bandeiraBase = detectarBandeiraCartao(cardNumber);
        const codigoPedido = `REC-${(cartaoCodigo || "CARTAO").toUpperCase()}-${Date.now()}`;

        const mpRes = await processarCartaoMercadoPago({
          token: mpToken,
          valor: value,
          descricao: `Recarga Cartão ${modalidadeLabel} - ${cartaoCodigo || "La More"}`,
          codigoPedido,
          parcelas: isDebito ? 1 : parcelas,
          tipoCartao,
          cardToken,
          bandeira: bandeiraBase,
          payer,
          appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://eventos.grupolamore.com.br",
        });

        const confirmado = mpRes.status === "approved" || mpRes.status === "in_process";
        let resultadoRecarga = null;

        if (confirmado && cartaoCodigo) {
          resultadoRecarga = await processarRecargaIdempotente({
            cartaoCodigo,
            valor: value,
            gatewayId: String(mpRes.paymentId),
            gatewayStatus: "CONFIRMADO",
            descricao: `Recarga Cartão ${modalidadeLabel} Integrado (Mercado Pago)`,
            operadorNome: `Mercado Pago ${modalidadeLabel}`,
          });
        }

        return NextResponse.json({
          success: true,
          txid: String(mpRes.paymentId),
          status: mpRes.status,
          confirmado,
          gateway: "MERCADO_PAGO",
          cartao: resultadoRecarga?.cartao || null,
          novoSaldo: resultadoRecarga?.novoSaldo,
          isTest: false,
        });
      } catch (errMp) {
        console.error("Erro na transação Mercado Pago (Fallback):", errMp.message);
        return NextResponse.json({ error: errMp.message }, { status: 400 });
      }
    }

    // =========================================================================
    // 5. FALLBACK DE TESTE (QUANDO SEM CHAVE DE GATEWAY)
    // =========================================================================
    let resultadoSimulado = null;
    if (cartaoCodigo) {
      resultadoSimulado = await processarRecargaIdempotente({
        cartaoCodigo,
        valor: value,
        gatewayId: txid,
        gatewayStatus: "SIMULADO",
        descricao: `Recarga Cartão ${modalidadeLabel} Online (Simulado)`,
        operadorNome: "Sistema Simulado",
      });
    }

    return NextResponse.json({
      success: true,
      txid,
      status: "CONFIRMED",
      confirmado: true,
      cartao: resultadoSimulado?.cartao || null,
      novoSaldo: resultadoSimulado?.novoSaldo,
      isTest: true,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
