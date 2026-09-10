"use client";
import { SessionProvider } from "next-auth/react";
import { BrandProvider } from "@/components/BrandContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BrandProvider>{children}</BrandProvider>
    </SessionProvider>
  );
}
