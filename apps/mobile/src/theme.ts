// Tasarım değerleri. Renkler rol adıyla tutulur; palet değişirse yalnızca burası değişir.
// Palet: "Mürekkep Moru". Açık lavanta zemin, koyu mor mürekkep metin, tek mor vurgu.
//
// Kontrast (hesaplanan, WCAG göreli parlaklık):
//   text/canvas 15,03:1, text/surface 16,41:1, text/selected 12,90:1
//   muted/canvas 6,51:1, muted/surface 7,10:1, muted/selected 5,59:1
//   onAction/action 8,40:1, action/selected 6,60:1
//   border/surface 3,89:1 ve border/canvas 3,56:1 (kontrol kenarları için 3:1 şartı)
//   bandLow/surface 3,25:1, bandMid/surface 6,22:1, bandHigh/surface 11,91:1
//   bandLow/bandMid 1,91:1, bandMid/bandHigh 1,92:1 (ardışık bantlar ayırt edilir)
//   insufficient/surface 4,11:1, error/errorSurface 6,82:1, success/successSurface 6,94:1
// Bant yine de her yerde metin etiketiyle birlikte gösterilir.

export const colors = {
  canvas: "#F6F4FA",
  surface: "#FFFFFF",
  text: "#241A38",
  muted: "#5C5470",
  border: "#857D9B",
  hairline: "#DDD7E8",
  action: "#5B36A3",
  onAction: "#FFFFFF",
  // Seçili sekme ve seçili satır zemini.
  selected: "#EAE0F8",
  // Odak halkası: koyu mürekkep, mor kontroller ve beyaz alanlar üzerinde de görünür.
  focus: "#241A38",
  error: "#9C2525",
  errorSurface: "#FBEDED",
  success: "#245D32",
  successSurface: "#EAF4EC",
  infoSurface: "#EFEAF8",
  disabled: "#E6E2EE",
  onDisabled: "#5C5470",
  // Haftalık bildirim aralıkları: 5–9, 10–19, 20+. Açıktan koyuya.
  bandLow: "#9B7FDB",
  bandMid: "#7048C0",
  bandHigh: "#3F2380",
  // "Yetersiz veri": gri, kesik çizgi ve metin etiketiyle gösterilir.
  insufficient: "#7F7B8C",
  // Koyu mürekkep panel (takip kodu) ve üzerindeki yazı.
  inverse: "#241A38",
  onInverse: "#FFFFFF",
  onInverseMuted: "#DCD3EE",
} as const;

// Ekran kenarı 16 (s3), ilişkili öğeler arası 8 (s2), bölümler arası 24 (s4).
export const space = { s1: 4, s2: 8, s3: 16, s4: 24, s5: 32, s6: 48 } as const;

export const radius = { control: 8, panel: 12 } as const;

// 1.25 oranlı ölçek. Metinler sistem yazı tipiyle çizilir ve kullanıcının yazı boyutu ayarıyla büyür.
export const font = {
  small: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 16, lineHeight: 24 },
  subhead: { fontSize: 20, lineHeight: 26 },
  title: { fontSize: 25, lineHeight: 30 },
  // Yalnızca ekranın ana sayısı için (karne oranı).
  display: { fontSize: 39, lineHeight: 44 },
} as const;

// Sayılar alt alta veya yan yana hizalı okunsun diye sabit genişlikli rakamlar.
export const tabularNums = { fontVariant: ["tabular-nums" as const] };

// iOS 44 pt, Android 48 dp. İkisini de karşılamak için 48.
export const minTouch = 48;

// Odak göstergesi kalınlığı. Giriş alanı odak alırken kenarlık bu kalınlığa çıkar.
export const focusWidth = 2;

// Tablet ve geniş ekranlarda satır uzunluğunu okunur tutar.
export const maxContentWidth = 640;
