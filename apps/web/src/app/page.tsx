import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";

import { IConnectPlusLanding } from "@/components/landing/iconnect-plus-landing";

import "./home.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-icp-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "iConnect Plus — Custom AI-powered Enterprise Apps",
  description:
    "We make custom AI-powered Enterprise Apps that drive growth. Purpose-built platforms for finance, CRM, GRC, HR, and operations.",
};

export default function HomePage() {
  return (
    <div className={spaceGrotesk.variable}>
      <IConnectPlusLanding />
    </div>
  );
}
