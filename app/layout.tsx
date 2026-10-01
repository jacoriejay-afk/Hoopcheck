import "./globals.css";

export const metadata = {
  title: "HoopCheck",
  description:
    "Ratings and reviews for overseas basketball coaches, teams, and leagues.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
