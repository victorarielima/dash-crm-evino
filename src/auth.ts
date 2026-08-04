import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Instância completa (usada nas rotas /api/auth e nos server actions de login/logout).
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
