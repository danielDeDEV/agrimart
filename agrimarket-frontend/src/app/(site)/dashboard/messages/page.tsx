'use client';

import * as React from 'react';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useSocketEvent } from '@/lib/socket';
import { cn, initials, timeAgo } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import type { Listing, User } from '@/lib/types';

export interface ConversationSummary {
  id: number;
  listingId: number;
  buyerId: number;
  farmerId: number;
  lastMessage?: string;
  lastMessageAt?: string;
  unread: number;
  counterpart: User;
  listing?: Listing;
}

export default function MessagesPage() {
  const [items, setItems] = React.useState<ConversationSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .get<ConversationSummary[]>('/messages/conversations')
      .then((res) => { setItems(res.data); setError(null); })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => load(), [load]);
  useSocketEvent('message', () => load());

  return (
    <div className="space-y-6">
      <PageHeader title="Messages" description="Conversations with buyers and farmers about specific listings." />

      <Card className="overflow-hidden">
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading ? (
          <div className="space-y-3 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<MessageSquare />}
            title="No conversations yet"
            description="Open any listing in the marketplace and press Message to ask the farmer a question."
            action={<Button variant="outline" asChild><Link href="/marketplace">Browse listings</Link></Button>}
          />
        ) : (
          <ul className="divide-y">
            {items.map((c) => (
              <li key={c.id}>
                <Link href={`/dashboard/messages/${c.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50">
                  <Avatar className="h-12 w-12">
                    {c.counterpart?.avatarUrl && <AvatarImage src={c.counterpart.avatarUrl} />}
                    <AvatarFallback>{initials(c.counterpart?.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={cn('truncate', c.unread ? 'font-bold' : 'font-semibold')}>
                        {c.counterpart?.businessName || c.counterpart?.fullName}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(c.lastMessageAt)}</span>
                    </div>
                    <p className="truncate text-xs text-primary">{c.listing?.produce?.name} · {c.listing?.code}</p>
                    <p className={cn('truncate text-sm', c.unread ? 'text-foreground' : 'text-muted-foreground')}>{c.lastMessage}</p>
                  </div>
                  {c.unread > 0 && (
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">{c.unread}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
