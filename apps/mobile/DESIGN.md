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
- iOS paketi derlendi (`npx expo export --platform ios`).
- Renk çiftlerinin kontrastı hesapla belirlendi, ölçüm aracıyla doğrulanmadı.

## Henüz doğrulanmadı
- Ekranlar bir cihazda veya simülatörde görülmedi. Ekran görüntüsü incelemesi yapılmadı.
- 320 px genişlik, %200 yazı boyutu ve ekran okuyucu denenmedi.
- Hata ve boş durumlar gerçek cihazda denenmedi.
