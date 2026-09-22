'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Phone, Send, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSocketEvent } from '@/lib/socket';
import { cn, formatCurrency, formatDateTime, initials } from '@/lib/utils';
import { Avatar, AvatarFallback, Button, Card, ErrorState, Skeleton, SmartImage, Textarea } from '@/components/ui';
import type { Listing, User } from '@/lib/types';

interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  body: string;
  isRead: boolean;
  mirroredToSms?: boolean;
  createdAt: string;
}

interface ConversationDetail {
  id: number;
  buyerId: number;
  farmerId: number;
  buyer: User;
  farmer: User;
  listing?: Listing;
}

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [conversation, setConversation] = React.useState<ConversationDetail | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(() => {
    api
      .get<{ conversation: ConversationDetail; messages: ChatMessage[] }>(`/messages/conversations/${id}`, { limit: 200 })
      .then((res) => {
        setConversation(res.data.conversation);
        setMessages(res.data.messages);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  React.useEffect(() => load(), [load]);

  useSocketEvent<{ conversationId: number; message: ChatMessage }>('message', (payload) => {
    if (String(payload.conversationId) === String(id)) {
      setMessages((prev) => (prev.some((m) => m.id === payload.message.id) ? prev : [...prev, payload.message]));
    }
  });

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const res = await api.post<ChatMessage>(`/messages/conversations/${id}`, { body });
      setMessages((prev) => [...prev, res.data]);
      setDraft('');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!conversation || !user) return <Skeleton className="h-[70vh]" />;

  const other = conversation.buyerId === user.id ? conversation.farmer : conversation.buyer;

  return (
    <Card className="flex h-[calc(100vh-10rem)] min-h-[520px] flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon-sm" asChild><Link href="/dashboard/messages" aria-label="Back"><ArrowLeft /></Link></Button>
        <Avatar className="h-10 w-10"><AvatarFallback>{initials(other?.fullName)}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{other?.businessName || other?.fullName}</p>
          {conversation.listing && (
            <Link href={`/marketplace/${conversation.listing.code}`} className="truncate text-xs text-primary hover:underline">
              {conversation.listing.produce?.name} · {formatCurrency(conversation.listing.pricePerUnit, { decimals: 0 })}/{conversation.listing.unit}
            </Link>
          )}
        </div>
        {other?.phone && <Button variant="subtle" size="sm" asChild><a href={`tel:${other.phone}`}><Phone /> Call</a></Button>}
        {conversation.listing && (
          <div className="relative hidden h-10 w-10 overflow-hidden rounded-lg sm:block">
            <SmartImage sizes="40px" src={conversation.listing.produce?.imageUrl} alt={conversation.listing.produce?.name ?? 'Produce'} />
          </div>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4">
        {messages.map((m) => {
          const mine = m.senderId === user.id;
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-soft',
                  mine ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-card'
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cn('mt-1 flex items-center gap-1 text-[10px]', mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                  {formatDateTime(m.createdAt)}
                  {m.mirroredToSms && <><Smartphone className="h-3 w-3" /> sent as SMS</>}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex items-end gap-2 border-t p-3">
        <Textarea
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Write a message… (Enter to send)"
          className="min-h-[44px] resize-none"
        />
        <Button type="submit" variant="gradient" size="icon" loading={sending} aria-label="Send">{!sending && <Send />}</Button>
      </form>
    </Card>
  );
}
