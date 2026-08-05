import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useListResults, useGetTelegramStatus, getListResultsQueryKey, getGetTelegramStatusQueryKey } from '@workspace/api-client-react';
import type { MatchedResult } from '@workspace/api-client-react';

interface FeedContextType {
  results: MatchedResult[];
  clearLocalFeed: () => void;
}

const FeedContext = createContext<FeedContextType>({ results: [], clearLocalFeed: () => {} });

export function FeedProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<MatchedResult[]>([]);
  const [since, setSince] = useState<string | undefined>(undefined);
  
  const { data: status } = useGetTelegramStatus({
    query: { 
      refetchInterval: 3000,
      queryKey: getGetTelegramStatusQueryKey()
    }
  });

  const isMonitoring = status?.isMonitoring ?? false;

  const params = { limit: 50, ...(since ? { since } : {}) };
  const { data: newResults } = useListResults(params, {
     query: {
        refetchInterval: isMonitoring ? 2000 : false,
        enabled: isMonitoring,
        queryKey: getListResultsQueryKey(params)
     }
  });

  useEffect(() => {
     if (newResults && newResults.length > 0) {
        setResults(prev => {
            const combined = [...newResults, ...prev];
            const map = new Map();
            combined.forEach(r => map.set(r.id, r));
            const deduplicated = Array.from(map.values());
            deduplicated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            
            // Only update since if we found a valid newest id
            if (deduplicated.length > 0 && deduplicated[0].id !== since) {
                setSince(deduplicated[0].id);
            }
            
            return deduplicated.slice(0, 500);
        });
     }
  }, [newResults, since]);

  const clearLocalFeed = () => {
     setResults([]);
     setSince(undefined);
  };

  return (
    <FeedContext.Provider value={{ results, clearLocalFeed }}>
      {children}
    </FeedContext.Provider>
  );
}

export const useFeed = () => useContext(FeedContext);
