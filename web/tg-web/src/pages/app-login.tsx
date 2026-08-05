import { useState } from 'react';
import { Lock, Zap, Loader2 } from 'lucide-react';
import { useAppLogin } from '@workspace/api-client-react';

interface Props {
  onAuthenticated: () => void;
}

export default function AppLogin({ onAuthenticated }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useAppLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    login.mutate(
      { data: { password } },
      {
        onSuccess: () => onAuthenticated(),
        onError: () => setError('INCORRECT_PASSWORD'),
      },
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 w-full max-w-sm mx-auto px-4">
        <div className="border border-border/60 bg-card/60 backdrop-blur rounded-xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <Zap className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold tracking-widest font-mono text-foreground">
              TG_MONITOR
            </span>
          </div>

          <div className="flex items-center gap-2 mb-6 text-muted-foreground">
            <Lock className="w-4 h-4" />
            <span className="text-sm font-mono tracking-wider">DASHBOARD_ACCESS</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-muted-foreground mb-1.5 tracking-wider uppercase">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                placeholder="Enter dashboard password"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-xs font-mono text-destructive tracking-wider">
                ✗ {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!password || login.isPending}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-mono text-sm tracking-wider py-2.5 rounded-md flex items-center justify-center gap-2 transition-colors"
            >
              {login.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'UNLOCK →'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
