import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { HomeLink, HomeLinkFallback } from "./components/home-link";
import { UserMenu } from "./components/user-menu";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Estudos",
  description: "Resumos e flashcards gerados por IA, com revisões no momento certo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-black/10 dark:border-white/10">
          <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Suspense fallback={<HomeLinkFallback />}>
              <HomeLink />
            </Suspense>
            <Suspense>
              <UserMenu />
            </Suspense>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
