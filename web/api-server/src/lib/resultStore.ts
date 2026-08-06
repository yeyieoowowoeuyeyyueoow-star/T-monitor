// Matched-message store — persisted to disk, max 2000 results
import fs from "fs";
import path from "path";
import os from "os";

const RESULTS_FILE = path.join(os.homedir(), ".tg-monitor-results.json");

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
  enriched: boolean;             // true بعد اكتمال Phase-2 (سيرفر، يوزر، مجموعات مشتركة)
}

interface PersistedState {
  results: MatchedResult[];
  totalCount: number;
}

class ResultStore {
  private results: MatchedResult[] = [];
  private _totalCount = 0;
  private readonly MAX = 2000;

  // Debounce saves so rapid incoming messages don't thrash the disk
  private _saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(RESULTS_FILE)) {
        const raw: PersistedState = JSON.parse(
          fs.readFileSync(RESULTS_FILE, "utf-8"),
        );
        if (Array.isArray(raw.results)) {
          this.results = raw.results.slice(0, this.MAX);
          this._totalCount = typeof raw.totalCount === "number" ? raw.totalCount : this.results.length;
        }
      }
    } catch (_) {}
  }

  private scheduleSave(): void {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this.flush();
    }, 2000); // write at most once every 2 seconds
  }

  /** Write immediately — call on clean shutdown if needed */
  flush(): void {
    try {
      const state: PersistedState = {
        results: this.results,
        totalCount: this._totalCount,
      };
      fs.writeFileSync(RESULTS_FILE, JSON.stringify(state), "utf-8");
    } catch (_) {}
  }

  add(result: MatchedResult): void {
    this.results.unshift(result);
    this._totalCount++;
    // Trim without O(N) slice on every call — only trim when significantly over limit
    if (this.results.length > this.MAX + 50) {
      this.results.length = this.MAX;
    }
    this.scheduleSave();
  }

  getAll(): MatchedResult[] {
    return this.results;
  }

  /**
   * Returns all results NEWER than the given afterId.
   * Results are stored newest-first (index 0 = newest).
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
    result.senderName        = patch.senderName;
    result.senderUsername    = patch.senderUsername;
    result.sharedGroups      = patch.sharedGroups;
    result.sharedGroupsCount = patch.sharedGroupsCount;
    result.enriched          = true;
    this.scheduleSave();
  }

  clear(): void {
    this.results = [];
    this.flush();
  }

  get totalCount() {
    return this._totalCount;
  }
  get length() {
    return this.results.length;
  }
}

export const resultStore = new ResultStore();
