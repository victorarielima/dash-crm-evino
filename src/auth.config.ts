import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Só contas destes domínios corporativos podem entrar.
export const ALLOWED_DOMAINS = ["vissimo.com.br", "evino.com.br", "grandcru.com.br"];

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      // A validação de verdade é no callback signIn abaixo.
      // Não usamos `hd` porque ele aceita só um domínio.
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    // bloqueia login de quem não é dos domínios permitidos
    signIn({ profile }) {
      const email = (profile?.email ?? "").toLowerCase();
      const hd = (profile as { hd?: string } | undefined)?.hd?.toLowerCase();
      return ALLOWED_DOMAINS.some((domain) => email.endsWith(`@${domain}`)) || (hd ? ALLOWED_DOMAINS.includes(hd) : false);
    },
    // usado pelo middleware: só passa quem está autenticado
    authorized({ auth }) {
      return !!auth?.user;
    },
    // expõe o ID único do Google (token.sub) em session.user.id
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
};
