import { useState, useEffect } from 'react';
import {
  useGetTelegramStatus,
  useStartMonitoring,
  useStopMonitoring,
  useDisconnectTelegram,
  useClearResults,
  useGetBotConfig,
  useSetBotConfig,
  getGetTelegramStatusQueryKey,
  getGetBotConfigQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Play, Square, LogOut, Trash2, Bot, Save, Eye, EyeOff } from 'lucide-react';

export default function Settings() {
   const queryClient = useQueryClient();
   const { data: status } = useGetTelegramStatus({
     query: { queryKey: getGetTelegramStatusQueryKey() }
   });
   const { data: botConfig } = useGetBotConfig({
     query: { queryKey: getGetBotConfigQueryKey() }
   });

   const [botToken, setBotToken] = useState('');
   const [chatId, setChatId]     = useState('');
   const [showToken, setShowToken] = useState(false);
   const [savedOk, setSavedOk]   = useState(false);

   // Fill fields when config loads
   useEffect(() => {
     if (botConfig) {
       setBotToken(botConfig.botToken || '');
       setChatId(botConfig.chatId || '');
     }
   }, [botConfig]);

   const startMutation      = useStartMonitoring();
   const stopMutation       = useStopMonitoring();
   const disconnectMutation = useDisconnectTelegram();
   const clearMutation      = useClearResults();
   const setBotMutation     = useSetBotConfig();

   const invalidateStatus = () => {
     queryClient.invalidateQueries({ queryKey: getGetTelegramStatusQueryKey() });
     queryClient.invalidateQueries({ queryKey: getGetBotConfigQueryKey() });
   };

   const handleStart      = () => startMutation.mutate({}, { onSuccess: invalidateStatus });
   const handleStop       = () => stopMutation.mutate({}, { onSuccess: invalidateStatus });
   const handleDisconnect = () => disconnectMutation.mutate({}, { onSuccess: invalidateStatus });
   const handleClear      = () => clearMutation.mutate({});

   const handleSaveBot = () => {
     if (!botToken.trim() || !chatId.trim()) return;
     setBotMutation.mutate(
       { data: { botToken: botToken.trim(), chatId: chatId.trim() } },
       {
         onSuccess: () => {
           setSavedOk(true);
           invalidateStatus();
           setTimeout(() => setSavedOk(false), 3000);
         },
       },
     );
   };

   return (
      <div className="p-8 max-w-3xl">
         <h1 className="text-2xl font-mono tracking-tight font-bold mb-8 text-foreground">SYSTEM_CONTROL</h1>

         <div className="space-y-6">

            {/* Engine */}
            <div className="bg-card border border-border p-6 rounded-lg">
               <h2 className="text-sm font-mono text-muted-foreground mb-4 uppercase tracking-wider">Engine Status</h2>
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                     <div className={`w-3 h-3 rounded-full ${status?.isMonitoring ? 'bg-primary shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse' : 'bg-muted-foreground'}`} />
                     <span className="font-mono text-sm">{status?.isMonitoring ? 'MONITORING_ACTIVE' : 'STANDBY'}</span>
                  </div>
                  <div className="flex gap-3">
                     {!status?.isMonitoring ? (
                        <button onClick={handleStart} disabled={startMutation.isPending} className="flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/30 rounded font-mono text-sm font-semibold hover:bg-primary/20 transition-colors min-w-[140px]">
                           <Play className="w-4 h-4" /> START_ENGINE
                        </button>
                     ) : (
                        <button onClick={handleStop} disabled={stopMutation.isPending} className="flex items-center justify-center gap-2 px-4 py-2 bg-destructive/10 text-destructive border border-destructive/30 rounded font-mono text-sm font-semibold hover:bg-destructive/20 transition-colors min-w-[140px]">
                           <Square className="w-4 h-4" /> HALT_ENGINE
                        </button>
                     )}
                  </div>
               </div>
            </div>

            {/* Bot config */}
            <div className="bg-card border border-border p-6 rounded-lg">
               <div className="flex items-center gap-2 mb-4">
                  <Bot className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Bot Configuration</h2>
                  {botConfig?.configured && (
                     <span className="ml-auto text-[10px] font-mono bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded">CONFIGURED</span>
                  )}
               </div>

               <div className="space-y-3">
                  {/* Bot Token */}
                  <div>
                     <label className="block text-xs font-mono text-muted-foreground mb-1.5 uppercase tracking-wider">Bot Token</label>
                     <div className="relative">
                        <input
                           type={showToken ? 'text' : 'password'}
                           value={botToken}
                           onChange={e => setBotToken(e.target.value)}
                           placeholder="123456789:ABCdef..."
                           className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 pr-10"
                        />
                        <button
                           type="button"
                           onClick={() => setShowToken(v => !v)}
                           className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                           {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                     </div>
                     <p className="text-[10px] font-mono text-muted-foreground mt-1">احصل عليه من @BotFather</p>
                  </div>

                  {/* Chat ID */}
                  <div>
                     <label className="block text-xs font-mono text-muted-foreground mb-1.5 uppercase tracking-wider">Chat ID</label>
                     <input
                        type="text"
                        value={chatId}
                        onChange={e => setChatId(e.target.value)}
                        placeholder="-100123456789  أو  123456789"
                        className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                     />
                     <p className="text-[10px] font-mono text-muted-foreground mt-1">
                        Chat ID الخاص بك أو المجموعة التي تريد استقبال التنبيهات فيها.
                        أرسل /start لبوتك ثم افتح: api.telegram.org/bot&#123;TOKEN&#125;/getUpdates
                     </p>
                  </div>

                  <button
                     onClick={handleSaveBot}
                     disabled={setBotMutation.isPending || !botToken.trim() || !chatId.trim()}
                     className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded font-mono text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 min-w-[140px]"
                  >
                     <Save className="w-4 h-4" />
                     {savedOk ? 'SAVED ✓' : setBotMutation.isPending ? 'SAVING...' : 'SAVE_CONFIG'}
                  </button>
               </div>
            </div>

            {/* Data management */}
            <div className="bg-card border border-border p-6 rounded-lg">
               <h2 className="text-sm font-mono text-muted-foreground mb-4 uppercase tracking-wider">Data Management</h2>
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <p className="text-sm text-foreground/80 font-mono">Clear all stored matches from server memory.</p>
                  <button onClick={handleClear} disabled={clearMutation.isPending} className="flex items-center justify-center gap-2 px-4 py-2 bg-muted text-foreground border border-border rounded font-mono text-sm font-semibold hover:bg-muted/80 transition-colors min-w-[140px]">
                     <Trash2 className="w-4 h-4 text-destructive" /> PURGE_DATA
                  </button>
               </div>
            </div>

            {/* Disconnect */}
            <div className="bg-card border border-destructive/30 p-6 rounded-lg relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-destructive" />
               <h2 className="text-sm font-mono text-destructive mb-4 uppercase tracking-wider">Disconnect Session</h2>
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                     <p className="text-sm text-foreground/80 font-mono mb-1">Authenticated as: <span className="text-primary">{status?.phone}</span></p>
                     <p className="text-xs text-muted-foreground font-mono">Sever connection to Telegram API. Requires re-authentication.</p>
                  </div>
                  <button onClick={handleDisconnect} disabled={disconnectMutation.isPending} className="flex items-center justify-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded font-mono text-sm font-bold hover:bg-destructive/90 transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)] hover:shadow-[0_0_20px_rgba(220,38,38,0.4)] min-w-[180px]">
                     <LogOut className="w-4 h-4" /> TERMINATE_LINK
                  </button>
               </div>
            </div>

         </div>
      </div>
   );
}
