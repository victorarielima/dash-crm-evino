"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { BRANDS } from "@/lib/brands";
import { useBrand } from "./BrandContext";
import { IconDashboard, IconAI } from "./icons";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { data: session } = useSession();
  const { brand, def: brandInfo, setBrand } = useBrand();
  const pathname = usePathname();
  const email = session?.user?.email ?? undefined;
  const name = session?.user?.name ?? email?.split("@")[0] ?? "Usuário";
  const initial = (name?.[0] ?? "U").toUpperCase();

  // Seletor de conta: a própria logo é o botão e abre as logos para escolher.
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!accountOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  return (
    <aside className={"sidebar" + (collapsed ? " is-collapsed" : "")}>
      <div className="sb-brand-row">
        <div className="sb-brand" ref={accountRef}>
          {/* A logo da conta ativa é o botão; abre as logos para trocar de conta. */}
          <button
            type="button"
            className={"sb-brand-btn" + (accountOpen ? " is-open" : "")}
            onClick={() => setAccountOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={accountOpen}
            aria-label={`Conta ${brandInfo.label}. Clique para trocar de conta.`}
            title={`Conta: ${brandInfo.label} — clique para trocar`}
          >
            {collapsed ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img className="sb-mark" src={brandInfo.mark} alt={brandInfo.label} />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img className="sb-wordmark" src={brandInfo.wordmark} alt={brandInfo.label} />
            )}
            <span className="sb-brand-caret" aria-hidden="true">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </button>

          {accountOpen && (
            <div className="sb-brand-pop" role="listbox" aria-label="Conta">
              {BRANDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="option"
                  aria-selected={b.id === brand}
                  className={"sb-brand-opt" + (b.id === brand ? " on" : "")}
                  onClick={() => {
                    setBrand(b.id);
                    setAccountOpen(false);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.wordmark} alt={b.label} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <nav className="sb-nav">
        <Link href="/" className={"sb-item" + (pathname === "/" ? " active" : "")}>
          <span className="sb-ic">
            <IconDashboard />
          </span>
          {!collapsed && <span className="sb-label">Dashboard</span>}
        </Link>
        <Link href="/chat" className={"sb-item" + (pathname?.startsWith("/chat") ? " active" : "")}>
          <span className="sb-ic">
            <IconAI />
          </span>
          {!collapsed && <span className="sb-label">IA</span>}
        </Link>
      </nav>

      <div className="sb-footer">
        <button className="sb-toggle" type="button" onClick={onToggle} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} title={collapsed ? "Expandir menu" : "Recolher menu"}>
          <span aria-hidden="true">{collapsed ? ">" : "<"}</span>
        </button>

        <div className="sb-user">
          <span className="sb-avatar">{initial}</span>
          {!collapsed && (
            <span className="sb-user-info">
              <b>{name}</b>
              <small>{email ?? ""}</small>
            </span>
          )}
          <button className="sb-logout" title="Sair" onClick={() => signOut({ redirectTo: "/login" })}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
