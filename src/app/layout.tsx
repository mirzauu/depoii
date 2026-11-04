import type { Metadata } from "next";
import { Inter, Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
import { AppShell } from "@/components/app-shell";
import { DepoiiProvider } from "@/components/depoii-provider";
import { VisitorTracker } from "@/components/visitor-tracker";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const THEME_SCRIPT = `try{document.documentElement.classList.toggle("dark",localStorage.getItem("depoii:theme")!=="light")}catch(e){}`;

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Depoii · Commercial Roofing Opportunity Engine",
  description: "Commercial roofs crossed with hail reports, appraisal parcels, and municipal permits for the city you select.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    apple: [
      { url: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${plusJakarta.variable} ${inter.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans" suppressHydrationWarning>
        <VisitorTracker />
        <DepoiiProvider>
          <AppShell>{children}</AppShell>
        </DepoiiProvider>
      </body>
    </html>
  );
}
