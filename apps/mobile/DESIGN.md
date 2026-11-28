# Mobil tasarım notları

## Hedef kitle ve amaç
Dışarıda, çoğu zaman stresli bir anda telefonla bildirim yapan veya bir bildirimin sonucunu takip eden kadınlar. Ekran tek elle, hızlı ve sakin kullanılabilmeli. Ana eylem her ekranda tek ve belirgin olmalı.

## Yön
"Transit Board". Açık gri-mavi zemin, koyu lacivert yazı, petrol yeşili vurgu. Kamu hizmeti ve güven duygusu verir. Görsel öğe: yoğunluk bantları hizalı satırlardır. Bant uzunluğu ve metin etiketi birlikte anlam taşır, anlam yalnızca renkte değildir.

## Ana kararlar
- Tek sütun, 16 px kenar boşluğu. Etiketler alanların üstünde.
- Sekmeler yalnızca metin etiketi taşır (Harita, Bildir, Takip, Karne, Bağlantı). Simge paketi eklenmedi.
- Sistem yazı tipi. Ek font indirilmedi.
- Hata, başarı ve bilgi kutuları renge ek olarak "Hata", "Başarılı", "Bilgi" etiketi taşır.
- Kapalı düğmenin nedeni düğmenin altında yazılır.
- Animasyon yok. Azaltılmış hareket ayarı ek iş gerektirmiyor.

### Bildir ekranı
- Sıra: yer, zaman, açıklama, gönder. Gönder düğmesi en altta ve tek birincil eylem.
- Konum haritaya dokunarak seçilir, işaretçi son dokunulan yere taşınır. Konum izni istenmez ve cihazın konumu kullanılmaz.
- Seçilen koordinat haritanın altında metin olarak da yazılır. Harita yalnızca dokunmayla kullanılabildiği için bu metin ekran okuyucuya durumu bildirir.
- Zaman, iOS'ta sistem tarih-saat seçicisiyle (kompakt görünüm) seçilir. Seçici İstanbul saat dilimine ayarlıdır ve altında seçilen zaman metinle yazılır.
- Seçiciye en küçük ve en büyük tarih sınırı verilmez. Böylece geçersiz bir zaman seçilebilir ve neden alanın altında görünür: gelecek veya bir yıldan eski.
- Gönderim kapalıyken neden düğmenin altında yazılır ("Haritadan konum seçince gönderim açılır.").
- Hata durumunda girilenler korunur. "Tekrar dene" aynı gönderimi tekrar eder ve tek kayıt oluşur.
- Başarıda takip kodu büyük ve seçilebilir metin olarak gösterilir. Kod kopyalama düğmesi yok, uzun basılarak kopyalanır.

### Harita ekranı
- Bölgeler renkli alan olarak çizilir. Renk koyulaştıkça yoğunluk artar. **Yetersiz veri** bölgesi açık gri ve kesik çizgilidir.
- Lejant haritanın üstünde, kartta durur: başlık, veri dönemi ve dört bant. Her bantın yanında renk örneği ve metin etiketi var.
- Bölgeye dokunmak seçer. Seçili bölge haritada kalın çerçeveli, listede kalın kenarlıdır ve adı ile bandı metinle yazılır.
- Altındaki liste haritanın erişilebilir karşılığıdır. Her satır adı ve bandı metinle taşır.

### Fotoğraf
- Tek fotoğraf, isteğe bağlı. Kütüphaneden seçilir. Kamera eklenmedi, bu yüzden kamera izni gerekmez.
- Seçilen fotoğraf en uzun kenarı 2048 piksele küçültülür ve JPEG olarak yeniden kodlanır. Böylece HEIC gibi biçimler sunucunun kabul ettiği JPEG'e dönüşür ve boyut sınırı aşılmaz.
- Önizleme, "Başka fotoğraf seç" ve "Fotoğrafı kaldır" düğmeleri var. Gönderim sırasında düğmeler kapalıdır.
- Fotoğraf hatası, fotoğraf olmayan hatadan ayrı bir metinle gösterilir ve tekrar denemenin güvenli olduğunu söyler.

## Değerler
Kaynak: `src/theme.ts`.

| Rol | Değer |
| --- | --- |
| Zemin (`canvas`) | `#F4F7F9` |
| Yüzey (`surface`) | `#FFFFFF` |
| Metin (`text`) | `#142C3D` |
| Soluk metin (`muted`) | `#4A5F6E` |
| Kontrol kenarı (`border`) | `#7A8E9C` |
| Vurgu (`action`) | `#005C72` |
| Hata (`error`) | `#9C2525` |
| Başarı (`success`) | `#245D32` |

Yazı ölçeği 13, 16, 20 ve 25. Boşluk 4, 8, 16, 24, 32 ve 48. İki köşe yarıçapı: 8 ve 12. En küçük dokunma hedefi 48.

## Kontrol edildi
- Tip kontrolü (`npm run typecheck`) hatasız.
- `npx expo-doctor` 20 kontrolün hepsini geçti.
- `npx expo install --check` paketlerin SDK ile uyumlu olduğunu gösterdi.
- iOS paketi derlendi (`npx expo export --platform ios`).
- Zaman kuralları (`src/lib/event-time.ts`) üç farklı cihaz saat diliminde (İstanbul, Los Angeles, Tokyo) Node'da denendi: İstanbul saati biçimi, `+03:00` ofsetli ISO, gelecek ve bir yıldan eski zaman, 365 gün sınırı.
- Multipart isteğinin yapısı Node'da sahte `fetch` ve `FormData` ile denendi: alan adları sunucunun listesiyle aynı, her alan bir kez, `Content-Type` başlığı yazılmıyor, açıklama boşsa alan eklenmiyor, fotoğraflı 400, 413 ve 503 hataları Türkçe metne çevriliyor.
- Harita yardımcıları (`[boylam, enlem]` çevirisi, başlangıç bölgesi, renk saydamlığı) birim testlerinden ve Barış'ın sunucusundan alınmış gerçek harita yanıtından geçti.
- Renk çiftlerinin kontrastı hesapla belirlendi, ölçüm aracıyla doğrulanmadı.
- Telefonda (iPhone, Expo Go) Bağlantı, Harita ve Karne ekranları açıldı ve test bildirimi gönderildi.

## Henüz doğrulanmadı
- Bildir ekranı (harita seçimi, tarih-saat seçici, gönderim) bir cihazda veya simülatörde görülmedi. Ekran görüntüsü incelemesi yapılmadı.
- Fotoğraf seçimi, önizleme ve fotoğraflı gönderim gerçek sunucuyla ve cihazda denenmedi. `:3187` adresinde Storage olmadığı için fotoğraflı gönderim yalnızca `:3000` adresinde denenebilir.
- Harita ekranındaki renkli alanların ve lejantın görünümü cihazda görülmedi.
- iOS kompakt tarih-saat seçicisinin dokunma hedefi 44 pt'ten küçük olabilir. Cihazda ölçülmedi.
- Android'de iki adımlı seçici (önce tarih, sonra saat) yazıldı ama denenmedi.
- Harita ekran okuyucuyla kullanılamaz. Konum seçimi dokunma gerektirir. Alternatif bir yol (ör. bölge merkezlerinden seçim) eklenmedi.
- 320 px genişlik, %200 yazı boyutu ve ekran okuyucu denenmedi.
