# Proje Kapsamı — Karpuz App

## 1. Ne yapıyoruz

Karpuza elle vurulduğunda çıkan sesi telefonun mikrofonuyla kaydedip, sesin akustik özniteliklerinden karpuzun **olgun (ripe)** mu **ham (unripe)** mı olduğunu söyleyen React Native uygulaması.

Dayandığı fikir: olgun karpuz vurulduğunda **donuk**, ham karpuz **tiz/metalik** ses çıkarır. Bu fark ölçülebilir akustik özniteliklere yansır.

**Referans makale:** Zeng W., Huang X., Müller Arisona S., McLoughlin I.V. — *Classifying watermelon ripeness by analysing acoustic signals using mobile devices*, Pers Ubiquit Comput (2013).
Makalenin bildirdiği sonuç: **%89.9 genel doğruluk** (olgun %89.3, ham %90.4).

## 2. Nasıl çalışıyor — akış

```
   kullanıcı karpuza vurur
            │
            ▼
   ┌──────────────────┐
   │  KAYIT           │  mono · 16 bit · 44.1 kHz
   └────────┬─────────┘
            ▼
   ┌──────────────────┐
   │  ÖN İŞLEME       │  RMS (1 ms / 44 örnek pencere)
   │                  │  dinamik eşik = 2 sn ortam gürültüsü × 5
   │                  │  başlangıç/bitiş noktası tespiti
   │                  │  vuruş çerçevesi: 1500–2500 örnek (~34–57 ms)
   │                  │  2. derece alçak geçiren Butterworth
   └────────┬─────────┘
            ▼
   ┌──────────────────┐
   │  ÖZNİTELİK       │  ZCR · STE · alt-bant STE oranı [1, 3, 4]
   └────────┬─────────┘
            ▼
   ┌──────────────────┐
   │  SINIFLANDIRMA   │  lineer SVM → her vuruş için olgun / ham
   │                  │  birden çok vuruş → çoğunluk oyu
   └────────┬─────────┘
            ▼
      SONUÇ EKRANI  +  kullanıcı geri bildirimi (doğru muydu?)
```

**Kullanılan öznitelikler ve gerekçesi (makaleden):**

| Öznitelik | Durum | Not |
|---|---|---|
| ZCR (sıfır geçiş oranı) | **var** | olgunda daha düşük |
| STE (kısa zamanlı enerji) | **var** | olgunda daha düşük |
| Alt-bant STE oranı 1 | **var** | tek başına en iyi ikinci sınıflandırıcı (%82.7) |
| Alt-bant STE oranı 2 | yok | precision/recall zayıf |
| Alt-bant STE oranı 3 | **var** | |
| Alt-bant STE oranı 4 | **var** | tek başına en iyi sınıflandırıcı (%84.5) |
| Brightness (spektral merkez) | yok | eğitim ve test setinde ters davrandı, güvenilmez |
| MFCC / spektrogram | yok | mobilde hesap maliyeti yüksek |

## 3. Fazlar

### Faz 0 — Kurulum
Repo, branch düzeni, Expo/RN iskeleti, mikrofon izni akışı, gerçek cihazda ham ses kaydını alıp dinleyebilmek.
**Bitti sayılır:** telefonda kayıt alınıp örnekler diziye çıkıyor.

### Faz 1 — Ön işleme
RMS hesabı, 2 saniyelik ortam gürültüsü ölçümü, dinamik eşik, başlangıç/bitiş tespiti, çerçeve uzunluğu filtresi, Butterworth alçak geçiren filtre.
**Bitti sayılır:** gürültü içinden vuruş çerçeveleri doğru ayrılıyor; vuruş olmayan ses reddediliyor.

### Faz 2 — Öznitelik çıkarımı
ZCR, STE ve 4 alt-bant STE oranının hesaplanması. Her vuruş için öznitelik vektörü.
**Bitti sayılır:** aynı ses dosyası için hesaplanan değerler referansla tutarlı.

### Faz 3 — Veri toplama ve etiketleme
Olgun ve ham karpuzlardan vuruş kaydı toplanması, etiketlenmesi, öznitelik veri setinin çıkarılması.
Makalede eğitim seti 10 olgun + 10 ham karpuz, test seti 15 olgun + 25 ham.
**Bitti sayılır:** etiketli öznitelik seti hazır. (Ham ses kayıtları **repoya girmez**, ayrı depolanır.)

### Faz 4 — Model
Lineer SVM eğitimi (mobil kısıtı nedeniyle çekirdekli SVM değil). Eğitilen ağırlıkların uygulamaya gömülmesi — telefonda eğitim yok, yalnız çıkarım.
**Bitti sayılır:** ayrılmış test setinde doğruluk/precision/recall raporlanıyor.

### Faz 5 — Uygulama arayüzü
Ortam gürültüsü ölçüm ekranı → kayıt ekranı (dalga formu) → sonuç ekranı. Vuruş algılanmadıysa uyarı. Çoklu vuruşta çoğunluk oyu.
**Bitti sayılır:** kullanıcı uygulamayı açıp karpuza vurup sonucu görebiliyor.

### Faz 6 — Geri bildirim döngüsü
"Sonuç doğru muydu?" akışı; onay verilirse kayıt + etiketin toplanması, modelin sonraki sürümde iyileştirilmesi.
**Kural:** hiçbir kişisel veri toplanmaz — ses, etiket ve cihaz modeli dışında hiçbir şey. Toplama açık rıza ile.

### Faz 7 — Yayına hazırlık
Uygulama içi metinler, izin açıklamaları, gizlilik metni, ikon/isim, mağaza hazırlığı. En son faz.

## 4. Kapsam dışı (şimdilik)

- Karpuzun **kalitesi** (çatlak, boşluk, ezik) — makale de bunu kapsamıyor, ayrı problem.
- Karpuz dışındaki meyveler.
- Sunucu tarafı model eğitimi / canlı model güncelleme — Faz 6'dan sonra konuşulur.
- Kullanıcı hesabı, giriş, sosyal özellikler.

## 5. Bilinen riskler

| Risk | Etki |
|---|---|
| Farklı telefon mikrofonları farklı frekans yanıtı veriyor | model cihaza göre kayabilir |
| Pazar/tarla gürültüsü | vuruş tespiti zorlaşır, eşik ayarı kritik |
| Vuruş kuvveti kişiye göre değişiyor | öznitelikler kuvvetten mümkün olduğunca bağımsız seçildi ama sıfır değil |
| Veri seti küçük | makalede 20 + 40 karpuz; genelleme sınırlı |
| Simülatörde mikrofon test edilemiyor | her şey gerçek cihazda doğrulanmalı |

## 6. Nasıl ilerliyoruz

Fazlar sırayla. Bir faz kapanmadan sonrakine geçilmez.
Herkesin taskı **proje tahtasında** (`proje-tahtasi.html`) tanımlı; tahtadaki bir karar **haber verilmeden değiştirilmez.**
