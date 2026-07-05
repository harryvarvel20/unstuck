import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ServiceWorker } from "@/components/ServiceWorker";
import { MeshBackground } from "@/components/MeshBackground";
import { AppNav } from "@/components/AppNav";
import { QuickCapture } from "@/components/QuickCapture";

// Editorial serif for display/headings — restrained, high-end.
const displayFont = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

// Humanist sans for body/UI.
const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "ADHV — the app that gets you started when your brain won't",
    template: "%s · ADHV",
  },
  description:
    "An AI body double, a plan that knows how you really use time, and a reset button for bad days. Turn “I can't even start” into a first step that takes 2 minutes.",
  applicationName: "ADHV",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ADHV",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    siteName: "ADHV",
    title: "ADHV — get started when your brain won't",
    description:
      "An AI body double that sits with you until it's done. Turn “I can't even start” into a first step that takes 2 minutes.",
    url: appUrl,
    images: [{ url: "/api/og", width: 1200, height: 630, alt: "ADHV" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ADHV — get started when your brain won't",
    description:
      "An AI body double, a plan that learns your real pace, and a reset button for bad days.",
    images: ["/api/og"],
  },
};

export const viewport: Viewport = {
  // Navy browser chrome framing the ivory app — theme-aware.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0F1F34" },
    { media: "(prefers-color-scheme: dark)", color: "#0C1320" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Light ("Old Money") is the DEFAULT; the midnight variant is the `.dark`
// class. Applied before paint to avoid a flash.
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('adhv-theme');
    if (stored === 'dark') { document.documentElement.classList.add('dark'); }
    else { document.documentElement.classList.remove('dark'); }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <MeshBackground />
        <PostHogProvider>{children}</PostHogProvider>
        <AppNav />
        <QuickCapture />
        <ServiceWorker />
      </body>
    </html>
  );
}
