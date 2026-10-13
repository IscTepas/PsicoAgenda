import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { APP_NAME } from "@psicoagenda/shared";
import { SerwistProvider } from "@/app/serwist";
import { Providers } from "@/components/providers";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — Gestión de práctica clínica`,
    template: `%s | ${APP_NAME}`,
  },
  description:
    "Agenda de citas, expediente clínico y recordatorios automáticos para profesionales de la psicología.",
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon-192x192.svg" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const serwistEnabled = process.env.NODE_ENV === "production";

  return (
    <html
      lang="es-MX"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {!serwistEnabled && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(regs) {
                    for (var r of regs) { r.unregister(); }
                  });
                }
                if (typeof window !== 'undefined' && 'caches' in window) {
                  caches.keys().then(function(names) {
                    for (var name of names) { caches.delete(name); }
                  });
                }
              `,
            }}
          />
        )}
      </head>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <SerwistProvider swUrl="/sw.js" disable={!serwistEnabled}>
          <Providers>{children}</Providers>
        </SerwistProvider>
      </body>
    </html>
  );
}
