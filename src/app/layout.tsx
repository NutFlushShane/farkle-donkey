import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Instrument_Sans, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://farkle.prosperdonkey.com"),
  title: "Farkle — Prosper Donkey",
  description: "Roll the dice, press your luck, bank it before you farkle. Play friends on one phone or take on the Donkey.",
  appleWebApp: { capable: true, title: "Farkle", statusBarStyle: "black-translucent" },
  openGraph: {
    title: "Farkle — Prosper Donkey",
    description: "Roll the dice. Press your luck. Bank it before you farkle.",
    url: "https://farkle.prosperdonkey.com",
    siteName: "Prosper Donkey",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#120F0B",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${jetBrainsMono.variable} ${newsreader.variable} antialiased`}
    >
      <body className="min-h-dvh">
        {children}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-2JHY5RMFV7" strategy="afterInteractive" />
        <Script id="ga4" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          // ad personalization and Google Signals off: prosperdonkey.com/privacy#games
          gtag('config', 'G-2JHY5RMFV7', { allow_google_signals: false, allow_ad_personalization_signals: false });
        `}</Script>
      </body>
    </html>
  );
}
