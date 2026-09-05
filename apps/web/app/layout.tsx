import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppToaster } from "@/components/AppToaster";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Job Automator",
  description: "Find jobs · tailor resumes · you apply",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen text-ink antialiased`}>
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
