import fs from "fs";
import path from "path";
import os from "os";
import { logger } from "./logger.js";

const BOT_FILE = path.join(os.homedir(), ".tg-monitor-bot.json");

interface BotConfig {
  botToken: string;
  chatId: string;
}

class BotStore {
  private _config: BotConfig = { botToken: "", chatId: "" };

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(BOT_FILE)) {
        const raw = JSON.parse(fs.readFileSync(BOT_FILE, "utf-8"));
        this._config = {
          botToken: raw.botToken || "",
          chatId: raw.chatId || "",
        };
        logger.info("Bot config loaded");
      }
    } catch (err) {
      logger.warn({ err }, "Failed to load bot config");
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(BOT_FILE, JSON.stringify(this._config), "utf-8");
    } catch (err) {
      logger.warn({ err }, "Failed to save bot config");
    }
  }

  getConfig(): BotConfig {
    return { ...this._config };
  }

  setConfig(botToken: string, chatId: string): void {
    this._config = { botToken: botToken.trim(), chatId: chatId.trim() };
    this.save();
  }

  get isConfigured(): boolean {
    return !!(this._config.botToken && this._config.chatId);
  }
}

export const botStore = new BotStore();
