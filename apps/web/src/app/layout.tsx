import type { Metadata } from "next";
import { Golos_Text, JetBrains_Mono } from "next/font/google";
import type { ReactElement, ReactNode } from "react";
import "./globals.css";

const golos = Golos_Text({
  subsets: ["cyrillic", "latin"],
  variable: "--font-golos",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["cyrillic", "latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "oku admin",
  description: "Phase 1 digital library ingestion and review",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({
  children,
}: RootLayoutProps): ReactElement {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body
        className={`${golos.variable} ${jetbrains.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
