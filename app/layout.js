import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { AppProvider } from "@/context/AppContext";
import SessionProvider from "@/components/SessionProvider";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
});
const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata = {
  title: "Sitecraft — Free AI Website Builder",
  description: "Generate single-page websites from a prompt. Powered by free, open-source AI models.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geist.variable} ${bricolage.variable} ${geistMono.variable}`}
    >
      <body suppressHydrationWarning>
        <SessionProvider>
          <AppProvider>{children}</AppProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
