import { useState, useEffect } from 'react';
import { useSendCode, useVerifyCode, useVerifyPassword, useRestoreSession, useGetTelegramStatus, getGetTelegramStatusQueryKey } from '@workspace/api-client-react';
import { Zap, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function Login() {
  const queryClient = useQueryClient();
  const { data: status } = useGetTelegramStatus({
    query: { queryKey: getGetTelegramStatusQueryKey() }
  });
  
  const sendCode = useSendCode();
  const verifyCode = useVerifyCode();
  const verifyPassword = useVerifyPassword();
  const restoreSession = useRestoreSession();

  const [apiId, setApiId] = useState(localStorage.getItem('tg_apiId') || '');
  const [apiHash, setApiHash] = useState(localStorage.getItem('tg_apiHash') || '');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  const [step, setStep] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status?.authState === 'waiting_code') setStep(3);
    else if (status?.authState === 'waiting_password') setStep(4);
    else if (status?.authState === 'idle' && step > 2) setStep(1);
  }, [status?.authState, step]);

  const handleApiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiId || !apiHash) {
      setError('API_CREDENTIALS_REQUIRED');
      return;
    }
    localStorage.setItem('tg_apiId', apiId);
    localStorage.setItem('tg_apiHash', apiHash);
    setError('');
    setStep(2);
  };

  const invalidateStatus = () => queryClient.invalidateQueries({ queryKey: getGetTelegramStatusQueryKey() });

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return setError('PHONE_NUMBER_REQUIRED');
    setError('');
    sendCode.mutate({ data: { apiId: Number(apiId), apiHash, phone } }, {
      onError: () => setError('FAILED_TO_SEND_CODE'),
      onSuccess: () => {
        setStep(3);
        invalidateStatus();
      }
    });
  };

  const handleRestore = () => {
     if (!apiId || !apiHash) return setError('API_CREDENTIALS_REQUIRED_FOR_RESTORE');
     setError('');
     restoreSession.mutate({ data: { apiId: Number(apiId), apiHash } }, {
        onError: () => setError('RESTORE_FAILED_TRY_PHONE_LOGIN'),
        onSuccess: () => invalidateStatus()
     });
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return setError('AUTHORIZATION_CODE_REQUIRED');
    setError('');
    verifyCode.mutate({ data: { code } }, {
      onError: () => setError('INVALID_CODE'),
      onSuccess: () => invalidateStatus()
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return setError('PASSWORD_REQUIRED');
    setError('');
    verifyPassword.mutate({ data: { password } }, {
      onError: () => setError('INVALID_PASSWORD'),
      onSuccess: () => invalidateStatus()
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
       <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

       <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl relative z-10 overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-primary to-primary/20" />

          <div className="p-8">
             <div className="flex items-center justify-center mb-8">
                <Zap className="w-8 h-8 text-primary mr-3" />
                <h1 className="text-2xl font-mono font-bold tracking-widest text-foreground">TG_MONITOR</h1>
             </div>

             <div className="flex justify-between items-center mb-8 px-4 relative">
                <div className="absolute left-0 top-1/2 w-full h-[1px] bg-border -z-10" />
                {[1, 2, 3, 4].map(s => (
                   <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs border bg-card transition-colors ${step >= s ? 'border-primary text-primary' : 'border-border text-muted-foreground'} ${step === s ? 'shadow-[0_0_10px_rgba(59,130,246,0.5)]' : ''}`}>
                      {s}
                   </div>
                ))}
             </div>

             {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded mb-6 font-mono text-sm">
                   {error}
                </div>
             )}

             {step === 1 && (
                <form onSubmit={handleApiSubmit} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                   <div className="space-y-2">
                      <label className="text-xs font-mono text-muted-foreground uppercase">API_ID</label>
                      <input type="text" value={apiId} onChange={e => setApiId(e.target.value)} className="w-full bg-input border border-border rounded px-4 py-2 font-mono text-sm focus:border-primary focus:outline-none transition-colors" placeholder="1234567" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-xs font-mono text-muted-foreground uppercase">API_HASH</label>
                      <input type="password" value={apiHash} onChange={e => setApiHash(e.target.value)} className="w-full bg-input border border-border rounded px-4 py-2 font-mono text-sm focus:border-primary focus:outline-none transition-colors" placeholder="0123456789abcdef0123456789abcdef" />
                   </div>
                   <div className="pt-4 flex gap-3">
                      <button type="submit" className="flex-1 bg-primary text-primary-foreground py-2.5 rounded font-mono text-sm font-bold hover:bg-primary/90 transition-colors flex justify-center items-center gap-2">
                         CONTINUE <ArrowRight className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={handleRestore} disabled={restoreSession.isPending} className="flex-1 bg-secondary text-secondary-foreground border border-border py-2.5 rounded font-mono text-sm font-bold hover:bg-secondary/80 transition-colors flex justify-center items-center gap-2">
                         {restoreSession.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                         RESTORE
                      </button>
                   </div>
                   <p className="text-center text-xs text-muted-foreground font-mono mt-4">
                      Get these at my.telegram.org
                   </p>
                </form>
             )}

             {step === 2 && (
                <form onSubmit={handlePhoneSubmit} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                   <div className="space-y-2">
                      <label className="text-xs font-mono text-muted-foreground uppercase">TARGET_PHONE</label>
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-input border border-border rounded px-4 py-2 font-mono text-sm focus:border-primary focus:outline-none transition-colors" placeholder="+1234567890" autoFocus />
                   </div>
                   <div className="pt-4 flex gap-3">
                      <button type="button" onClick={() => setStep(1)} className="px-4 bg-secondary text-secondary-foreground border border-border py-2.5 rounded font-mono text-sm font-bold hover:bg-secondary/80 transition-colors">
                         BACK
                      </button>
                      <button type="submit" disabled={sendCode.isPending} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded font-mono text-sm font-bold hover:bg-primary/90 transition-colors flex justify-center items-center gap-2">
                         {sendCode.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'SEND_CODE'}
                      </button>
                   </div>
                </form>
             )}

             {step === 3 && (
                <form onSubmit={handleCodeSubmit} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                   <div className="space-y-2">
                      <label className="text-xs font-mono text-muted-foreground uppercase">AUTHORIZATION_CODE</label>
                      <input type="text" value={code} onChange={e => setCode(e.target.value)} className="w-full bg-input border border-border rounded px-4 py-2 font-mono text-center text-2xl tracking-[0.5em] focus:border-primary focus:outline-none transition-colors" placeholder="00000" autoFocus />
                   </div>
                   <div className="pt-4">
                      <button type="submit" disabled={verifyCode.isPending} className="w-full bg-primary text-primary-foreground py-2.5 rounded font-mono text-sm font-bold hover:bg-primary/90 transition-colors flex justify-center items-center gap-2">
                         {verifyCode.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'VERIFY_CODE'}
                      </button>
                   </div>
                   <p className="text-center text-xs text-muted-foreground font-mono mt-4">
                      Sent to your Telegram app
                   </p>
                </form>
             )}

             {step === 4 && (
                <form onSubmit={handlePasswordSubmit} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                   <div className="space-y-2">
                      <label className="text-xs font-mono text-muted-foreground uppercase">2FA_PASSWORD</label>
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-input border border-border rounded px-4 py-2 font-mono text-sm focus:border-primary focus:outline-none transition-colors" placeholder="••••••••" autoFocus />
                   </div>
                   <div className="pt-4">
                      <button type="submit" disabled={verifyPassword.isPending} className="w-full bg-primary text-primary-foreground py-2.5 rounded font-mono text-sm font-bold hover:bg-primary/90 transition-colors flex justify-center items-center gap-2">
                         {verifyPassword.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'AUTHENTICATE'}
                      </button>
                   </div>
                </form>
             )}
          </div>
       </div>
    </div>
  );
}
