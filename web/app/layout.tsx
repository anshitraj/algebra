import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const description =
  "A non-custodial agentic-commerce control plane. Algebra turns an agent's purchase intent into policy-governed, user-approved checkout — without ever handing the agent a card number, a wallet key, or an OTP.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_WEB_URL || "http://localhost:3000"),
  title: "Algebra — permission to spend, not access to money",
  description,
  openGraph: { title: "Algebra — permission to spend, not access to money", description, siteName: "Algebra", type: "website", locale: "en_IN" },
  twitter: { card: "summary", title: "Algebra", description },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geist.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen antialiased selection:bg-primary selection:text-primary-tint">
        {children}
      </body>
    </html>
  );
}
