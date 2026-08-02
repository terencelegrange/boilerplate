import type { Metadata } from "next";
import { cookies } from "next/headers";
import CrisisBanner from "@/components/CrisisBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Admin",
  description: "Admin boilerplate",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const theme = jar.get("bp_theme")?.value ?? "dark";

  return (
    <html lang="en" className={`h-full ${theme === "dark" ? "dark" : ""}`}>
      <body className="h-full bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 antialiased flex flex-col">
        <CrisisBanner />
        <div className="flex-1 min-h-0">{children}</div>
      </body>
    </html>
  );
}
