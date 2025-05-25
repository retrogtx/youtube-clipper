import type { Metadata } from "next";
import { Host_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { GradientBackground } from "@/components/GradientBackground";

const font = Host_Grotesk({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clippa - Clean & Fast Video Clipper | HD YouTube Downloads",
  description:
    "Premium YouTube video clipper with zero ads. Download & clip HD videos with precise timestamps. Simple pricing, maximum quality. 📼",
  keywords:
    "video clipper, youtube downloader, HD video clips, video trimmer, youtube clips",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📼</text></svg>",
    shortcut:
      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📼</text></svg>",
  },
  openGraph: {
    title: "Clippa - Clean & Fast Video Clipper | HD YouTube Downloads",
    description:
      "Premium YouTube video clipper with zero ads. Download & clip HD videos with precise timestamps. Simple pricing, maximum quality.",
    type: "website",
    siteName: "Clippa",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Clippa - HD Video Clipper",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clippa - Clean & Fast Video Clipper",
    description:
      "Premium YouTube video clipper with zero ads. Download & clip HD videos with precise timestamps.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
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
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <GradientBackground />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
