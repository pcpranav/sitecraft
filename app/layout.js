import { Inter, JetBrains_Mono } from "next/font/google";
import { AppProvider } from "@/context/AppContext";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"] });

export const metadata = {
  title: "Webcraft Studio",
  description: "AI-powered website builder",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.className}`}>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
