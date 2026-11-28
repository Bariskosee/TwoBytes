// Tasarım değerleri. Renkler rol adıyla tutulur; palet değişirse yalnızca burası değişir.
// Yön: "Transit Board". Sakin açık zemin, koyu lacivert yazı, petrol yeşili vurgu.
// Kontrast (hesaplanan): text/canvas ~13:1, muted/canvas ~6:1, onAction/action ~7.5:1,
// border/canvas ~3.2:1 (kontrol kenarları için 3:1 şartı).

export const colors = {
  canvas: "#F4F7F9",
  surface: "#FFFFFF",
  text: "#142C3D",
  muted: "#4A5F6E",
  border: "#7A8E9C",
  hairline: "#D5DEE4",
  action: "#005C72",
  onAction: "#FFFFFF",
  focus: "#2259A5",
  error: "#9C2525",
  errorSurface: "#FBEDED",
  success: "#245D32",
  successSurface: "#EAF4EC",
  infoSurface: "#E6F0F4",
  disabled: "#DCE4E9",
  onDisabled: "#4A5F6E",
  bandLow: "#4F93A6",
  bandMid: "#2B7589",
  bandHigh: "#0B4C5F",
} as const;

export const space = { s1: 4, s2: 8, s3: 16, s4: 24, s5: 32, s6: 48 } as const;

export const radius = { control: 8, panel: 12 } as const;

// 1.25 oranlı ölçek. Metinler sistem yazı tipiyle çizilir ve kullanıcının yazı boyutu ayarıyla büyür.
export const font = {
  small: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 16, lineHeight: 24 },
  subhead: { fontSize: 20, lineHeight: 26 },
  title: { fontSize: 25, lineHeight: 30 },
} as const;

// iOS 44 pt, Android 48 dp. İkisini de karşılamak için 48.
export const minTouch = 48;
