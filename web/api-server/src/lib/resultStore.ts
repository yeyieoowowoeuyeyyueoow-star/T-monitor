// In-memory matched-message store — max 2000 results, no database
export interface MatchedResult {
  id: string;
  groupName: string;
  senderName: string;
  senderUsername: string | null;
  timestamp: string;
  matchedKeywords: string[];
  snippet: string;
  fullText: string;
  messageLink: string | null;
  sharedGroups: string[];        // المجموعات المشتركة مع المرسل
  sharedGroupsCount: number;
  noforwards: boolean;           // هل قيّد المرسل تحويل رسائله
}

class ResultStore {
  private results: MatchedResult[] = [];
  private _totalCount = 0;
  private readonly MAX = 2000;

  add(result: MatchedResult): void {
    this.results.unshift(result);
    this._totalCount++;
    // Trim without O(N) slice on every call — only trim when significantly over limit
    if (this.results.length > this.MAX + 50) {
      this.results.length = this.MAX;
    }
  }

  getAll(): MatchedResult[] {
    return this.results;
  }

  /**
   * Returns all results NEWER than the given afterId.
   * Results are stored newest-first (index 0 = newest).
   *
   * Fix: previous code used `if (idx <= 0)` which also returned []
   * when idx === -1 (ID not found, e.g. after store clear), causing
   * the bot to silently miss all accumulated results.
   */
  getSince(afterId: string | null): MatchedResult[] {
    if (!afterId) return this.results;
    const idx = this.results.findIndex((r) => r.id === afterId);
    if (idx < 0) return this.results;  // ID not found → return all (store was cleared or restarted)
    if (idx === 0) return [];           // Already at the newest → nothing newer
    return this.results.slice(0, idx); // Everything at indices 0..idx-1 is newer
  }

  /**
   * Enrich an existing result with sender/shared-group info resolved in Phase 2.
   * Mutates in place — the result was already pushed to consumers via getAll/getSince.
   */
  enrich(id: string, patch: {
    senderName: string;
    senderUsername: string | null;
    sharedGroups: string[];
    sharedGroupsCount: number;
  }): void {
    const result = this.results.find((r) => r.id === id);
    if (!result) return;
    result.senderName       = patch.senderName;
    result.senderUsername   = patch.senderUsername;
    result.sharedGroups     = patch.sharedGroups;
    result.sharedGroupsCount = patch.sharedGroupsCount;
  }

  clear(): void {
    this.results = [];
  }

  get totalCount() {
    return this._totalCount;
  }
  get length() {
    return this.results.length;
  }
}

export const resultStore = new ResultStore();
