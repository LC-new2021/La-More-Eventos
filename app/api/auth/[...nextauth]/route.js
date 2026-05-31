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

        const usuario = await prisma.usuario.findUnique({
          where: { email: credentials.email },
        });

        if (!usuario || !usuario.ativo) return null;

        const senhaValida = await bcrypt.compare(credentials.password, usuario.senha);
        if (!senhaValida) return null;

        return {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          role: usuario.role,
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
            token.role = dbUser.role;
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
      session.user.id = token.id;
      session.user.nome = token.nome;
      session.user.role = token.role;
      session.user.eventoId = token.eventoId;
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

