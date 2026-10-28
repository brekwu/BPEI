import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BPEILogo } from "./BPEILogo";
import { SpaceSwitcher, PublicSiteButton } from "./SpaceSwitcher";

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-secondary/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 md:px-6">
          <Link to="/"><BPEILogo variant="dark" /></Link>
          <div className="flex items-center gap-2">
            <PublicSiteButton />
            <SpaceSwitcher />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 md:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}