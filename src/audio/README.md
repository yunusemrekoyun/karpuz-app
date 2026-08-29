# src/audio — akustik analiz modülü

Karpuzdan bağımsız. Kısa "vuruş" (impact) seslerini tespit eder, ön işler ve
zaman/frekans özniteliklerini çıkarır. Olgun/ham kararı bu modülün işi değil.

Yöntem ve parametreler: Zeng vd. (2013), bölüm 4 — detaylar için
[`docs/SES-ANALIZI.md`](../../docs/SES-ANALIZI.md).

## Dosyalar

| Dosya | İş |
|---|---|
| `fft.js` | Bağımsız radix-2 FFT, gerçek sinyal güç spektrumu |
| `dsp.js` | RMS, dinamik eşik, olay segmentasyonu, Butterworth, ZCR, STE, alt-bant STE oranları |
| `analyzer.js` | `ThumpAnalyzer` — gürültü ölçümü → dinleme → analiz oturumu, öznitelik vektörü üretir |
| `watermelon.js` | **Ayrı katman** — özniteliği olgun/ham'a çevirir (Faz 4'te eğitilmiş SVM ağırlıklarıyla) |
| `index.js` | Genel API |

## Kullanım

```js
const { ThumpAnalyzer, Phase } = require('./src/audio');

const analyzer = new ThumpAnalyzer();          // opsiyonel: { noisePeriodS, minMs, maxMs }
analyzer.begin(sampleRate);                     // MEASURING_NOISE
// her PCM chunk (Float32, [-1,1]):
analyzer.push(chunk);                           // 2 sn sonra otomatik LISTENING
// kullanıcı bitirince:
const result = analyzer.finish();
// result.thumps[i].features = { zcr, ste, subBand: [r1, r2, r3, r4] }
// result.diagnostics = { threshold, peakRms, recordedSec, rawSegments }
```

## Test

```
node scripts/validate-dsp.js
```

Sentetik sinyallerle 23 kontrol (FFT, ZCR, STE, alt-bant, Butterworth, eşik +
segmentasyon, sınıflandırıcı sağlaması). Bağımlılık yok, düz Node ile çalışır.

## Durum

- Faz 1 (ön işleme) + Faz 2 (öznitelik çıkarımı): tamam.
- Expo/pnpm iskeleti ve mikrofon yakalama katmanı (Faz 0) ayrı — henüz repoda yok.
  Yakalama tarafı `ThumpAnalyzer.push()` metoduna Float32 PCM besleyecek şekilde
  bağlanır (expo-audio `useAudioStream` mobilde, Web Audio API web'de).
- Faz 4: `watermelon.classifyThumpSVM(vector, weights, bias)` eğitilmiş ağırlık bekliyor.
