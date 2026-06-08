import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  const { codigo } = await params;

  if (!codigo) {
    return NextResponse.json({ error: 'Código do cartão ausente' }, { status: 400 });
  }

  const manifest = {
    name: `La More - Cartão ${codigo.toUpperCase()}`,
    short_name: "La More Eventos",
    start_url: `/cartao/${codigo.toUpperCase()}`,
    scope: "/",
    display: "standalone",
    background_color: "#0F1C3F",
    theme_color: "#0F1C3F",
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      }
    ]
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    }
  });
}
