import { AuthProvider } from '@/lib/auth';
import { Navbar } from '@/components/site/navbar';
import { Footer } from '@/components/site/footer';
import { MaintenanceBanner } from '@/components/site/maintenance-banner';
import { getSettings } from '@/lib/settings.server';
import { organisationJsonLd, websiteJsonLd, jsonLdScript } from '@/lib/listing-seo';

/**
 * The public site and the signed-in farmer/buyer area share this shell and the
 * "user" auth realm. The admin console lives outside this group entirely, under
 * /admin, with its own layout and its own session.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // Who runs the platform and how to search it — stated once, for the whole
  // public site, from the same settings an administrator edits.
  const site = await getSettings();

  return (
    <AuthProvider realm="user">
      <script {...jsonLdScript(organisationJsonLd(site))} />
      <script {...jsonLdScript(websiteJsonLd(site))} />
      <div className="flex min-h-screen flex-col">
        <MaintenanceBanner />
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </AuthProvider>
  );
}
