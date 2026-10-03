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
    icon: "/bankai-symbol.svg",
    shortcut: "/bankai-symbol.svg",
    apple: "/bankai-symbol.svg",
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
    >
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
