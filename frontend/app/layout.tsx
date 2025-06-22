import type { Metadata } from "next";
import { Host_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { GradientBackground } from "@/components/GradientBackground";
import { Analytics } from "@vercel/analytics/next"

const font = Host_Grotesk({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clippa - Clean & Fast Video Clipper | HD YouTube Downloads",
  description:
    "Premium YouTube video clipper with zero ads. Download & clip HD videos with precise timestamps. Simple pricing, maximum quality. 📼",
  keywords:
    "video clipper, youtube downloader, HD video clips, video trimmer, youtube clips, clippa, clippa.in, youtube clipper, youtube video downloader, youtube video clipper, youtube video cutter, youtube video trimmer, youtube video editor, youtube video editor online, youtube video editor free, youtube video editor pro, youtube video editor premium, youtube video editor premium free, youtube video editor premium free download, youtube video editor premium free download online, youtube video editor premium free download online free, youtube video editor premium free download online free download, youtube video editor premium free download online free download free, youtube video editor premium free download online free download free download, ad free, premium",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📼</text></svg>",
    shortcut:
      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📼</text></svg>",
  },
  openGraph: {
    url: "https://clippa.in/",
    type: "website",
    locale: "en_US",
    siteName: "Clippa",
    title: "Clippa - Clean & Fast Video Clipper | HD YouTube Downloads",
    description:
      "Premium YouTube video clipper with zero ads. Download & clip HD videos with precise timestamps. Simple pricing, maximum quality.",
    images: ["/og-image.png"],
  },
  other: {
    "twitter:image": ["/og-image.png"],
    "twitter:card": "summary_large_image",
    "twitter:url": "https://clippa.in/",
    "twitter:domain": "clippa.in",
    "twitter:title": "Clippa - Clean & Fast Video Clipper",
    "twitter:description":
      "Premium YouTube video clipper with zero ads. Download & clip HD videos with precise timestamps.",
    "og:url": "https://clippa.in/",
    "og:type": "website",
    "og:title": "Clippa - Clean & Fast Video Clipper | HD YouTube Downloads",
    "og:description":
      "Premium YouTube video clipper with zero ads. Download & clip HD videos with precise timestamps. Simple pricing, maximum quality.",
    "og:image": ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    nocache: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${font.className} antialiased min-h-screen`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <GradientBackground />
          {children}
          <Analytics />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
