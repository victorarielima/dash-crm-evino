import type { DefaultSession } from "next-auth";

// Adiciona o ID único do Google (sub) ao usuário da sessão.
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
    } & DefaultSession["user"];
  }
}
