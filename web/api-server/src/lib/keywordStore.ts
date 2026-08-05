// Keyword store with file persistence — survives server restarts
import fs from "fs";
import path from "path";
import os from "os";

const KEYWORDS_FILE = path.join(os.homedir(), ".tg-monitor-keywords.json");

export interface Keyword {
  id: string;
  text: string;
  enabled: boolean;
  pattern: RegExp;
}

interface StoredKeyword {
  id: string;
  text: string;
  enabled: boolean;
}

class KeywordStore {
  private keywords: Keyword[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(KEYWORDS_FILE)) {
        const data: StoredKeyword[] = JSON.parse(
          fs.readFileSync(KEYWORDS_FILE, "utf-8"),
        );
        if (Array.isArray(data)) {
          this.keywords = data.map((k) => ({
            ...k,
            pattern: new RegExp(
              k.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              "i",
            ),
          }));
        }
      }
    } catch (_) {}
  }

  private save(): void {
    try {
      const data: StoredKeyword[] = this.keywords.map(
        ({ id, text, enabled }) => ({ id, text, enabled }),
      );
      fs.writeFileSync(KEYWORDS_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (_) {}
  }

  add(text: string): Keyword | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    if (
      this.keywords.some(
        (k) => k.text.toLowerCase() === trimmed.toLowerCase(),
      )
    )
      return null;
    const kw: Keyword = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: trimmed,
      enabled: true,
      pattern: new RegExp(
        trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      ),
    };
    this.keywords.push(kw);
    this.save();
    return kw;
  }

  remove(id: string): boolean {
    const before = this.keywords.length;
    this.keywords = this.keywords.filter((k) => k.id !== id);
    if (this.keywords.length < before) {
      this.save();
      return true;
    }
    return false;
  }

  update(
    id: string,
    changes: { text?: string; enabled?: boolean },
  ): Keyword | null {
    const kw = this.keywords.find((k) => k.id === id);
    if (!kw) return null;
    if (changes.text !== undefined) {
      kw.text = changes.text.trim();
      kw.pattern = new RegExp(
        kw.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
    }
    if (changes.enabled !== undefined) kw.enabled = changes.enabled;
    this.save();
    return kw;
  }

  getAll(): Omit<Keyword, "pattern">[] {
    return this.keywords.map(({ id, text, enabled }) => ({ id, text, enabled }));
  }

  findMatches(text: string): Keyword[] {
    return this.keywords.filter((k) => k.enabled && k.pattern.test(text));
  }

  get count() {
    return this.keywords.length;
  }
  get activeCount() {
    return this.keywords.filter((k) => k.enabled).length;
  }
}

export const keywordStore = new KeywordStore();
