import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finance App",
  description: "Personal finance tracking and budgeting",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body className="bg-white text-gray-900">{children}</body>
    </html>
  );
}

