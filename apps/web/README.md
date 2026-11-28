# Güvenlik Haritası kurum paneli ve API

Kurum paneli `/kurum` adresinde açılır. Mobil uygulamanın bildirim, yoğunluk haritası, takip kodu ve karne uçları da bu Next.js uygulamasındadır.

Supabase kurulumu, örnek kurum hesapları ve API sözleşmesi için [depo README’sine](../../README.md) bakın. Ortam değişkenlerini `.env.example` üzerinden `.env.local` dosyasına ekleyin.

```bash
npm ci
npm run dev
```

Uygulama varsayılan olarak `http://localhost:3000` adresinde çalışır. Fotoğrafsız bildirim ve ağ tekrarı için ayrı bir terminalde `./scripts/smoke-report.sh` çalıştırın.
