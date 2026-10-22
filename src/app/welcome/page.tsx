import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";

export const metadata: Metadata = {
  title: "Depoii | Commercial Intelligence — Know When, Where, and Why",
  description:
    "Commercial roof intelligence for Dallas–Fort Worth roofing contractors and estimators. Hail swath reports, county appraisal parcels, and municipal permit searches.",
  keywords: [
    "commercial roofing leads",
    "commercial roof intelligence",
    "hail damage commercial roofs",
    "DFW roofing contractors",
    "commercial roof permits",
    "roof aging alarm",
  ],
  alternates: {
    canonical: "https://depoii.com/welcome",
  },
  openGraph: {
    title: "Depoii | Commercial Intelligence — Know When, Where, and Why",
    description:
      "Cross-referenced hail reports, county appraisal data, and municipal permit searches for DFW commercial roofers.",
    url: "https://depoii.com/welcome",
    siteName: "Depoii",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/landing/hero-roof.jpg",
        width: 1200,
        height: 630,
        alt: "Depoii - Commercial Roof Intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Depoii | Commercial Intelligence",
    description:
      "Know which commercial roofs are worth the drive before competitors pull the permit.",
    images: ["/landing/hero-roof.jpg"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Depoii",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: "https://depoii.com",
      description:
        "Commercial roof intelligence platform correlating hail swath points, appraisal parcels, and municipal permit searches for commercial contractors.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        category: "Free Pilot",
      },
    },
    {
      "@type": "Organization",
      name: "Depoii",
      url: "https://depoii.com",
      logo: "https://depoii.com/icon.svg",
      contactPoint: {
        "@type": "ContactPoint",
        email: "hello@depoii.com",
        contactType: "customer support",
      },
    },
  ],
};

export default function WelcomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage formMode="api" />
    </>
  );
}
