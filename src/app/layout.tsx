import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "bank.ai",
  description: "Banco conversacional com inteligência artificial",
  icons: {
    icon: "/logo/logo_bank_FAVICON.svg",
    shortcut: "/logo/logo_bank_FAVICON.svg",
    apple: "/logo/logo_bank_FAVICON.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${nunito.variable} h-full antialiased`}
      style={{ colorScheme: "light" }}
      suppressHydrationWarning
    >
      <body className="h-full overflow-hidden" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
