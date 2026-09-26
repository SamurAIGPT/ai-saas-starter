# 🎨 AIForge - منصة التطبيقات الذكية

منصة متكاملة لإنشاء واستخدام تطبيقات الذكاء الاصطناعي بسهولة وأمان.

## 🚀 الميزات الرئيسية

### 1. متجر التطبيقات المتكامل
- **20+ تطبيق ذكي** في مجالات متنوعة
- **بحث وتصفية متقدمة** حسب الفئة والكلمات المفتاحية
- **تقييمات وتعليقات** من المستخدمين
- **تثبيت فوري** بضغطة زر واحدة

### 2. لوحة تحكم Admin احترافية
- **إضافة تطبيقات جديدة** بسهولة
- **تحرير وحذف التطبيقات** الموجودة
- **إدارة الفئات** والتصنيفات
- **تحديث البيانات** والوصفات

### 3. نظام الرصيد المرن
- **شراء رصيد** عند الحاجة
- **دفع آمن** عبر PayPal
- **استهلاك ذكي** للرصيد
- **إحصائيات الاستخدام**

### 4. تصميم احترافي
- **الوضع الليلي** الأنيق
- **واجهة سهلة الاستخدام**
- **تجاوب كامل** على جميع الأجهزة
- **أداء سريع جداً**

### 5. التواصل الاجتماعي
- **أيقونات التواصل الاجتماعي** في Footer
- **روابط مباشرة** إلى حساباتك
- **مشاركة سهلة** للتطبيقات

## 📦 التثبيت والإعداد

### 1. المتطلبات
- Node.js 18+
- npm أو yarn
- قاعدة بيانات PostgreSQL
- حساب PayPal

### 2. التثبيت
```bash
# استنساخ المشروع
git clone <repository-url>
cd ai-saas-starter

# تثبيت الحزم
npm install

# توليد Prisma Client
npx prisma generate

# تشغيل الخادم
npm run dev
```

### 3. متغيرات البيئة
أنشئ ملف `.env.local`:

```env
# قاعدة البيانات
DATABASE_URL="postgresql://user:password@localhost:5432/aiforge"
DIRECT_URL="postgresql://user:password@localhost:5432/aiforge"

# المصادقة
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
ADMIN_EMAILS="admin@example.com"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# PayPal
NEXT_PUBLIC_PAYPAL_CLIENT_ID="your-paypal-client-id"
PAYPAL_CLIENT_SECRET="your-paypal-secret"
PAYPAL_WEBHOOK_ID="your-paypal-webhook-id"
PAYPAL_ENV="sandbox"
PAYPAL_API_BASE="https://api-m.sandbox.paypal.com"

# MuAPI
MUAPIAPP_API_KEY="your-muapi-key"
MUAPI_WEBHOOK_SECRET="replace_with_a_long_random_secret"
DOWNLOAD_ALLOWED_HOSTS="cdn.muapi.ai,cdn.muapi.com,images.unsplash.com"
```

بعد تحديث المخطط، راجع تنبيه قاعدة البيانات المشتركة في `README.md` ثم زامن نموذجي `PayPalOrder` و`PaymentEvent` مع قاعدة البيانات قبل استخدام الدفع. تحقق من Webhook PayPal يتطلب تسجيل Webhook ID الصحيح لدى PayPal.

## 🎯 الصفحات الرئيسية

### صفحة الهبوط (`/`)
- عرض شامل لمميزات المنصة
- أيقونات التطبيقات المميزة
- أزرار الـ CTA واضحة

### متجر التطبيقات (`/store`)
- بحث وتصفية متقدمة
- عرض التطبيقات المتاحة
- معلومات التطبيق الكاملة

### لوحة المستخدم (`/dashboard`)
- التطبيقات المثبتة
- الإحصائيات السريعة
- التطبيقات المقترحة

### لوحة التحكم (`/admin`) ⭐ جديد
- إدارة التطبيقات كاملة
- إضافة/تحديث/حذف التطبيقات
- البحث والتصفية المتقدمة

### صفحة التسعير (`/pricing`)
- خطط الشراء المختلفة
- أسعار واضحة
- خيارات الدفع

## 🔧 API Endpoints

### التطبيقات
```bash
GET    /api/apps              # جلب التطبيقات
POST   /api/apps              # إضافة تطبيق
PUT    /api/apps/[id]         # تحديث تطبيق
DELETE /api/apps/[id]         # حذف تطبيق
```

### الفئات
```bash
GET    /api/categories        # جلب الفئات
POST   /api/categories        # إضافة فئة
```

### التطبيقات المثبتة
```bash
GET    /api/installed-apps    # جلب التطبيقات المثبتة
```

## 🎨 التخصيص

### تغيير الأيقونات الاجتماعية
في `src/components/Footer.js`:
```javascript
const socialLinks = [
  { icon: FaTwitter, href: "YOUR_TWITTER_URL", label: "Twitter" },
  { icon: FaFacebook, href: "YOUR_FACEBOOK_URL", label: "Facebook" },
  // ...
];
```

### تغيير الألوان
في `src/app/globals.css`:
```css
@theme inline {
  --color-primary: #6366f1;
  --color-primary-hover: #4f46e5;
  /* ... */
}
```

### إضافة تطبيقات جديدة
1. توجّه إلى `/admin`
2. اضغط على "إضافة تطبيق"
3. ملء النموذج
4. احفظ التطبيق

## 📊 الهيكل المشروع

```
ai-saas-starter/
├── src/
│   ├── app/
│   │   ├── page.js              # صفحة الهبوط
│   │   ├── store/
│   │   │   └── page.js          # متجر التطبيقات
│   │   ├── dashboard/
│   │   │   └── page.js          # لوحة المستخدم
│   │   ├── admin/
│   │   │   └── page.js          # لوحة التحكم
│   │   ├── pricing/
│   │   │   └── page.js          # صفحة التسعير
│   │   ├── api/
│   │   │   ├── apps/            # API التطبيقات
│   │   │   ├── categories/       # API الفئات
│   │   │   └── installed-apps/   # API التطبيقات المثبتة
│   │   └── layout.js            # تخطيط الصفحات
│   ├── components/
│   │   ├── Navbar.js            # شريط التنقل
│   │   ├── Footer.js            # تذييل الصفحة
│   │   └── ...
│   └── lib/
│       ├── apps/
│       │   └── appRegistry.js   # سجل التطبيقات
│       ├── services/
│       │   ├── billing.js       # خدمة الدفع
│       │   └── paypal.js        # خدمة PayPal
│       └── ...
├── prisma/
│   ├── schema.prisma            # هيكل قاعدة البيانات
│   └── seed.js                  # إضافة البيانات الأولية
└── package.json
```

## 🚀 النشر

### على Vercel (الأسهل)
```bash
git push origin main
# سيتم النشر تلقائياً
```

### متطلبات الإنتاج
1. متغيرات البيئة محدثة
2. قاعدة بيانات PostgreSQL متقدمة
3. حساب PayPal نشط
4. Google OAuth مفعّل

## 📞 الدعم

- التوثيق الشاملة: اقرأ `FINAL_UPDATES.md`
- قائمة الاختبار: اقرأ `TEST_CHECKLIST.md`
- الأسئلة الشائعة: اسأل في Issues

## 🔐 الأمان

- ✅ مصادقة آمنة مع NextAuth
- ✅ تشفير كلمات المرور
- ✅ التحقق من صحة المدخلات
- ✅ حماية CSRF
- ✅ معايير الأمان الحديثة

## 📈 الأداء

- ⚡ وقت التحميل < 2 ثانية
- 🎯 Lighthouse Score > 90
- 📱 Mobile-First Design
- 🔄 Server-Side Caching

## 📄 الترخيص

MIT License - استخدم بحرية في مشاريعك التجارية

## 👨‍💻 المساهمة

نحن نرحب بمساهماتك! يرجى:
1. عمل Fork للمشروع
2. إنشاء فرع للميزة الجديدة
3. عمل Commit للتغييرات
4. عمل Push للفرع
5. فتح Pull Request

## 📞 التواصل

- 🐦 Twitter: [@aiforge](https://twitter.com/aiforge)
- 📘 Facebook: [AIForge](https://facebook.com/aiforge)
- 📷 Instagram: [@aiforge](https://instagram.com/aiforge)
- 💼 LinkedIn: [AIForge](https://linkedin.com/company/aiforge)
- 📺 YouTube: [AIForge](https://youtube.com/aiforge)
- 🐙 GitHub: [aiforge](https://github.com/aiforge)

---

**صُنع بـ ❤️ لمنصة الذكاء الاصطناعي**

© 2026 AIForge. جميع الحقوق محفوظة.
