import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Most Dangerous Games Locator",
  description: "Fuzzy passage and physical-page locator for The Most Dangerous Games"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
