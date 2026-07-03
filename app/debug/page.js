import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function DebugPage() {
  const session = await getServerSession(authOptions);
  
  return (
    <div style={{ padding: 20, fontFamily: "monospace", fontSize: 16 }}>
      <h1>DEBUG SESSÃO SERVIDOR</h1>
      <pre>
        {JSON.stringify(session, null, 2)}
      </pre>
      <h2>HEADERS DA REQUISIÇÃO</h2>
      <p>Verifique o banco de dados se necessário.</p>
    </div>
  );
}
