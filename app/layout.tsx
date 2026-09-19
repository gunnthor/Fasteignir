import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/header";
export const metadata: Metadata = {
  metadataBase: new URL("https://fasteign.gunnthor.is"),
  title: {
    default: "Fasteign · Raunverulegt söluverð",
    template: "%s · Fasteign",
  },
  description:
    "Skoðaðu þinglýst kaupverð íbúða á höfuðborgarsvæðinu. Kort, samanburður og gagnsætt verðmat úr Kaupskrá HMS.",
  robots: { index: true, follow: true },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="is" suppressHydrationWarning>
      <body>
        <a className="skip" href="#main">
          Fara í efni
        </a>
        <Header />
        {children}
      </body>
    </html>
  );
}
