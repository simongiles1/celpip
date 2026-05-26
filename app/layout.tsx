import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NavBar } from "@/components/layout/NavBar";
import { OnboardingGuard } from "@/components/providers/OnboardingGuard";
import { StoreProvider } from "@/components/providers/StoreProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CELPIP Pilot",
  description: "Personalized CELPIP Reading & Writing study accelerator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-gray-50 text-gray-900">
        <StoreProvider>
          <OnboardingGuard>
            <NavBar />
            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
          </OnboardingGuard>
        </StoreProvider>
      </body>
    </html>
  );
}
