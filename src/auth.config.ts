import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Só contas deste domínio corporativo podem entrar.
export const ALLOWED_DOMAIN = "vissimo.com.br";

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      // `hd` mostra só contas do domínio no seletor do Google (hint de UX);
      // a validação de verdade é no callback signIn abaixo.
      authorization: { params: { hd: ALLOWED_DOMAIN, prompt: "select_account" } },
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    // bloqueia login de quem não é do domínio
    signIn({ profile }) {
      const email = (profile?.email ?? "").toLowerCase();
      const hd = (profile as { hd?: string } | undefined)?.hd;
      return email.endsWith("@" + ALLOWED_DOMAIN) || hd === ALLOWED_DOMAIN;
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
