import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Activity, Key, Settings, Zap } from 'lucide-react';
import { useGetTelegramStatus, getGetTelegramStatusQueryKey } from '@workspace/api-client-react';

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: status } = useGetTelegramStatus({
    query: { queryKey: getGetTelegramStatusQueryKey() }
  });

  const navItems = [
    { path: '/dashboard', label: 'Overview', icon: Activity },
    { path: '/keywords', label: 'Keywords', icon: Key },
    { path: '/settings', label: 'System', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Zap className="w-5 h-5 text-primary mr-3" />
          <span className="font-mono font-bold tracking-wider text-sm">TG_MONITOR</span>
        </div>

        <div className="p-4 flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path} className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${isActive ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"}`}>
                <item.icon className="w-4 h-4" />
                <span className="font-mono">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Status indicator */}
        <div className="p-4 border-t border-border bg-muted/30">
           <div className="flex items-center gap-3">
             <div className="relative flex h-3 w-3">
               {status?.isMonitoring && (
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
               )}
               <span className={`relative inline-flex rounded-full h-3 w-3 ${status?.isMonitoring ? "bg-primary" : "bg-muted-foreground"}`}></span>
             </div>
             <div>
               <p className="text-xs font-mono font-semibold uppercase tracking-wider text-foreground">
                 {status?.isMonitoring ? 'Active' : 'Standby'}
               </p>
               <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate max-w-[150px]">
                 {status?.phone || 'Disconnected'}
               </p>
             </div>
           </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10 flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
