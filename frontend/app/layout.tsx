import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "PurposeCanvas — Purpose-Aware Image Generation",
  description:
    "AI image generation gateway for education. Asks what the picture is for, routes to the cheapest model that meets the need, and shows real GPU and energy savings per school.",
  keywords: ["AI", "image generation", "education", "cost optimization", "school", "sustainable AI"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-[#0A0A14] text-[#F0F0FF] min-h-screen overflow-x-hidden">
        <NavBar />
        <main className="pt-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
