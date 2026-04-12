"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, FileCode2, Play, Settings, Terminal, PanelLeftClose, PanelLeftOpen } from "lucide-react";

const navItems = [
  { href: "/", icon: LayoutGrid, label: "Dashboard" },
  { href: "/pipelines", icon: FileCode2, label: "Pipelines" },
  { href: "/executions", icon: Play, label: "Executions" },
  { href: "/tools/playground", icon: Terminal, label: "Playground" },
  { href: "/admin", icon: Settings, label: "Admin" },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (collapsed) {
    return (
      <aside className="w-12 flex-shrink-0 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col items-center">
        <button
          onClick={() => setCollapsed(false)}
          className="h-12 flex items-center justify-center w-full border-b border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]"
          title="Expand sidebar (Ctrl+B)"
        >
          <PanelLeftOpen size={16} className="text-[var(--color-text-muted)]" />
        </button>
        <nav className="flex-1 py-2 flex flex-col items-center gap-1">
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={`p-2 rounded hover:bg-[var(--color-bg-hover)] ${
                pathname === href || (href !== "/" && pathname.startsWith(href))
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)]"
              }`}
              title={label}
            >
              <Icon size={16} />
            </Link>
          ))}
        </nav>
      </aside>
    );
  }

  return (
    <aside className="w-56 flex-shrink-0 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col">
      <div className="h-12 flex items-center justify-between px-4 border-b border-[var(--color-border)]">
        <span className="text-sm font-semibold text-[var(--color-accent)] tracking-wide">
          ELWOOD
        </span>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded hover:bg-[var(--color-bg-hover)]"
          title="Collapse sidebar (Ctrl+B)"
        >
          <PanelLeftClose size={14} className="text-[var(--color-text-muted)]" />
        </button>
      </div>
      <nav className="flex-1 py-2">
        {navItems.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
              pathname === href || (href !== "/" && pathname.startsWith(href))
                ? "bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
        Elwood Portal v0.1.0
      </div>
    </aside>
  );
}
