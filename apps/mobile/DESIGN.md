# Mobil tasarım notları

Gerçek yol: `apps/mobile` (depo kökü `twobytes`). Uygulamanın görünen adı `app.json` içinde "Güvenlik Haritası". "HatGüven" adı depoda yalnızca Supabase proje adı olarak geçiyor, uygulama adı değiştirilmedi.

## Hedef kitle ve amaç
Dışarıda, çoğu zaman stresli bir anda telefonla bildirim yapan veya bir bildirimin sonucunu takip eden kadınlar. Ekran tek elle, hızlı ve sakin kullanılabilmeli. Ana eylem her ekranda tek ve belirgin olmalı.

## Yön
"Mürekkep Moru". Açık lavanta zemin, koyu mor mürekkep metin, tek mor vurgu. Sakin, okunaklı ve kompakt. Görsel öğe: yoğunluk bantları açıktan koyuya üç mor tondur. Bant her yerde metin etiketiyle birlikte gösterilir, anlam yalnızca renkte değildir.

## Ana kararlar
- **Sayfa başlığını yerel gezinme çubuğu taşır.** Büyük koyu başlık şeridi kaldırıldı. Başlık, iOS güvenli alanı ve durum çubuğu (koyu yazı, lavanta zemin) böylece sistem tarafından yönetilir. Ekran içinde yalnızca tek satırlık kısa bir açıklama durur.
- **Tek sekme çubuğu bileşeni** (`app-tab-bar.tsx`). Beş sekme aynı boyutta ve aynı biçimdedir. Seçili sekme açık mor zemin (`selected`), mor kalın yazı ve erişilebilir `selected` durumuyla ayrılır. Alt güvenli alan çubuğa eklenir. Sekmeler yalnızca metin taşır, simge paketi eklenmedi.
- Tek sütun, 16 kenar boşluğu. Bölümler arası 24, ilişkili öğeler arası 8. Geniş ekranda içerik 640 genişliğe sınırlanır.
- Etiketler alanların üstünde. Odak halkası koyu mürekkep (`focus`), 2 kalınlık. Hata, başarı ve bilgi kutuları renge ek olarak "Hata", "Başarılı", "Bilgi" etiketi taşır.
- Sistem yazı tipi. Animasyon yok.

### Harita ekranı (liste öncelikli)
Sıra: kısa "Harita" başlığı (gezinme çubuğu), küçük etkileşimli harita kartı, "Bölgeler" başlığı ve altında dönem ile birim, sakin bölge satırları. En altta, kaydırma alanının dışında, sekme çubuğundan ayrı yüzen işlem kartı.
- Harita kartı pencerenin yaklaşık %28'i (en az 190, en çok 280). İlk açılışta altındaki listenin birkaç satırı görünür. Harita sağlayıcısının atıf yazısı haritanın içinde kalır, üzerine hiçbir öğe konmadı.
- Derinlik: önce yüzey rengi, ince kenarlık ve boşluk. Harita kartı ve alt işlem kartı mor-gri tonlu (`#3B2A66`), düşük opaklıklı gölge alır (`elevation`, `src/theme.ts`). Gölge dış kapsayıcıda (arka planlı), yuvarlatma ve kırpma iç kapsayıcıdadır (`DensityMap`). iOS `shadow*`, Android `elevation` kullanır.
- Bölgeler haritada renkli alan olarak çizilir, ortasında bant etiketi durur. **Yetersiz veri** gri, kesik çizgili ve etiketlidir.
- Bölge satırı: ad solda, sağda bant işareti ve metin (`5–9`, `10–19`, `20+`, `Yetersiz veri`). Üç mor ton dolu kutu, Yetersiz veri içi boş gri kesik çizgili nötr kutudur. Satır beyaz ve ince kenarlıklıdır. **Seçili satır** açık lavanta (`selected`) zeminli, ince mor (`action`) kenarlıklı ve `selected` erişilebilir durumludur. Haritadan veya listeden seçim ikisini birlikte vurgular. Ayrı lejant kaldırıldı, her satır işaret ve metni kendisi taşır.
- **Seçili bölgede bildir** düğmesi alt kartta, parmakla rahat erişilen yerdedir. Bölge seçilmeyince pasiftir ve kartta "Önce haritadan veya listeden bir bölge seçin." yazar. Seçilince bölgenin adı ve bandı yazılır, düğme ana renge döner. Düğme bölgenin ortasını (`centroidOf`, Bildir'deki "Bölgeden seç" ile aynı hesap) `lat`, `lng`, `area`, `n` parametreleriyle Bildir'e taşır. Bildir parametreleri doğrular (sayı ve aralık), konumu yerleştirir ve "yaklaşık yer" notu gösterir. Kullanıcı konumu orada değiştirebilir, gönderim doğrulaması aynıdır.
- Alt kart sekme çubuğundan lavanta boşluk, gölge ve kenarlıkla ayrılır. Liste kaydırma alanının içinde, alt kart dışındadır: son satırı kapatmaz.
- Hiç bölge yoksa nedeni yazılır ve **Yenile** düğmesi çıkar.

### Bildir ekranı
Sıra: 1 Yer, 2 Zaman, 3 Ek bilgi, gönder. Açıklama ve fotoğrafın isteğe bağlı olduğu yalnızca ekranın açıklama satırında bir kez söylenir.
- **Harita–sayfa kaydırma çakışması çözüldü.** Sayfada yalnızca dokunulmaz, küçük bir harita önizlemesi durur. **Haritada yer seç** tam ekran bir harita penceresi açar: dokununca işaretçi taşınır, **Bu yeri seç** ile onaylanır, **Vazgeç** ile kapanır. Böylece harita sayfayı kaydırmayı engellemez.
- **Bölgeden seçme** alternatifi, yer kartında düğmenin hemen altında, her zaman görünür ("Ya da bölgeden seçin"). Bölgenin ortası yaklaşık konum olarak alınır. Liste harita ucundan gelir. Gelmezse harita seçimi tek başına çalışır.
- Konum izni istenmez ve cihazın konumu kullanılmaz. Seçilen koordinat metin olarak da yazılır.
- Zaman, iOS'ta sistem tarih-saat seçicisiyle (kompakt görünüm) seçilir. Seçici İstanbul saat dilimine ayarlıdır. Seçiciye sınır verilmez, geçersiz zamanın nedeni alanın altında yazılır.
- **Gönder düğmesinin hemen üstünde** "Göndermek için eksik:" kutusu eksik alanı açıkça yazar (ör. "Yer seçilmedi."). Hata olduğunda hata kutusu, teknik ayrıntı ve "girdiğiniz bilgiler korundu" notu aynı yerde çıkar, düğme **Tekrar dene** olur.
- Başarıda takip kodu koyu panelde iri ve seçilebilir gösterilir. **Kodu kopyala veya paylaş** ana eylemdir (sistem paylaşım sayfası). **Takip sekmesine git** ve **Yeni bildirim** ikincil düğmelerdir.

### Takip ekranı
- Başlık alanı kısa. Kod alanı ve **Durumu göster** düğmesi ekranın en üstünde bir arada durur. Kodun biçimlendirme ve doğrulama davranışı (büyük harf, otomatik düzeltme kapalı, arama tuşuyla sorgu) aynı.
- **Bekleme:** düğme "Durumu göster…" olur ve altında "Durum sorgulanıyor" yazar. **Hatalı kod:** hata, alanın hemen altında "Hata:" etiketiyle yazılır, alan kırmızı kenarlıklı olur, kod korunur. **Ağ hatası:** bildirim kutusunda teknik ayrıntıyla.
- **Sonuç:** renkli durum bloğu (kurum adı, durum, üç aşamalı durum izi) ve altında önlem ayrıntıları. İncelemede koyu mürekkep, Önlem planlandı mor, Tamamlandı yeşil. Anlam renkte değil, metinde ve ekran okuyucunun okuduğu cümlededir.

### Karne ekranı
- Tarih aralığı açıklama satırında tek bakışta durur.
- Her kurum kartında tamamlanan ve toplam önlem büyük yazıyla (`1 / 2`), yüzde etiketi ve kalın ilerleme çubuğu var. Rakamlar sabit genişlikli. Kart ekran okuyucuya "N önlemden M tanesi tamamlandı, yüzde X" diye okunur.
- **"Bu dönemde önlem kaydı yok"** ayrı, kesik kenarlıklı sade bir kartta gösterilir: oran ve çubuk yoktur.

### Bağlantı ekranı
- **Bağlantıyı dene** ve **Test bildirimi gönder** ayrı kutulardır. İlki beyaz kartta **Veri yazmaz** etiketiyle, ikincisi kesik kenarlıklı ve açık mor zeminli kutuda **Veri yazar** etiketiyle durur. Test bildiriminin ortak veritabanına yazdığı ve kurum panelinde görünebileceği düğmenin üstünde de yazılıdır.
- Tasarım doğrulanırken yalnızca canlı veri yazmayan bağlantı kontrolü kullanıldı.

### Fotoğraf
- Tek fotoğraf, isteğe bağlı. Kütüphaneden seçilir. Kamera eklenmedi, kamera izni gerekmez.
- En uzun kenar 2048 piksele küçültülür ve JPEG olarak yeniden kodlanır. Önizleme, "Başka fotoğraf seç" ve "Fotoğrafı kaldır" düğmeleri var. Gönderim sırasında düğmeler kapalıdır.
- Fotoğraf hatası, fotoğraf olmayan hatadan ayrı bir metinle gösterilir ve tekrar denemenin güvenli olduğunu söyler.

## Değerler
Kaynak: `src/theme.ts`.

| Rol | Değer |
| --- | --- |
| Zemin (`canvas`) | `#F6F4FA` |
| Kart ve giriş alanı (`surface`) | `#FFFFFF` |
| Ana metin ve başlık (`text`) | `#241A38` |
| Ana düğme ve etkin kontroller (`action`) | `#5B36A3` |
| Ana düğme metni (`onAction`) | `#FFFFFF` |
| Seçili sekme ve seçili satır zemini (`selected`) | `#EAE0F8` |
| Soluk metin (`muted`) | `#5C5470` |
| Kontrol kenarı (`border`) | `#857D9B` |
| İnce ayırıcı (`hairline`) | `#DDD7E8` |
| Bant 5–9, 10–19, 20+ | `#9B7FDB`, `#7048C0`, `#3F2380` |
| Yetersiz veri (`insufficient`) | `#7F7B8C` |
| Hata, başarı | `#9C2525`, `#245D32` |

Yazı ölçeği 13, 16, 20, 25 ve yalnızca karne sayısı için 39. Boşluk 4, 8, 16, 24, 32 ve 48. İki köşe yarıçapı: 8 ve 12. En küçük dokunma hedefi 48.

## Kontrol edildi
- Tip kontrolü (`npm run typecheck`) hatasız. iOS paketi derlendi (`expo export --platform ios`, 1201 modül).
- Kontrast WCAG göreli parlaklık formülüyle hesaplandı: ana metin/zemin 15,03:1, ikincil metin/zemin 6,51:1, ikincil metin/seçili zemin 5,59:1, buton metni/buton 8,40:1, seçili sekme metni/seçili zemin 6,60:1, kontrol kenarı/kart 3,89:1, kontrol kenarı/zemin 3,56:1, bantlar/kart 3,25:1, 6,22:1 ve 11,91:1, ardışık bantlar arası 1,91:1 ve 1,92:1, yetersiz veri/kart 4,11:1, hata ve başarı metinleri 6,82:1 ve 6,94:1. Ölçüm aracıyla doğrulanmadı.
- Zaman kuralları üç saat diliminde (İstanbul, Los Angeles, Tokyo) Node'da denendi. Multipart isteğinin yapısı sahte `fetch` ve `FormData` ile denendi. Bölge ortası hesabı gerçek `GET /api/map` yanıtıyla denendi.
- Telefonda (iPhone, Expo Go) Bağlantı, Harita ve Karne ekranları açıldı ve test bildirimi gönderildi. Bu, önceki arayüzle yapılan testtir.

## Henüz doğrulanmadı
- **Yeni arayüzün hiçbir ekranı için ekran görüntüsü incelemesi yapılmadı.** Simülatör ve tarayıcı aracı yoktu, telefon ekranı görülemedi. Yönergede istenen görsel inceleme eksik.
- Ekte verilen ekran görüntüleri bu oturuma ulaşmadı, mevcut arayüz görüntülerle incelenmedi.
- **Mavi dişli simgesi.** Uygulama kodunda dişli, ayar veya benzeri bir simge yok (`src` ve `app.json` içinde arandı). Büyük olasılıkla Expo Go'nun geliştirme araçları düğmesidir ve yalnızca geliştirme sırasında görünür. Bu doğrulanmadı. Öyleyse uygulama bileşeni değildir ve yayın derlemesinde bulunmaz. Geliştirme sırasında içerikle çakışıyorsa Expo Go menüsünden gizlenebilir.
- Tam ekran harita penceresi (açılış, işaretçi, **Bu yeri seç**, **Vazgeç**, Android geri düğmesi) cihazda denenmedi. Küçük önizlemenin `region` ile işaretçiyi doğru gösterip göstermediği görülmedi.
- Özel sekme çubuğunun cihazda görünümü ve `tab` / `selected` rollerinin ekran okuyucuda duyurulması denenmedi. 320 genişlikte beş etiketin sığması ve %200 yazı boyutunda küçülen etiketler görülmedi.
- Haritadaki bant etiketlerinin (özel işaretçi) bölgeyle çakışması, Android görünümü ve harita sağlayıcısı atıf yazısının görünürlüğü cihazda doğrulanmadı.
- Klavye açıkken Takip ve Bildir formlarının kaydırılması, iOS'ta `automaticallyAdjustKeyboardInsets` ile Android'de yeniden boyutlandırma cihazda denenmedi.
- Fotoğraflı gönderim (Barış'ın `EXPO_PUBLIC_USE_RN_FETCH=1` düzeltmesiyle) gerçek sunucuda denenmedi.
- Paylaşım sayfası, odak halkası ve bölge listesinin VoiceOver ve TalkBack okuması denenmedi.
- Lint çalıştırılamadı: projede ESLint ve yapılandırma dosyası yok. Otomatik test komutu da yok, yalnızca tip kontrolü var.
