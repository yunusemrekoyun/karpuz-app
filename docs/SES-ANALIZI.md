# Ses Analizi Modülü

Karpuzdan **bağımsız** akustik analiz katmanı: kısa "vuruş" (impact) seslerini
tespit eder, ön işler ve zaman/frekans özniteliklerini çıkarır. Ne anlama
geldiğine karar vermek (olgun/ham) bu modülün işi değil.

Parametre varsayılanları ve öznitelik formülleri şu makaleden alınmıştır:
Zeng, Huang, Müller Arisona, McLoughlin — *"Classifying watermelon ripeness by
analysing acoustic signals using mobile devices"*, Pers Ubiquit Comput (2013),
bölüm 4.

Kod: [`src/audio/`](../src/audio) · Doğrulama: `npm run validate`
([`scripts/validate-dsp.js`](../scripts/validate-dsp.js), 23 test)

## Modül yapısı

| Dosya | Sorumluluk |
|---|---|
| [`fft.js`](../src/audio/fft.js) | Bağımsız radix-2 FFT, güç spektrumu |
| [`dsp.js`](../src/audio/dsp.js) | RMS, dinamik eşik, segmentasyon, Butterworth, ZCR, STE, alt-bant STE oranları |
| [`analyzer.js`](../src/audio/analyzer.js) | `ThumpAnalyzer` — oturum akışı, öznitelik vektörü üretir |
| [`watermelon.js`](../src/audio/watermelon.js) | **Ayrı katman** — özniteliği olgun/ham'a çevirir (Faz 4) |

## Kayıt

| Parametre | Değer |
|---|---|
| Kanal | mono |
| Örnek | `[-1,1]` float (makaledeki 16 bit ile eşdeğer) |
| Örnekleme hızı | 44.1 kHz istenir; gerçek hız çalışma anında kullanılır |

Mobil: `expo-audio` `useAudioStream` (`encoding: 'float32'`).
Web: Web Audio API `ScriptProcessor` (sadece geliştirme).

## İşlem akışı ([`ThumpAnalyzer`](../src/audio/analyzer.js))

```
begin(rate) → MEASURING_NOISE → LISTENING → finish() → DONE
```

`finish()` şunu döndürür:
```js
{
  rate, threshold, thumpCount,
  thumps: [{ index, startSec, lengthMs, features: { zcr, ste, subBand:[r1,r2,r3,r4] } }],
  diagnostics: { threshold, peakRms, recordedSec, rawSegments }
}
```

### 1. Dinamik eşik (bölüm 4.1.1–4.1.2)

- RMS penceresi: **1 ms (44 örnek @ 44.1 kHz)**, örtüşmesiz.
- Olaylardan önce **2 sn** ortam sesi ölçülür.
- `eşik = 5 × (ortam RMS ortalaması)`

### 2. Olay segmentasyonu (bölüm 4.1.2–4.1.3)

- 1 ms çerçeveler RMS'e göre 0/1 etiketlenir; `0→1` başlangıç, `1→0` bitiş.
- Kısa + yakın parçalar birleştirilir (her biri < 1000 örnek, aralık < 500 örnek).
- Uzunluk filtresi: varsayılan **1500–2500 örnek (34–57 ms)** — makalenin gözlemlediği
  karpuz vuruşu aralığı. `segmentThumps(..., { minMs, maxMs })` ile değiştirilebilir.
- `findSegments()` filtresiz tüm adayları verir (teşhis için).
- Tüm eşikler 44.1 kHz'e göre tanımlı, gerçek hıza ölçeklenir.

### 3. Butterworth filtresi (bölüm 4.1.5)

- 2. derece alçak geçiren, kesim = Nyquist / 2 = `rate/4`.
- İleri + geri uygulanır (sıfır faz).

### 4. Öznitelik çıkarımı (bölüm 4.2) — [`extractFeatures`](../src/audio/dsp.js)

| Öznitelik | Formül | Ölçekten bağımsız? |
|---|---|---|
| ZCR | eş. (3): işaret değişimi / 2N | evet |
| STE | eş. (4): Σ sᵢ² | hayır (mikrofon kazancına bağlı) |
| Alt-bant STE oranı ×4 | eş. (5): FFT gücü / toplam güç | evet |

Alt-bant sınırları = Nyquist × `[0, 1/8, 1/4, 1/2, 1]`
(≈ 0–2756, 2756–5512, 5512–11025, 11025–22050 Hz @ 44.1 kHz). Oranlar ≈ 1'e toplanır.

Modül dört alt-bant oranının **hepsini** döndürür; hangilerinin kullanılacağı
sınıflandırıcının kararı.

## Doğrulama

`npm run validate` → 23 test. FFT (impulse→düz spektrum, ton→doğru bin), ZCR
(tam salınım→~1, sinüs→2f/rate, DC→0), STE (sabit genlik), alt-bant (ton doğru
banda düşüyor, toplam≈1), Butterworth (2 kHz geçer, 20 kHz durur), eşik +
segmentasyon (tek vuruş bulunur, kısa blip reddedilir), sınıflandırıcı sağlaması.

Makalenin Table 2 ortalamalarıyla **doğrudan** karşılaştırma yapılamıyor —
yazarların ham kayıtları yayınlanmadı (Faz 3'te kendi verimiz toplanacak).

## Kapsam

- **Bu modül:** Faz 1 (ön işleme) + Faz 2 (öznitelik çıkarımı). Karpuzdan bağımsız.
- **Ayrı:** [`watermelon.js`](../src/audio/watermelon.js) — geçici en-yakın-komşu;
  Faz 4'te `classifyThumpSVM(vector, weights, bias)` eğitilmiş ağırlıklarla.
- **Kapsam dışı:** Faz 3 veri toplama, Faz 4 SVM eğitimi, diğer meyveler, sunucu.

## Karpuz eşlemesi (referans, Table 2 eğitim seti)

`watermelonFeatureVector(features)` → `[ZCR, STE, alt-bant 1, 3, 4]` (bant 2 ve
brightness makalede elenmiş).

| | ZCR | STE | Bant 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|---|
| Olgun | 0.0138 | 5.6 | 31.7% | 29.0% | 24.0% | 15.6% |
| Ham | 0.0202 | 8.2 | 66.9% | 21.0% | 5.95% | 6.32% |

Ham karpuzda enerji ilk alt-banda yığılır ve oranlar hızla düşer; olgunda daha
düz. Makale genel doğruluk: %89.9.
