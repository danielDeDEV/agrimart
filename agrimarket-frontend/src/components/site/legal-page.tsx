import { Badge } from '@/components/ui';

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

/** Shared layout for the privacy policy and terms of use. */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <>
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 mesh-bg" />
        <div className="container-wide relative max-w-3xl py-14">
          <Badge variant="secondary" className="mb-4">Last updated {updated}</Badge>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{intro}</p>
        </div>
      </section>

      <div className="container-wide grid max-w-5xl gap-10 py-12 lg:grid-cols-[220px_1fr]">
        <nav className="hidden lg:block">
          <ul className="sticky top-24 space-y-1 text-sm">
            {sections.map((section, i) => (
              <li key={section.heading}>
                <a href={`#section-${i}`} className="block rounded-lg px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                  {section.heading}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-10">
          {sections.map((section, i) => (
            <section key={section.heading} id={`section-${i}`} className="scroll-mt-24">
              <h2 className="font-display text-xl font-bold">
                {i + 1}. {section.heading}
              </h2>
              <div className="mt-3 space-y-3 leading-relaxed text-muted-foreground">
                {section.paragraphs.map((p) => <p key={p}>{p}</p>)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
