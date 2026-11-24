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

/* Keep in sync with THEME_STORAGE_KEY in packages/ui/src/theme-shell.tsx. */
const themeBootScript = `(function(){try{var stored=localStorage.getItem("oku-theme");var theme=stored==="dark"||stored==="light"?stored:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",theme);}catch(e){}})();`;

export default function RootLayout({
  children,
}: RootLayoutProps): ReactElement {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body
        className={`${golos.variable} ${jetbrains.variable} font-sans antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {children}
      </body>
    </html>
  );
}
