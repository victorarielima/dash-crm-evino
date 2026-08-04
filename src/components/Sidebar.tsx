"use client";
import { signOut, useSession } from "next-auth/react";
import { IconDashboard } from "./icons";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { data: session } = useSession();
  const email = session?.user?.email ?? undefined;
  const name = session?.user?.name ?? email?.split("@")[0] ?? "Usuário";
  const initial = (name?.[0] ?? "U").toUpperCase();

  return (
    <aside className={"sidebar" + (collapsed ? " is-collapsed" : "")}>
      <div className="sb-brand-row">
        <div className="sb-brand">
          {collapsed ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className="sb-mark" src="/logo-reduzida.png" alt="Evino" />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className="sb-wordmark" src="/evino-logo.png" alt="Evino" style={{ height: 24, width: "auto" }} />
          )}
        </div>
      </div>

      <nav className="sb-nav">
        <button className="sb-item active">
          <span className="sb-ic">
            <IconDashboard />
          </span>
          {!collapsed && <span className="sb-label">Dashboard</span>}
        </button>
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
