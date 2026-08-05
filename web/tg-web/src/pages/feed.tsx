import { useFeed } from '@/context/feed-context';
import { useGetTelegramStatus, getGetTelegramStatusQueryKey } from '@workspace/api-client-react';
import type { MatchedResult } from '@workspace/api-client-react';
import { ExternalLink } from 'lucide-react';

// ── Avatar color based on sender name ─────────────────────────────────────
const AVATAR_COLORS = [
  ['#2196F3', '#1565C0'], // blue
  ['#9C27B0', '#6A1B9A'], // purple
  ['#4CAF50', '#2E7D32'], // green
  ['#FF9800', '#E65100'], // orange
  ['#E91E63', '#880E4F'], // pink
  ['#00BCD4', '#006064'], // cyan
  ['#F44336', '#B71C1C'], // red
  ['#009688', '#004D40'], // teal
];

function getAvatarColor(name: string): string[] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0x7fffffff;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// ── Highlight keywords inside message text ────────────────────────────────
function highlightKeywords(text: string, keywords: string[]) {
  if (!keywords.length) return <>{text}</>;
  const escaped = keywords.map((k) =>
    k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) => {
        const isMatch = keywords.some(
          (k) => k.toLowerCase() === part.toLowerCase(),
        );
        return isMatch ? (
          <mark
            key={i}
            className="rounded-sm px-0.5 font-semibold"
            style={{ background: 'rgba(255,214,0,0.25)', color: '#FFD600' }}
          >
            {part}
          </mark>
        ) : (
          part
        );
      })}
    </>
  );
}

// ── Format time ───────────────────────────────────────────────────────────
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Single chat bubble ────────────────────────────────────────────────────
function MessageBubble({ result }: { result: MatchedResult }) {
  const [bg, border] = getAvatarColor(result.senderName);
  const initials = result.senderName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-start gap-3 px-4 py-1 group">
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-md mt-0.5"
        style={{ background: `linear-gradient(135deg, ${bg}, ${border})` }}
      >
        {initials || '?'}
      </div>

      {/* Bubble */}
      <div className="flex-1 min-w-0">
        {/* Sender row */}
        <div className="flex items-baseline gap-2 mb-1">
          <span
            className="text-sm font-semibold leading-none"
            style={{ color: bg }}
          >
            {result.senderName}
          </span>
          {result.senderUsername && (
            <span className="text-xs text-muted-foreground font-mono">
              @{result.senderUsername}
            </span>
          )}
          {/* Group badge */}
          <span
            className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0"
            style={{
              color: bg,
              borderColor: `${bg}40`,
              background: `${bg}12`,
            }}
          >
            {result.groupName}
          </span>
        </div>

        {/* Message card */}
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-3 max-w-2xl relative"
          style={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
          }}
        >
          {/* Message text */}
          <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed break-words">
            {highlightKeywords(result.fullText, result.matchedKeywords)}
          </p>

          {/* Shared groups */}
          {result.sharedGroups?.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/30">
              <p className="text-[10px] font-mono text-muted-foreground mb-1.5">
                👥 مجموعات مشتركة ({result.sharedGroupsCount ?? result.sharedGroups.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {result.sharedGroups.slice(0, 6).map((name, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm border"
                    style={{ background: `${bg}10`, color: bg, borderColor: `${bg}30` }}
                  >
                    {name}
                  </span>
                ))}
                {result.sharedGroups.length > 6 && (
                  <span className="text-[10px] font-mono text-muted-foreground/60 self-center px-1">
                    +{result.sharedGroups.length - 6} أخرى
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Footer: keywords + time + link */}
          <div className="flex items-end justify-between gap-3 mt-2 pt-2 border-t border-border/50">
            {/* Matched keywords */}
            <div className="flex flex-wrap gap-1.5">
              {result.matchedKeywords.map((k) => (
                <span
                  key={k}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm"
                  style={{
                    background: 'rgba(255,214,0,0.12)',
                    color: '#FFD600',
                    border: '1px solid rgba(255,214,0,0.25)',
                  }}
                >
                  🔑 {k}
                </span>
              ))}
            </div>

            {/* Time + link */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[11px] text-muted-foreground font-mono">
                {formatTime(result.timestamp)}
              </span>
              {result.messageLink && (
                <a
                  href={result.messageLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] font-mono transition-colors hover:opacity-80"
                  style={{ color: bg }}
                  title="Open in Telegram"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Date divider ──────────────────────────────────────────────────────────
function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 h-px bg-border/50" />
      <span className="text-[11px] font-mono text-muted-foreground px-3 py-1 rounded-full border border-border/50 bg-muted/30">
        {label}
      </span>
      <div className="flex-1 h-px bg-border/50" />
    </div>
  );
}

// ── Main feed page ────────────────────────────────────────────────────────
export default function Feed() {
  const { results } = useFeed();
  const { data: status } = useGetTelegramStatus({
    query: { queryKey: getGetTelegramStatusQueryKey() },
  });

  // Insert date dividers when the day changes
  type Item =
    | { kind: 'msg'; result: MatchedResult }
    | { kind: 'divider'; label: string };

  const items: Item[] = [];
  let lastDate = '';
  for (const r of results) {
    const d = formatDate(r.timestamp);
    if (d !== lastDate) {
      items.push({ kind: 'divider', label: d });
      lastDate = d;
    }
    items.push({ kind: 'msg', result: r });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex justify-between items-center px-5 py-3 border-b border-border sticky top-0 z-10 backdrop-blur-sm"
        style={{ background: 'hsla(var(--background)/0.9)' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground leading-none">
              Live Feed
            </span>
            <span className="text-[11px] text-muted-foreground font-mono mt-0.5">
              {results.length} message{results.length !== 1 ? 's' : ''} captured
            </span>
          </div>
        </div>
        {status?.isMonitoring ? (
          <span className="flex items-center gap-2 text-xs font-mono text-primary bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Live
          </span>
        ) : (
          <span className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-muted px-3 py-1.5 rounded-full border border-border">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
            Offline
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: 'hsl(var(--card))', border: '2px dashed hsl(var(--border))' }}
            >
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1 font-mono">
              {status?.isMonitoring
                ? 'Waiting for keyword matches…'
                : 'Start monitoring from System settings'}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {items.map((item, i) =>
              item.kind === 'divider' ? (
                <DateDivider key={`div-${i}`} label={item.label} />
              ) : (
                <MessageBubble key={item.result.id} result={item.result} />
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
