import { Geist } from "next/font/google";
import "./globals.css";
import SessionWrapper from "../components/SessionWrapper";

const geist = Geist({ subsets: ["latin"] });

export const metadata = {
  title: "La More Eventos",
  description: "Sistema de cartão de consumo virtual para eventos",
  icons: {
    icon: "/logo.png?v=3",
    shortcut: "/logo.png?v=3",
    apple: "/logo.png?v=3",
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={geist.className}>
        <SessionWrapper>{children}</SessionWrapper>
      </body>
    </html>
  );
}
