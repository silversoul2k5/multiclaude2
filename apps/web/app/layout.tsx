import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unified AI Workspace",
  description: "Self-hosted provider-independent AI memory workspace"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="font-body">{children}</body>
    </html>
  );
}
