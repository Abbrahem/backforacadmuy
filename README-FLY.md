# نشر الباك اند على Fly.io

## المتطلبات الأساسية

1. **تثبيت Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **تسجيل الدخول:**
   ```bash
   fly auth login
   ```

## خطوات النشر

### الطريقة الأولى: استخدام سكريبت النشر (الأسهل)

```bash
# جعل السكريبت قابل للتنفيذ
chmod +x deploy-fly.sh

# تشغيل سكريبت النشر
./deploy-fly.sh
```

### الطريقة الثانية: النشر اليدوي

1. **إنشاء التطبيق:**
   ```bash
   fly apps create areeb-backend --org personal
   ```

2. **تعيين المتغيرات البيئية:**
   ```bash
   # إذا كان لديك ملف .env
   fly secrets set $(cat .env | grep -v '^#' | xargs)
   
   # أو تعيين كل متغير على حدة
   fly secrets set MONGODB_URI="your_mongodb_uri"
   fly secrets set JWT_SECRET="your_jwt_secret"
   fly secrets set CLOUDINARY_CLOUD_NAME="your_cloudinary_name"
   fly secrets set CLOUDINARY_API_KEY="your_cloudinary_key"
   fly secrets set CLOUDINARY_API_SECRET="your_cloudinary_secret"
   ```

3. **النشر:**
   ```bash
   fly deploy
   ```

## إدارة التطبيق

### عرض معلومات التطبيق
```bash
fly status
```

### عرض السجلات
```bash
fly logs
```

### إعادة تشغيل التطبيق
```bash
fly apps restart areeb-backend
```

### حذف التطبيق
```bash
fly apps destroy areeb-backend
```

## المتغيرات البيئية المطلوبة

تأكد من تعيين المتغيرات التالية:

- `MONGODB_URI`: رابط قاعدة البيانات
- `JWT_SECRET`: مفتاح التوقيع للـ JWT
- `CLOUDINARY_CLOUD_NAME`: اسم حساب Cloudinary
- `CLOUDINARY_API_KEY`: مفتاح API لـ Cloudinary
- `CLOUDINARY_API_SECRET`: السر لـ Cloudinary
- `NODE_ENV`: بيئة التشغيل (production)

## استكشاف الأخطاء

### فحص حالة التطبيق
```bash
fly status
```

### عرض السجلات المباشرة
```bash
fly logs --follow
```

### فحص الصحة
```bash
curl https://areeb-backend.fly.dev/health
```

### الوصول إلى التطبيق
```bash
fly ssh console
```

## ملاحظات مهمة

1. **المنطقة:** التطبيق سيتم نشره في منطقة `fra` (فرانكفورت)
2. **الذاكرة:** تم تعيين 512MB من الذاكرة
3. **الـ CPU:** تم تعيين 1 CPU مشترك
4. **الـ HTTPS:** مفعل تلقائياً
5. **الـ Auto-scaling:** مفعل (يتوقف عند عدم الاستخدام)

## الروابط المفيدة

- [Fly.io Documentation](https://fly.io/docs/)
- [Fly.io CLI Reference](https://fly.io/docs/flyctl/)
- [Node.js on Fly.io](https://fly.io/docs/languages-and-frameworks/node/) 