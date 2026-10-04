import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/hooks/use-theme";
import { ThemedToaster } from "@/components/themed-toaster";
import {
  DEFAULT_MODE,
  MODE_STORAGE_KEY,
  MODES,
} from "@/lib/themes";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
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
  themeColor: "#020617",
  colorScheme: "dark light",
};

// Inline boot script — runs before React hydrates so the user's
// chosen mode (data-mode) is on the <html> element before first paint.
// Without this every page load flashes the server-rendered default for a
// frame before the React tree mounts and applies the saved choice.
//
// Kept dependency-free (no imports, no JSX) so the browser can run it
// before React hydrates.
const THEME_BOOT_SCRIPT = `
(function(){
  var d = document.documentElement;
  try {
    var MODE_KEY = "wacrm.mode";
    var MODE_DEFAULT = "dark";
    var MODES = ["light", "dark"];
    var savedMode = localStorage.getItem(MODE_KEY);
    d.dataset.mode = MODES.indexOf(savedMode) !== -1 ? savedMode : MODE_DEFAULT;
  } catch (_e) {
    d.dataset.mode = "dark";
  }
})();
`;

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
      className={`${inter.variable} h-full antialiased`}
      // The `theme-boot` script below rewrites `data-mode` on <html>
      // from localStorage before React hydrates. suppressHydrationWarning
      // silences the expected server/client mode attribute mismatch.
      suppressHydrationWarning
    >
      <head>
        <Script
          id="theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground font-sans">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider>
            {children}
            <ThemedToaster />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
