import "./globals.css";

export const metadata = {
  title: "G&P Driver Connect",
  description: "Driver and dispatch portal for G&P LOGISTICS LLC"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
