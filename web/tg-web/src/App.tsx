import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { useEffect, useState } from 'react';
import {
  useGetTelegramStatus,
  useGetAuthStatus,
  getGetTelegramStatusQueryKey,
} from '@workspace/api-client-react';

import Login from '@/pages/login';
import AppLogin from '@/pages/app-login';
import Dashboard from '@/pages/dashboard';
import Keywords from '@/pages/keywords';
import Settings from '@/pages/settings';
import NotFound from '@/pages/not-found';
import Layout from '@/components/layout';

const queryClient = new QueryClient();

/** Gate that checks the dashboard password before showing any content */
function AppPasswordGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const { data, isLoading } = useGetAuthStatus();

  useEffect(() => {
    if (!isLoading && data !== undefined) {
      setAuthed(data.authenticated);
    }
  }, [data, isLoading]);

  if (authed === null) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-muted-foreground font-mono text-sm relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4 relative z-10" />
        <div className="tracking-widest relative z-10">SYSTEM_INITIALIZING...</div>
      </div>
    );
  }

  if (!authed) {
    return <AppLogin onAuthenticated={() => setAuthed(true)} />;
  }

  return <>{children}</>;
}

function AuthBoundary({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: status, isLoading } = useGetTelegramStatus({
    query: {
       refetchInterval: 3000,
       queryKey: getGetTelegramStatusQueryKey()
    }
  });

  useEffect(() => {
    if (isLoading || !status) return;
    const isAuth = status.authState === 'authenticated';

    if (isAuth && location === '/') {
      setLocation('/dashboard');
    } else if (!isAuth && location !== '/') {
      setLocation('/');
    }
  }, [status, isLoading, location, setLocation]);

  if (isLoading && !status) {
     return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-muted-foreground font-mono text-sm relative overflow-hidden">
           <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
           <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4 relative z-10" />
           <div className="tracking-widest relative z-10">SYSTEM_INITIALIZING...</div>
        </div>
     );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AppPasswordGate>
          <AuthBoundary>
            <Switch>
              <Route path="/" component={Login} />
              <Route>
                <Layout>
                  <Switch>
                    <Route path="/dashboard" component={Dashboard} />
                    <Route path="/keywords" component={Keywords} />
                    <Route path="/settings" component={Settings} />
                    <Route component={NotFound} />
                  </Switch>
                </Layout>
              </Route>
            </Switch>
          </AuthBoundary>
        </AppPasswordGate>
      </WouterRouter>
    </QueryClientProvider>
  );
}
