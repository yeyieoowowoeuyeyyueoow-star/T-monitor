import { useGetTelegramStatus, getGetTelegramStatusQueryKey } from '@workspace/api-client-react';
import { MessageSquare, Users, Key, Bot } from 'lucide-react';
import { useLocation } from 'wouter';

export default function Dashboard() {
  const { data: status } = useGetTelegramStatus({
    query: { queryKey: getGetTelegramStatusQueryKey() }
  });
  const [, setLocation] = useLocation();

  const stats = [
    { label: 'Total Matches', value: status?.totalMatches ?? 0, icon: MessageSquare },
    { label: 'Groups Monitored', value: status?.groupCount ?? 0, icon: Users },
    { label: 'Active Keywords', value: status?.activeKeywords ?? 0, icon: Key },
  ];

  return (
     <div className="p-8 h-full overflow-y-auto">
        <h1 className="text-2xl font-mono tracking-tight font-bold mb-6 text-foreground">SYSTEM_OVERVIEW</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
           {stats.map((s, i) => (
              <div key={i} className="bg-card border border-border p-5 rounded-lg flex flex-col hover:border-primary/30 transition-colors">
                 <div className="flex justify-between items-center mb-4">
                    <span className="text-muted-foreground font-mono text-xs uppercase tracking-wider">{s.label}</span>
                    <s.icon className="w-4 h-4 text-primary/50" />
                 </div>
                 <span className="text-3xl font-mono">{s.value}</span>
              </div>
           ))}
        </div>

        {/* Bot status */}
        <div className="mb-4 flex items-center justify-between">
           <h2 className="text-sm font-mono tracking-widest text-muted-foreground uppercase">BOT_STATUS</h2>
           <span className="text-xs font-mono text-primary animate-pulse">{status?.isMonitoring ? 'LIVE' : ''}</span>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
           <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${status?.botConfigured ? 'bg-primary/10' : 'bg-muted'}`}>
                 <Bot className={`w-6 h-6 ${status?.botConfigured ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div className="flex-1">
                 {status?.botConfigured ? (
                    <>
                       <p className="font-mono text-sm font-semibold text-foreground">BOT_CONFIGURED</p>
                       <p className="font-mono text-xs text-muted-foreground mt-1">
                          {status.isMonitoring
                             ? 'المراقبة نشطة — التنبيهات ترسل للبوت فور اكتشاف الكلمات.'
                             : 'البوت جاهز. ابدأ المراقبة من System للحصول على التنبيهات.'}
                       </p>
                    </>
                 ) : (
                    <>
                       <p className="font-mono text-sm font-semibold text-foreground">BOT_NOT_CONFIGURED</p>
                       <p className="font-mono text-xs text-muted-foreground mt-1">
                          أدخل Bot Token وChat ID من صفحة{' '}
                          <button
                             onClick={() => setLocation('/settings')}
                             className="text-primary underline-offset-2 hover:underline"
                          >
                             System
                          </button>
                          .
                       </p>
                    </>
                 )}
              </div>
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${status?.botConfigured ? (status.isMonitoring ? 'bg-primary shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse' : 'bg-primary') : 'bg-muted-foreground'}`} />
           </div>
        </div>
     </div>
  );
}
