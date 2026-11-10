import type { Metadata } from "next";
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
  metadataBase: new URL("https://the-red-pen.vercel.app"),
  title: {
    default: "The Red Pen — Brand Governance",
    template: "%s | The Red Pen",
  },
  description:
    "Review brand content before it goes live. Keep campaigns aligned with approved facts, claims, tone, and brand guidelines.",
  applicationName: "The Red Pen",
  keywords: [
    "brand governance",
    "content review",
    "brand consistency",
    "campaign approval",
    "content compliance",
  ],
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
