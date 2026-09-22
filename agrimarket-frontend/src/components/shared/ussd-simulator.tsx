'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Delete, Loader2, Phone, PhoneOff, RotateCcw, Signal, Battery, Wifi,
} from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { cn, isValidGhanaPhone, normalizePhone } from '@/lib/utils';
import { SITE } from '@/lib/constants';
import { useSettings } from '@/components/settings-provider';
import { Badge, Button, Input } from '@/components/ui';

interface SimulateResponse {
  sessionId: string;
  screen: string;
  type: 'CON' | 'END';
  ended: boolean;
  state?: string;
  step?: number;
}

interface LogEntry {
  input: string;
  screen: string;
  type: 'CON' | 'END';
  at: string;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

/**
 * Drives the real USSD state machine on the backend — not a mock. Every
 * keypress here goes through the same engine that serves the telecom gateway,
 * so what a visitor sees on this page is exactly what a farmer sees on a Nokia.
 */
export function UssdSimulator({
  className,
  compact = false,
  defaultPhone = '',
  showLog = true,
}: {
  className?: string;
  compact?: boolean;
  defaultPhone?: string;
  showLog?: boolean;
}) {
  const site = useSettings();
  const [phone, setPhone] = React.useState(defaultPhone);
  // The simulator is a sandbox: it opens the demo account, and any number it
  // does not recognise walks the registration screens without saving anything.
  const demoPhone = site.ussdDemoPhone;
  const [dialInput, setDialInput] = React.useState(site.ussdCode);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [screen, setScreen] = React.useState<string>('');
  const [screenType, setScreenType] = React.useState<'CON' | 'END' | null>(null);
  const [buffer, setBuffer] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [log, setLog] = React.useState<LogEntry[]>([]);
  const [state, setState] = React.useState<string | undefined>();
  // The transcript shows the step you are on; older steps stay one click away
  const [showAllSteps, setShowAllSteps] = React.useState(false);

  const replyRef = React.useRef<HTMLInputElement>(null);

  const active = !!sessionId && screenType === 'CON';
  const ended = screenType === 'END';

  const send = React.useCallback(
    async (text: string, existingSession?: string | null) => {
      const target = normalizePhone(phone);
      if (!isValidGhanaPhone(target)) {
        setError('Enter a valid Ghana number, e.g. 0244123456');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await api.post<SimulateResponse>('/ussd/simulate', {
          sessionId: existingSession ?? sessionId ?? undefined,
          phoneNumber: target,
          text,
        });

        setSessionId(res.data.sessionId);
        setScreen(res.data.screen);
        setScreenType(res.data.type);
        setState(res.data.state);
        setBuffer('');
        setLog((prev) => [
          ...prev,
          { input: text || '(dial)', screen: res.data.screen, type: res.data.type, at: new Date().toISOString() },
        ]);
      } catch (err) {
        setError(errorMessage(err, 'The USSD service is unreachable. Is the API running?'));
      } finally {
        setLoading(false);
      }
    },
    [phone, sessionId]
  );

  const startSession = () => {
    setLog([]);
    setSessionId(null);
    void send('', null);
  };

  const endSession = () => {
    setSessionId(null);
    setScreen('');
    setScreenType(null);
    setBuffer('');
    setState(undefined);
  };

  React.useEffect(() => {
    if (active && !loading) replyRef.current?.focus();
  }, [active, loading, log.length]);

  const press = (key: string) => {
    if (!active) return;
    setBuffer((b) => (b.length < 60 ? b + key : b));
    replyRef.current?.focus();
  };

  const backspace = () => setBuffer((b) => b.slice(0, -1));

  const submit = () => {
    if (!active || loading) return;
    void send(buffer);
  };

  return (
    <div className={cn('grid gap-8', showLog && !compact ? 'lg:grid-cols-[auto_1fr]' : '', className)}>
      {/* ── The handset ──────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-[320px]">
        <div className="relative rounded-[2.5rem] bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 p-3 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
          {/* earpiece */}
          <div className="mx-auto mb-2 h-1.5 w-14 rounded-full bg-slate-600" />

          {/* screen */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-950/60 bg-[#071309]">
            <div className="flex items-center justify-between px-3 pt-2 text-[9px] font-medium text-[#7fe3a5]/70">
              <span className="flex items-center gap-1">
                <Signal className="h-2.5 w-2.5" /> MTN GH
              </span>
              <span className="flex items-center gap-1">
                <Wifi className="h-2.5 w-2.5 opacity-40" />
                <Battery className="h-2.5 w-2.5" />
              </span>
            </div>

            <div className="ussd-screen min-h-[230px] px-3.5 py-3 text-[12.5px]">
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex h-[200px] flex-col items-center justify-center gap-2 text-[#7fe3a5]"
                  >
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <p className="text-[11px]">Sending USSD request…</p>
                  </motion.div>
                ) : screen ? (
                  <motion.div
                    key={log.length}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <pre className="whitespace-pre-wrap break-words font-[inherit] leading-relaxed">{screen}</pre>

                    {active && (
                      <div className="mt-3 border-t border-[#1d4d30] pt-2">
                        <label htmlFor="ussd-reply" className="text-[10px] uppercase tracking-wider text-[#5fbf85]">
                          Reply — type here or use the keypad
                        </label>
                        {/* A real input, so answers like a name can be typed; the keypad writes into it too */}
                        <input
                          id="ussd-reply"
                          ref={replyRef}
                          value={buffer}
                          onChange={(e) => setBuffer(e.target.value.slice(0, 60))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              submit();
                            }
                          }}
                          autoComplete="off"
                          spellCheck={false}
                          placeholder="Type your answer…"
                          className="mt-0.5 w-full border-0 bg-transparent p-0 text-[15px] font-bold tracking-wider text-[#9dffc0] caret-[#9dffc0] outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-[#3f7a55]"
                        />
                      </div>
                    )}

                    {ended && (
                      <p className="mt-3 border-t border-[#1d4d30] pt-2 text-[10px] uppercase tracking-wider text-[#5fbf85]/70">
                        Session ended
                      </p>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex h-[200px] flex-col items-center justify-center gap-3 text-center"
                  >
                    <p className="text-[11px] text-[#5fbf85]">Enter the service code and press dial</p>
                    <p className="font-mono text-xl font-bold tracking-widest text-[#9dffc0]">{dialInput}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* keypad */}
          <div className="mt-3 px-1">
            <div className="mb-2 flex gap-2">
              <button
                onClick={active ? submit : startSession}
                disabled={loading}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-inner transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                <Phone className="h-3.5 w-3.5" />
                {active ? 'SEND' : 'DIAL'}
              </button>
              <button
                onClick={backspace}
                disabled={!active || !buffer}
                className="flex h-9 w-12 items-center justify-center rounded-xl bg-slate-700 text-slate-200 transition-colors hover:bg-slate-600 disabled:opacity-40"
                aria-label="Delete"
              >
                <Delete className="h-4 w-4" />
              </button>
              <button
                onClick={endSession}
                disabled={!sessionId}
                className="flex h-9 w-12 items-center justify-center rounded-xl bg-red-600/90 text-white transition-colors hover:bg-red-500 disabled:opacity-40"
                aria-label="End call"
              >
                <PhoneOff className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pb-1">
              {KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => press(key)}
                  disabled={!active}
                  className={cn(
                    'h-10 rounded-xl bg-gradient-to-b from-slate-600 to-slate-700 text-base font-semibold text-slate-100 shadow-sm transition-all',
                    'hover:from-slate-500 hover:to-slate-600 active:scale-95 disabled:opacity-40 disabled:hover:from-slate-600'
                  )}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* handset controls */}
        <div className="mt-5 space-y-2.5">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <label htmlFor="sim-phone" className="block text-xs font-semibold text-muted-foreground">
                Phone number (the identity the service sees)
              </label>
              {demoPhone && phone !== demoPhone && (
                <button
                  type="button"
                  onClick={() => setPhone(demoPhone)}
                  disabled={!!sessionId && !ended}
                  className="text-xs font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-40"
                >
                  Use demo account
                </button>
              )}
            </div>
            <Input
              id="sim-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !active) {
                  e.preventDefault();
                  startSession();
                }
              }}
              placeholder="0244123456"
              disabled={!!sessionId && !ended}
              className="h-10 font-mono"
              error={!!phone && !isValidGhanaPhone(phone)}
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              A demonstration: nothing you do here is saved and no SMS is sent.{' '}
              {demoPhone ? (
                <>
                  The demo account <span className="font-mono font-semibold">{demoPhone}</span> (PIN 1357) has produce
                  to manage; any other number shows how registration works.
                </>
              ) : (
                <>Type any number to walk through registration exactly as a farmer would.</>
              )}{' '}
              Dial <span className="font-mono font-semibold">{site.ussdCode}</span> on a real phone to use the service.
            </p>
          </div>

          {!sessionId && (
            <Input
              value={dialInput}
              onChange={(e) => setDialInput(e.target.value)}
              className="h-10 text-center font-mono font-bold tracking-widest"
              aria-label="USSD service code"
            />
          )}

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{error}</p>
          )}

          {(sessionId || ended) && (
            <Button variant="outline" size="sm" className="w-full" onClick={startSession} disabled={loading}>
              <RotateCcw /> Start a new session
            </Button>
          )}

          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            {demoPhone ? 'The demo account has produce to manage. Any other number walks through registration. ' : ''}
            A number that belongs to a real account is refused — that is what protects a farmer&apos;s PIN.
          </p>
        </div>
      </div>

      {/* ── Session transcript ───────────────────────────────────────── */}
      {showLog && !compact && (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold">
                {showAllSteps ? 'Session transcript' : 'Current step'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {showAllSteps
                  ? 'Every request here hits the live USSD engine on the API — the same code path the telecom gateway calls.'
                  : 'This is the screen the farmer is on now. It hits the live USSD engine on the API, exactly as a telecom gateway would.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {log.length > 1 && (
                <Button variant="outline" size="sm" onClick={() => setShowAllSteps((v) => !v)}>
                  {showAllSteps ? 'Show current step only' : `Show all ${log.length} steps`}
                </Button>
              )}
              {state && (
                <Badge variant="outline" className="font-mono text-[11px]">
                  state: {state}
                </Badge>
              )}
            </div>
          </div>

          <div className={cn('mt-4 space-y-3 pr-1', showAllSteps && 'max-h-[520px] overflow-y-auto')}>
            {log.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center">
                <Phone className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium">No session yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter a phone number and press DIAL on the handset to begin.
                </p>
              </div>
            ) : (
              (showAllSteps ? log.map((entry, index) => [entry, index] as const) : [[log[log.length - 1], log.length - 1] as const]).map(([entry, index]) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-xl border bg-card p-3.5 shadow-soft"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-muted text-[10px] font-bold">
                        {index + 1}
                      </span>
                      <span className="text-muted-foreground">Sent</span>
                      <code className="rounded bg-primary-50 px-1.5 py-0.5 font-mono font-bold text-primary-700 dark:bg-primary-950 dark:text-primary-300">
                        {entry.input}
                      </code>
                    </span>
                    <Badge variant={entry.type === 'END' ? 'secondary' : 'success'} size="sm">
                      {entry.type}
                    </Badge>
                  </div>
                  <pre className="whitespace-pre-wrap break-words rounded-lg bg-muted/60 p-3 font-mono text-[11.5px] leading-relaxed">
                    {entry.screen}
                  </pre>
                </motion.div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
