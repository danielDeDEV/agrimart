'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock, Eye, MessageSquare, User } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/utils';
import { Badge, Card, ErrorState, Skeleton } from '@/components/ui';
import type { FarmingTip } from '@/lib/types';

/** Renders **bold** spans without injecting HTML — article text comes from the database. */
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

export default function TipDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [tip, setTip] = React.useState<FarmingTip | null>(null);
  const [related, setRelated] = React.useState<FarmingTip[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    api
      .get<{ tip: FarmingTip; related: FarmingTip[] }>(`/tips/${slug}`)
      .then((res) => {
        setTip(res.data.tip);
        setRelated(res.data.related);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [slug]);

  React.useEffect(() => load(), [load]);

  if (loading) {
    return (
      <div className="container-wide max-w-3xl space-y-4 py-14">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !tip) return <div className="container-wide py-20"><ErrorState message={error ?? 'Guide not found'} onRetry={load} /></div>;

  return (
    <article className="container-wide max-w-3xl py-10 lg:py-14">
      <Link href="/tips" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All farm guides
      </Link>

      <Badge variant="success" className="mt-6 capitalize">{tip.category.replace('_', ' ')}</Badge>
      <h1 className="mt-3 text-balance font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{tip.title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{tip.excerpt}</p>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-y py-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5"><User className="h-4 w-4" /> {tip.author}</span>
        <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {tip.readMinutes} min read</span>
        <span className="flex items-center gap-1.5"><Eye className="h-4 w-4" /> {formatNumber(tip.views)} readers</span>
        <span>{formatDate(tip.publishedAt, 'long')}</span>
      </div>

      <div className="mt-8 space-y-5 text-[17px] leading-8 text-muted-foreground">
        {tip.content.split(/\n\s*\n/).map((paragraph, i) => (
          <p key={i}>{renderInline(paragraph.trim())}</p>
        ))}
      </div>

      {tip.smsVersion && (
        <Card className="mt-10 overflow-hidden">
          <div className="flex items-center gap-2 border-b bg-muted/50 px-5 py-3">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">The SMS version farmers receive</span>
          </div>
          <p className="p-5 font-mono text-sm leading-relaxed">{tip.smsVersion}</p>
        </Card>
      )}

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-xl font-bold">Related guides</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {related.map((item) => (
              <Link key={item.id} href={`/tips/${item.slug}`}>
                <Card hover className="h-full p-4">
                  <p className="text-xs font-semibold capitalize text-primary">{item.category.replace('_', ' ')}</p>
                  <p className="mt-1 text-sm font-semibold leading-snug">{item.title}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.readMinutes} min read</p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
