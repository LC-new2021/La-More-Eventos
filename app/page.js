import { redirect } from "next/navigation";

// Página raiz redireciona para o portal de acessos
export default function Home() {
  redirect("/acessos");
}
