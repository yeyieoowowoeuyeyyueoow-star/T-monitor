import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import fs from "fs";
import path from "path";
import os from "os";
import { logger } from "./logger.js";
import { keywordStore } from "./keywordStore.js";
import { resultStore } from "./resultStore.js";
import { botStore } from "./botStore.js";

const SESSION_FILE   = path.join(os.homedir(), ".tg-monitor-session");
const LAST_IDS_FILE  = path.join(os.homedir(), ".tg-monitor-lastids.json");

// ── Constants ────────────────────────────────────────────────────────────────

/** Cache TTL for resolved Telegram entities (10 min) */
const ENTITY_CACHE_TTL_MS      = 10 * 60 * 1000;
/** Refresh the groups list every 5 min while monitoring */
const GROUP_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
/** Auto-reconnect watchdog interval */
const RECONNECT_INTERVAL_MS     = 30_000;
/**
 * Catch-up sweep interval.
 * Every N ms we poll recent messages from active groups to rescue anything
 * that Telegram didn't deliver via UpdateNewChannelMessage (common in
 * high-traffic supergroups where Telegram batches updates server-side).
 */
const CATCHUP_INTERVAL_MS       = 45_000;
/** Max messages to fetch per group per catch-up sweep */
const CATCHUP_LIMIT             = 50;
/** How many groups to sweep per tick (to avoid FloodWait) */
const CATCHUP_BATCH_SIZE        = 3;
/** Delay between batches in ms */
const CATCHUP_BATCH_DELAY_MS    = 1_500;

type AuthState = "idle" | "waiting_code" | "waiting_password" | "authenticated";

interface CachedEntity { entity: any; expiresAt: number; }

// ─────────────────────────────────────────────────────────────────────────────

class TelegramService {
  private client: TelegramClient | null = null;
  private _authState: AuthState = "idle";
  private _isMonitoring = false;
  private _groups: Record<string, string> = {};
  private _apiId  = 0;
  private _apiHash = "";
  private _phone  = "";

  // Timers
  private messageHandler:    ((event: any) => Promise<void>) | null = null;
  private _reconnectTimer:   ReturnType<typeof setInterval> | null  = null;
  private _groupRefreshTimer:ReturnType<typeof setInterval> | null  = null;
  private _catchupTimer:     ReturnType<typeof setInterval> | null  = null;

  // Entity cache
  private _entityCache: Map<string, CachedEntity> = new Map();

  /**
   * Last seen message ID per group chatIdStr.
   * Persisted to disk so reconnects can fetch missed messages.
   */
  private _lastSeenMsgId: Map<string, number> = new Map();

  /** Set of message IDs already processed — prevents duplicates between
   *  the real-time event handler and the catch-up sweep. */
  private _processedMsgIds: Set<string> = new Set();

  // Diagnostic counters
  private _eventsReceived = 0;
  private _eventsMatched  = 0;
  private _eventsMissedGroup = 0; // chatId not in _groups

  // Auth callbacks
  private resolveCode:     ((v: string) => void) | null = null;
  private resolvePassword: ((v: string) => void) | null = null;
  private authPromise: Promise<void> | null = null;

  // ── Session helpers ───────────────────────────────────────────────────────

  private readSession(): string {
    try {
      if (fs.existsSync(SESSION_FILE)) return fs.readFileSync(SESSION_FILE, "utf-8").trim();
    } catch (_) {}
    return "";
  }

  private writeSession(s: string): void {
    try { fs.writeFileSync(SESSION_FILE, s, { encoding: "utf-8", mode: 0o600 }); } catch (_) {}
  }

  // ── Last-seen-ID persistence ──────────────────────────────────────────────

  private loadLastIds(): void {
    try {
      if (fs.existsSync(LAST_IDS_FILE)) {
        const raw = JSON.parse(fs.readFileSync(LAST_IDS_FILE, "utf-8"));
        if (raw && typeof raw === "object") {
          for (const [k, v] of Object.entries(raw)) {
            if (typeof v === "number") this._lastSeenMsgId.set(k, v);
          }
          logger.info({ groups: this._lastSeenMsgId.size }, "Loaded last-seen message IDs");
        }
      }
    } catch (_) {}
  }

  private saveLastIds(): void {
    try {
      const obj: Record<string, number> = {};
      this._lastSeenMsgId.forEach((v, k) => { obj[k] = v; });
      fs.writeFileSync(LAST_IDS_FILE, JSON.stringify(obj), { encoding: "utf-8", mode: 0o600 });
    } catch (_) {}
  }

  private updateLastSeen(chatIdStr: string, msgId: number): void {
    const current = this._lastSeenMsgId.get(chatIdStr) ?? 0;
    if (msgId > current) {
      this._lastSeenMsgId.set(chatIdStr, msgId);
      // Persist every 50 updates to avoid excessive disk writes
      if ((this._eventsReceived % 50) === 0) this.saveLastIds();
    }
  }

  // ── Entity cache helpers ──────────────────────────────────────────────────

  private getCachedEntity(key: string): any | null {
    const entry = this._entityCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this._entityCache.delete(key); return null; }
    return entry.entity;
  }

  private setCachedEntity(key: string, entity: any): void {
    this._entityCache.set(key, { entity, expiresAt: Date.now() + ENTITY_CACHE_TTL_MS });
  }

  // ── chatId resolution ─────────────────────────────────────────────────────

  /**
   * Resolves a chatIdStr from an event to a key in _groups.
   *
   * Telegram uses two chatId formats depending on gramjs version and peer type:
   *   - Supergroups/Channels: "-1001234567890"  (with -100 prefix)
   *   - Basic groups:         "-123456789"       (simple negative)
   *
   * We try the raw value first, then alternate forms to be safe.
   */
  private resolveGroupKey(chatIdStr: string): string | null {
    if (!chatIdStr) return null;
    if (this._groups[chatIdStr]) return chatIdStr;

    // Try without -100 prefix (some gramjs versions omit it for channels)
    if (chatIdStr.startsWith("-100")) {
      const alt = "-" + chatIdStr.slice(4);
      if (this._groups[alt]) return alt;
    } else if (chatIdStr.startsWith("-") && !chatIdStr.startsWith("-100")) {
      // Try adding -100 prefix for supergroups
      const alt = "-100" + chatIdStr.slice(1);
      if (this._groups[alt]) return alt;
    }

    return null;
  }

  // ── Group refresh ─────────────────────────────────────────────────────────

  private async refreshGroups(): Promise<void> {
    if (!this.client) return;
    try {
      const groups: Record<string, string> = {};
      for await (const dialog of this.client.iterDialogs({ limit: 0 })) {
        if (dialog.isGroup || dialog.isChannel) {
          const idStr = dialog.id?.toString() ?? "";
          if (idStr) groups[idStr] = dialog.title || "Unknown";
        }
      }
      this._groups = groups;
      logger.info({ count: Object.keys(groups).length }, "Groups refreshed");
    } catch (err) {
      logger.warn({ err }, "Group refresh failed — keeping previous list");
    }
  }

  // ── Two-phase message processing ──────────────────────────────────────────

  /**
   * PHASE 1 — synchronous/fast.
   * Saves a result immediately with whatever info is available right now.
   * Returns the result ID so Phase 2 can enrich it later.
   */
  private saveResult(opts: {
    msgId:    number;
    chatIdStr: string;
    text:     string;
    matches:  { text: string }[];
    noforwards: boolean;
    link:     string | null;
  }): string {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const snippet = opts.text.length > 300 ? opts.text.slice(0, 300) + "…" : opts.text;

    resultStore.add({
      id,
      groupName:        this._groups[opts.chatIdStr] ?? "Unknown",
      senderName:       "…",           // enriched in Phase 2
      senderUsername:   null,
      timestamp:        new Date().toISOString(),
      matchedKeywords:  opts.matches.map((k) => k.text),
      snippet,
      fullText:         opts.text,
      messageLink:      opts.link,
      sharedGroups:     [],            // enriched in Phase 2
      sharedGroupsCount: 0,
      noforwards:       opts.noforwards,
    });

    return id;
  }

  /**
   * PHASE 2 — runs asynchronously via setImmediate, never blocks event loop.
   * Enriches an existing result with sender name, username, shared groups.
   *
   * Works with either:
   *   - a real-time event + its message (event.getSender() available)
   *   - a catch-up message object from getMessages() (no event wrapper)
   */
  private enrichResultAsync(resultId: string, msg: any, event?: any): void {
    setImmediate(async () => {
      if (!this.client) return;
      try {
        let senderName     = "Unknown";
        let senderUsername: string | null = null;
        let senderId:       bigint | null = null;
        let senderEntity:   any = null;
        let sharedGroups:   string[] = [];

        // ── Resolve sender entity ────────────────────────────────────────
        const fromPeer = (msg as any).fromId;
        if (fromPeer?.className === "PeerUser" && fromPeer.userId) {
          senderId = fromPeer.userId as bigint;
          const cacheKey = String(senderId);
          senderEntity = this.getCachedEntity(cacheKey);
          if (!senderEntity) {
            try {
              senderEntity = await this.client.getEntity(senderId as any);
              if (senderEntity) this.setCachedEntity(cacheKey, senderEntity);
            } catch (_) {}
          }
        }

        // Fallback: use event.getSender() for real-time events
        if (!senderEntity && event) {
          try {
            senderEntity = await event.getSender();
            if (senderEntity?.id) {
              senderId = senderEntity.id as bigint;
              this.setCachedEntity(String(senderId), senderEntity);
            }
          } catch (_) {}
        }

        // Fallback: sender field on catch-up messages
        if (!senderEntity && (msg as any).sender) {
          senderEntity = (msg as any).sender;
          if (senderEntity?.id) {
            senderId = senderEntity.id as bigint;
            this.setCachedEntity(String(senderId), senderEntity);
          }
        }

        if (senderEntity) {
          if (senderEntity.className === "User") {
            const first = senderEntity.firstName || "";
            const last  = senderEntity.lastName  || "";
            const rawUsername = senderEntity.username || senderEntity.usernames?.[0]?.username;
            senderUsername = rawUsername ? String(rawUsername) : null;
            senderName = `${first} ${last}`.trim() || senderUsername || "Unknown";
          } else {
            senderName = senderEntity.title || senderEntity.username || "Unknown";
            senderUsername = senderEntity.username ? String(senderEntity.username) : null;
          }
        }

        // ── Shared groups ────────────────────────────────────────────────
        if (senderId && this.client) {
          try {
            const peer = await this.client.getInputEntity(senderId as any);
            if ((peer as any).className === "InputPeerUser") {
              const inputUser = new Api.InputUser({
                userId:     (peer as any).userId,
                accessHash: (peer as any).accessHash,
              });
              const common = await this.client.invoke(
                new Api.messages.GetCommonChats({
                  userId: inputUser,
                  maxId:  BigInt(0) as any,
                  limit:  100,
                }),
              );
              sharedGroups = ((common as any).chats ?? [])
                .map((c: any) => c.title || c.username || "")
                .filter(Boolean);
            }
          } catch (_) {}
        }

        // Patch the result in-place inside resultStore
        resultStore.enrich(resultId, { senderName, senderUsername, sharedGroups, sharedGroupsCount: sharedGroups.length });

      } catch (err) {
        logger.warn({ err, resultId }, "Phase-2 enrichment failed");
      }
    });
  }

  // ── Core message processing (shared by event handler + catch-up sweep) ────

  private async processMessage(opts: {
    msgId:      number;
    chatIdStr:  string;
    text:       string;
    noforwards: boolean;
    msg?:       any;   // message object (from event or getMessages)
    event?:     any;   // only present for real-time events (has getSender())
    link?:      string | null;
  }): Promise<void> {
    const dedupeKey = `${opts.chatIdStr}:${opts.msgId}`;
    if (this._processedMsgIds.has(dedupeKey)) return;
    this._processedMsgIds.add(dedupeKey);
    // Keep dedup set bounded
    if (this._processedMsgIds.size > 20_000) {
      const iter = this._processedMsgIds.values();
      for (let i = 0; i < 5_000; i++) {
        const next = iter.next();
        if (!next.done && next.value) this._processedMsgIds.delete(next.value);
      }
    }

    const matches = keywordStore.findMatches(opts.text);
    if (!matches.length) return;

    this._eventsMatched++;
    this.updateLastSeen(opts.chatIdStr, opts.msgId);

    // Phase 1: save immediately
    const resultId = this.saveResult({
      msgId:      opts.msgId,
      chatIdStr:  opts.chatIdStr,
      text:       opts.text,
      matches,
      noforwards: opts.noforwards,
      link:       opts.link ?? null,
    });

    // Phase 2: enrich in background whenever we have a msg object
    if (opts.msg) {
      this.enrichResultAsync(resultId, opts.msg, opts.event);
    }

    logger.info(
      { group: this._groups[opts.chatIdStr], keywords: matches.map((k) => k.text), msgId: opts.msgId },
      "Keyword match",
    );
  }

  // ── Catch-up sweep ────────────────────────────────────────────────────────

  /**
   * Sweeps recent messages from all monitored groups in rate-limited batches.
   * Catches messages that Telegram didn't deliver via real-time updates
   * (common for high-traffic supergroups).
   */
  private async runCatchupSweep(): Promise<void> {
    if (!this.client || !this._isMonitoring) return;

    const groupIds = Object.keys(this._groups);
    logger.debug({ groups: groupIds.length }, "Starting catch-up sweep");

    for (let i = 0; i < groupIds.length; i += CATCHUP_BATCH_SIZE) {
      if (!this._isMonitoring) break;
      const batch = groupIds.slice(i, i + CATCHUP_BATCH_SIZE);

      await Promise.all(batch.map(async (chatIdStr) => {
        if (!this.client) return;
        try {
          const lastId = this._lastSeenMsgId.get(chatIdStr) ?? 0;
          const messages: any[] = await this.client.getMessages(chatIdStr, {
            limit: CATCHUP_LIMIT,
            ...(lastId ? { minId: lastId } : {}),
          });

          for (const msg of messages) {
            if (!msg?.text || !msg?.id) continue;
            const bareId   = chatIdStr.replace(/^-100/, "");
            const username = (msg as any).chat?.username ?? null;
            const link     = username
              ? `https://t.me/${username}/${msg.id}`
              : `https://t.me/c/${bareId}/${msg.id}`;

            await this.processMessage({
              msgId:      msg.id,
              chatIdStr,
              text:       msg.text,
              noforwards: !!(msg as any).noforwards,
              link,
            });
          }

          // Update lastSeen even if no matches, so next sweep knows the boundary
          if (messages.length > 0) {
            const maxId = Math.max(...messages.map((m: any) => m.id as number));
            this.updateLastSeen(chatIdStr, maxId);
          }
        } catch (err) {
          logger.debug({ err, chatIdStr }, "Catch-up fetch failed for group");
        }
      }));

      // Delay between batches to avoid FloodWait
      if (i + CATCHUP_BATCH_SIZE < groupIds.length) {
        await new Promise((r) => setTimeout(r, CATCHUP_BATCH_DELAY_MS));
      }
    }

    this.saveLastIds();
    logger.debug("Catch-up sweep complete");
  }

  // ── Status ────────────────────────────────────────────────────────────────

  getStatus() {
    return {
      authState:        this._authState,
      isMonitoring:     this._isMonitoring,
      phone:            this._phone,
      groupCount:       Object.keys(this._groups).length,
      totalMatches:     resultStore.totalCount,
      activeKeywords:   keywordStore.activeCount,
      botConfigured:    botStore.isConfigured,
      eventsReceived:   this._eventsReceived,
      eventsMatched:    this._eventsMatched,
      eventsMissedGroup:this._eventsMissedGroup,
    };
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async tryRestoreSession(apiId: number, apiHash: string): Promise<boolean> {
    const saved = this.readSession();
    if (!saved) return false;
    try {
      const session = new StringSession(saved);
      const client  = new TelegramClient(session, apiId, apiHash, { connectionRetries: 3 });
      await client.connect();
      if (!await client.checkAuthorization()) { await client.disconnect(); return false; }
      const me = await client.getMe();
      this._phone    = (me as any)?.phone ? `+${(me as any).phone}` : "";
      this.client    = client;
      this._apiId    = apiId;
      this._apiHash  = apiHash;
      this._authState = "authenticated";
      logger.info("Session restored");
      return true;
    } catch (err) {
      logger.warn({ err }, "Session restore failed");
      return false;
    }
  }

  async sendCode(apiId: number, apiHash: string, phone: string): Promise<void> {
    this._authState = "idle";
    this.client?.disconnect();
    this.client = null;

    const session = new StringSession(this.readSession());
    const client  = new TelegramClient(session, apiId, apiHash, { connectionRetries: 3 });

    this._apiId   = apiId;
    this._apiHash = apiHash;
    this._phone   = phone;

    this.authPromise = new Promise<void>((resolveAuth, rejectAuth) => {
      client.start({
        phoneNumber: phone,
        phoneCode: () =>
          new Promise<string>((resolve) => {
            this._authState = "waiting_code";
            this.resolveCode = resolve;
          }),
        password: () =>
          new Promise<string>((resolve) => {
            this._authState = "waiting_password";
            this.resolvePassword = resolve;
          }),
        onError: (err: Error) => {
          this._authState = "idle";
          rejectAuth(err);
        },
      }).then(async () => {
        const sess = client.session.save() as unknown as string;
        this.writeSession(sess);
        this.client    = client;
        this._authState = "authenticated";
        resolveAuth();
      }).catch(rejectAuth);
    });

    this._authState = "waiting_code";
    await client.connect();
  }

  submitCode(code: string): void {
    this.resolveCode?.(code);
    this.resolveCode = null;
  }

  submitPassword(password: string): void {
    this.resolvePassword?.(password);
    this.resolvePassword = null;
  }

  async waitForStateChange(from: AuthState): Promise<{ state: AuthState; error?: string }> {
    const TIMEOUT = 60_000;
    const start   = Date.now();
    while (Date.now() - start < TIMEOUT) {
      if (this._authState !== from) return { state: this._authState };
      await new Promise((r) => setTimeout(r, 300));
    }
    return { state: this._authState, error: "Timeout" };
  }

  disconnect(): void {
    this._clearAllTimers();
    this._isMonitoring = false;
    this._authState    = "idle";
    this._phone        = "";
    this._entityCache.clear();
    this._processedMsgIds.clear();
    this.resolveCode     = null;
    this.resolvePassword = null;
    this.authPromise     = null;
    this.client?.disconnect();
    this.client = null;
    try { if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE); } catch (_) {}
  }

  // ── Monitoring ────────────────────────────────────────────────────────────

  async startMonitoring(): Promise<void> {
    if (!this.client || this._authState !== "authenticated") throw new Error("Not authenticated");
    if (this._isMonitoring) return;

    this.loadLastIds();

    // Fetch groups first
    await this.refreshGroups();

    // Periodic group-list refresh
    this._groupRefreshTimer = setInterval(() => void this.refreshGroups(), GROUP_REFRESH_INTERVAL_MS);

    // ── Real-time event handler ──────────────────────────────────────────
    this.messageHandler = async (event: any) => {
      this._eventsReceived++;

      try {
        const msg = event.message;
        if (!msg?.text || !msg?.id) return;

        const rawChatId  = event.chatId?.toString() ?? "";
        const chatIdStr  = this.resolveGroupKey(rawChatId);

        if (!chatIdStr) {
          this._eventsMissedGroup++;
          // Log occasionally so we can diagnose ID mismatches
          if (this._eventsMissedGroup <= 5 || this._eventsMissedGroup % 100 === 0) {
            logger.debug(
              { rawChatId, totalMissed: this._eventsMissedGroup, knownGroups: Object.keys(this._groups).length },
              "Event chatId not in groups map",
            );
          }
          return;
        }

        this.updateLastSeen(chatIdStr, msg.id);

        // Build link synchronously from what we already know
        const bareId   = chatIdStr.replace(/^-100/, "");
        let link: string | null = null;
        try {
          const chat = await event.getChat();
          const username = chat?.username || (chat as any)?.usernames?.[0]?.username;
          link = username ? `https://t.me/${username}/${msg.id}` : `https://t.me/c/${bareId}/${msg.id}`;
        } catch (_) {
          link = `https://t.me/c/${bareId}/${msg.id}`;
        }

        await this.processMessage({
          msgId:      msg.id,
          chatIdStr,
          text:       msg.text,
          noforwards: !!(msg as any).noforwards,
          event,
          msg,
          link,
        });

      } catch (err) {
        logger.error({ err }, "Message handler error");
      }
    };

    this.client.addEventHandler(this.messageHandler, new NewMessage({}));
    this._isMonitoring = true;
    logger.info("Monitoring started");

    // ── Initial catch-up sweep (fetch recent messages missed before start) ─
    // Run after a short delay to let the event handler settle first
    setTimeout(() => void this.runCatchupSweep(), 5_000);

    // ── Periodic catch-up sweep ──────────────────────────────────────────
    this._catchupTimer = setInterval(() => void this.runCatchupSweep(), CATCHUP_INTERVAL_MS);

    // ── Auto-reconnect watchdog ──────────────────────────────────────────
    this._reconnectTimer = setInterval(async () => {
      if (!this._isMonitoring || !this.client) return;
      try {
        const ok = await this.client.checkAuthorization();
        if (!ok) throw new Error("Not authorized");
      } catch (err) {
        logger.warn({ err }, "Telegram connection lost — reconnecting…");
        try {
          await this.client.connect();
          if (this.messageHandler) {
            this.client.removeEventHandler(this.messageHandler, new NewMessage({}));
            this.client.addEventHandler(this.messageHandler, new NewMessage({}));
          }
          logger.info("Reconnected to Telegram");
          // Catch up on messages missed during disconnect
          setTimeout(() => void this.runCatchupSweep(), 2_000);
        } catch (reconnErr) {
          logger.error({ reconnErr }, "Reconnect failed — will retry in 30 s");
        }
      }
    }, RECONNECT_INTERVAL_MS);
  }

  async stopMonitoring(): Promise<void> {
    this._clearCatchupTimers();
    if (!this.client) return;
    if (this.messageHandler) {
      this.client.removeEventHandler(this.messageHandler, new NewMessage({}));
      this.messageHandler = null;
    }
    this._isMonitoring = false;
    this.saveLastIds();
    logger.info("Monitoring stopped");
  }

  // ── Timer helpers ─────────────────────────────────────────────────────────

  private _clearCatchupTimers(): void {
    if (this._reconnectTimer)    { clearInterval(this._reconnectTimer);    this._reconnectTimer    = null; }
    if (this._groupRefreshTimer) { clearInterval(this._groupRefreshTimer); this._groupRefreshTimer = null; }
    if (this._catchupTimer)      { clearInterval(this._catchupTimer);      this._catchupTimer      = null; }
  }

  private _clearAllTimers(): void {
    this._clearCatchupTimers();
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  get isAuthenticated() { return this._authState === "authenticated"; }
  get authState()       { return this._authState; }
}

export const telegramService = new TelegramService();
