import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PurposeCanvas — Purpose-Aware Image Generation",
  description:
    "AI image generation gateway for education. Asks what the picture is for, routes to the cheapest model that meets the need, and shows real GPU and energy savings per school.",
  keywords: ["AI", "image generation", "education", "cost optimization", "school"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0a0a0f] text-white min-h-screen`}>
        <NavBar />
        <main className="pt-16">{children}</main>
      </body>
    </html>
  );
}
