import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lead User Discovery",
  description: "Find lead users by scanning public forums, code repos, and communities for self-built solutions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
