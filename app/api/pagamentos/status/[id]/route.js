import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req, { params }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const eventoId = searchParams.get("eventoId");

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
          asaasUrl = ""; 
        }
      }
    }

    const host = req.headers.get("host") || "";
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

    if (!asaasApiKey) {
      // Simulação para testes locais se sem chaves
      return NextResponse.json({ status: "CONFIRMED", simulated: true });
    }

    const response = await fetch(`${asaasUrl}/v3/payments/${id}`, {
      headers: {
        "access_token": asaasApiKey,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `Erro Asaas: ${errorText}` }, { status: response.status });
    }

    const paymentData = await response.json();
    return NextResponse.json({
      status: paymentData.status, // "PENDING", "RECEIVED", "CONFIRMED", etc.
      simulated: false
    });

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
