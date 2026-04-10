import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { LayoutGrid, FileCode2, Play, Settings, Terminal } from "lucide-react";

export const metadata: Metadata = {
  title: "Elwood Portal",
  description: "Management portal for Elwood integration pipelines",
};

const navItems = [
  { href: "/", icon: LayoutGrid, label: "Dashboard" },
  { href: "/pipelines", icon: FileCode2, label: "Pipelines" },
  { href: "/executions", icon: Play, label: "Executions" },
  { href: "/tools/playground", icon: Terminal, label: "Playground" },
  { href: "/admin", icon: Settings, label: "Admin" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex overflow-hidden bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col">
          <div className="h-12 flex items-center px-4 border-b border-[var(--color-border)]">
            <span className="text-sm font-semibold text-[var(--color-accent)] tracking-wide">
              ELWOOD
            </span>
          </div>
          <nav className="flex-1 py-2">
            {navItems.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors"
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

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
