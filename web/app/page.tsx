import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { StoreStrip } from "@/components/store-strip";
import { GetStarted } from "@/components/get-started";
import { DashboardSection } from "@/components/dashboard-section";
import { HowItWorks } from "@/components/how-it-works";
import { PolicyDimensions } from "@/components/policy-dimensions";
import { TrustBoundaries } from "@/components/trust-boundaries";
import { Merchants } from "@/components/merchants";
import { IntegrateSection } from "@/components/integrate-section";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <StoreStrip />
        <GetStarted />
        <DashboardSection />
        <HowItWorks />
        <PolicyDimensions />
        <TrustBoundaries />
        <Merchants />
        <IntegrateSection />
      </main>
      <Footer />
    </>
  );
}
