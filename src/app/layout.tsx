import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AutoVitals Ads ROI",
  description:
    "Google Ads spend tied to Salesforce revenue: account health, CPL, CPA, ROAS and ROMI by campaign and product line, with an AI-written quarterly memo for the CRO.",
  applicationName: "AutoVitals Ads ROI",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#07090f" },
    { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
  ],
};

// Applies the saved theme before paint so the page never flashes the wrong theme.
const themeInit = `(function(){try{var t=localStorage.getItem('av-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full flex flex-col">
        <div className="mesh" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
