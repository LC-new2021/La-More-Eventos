import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const rawEmail = String(credentials.email).trim();
        const lowerEmail = rawEmail.toLowerCase();
        const trimmedPassword = String(credentials.password).trim();

        if (!rawEmail || !trimmedPassword) return null;

        let usuario = await prisma.usuario.findUnique({
          where: { email: lowerEmail },
        });

        if (!usuario) {
          usuario = await prisma.usuario.findUnique({
            where: { email: rawEmail },
          });
        }

        if (!usuario) {
          const allUsers = await prisma.usuario.findMany();
          usuario = allUsers.find(u => u.email && u.email.trim().toLowerCase() === lowerEmail);
        }

        if (!usuario || !usuario.ativo) return null;

        const senhaValida = await bcrypt.compare(trimmedPassword, usuario.senha);
        if (!senhaValida) return null;

        let role = usuario.role;
        if (role === 'CLIENTE' || role === 'SUPORTE') {
          role = 'SUPORTE_OPERACIONAL';
        }

        return {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          role,
          eventoId: usuario.eventoId,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.nome = user.nome;
        token.role = user.role;
        token.eventoId = user.eventoId;
      } else if (token?.id) {
        try {
          const dbUser = await prisma.usuario.findUnique({
            where: { id: token.id },
            select: { role: true, eventoId: true, nome: true },
          });
          if (dbUser) {
            let userRole = dbUser.role;
            if (userRole === 'CLIENTE' || userRole === 'SUPORTE') userRole = 'SUPORTE_OPERACIONAL';
            token.role = userRole;
            token.eventoId = dbUser.eventoId;
            token.nome = dbUser.nome;
          }
        } catch (e) {
          console.error("Erro ao sincronizar token JWT:", e);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (!session) session = {};
      if (!session.user) session.user = {};
      if (token) {
        session.user.id = token.id;
        session.user.nome = token.nome;
        session.user.role = token.role;
        session.user.eventoId = token.eventoId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || "lamore-eventos-secret-dev",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

