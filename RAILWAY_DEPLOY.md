# نشر TG Monitor على Railway

## الخطوات

### 1. رفع الملفات على GitHub
أنشئ repository جديد على GitHub وارفع محتوى هذا الـ zip إليه.

### 2. إنشاء مشروع Railway
- اذهب إلى [railway.app](https://railway.app)
- اضغط **New Project → Deploy from GitHub repo**
- اختر الـ repository الذي أنشأته

### 3. إعداد المتغيرات البيئية
في لوحة Railway → **Variables** أضف:

| المتغير | القيمة | ملاحظة |
|---|---|---|
| `SESSION_SECRET` | نص عشوائي طويل (32+ حرف) | **مطلوب** — يُستخدم لتوقيع الكوكيز. بدونه تُبطل الجلسات عند كل restart |
| `DASHBOARD_PASSWORD` | كلمة مرور من اختيارك | **مطلوب** — يحمي الداشبورد |

> ملاحظة: `PORT` يُضبط تلقائياً من Railway، لا تضفه يدوياً.

### 4. إضافة Railway Volume (مهم جداً)
بدون Volume تُفقد جلسة Telegram والكلمات المفتاحية والنتائج عند كل إعادة نشر.

- في لوحة Railway → **Volumes** → **New Volume**
- اضبط **Mount Path** على: `/root`
- حجم 1 GB يكفي للبداية

هذا يحفظ الملفات التالية بين عمليات النشر:
```
/root/.tg-monitor-session       ← جلسة Telegram (تجنّب إعادة التسجيل)
/root/.tg-monitor-keywords.json ← الكلمات المفتاحية
/root/.tg-monitor-results.json  ← النتائج المحفوظة
/root/.tg-monitor-bot.json      ← إعدادات بوت التنبيه
/root/.tg-monitor-lastids.json  ← آخر رسائل تمت معالجتها
```

### 5. النشر
Railway سيكتشف الـ `Dockerfile` تلقائياً ويبدأ البناء والتشغيل.
بعد اكتمال البناء، ستحصل على رابط عام للتطبيق.

## أول استخدام بعد النشر
1. افتح رابط التطبيق
2. أدخل `DASHBOARD_PASSWORD` التي ضبطتها
3. أدخل **API_ID** و **API_HASH** من [my.telegram.org](https://my.telegram.org)
4. اتبع خطوات الـ wizard لتسجيل الدخول بحسابك

## استكشاف الأخطاء

### Health Check يفشل
تأكد أن `SESSION_SECRET` و `DASHBOARD_PASSWORD` مضبوطان في Variables.

### يطلب إعادة تسجيل الدخول لـ Telegram بعد كل نشر
هذا يعني أن Railway Volume غير مضبوط أو مسار التثبيت خاطئ.
تأكد أن Mount Path = `/root`.

### الكوكيز لا تعمل بعد restart
تأكد أن `SESSION_SECRET` لا يتغير بين عمليات النشر.
