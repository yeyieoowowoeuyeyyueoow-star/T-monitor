import { useState } from 'react';
import { useListKeywords, useAddKeyword, useUpdateKeyword, useRemoveKeyword, getListKeywordsQueryKey } from '@workspace/api-client-react';
import { Plus, Trash2, Power } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function Keywords() {
  const { data: keywords = [] } = useListKeywords({
    query: { queryKey: getListKeywordsQueryKey() }
  });
  
  const addMutation = useAddKeyword();
  const updateMutation = useUpdateKeyword();
  const removeMutation = useRemoveKeyword();
  const queryClient = useQueryClient();

  const [newKeyword, setNewKeyword] = useState('');

  const invalidateKeywords = () => queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() });

  const handleAdd = (e: React.FormEvent) => {
     e.preventDefault();
     if (!newKeyword.trim()) return;
     addMutation.mutate({ data: { text: newKeyword.trim() } }, {
        onSuccess: () => {
           setNewKeyword('');
           invalidateKeywords();
        }
     });
  };

  const handleToggle = (id: string, enabled: boolean) => {
     updateMutation.mutate({ id, data: { enabled: !enabled } }, {
        onSuccess: () => invalidateKeywords()
     });
  };

  const handleRemove = (id: string) => {
     removeMutation.mutate({ id }, {
        onSuccess: () => invalidateKeywords()
     });
  };

  return (
     <div className="p-8 h-full flex flex-col">
        <h1 className="text-2xl font-mono tracking-tight font-bold mb-6 text-foreground">TARGET_KEYWORDS</h1>

        <form onSubmit={handleAdd} className="flex gap-3 mb-8 max-w-2xl">
           <input
              type="text"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              placeholder="ENTER NEW TARGET..."
              className="flex-1 bg-input border border-border rounded-md px-4 py-2 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-foreground"
           />
           <button
              type="submit"
              disabled={addMutation.isPending}
              className="bg-primary text-primary-foreground px-6 py-2 rounded-md font-mono text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
           >
              <Plus className="w-4 h-4" /> ADD
           </button>
        </form>

        <div className="flex-1 overflow-y-auto">
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {keywords.map(kw => (
                 <div key={kw.id} className={`p-4 border rounded-md font-mono flex items-center justify-between transition-colors ${kw.enabled ? 'border-primary/30 bg-primary/5 shadow-[inset_0_0_10px_rgba(59,130,246,0.05)]' : 'border-border bg-card'}`}>
                    <span className={`text-sm ${kw.enabled ? 'text-foreground' : 'text-muted-foreground line-through decoration-muted-foreground/50'}`}>
                       {kw.text}
                    </span>
                    <div className="flex gap-2">
                       <button
                          onClick={() => handleToggle(kw.id, kw.enabled)}
                          disabled={updateMutation.isPending}
                          className={`p-1.5 rounded transition-colors ${kw.enabled ? 'text-primary hover:bg-primary/20' : 'text-muted-foreground hover:bg-muted border border-transparent hover:border-border'}`}
                          title={kw.enabled ? "Disable" : "Enable"}
                       >
                          <Power className="w-4 h-4" />
                       </button>
                       <button
                          onClick={() => handleRemove(kw.id)}
                          disabled={removeMutation.isPending}
                          className="p-1.5 rounded text-destructive hover:bg-destructive/20 transition-colors"
                          title="Delete"
                       >
                          <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                 </div>
              ))}
           </div>
           
           {keywords.length === 0 && (
             <div className="text-center p-12 border border-dashed border-border rounded-lg text-muted-foreground font-mono text-sm max-w-2xl">
               NO_KEYWORDS_DEFINED. ADD A TARGET TO BEGIN MONITORING.
             </div>
           )}
        </div>
     </div>
  );
}
