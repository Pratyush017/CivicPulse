import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  preload: false,
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "CivicPulse — Community Issue Tracker",
  description:
    "Report and track civic issues in your community. AI-powered classification and severity analysis.",
};

import ClickSpark from "@/components/ui/ClickSpark";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased font-sans`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ClickSpark sparkColor="#2dd4bf" sparkSize={10} sparkRadius={20} sparkCount={10} duration={600} />
      </body>
    </html>
  );
}
