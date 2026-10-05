import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/hooks/use-theme";
import {
  DEFAULT_MODE,
} from "@/lib/themes";

const roboto = localFont({
  src: [
    { path: "../../Fonts/Roboto-LightItalic.ttf", weight: "300", style: "italic" },
    { path: "../../Fonts/Roboto-Regular.ttf", weight: "400" },
    { path: "../../Fonts/Roboto-Medium.ttf", weight: "500" },
    { path: "../../Fonts/Roboto-Medium.ttf", weight: "600" },
    { path: "../../Fonts/Roboto-Bold.ttf", weight: "700" },
    { path: "../../Fonts/Roboto-ExtraBold.ttf", weight: "800" },
    { path: "../../Fonts/Roboto-Black.ttf", weight: "900" },
  ],
  variable: "--font-roboto",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: {
    default: "ADOLF v3.0",
    template: "%s — ADOLF v3.0",
  },
  description: "ADOLF v3.0 — a personal, account-scoped WhatsApp CRM built for focused customer operations.",
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: [{ url: "/icon" }],
    apple: [{ url: "/apple-icon.svg" }],
  },
  appleWebApp: {
    capable: true,
    title: "ADOLF v3.0",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#050506",
  colorScheme: "dark light",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      data-mode={DEFAULT_MODE}
      className={`${roboto.variable} h-full antialiased`}
      // The `theme-boot` script below rewrites `data-mode` on <html>
      // from localStorage before React hydrates. suppressHydrationWarning
      // silences the expected server/client mode attribute mismatch.
      suppressHydrationWarning
    >
      <head>
        <Script src="/theme-boot.js" strategy="beforeInteractive" />
      </head>
      <body className="min-h-full bg-background text-foreground font-sans">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
