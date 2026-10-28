import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "OAuth Approval Guides",
  description:
    "How hard is it to get an OAuth app approved, how long does it take, and what can an agent do for you? Guides for developers connecting AI agents to their users' apps.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-head">
          <Link href="/" className="brand">
            OAuth Approval Guides
          </Link>
          <span className="brand-sub">for agents built on Composio</span>
          <nav className="site-nav" aria-label="Site">
            <Link href="/#library">Library</Link>
            <Link href="/checks">How I checked</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-foot">
          A take-home prototype by Vishnu Mathur for Composio&apos;s APM (Integrations) role. Not an official Composio product.
          Provider facts change; every claim carries its evidence and the date it was checked.
        </footer>
      </body>
    </html>
  );
}
