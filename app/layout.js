import { Geist } from "next/font/google";
import "./globals.css";
import SessionWrapper from "../components/SessionWrapper";

const geist = Geist({ subsets: ["latin"] });

export const metadata = {
  title: "La More Eventos",
  description: "Sistema de cartão de consumo virtual para eventos",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png?v=3",
    shortcut: "/logo.png?v=3",
    apple: "/logo.png?v=3",
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icon.png" />
      </head>
      <body className={geist.className}>
        <SessionWrapper>{children}</SessionWrapper>
      </body>
    </html>
  );
}
