import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GU Graduation E-Ticket System",
  description:
    "Gulf University Graduation Ceremony — E-Ticket generation and QR check-in system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
