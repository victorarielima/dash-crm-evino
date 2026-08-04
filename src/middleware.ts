import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Protege todas as rotas: sem sessão → redireciona para /login.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    // tudo, EXCETO a página de login, as rotas do próprio auth e assets estáticos
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|evino-logo.png).*)",
  ],
};
