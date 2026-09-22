'use client';

import * as React from 'react';
import Link from 'next/link';
import { BookOpen, Clock, Eye, MessageSquare, Search, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { TIP_CATEGORIES } from '@/lib/constants';
import { Badge, Card, EmptyState, Input, Skeleton } from '@/components/ui';
import type { FarmingTip } from '@/lib/types';

const CATEGORY_TONES: Record<string, string> = {
  planting: 'from-primary-500 to-primary-700',
  pest_control: 'from-red-500 to-orange-600',
  harvesting: 'from-gold-500 to-gold-700',
  storage: 'from-amber-600 to-yellow-700',
  marketing: 'from-blue-500 to-indigo-600',
  finance: 'from-violet-500 to-purple-700',
  weather: 'from-cyan-500 to-sky-700',
  livestock: 'from-rose-500 to-red-700',
};

export default function TipsPage() {
  const [tips, setTips] = React.useState<FarmingTip[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [category, setCategory] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    setLoading(true);
    api
      .get<FarmingTip[]>('/tips', { limit: 30, category: category || undefined, search: query || undefined })
      .then((res) => setTips(res.data))
      .catch(() => setTips([]))
      .finally(() => setLoading(false));
  }, [category, query]);

  const featured = !category && !query ? tips.find((t) => t.isFeatured) : undefined;
  const rest = featured ? tips.filter((t) => t.id !== featured.id) : tips;

  return (
    <>
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 mesh-bg" />
        <div className="container-wide relative py-14 lg:py-20">
          <Badge variant="success" className="mb-4"><BookOpen /> Extension desk</Badge>
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Farm guides</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Practical advice on planting, storage, pests and selling — written for Ghanaian conditions. Each
            guide also goes out as a short SMS to farmers without internet.
          </p>
          <form
            className="mt-7 max-w-lg"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search.trim());
            }}
          >
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guides — armyworm, storage, tomato…" icon={<Search />} className="h-12 bg-card" />
          </form>
        </div>
      </section>

      <section className="container-wide py-12">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2">
          {[{ value: '', label: 'All guides' }, ...TIP_CATEGORIES].map((c) => (
            <button
              key={c.value || 'all'}
              onClick={() => setCategory(c.value)}
              className={cn(
                'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-all',
                category === c.value ? 'border-primary bg-primary text-white shadow-glow' : 'bg-card hover:border-primary/40'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
          </div>
        ) : tips.length === 0 ? (
          <EmptyState icon={<BookOpen />} title="No guides found" description="Try another topic or search term." />
        ) : (
          <>
            {featured && (
              <Link href={`/tips/${featured.slug}`} className="group mt-8 block">
                <Card hover className="grid overflow-hidden md:grid-cols-[1fr_1.2fr]">
                  <div className={cn('relative flex min-h-[220px] items-end bg-gradient-to-br p-8 text-white', CATEGORY_TONES[featured.category])}>
                    <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:18px_18px]" />
                    <Badge className="relative bg-white/20 text-white backdrop-blur"><Star className="fill-current" /> Featured guide</Badge>
                  </div>
                  <div className="p-8">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">{featured.category.replace('_', ' ')}</p>
                    <h2 className="mt-2 font-display text-2xl font-bold leading-tight group-hover:text-primary">{featured.title}</h2>
                    <p className="mt-3 leading-relaxed text-muted-foreground">{featured.excerpt}</p>
                    <Meta tip={featured} />
                  </div>
                </Card>
              </Link>
            )}

            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {rest.map((tip) => (
                <Link key={tip.id} href={`/tips/${tip.slug}`} className="group">
                  <Card hover className="flex h-full flex-col overflow-hidden">
                    <div className={cn('relative h-28 bg-gradient-to-br', CATEGORY_TONES[tip.category])}>
                      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]" />
                      <span className="absolute bottom-3 left-4 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold capitalize text-white backdrop-blur">
                        {tip.category.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="font-semibold leading-snug group-hover:text-primary">{tip.title}</h3>
                      <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">{tip.excerpt}</p>
                      <Meta tip={tip} />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}

function Meta({ tip }: { tip: FarmingTip }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {tip.readMinutes} min read</span>
      <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {formatNumber(tip.views)}</span>
      {tip.smsVersion && <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> SMS version</span>}
      <span className="ml-auto">{formatDate(tip.publishedAt)}</span>
    </div>
  );
}
