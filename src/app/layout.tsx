import type { Metadata } from "next";
import "./globals.css";
import ManagementAccess from "@/components/ManagementAccess";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Elwood Portal",
  description: "Management portal for Elwood integration pipelines",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex overflow-hidden bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
        <Sidebar />
        <ManagementAccess>
          {children}
        </ManagementAccess>
      </body>
    </html>
  );
}
