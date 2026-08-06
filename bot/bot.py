#!/usr/bin/env python3
"""
TG Monitor — Python Bot Notifier
يعمل poll على API الخادم المحلي ويرسل التنبيهات عبر Telegram Bot API.
"""

import html
import json
import os
import time
import urllib.request
import urllib.parse
import urllib.error

API_BASE = "http://localhost:{}/api".format(os.environ.get("PORT", "5000"))
STATE_FILE = os.path.expanduser("~/.tg-monitor-bot-state.json")
POLL_INTERVAL = 2   # ثانية بين كل poll
STARTUP_DELAY = 8   # انتظر حتى يبدأ سيرفر Node.js


# ── State ──────────────────────────────────────────────────────────────────

def load_state() -> dict:
    try:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return {"last_id": None, "was_monitoring": None}


def save_state(state: dict):
    try:
        with open(STATE_FILE, "w") as f:
            json.dump(state, f)
    except Exception:
        pass


# ── API helpers ────────────────────────────────────────────────────────────

def api_get(path: str, params: dict | None = None):
    url = f"{API_BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read().decode())
    except Exception:
        return None


def bot_send(token: str, chat_id: str, text: str):
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    body = json.dumps({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": False,
    }).encode()
    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body_err = e.read().decode()
        print(f"[bot] HTTP {e.code}: {body_err}", flush=True)
    except Exception as e:
        print(f"[bot] Send error: {e}", flush=True)
    return None


# ── Message formatters ─────────────────────────────────────────────────────

def e(text: str) -> str:
    """HTML-escape a plain-text value before embedding it in an HTML Telegram message."""
    return html.escape(str(text), quote=False)


def format_result(r: dict) -> str:
    keywords      = " | ".join(f"<code>{e(k)}</code>" for k in r.get("matchedKeywords", []))
    group         = e(r.get("groupName", "?"))
    sender        = e(r.get("senderName", "?"))
    username      = r.get("senderUsername")
    snippet       = e(r.get("snippet", "").strip())
    link          = r.get("messageLink")
    shared        = r.get("sharedGroups", [])
    shared_count  = r.get("sharedGroupsCount", len(shared))

    sender_display = f"@{e(username)}" if username else sender

    lines = [
        f"🔍 <b>كلمة مفتاحية:</b> {keywords}",
        f"💬 <b>المجموعة:</b> {group}",
        f"👤 <b>المرسل:</b> {sender_display}",
    ]

    # المجموعات المشتركة مع المرسل
    if shared_count > 0:
        shared_names = "\n".join(f"  • {e(name)}" for name in shared[:10])
        lines.append(
            f"👥 <b>مجموعات مشتركة مع المرسل ({shared_count}):</b>\n{shared_names}"
        )
        if shared_count > 10:
            lines.append(f"  <i>... و{shared_count - 10} أخرى</i>")
    else:
        lines.append("👥 <b>مجموعات مشتركة:</b> لا توجد")

    noforwards = r.get("noforwards", False)
    if noforwards:
        lines.append("🔒 <b>التحويل:</b> مقيّد")
    else:
        lines.append("✅ <b>التحويل:</b> مسموح")

    lines += [
        "",
        f"<blockquote>{snippet}</blockquote>",
    ]
    if link:
        lines.append(f'\n🔗 <a href="{link}">فتح الرسالة</a>')

    return "\n".join(lines)


def format_monitoring_started(status: dict) -> str:
    group_count   = status.get("groupCount", 0)
    active_kw     = status.get("activeKeywords", 0)
    phone         = status.get("phone", "")
    phone_display = f" (<code>{phone}</code>)" if phone else ""
    return (
        f"✅ <b>بدأت المراقبة{phone_display}</b>\n\n"
        f"📡 المجموعات المراقبة: <b>{group_count}</b>\n"
        f"🔑 الكلمات النشطة: <b>{active_kw}</b>\n\n"
        f"سيتم إشعارك فور اكتشاف أي كلمة مفتاحية."
    )


def format_monitoring_stopped() -> str:
    return (
        "🔴 <b>توقفت المراقبة</b>\n\n"
        "لن تصلك تنبيهات حتى تعيد تشغيل المراقبة من لوحة التحكم."
    )


# ── Main loop ──────────────────────────────────────────────────────────────

def main():
    print("[bot] TG Monitor Bot بدأ التشغيل...", flush=True)
    time.sleep(STARTUP_DELAY)

    state = load_state()

    # عند أول تشغيل: ضبط last_id على أحدث رسالة لتجنب إغراق المحادثة
    if state["last_id"] is None:
        initial = api_get("/results", {"limit": "1"})
        if initial and len(initial) > 0:
            state["last_id"] = initial[0]["id"]
            save_state(state)
            print(f"[bot] أول تشغيل — بدء المتابعة من ID: {state['last_id']}", flush=True)

    while True:
        try:
            # جلب إعدادات البوت
            config = api_get("/bot")
            if not config or not config.get("botToken") or not config.get("chatId"):
                print("[bot] البوت غير مُعدّ بعد، في انتظار الإعداد...", flush=True)
                time.sleep(10)
                continue

            token   = config["botToken"]
            chat_id = config["chatId"]

            # ── تتبع تغيير حالة المراقبة ─────────────────────────────────
            tg_status = api_get("/telegram/status")
            if tg_status is not None:
                is_monitoring  = tg_status.get("isMonitoring", False)
                was_monitoring = state.get("was_monitoring")

                if was_monitoring is False and is_monitoring is True:
                    msg  = format_monitoring_started(tg_status)
                    resp = bot_send(token, chat_id, msg)
                    if resp and resp.get("ok"):
                        print("[bot] ✅ أُرسل إشعار بدء المراقبة", flush=True)

                elif was_monitoring is True and is_monitoring is False:
                    msg  = format_monitoring_stopped()
                    resp = bot_send(token, chat_id, msg)
                    if resp and resp.get("ok"):
                        print("[bot] 🔴 أُرسل إشعار إيقاف المراقبة", flush=True)

                if was_monitoring != is_monitoring:
                    state["was_monitoring"] = is_monitoring
                    save_state(state)

            # ── جلب النتائج الجديدة وإرسالها ──────────────────────────────
            # لا نستخدم enrichedOnly حتى لا نتخطى رسائل غير مكتملة الإثراء
            params = {}
            if state["last_id"]:
                params["since"] = state["last_id"]

            results = api_get("/results", params if params else None)
            if results is None:
                time.sleep(POLL_INTERVAL)
                continue

            for result in reversed(results):
                msg = format_result(result)
                sent = False
                for attempt in range(3):          # حاول 3 مرات عند الفشل
                    resp = bot_send(token, chat_id, msg)
                    if resp and resp.get("ok"):
                        print(f"[bot] ✅ أُرسلت: {result.get('matchedKeywords')}", flush=True)
                        sent = True
                        break
                    if attempt < 2:
                        time.sleep(2 ** attempt)  # exponential backoff: 1s ثم 2s

                if sent:
                    # تحديث last_id فقط عند النجاح لتجنب ضياع رسائل صامت
                    state["last_id"] = result["id"]
                    save_state(state)
                else:
                    print(f"[bot] ❌ فشل إرسال النتيجة بعد 3 محاولات: {result.get('id')} — سيُعاد المحاولة في الدورة القادمة", flush=True)
                    # لا نتقدم في last_id — سيُعاد إرسالها في الدورة التالية
                    break

        except Exception as e:
            print(f"[bot] خطأ: {e}", flush=True)

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
