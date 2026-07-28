# Karpuz App

Karpuza vurulduğunda çıkan sesi telefonun mikrofonuyla kaydedip, sesin akustik özniteliklerinden karpuzun **olgun mu ham mı** olduğunu söyleyen mobil uygulama.

Referans makale: Zeng, Huang, Müller Arisona, McLoughlin — *"Classifying watermelon ripeness by analysing acoustic signals using mobile devices"* (Pers Ubiquit Comput, 2013).

Kapsam ve fazlar: [PROJE-KAPSAMI.md](PROJE-KAPSAMI.md)
Canlı proje tahtası (PDD): [proje-tahtasi.html](proje-tahtasi.html)

---

## 1. Kurulum

React Native (Expo) projesi. Node 20+ ve pnpm gerekir.

```bash
# 1) Depoyu klonla
git clone <repo-url> karpuz-app
cd karpuz-app

# 2) Bağımlılıklar
pnpm install

# 3) Ortam değişkenleri
#    .env dosyası repoda YOK ve asla eklenmeyecek.
#    Gerekli anahtarları ekip liderinden özelden iste, kendi .env dosyanı oluştur.

# 4) Çalıştır
pnpm start          # Expo geliştirme sunucusu
pnpm ios            # iOS simülatör
pnpm android        # Android emülatör
```

> Uygulama **mikrofon** kullanıyor. Simülatörde ses girişi güvenilir değil — test mutlaka gerçek cihazda yapılır.

---

## 2. Branch düzeni

```
main        ← kararlı sürüm. Kimse doğrudan buraya push etmez.
├── yunus
├── ismail
└── rumeysa
```

**Herkes yalnızca kendi branch'inde çalışır.** Başkasının branch'ine commit atılmaz, push edilmez, rebase edilmez.

```bash
git checkout yunus          # kendi branch'in
git pull origin main        # işe başlamadan önce main'i kendine çek
# ... çalış, commit at ...
git push origin yunus
```

`main`'e geçiş yalnızca **pull request** ile olur ve en az bir kişi bakar. Kendi PR'ını kendin merge etmezsin.

Çakışma çıkarsa kendi branch'inde çözersin; `main` üzerinde çakışma çözülmez.

---

## 3. Commit ve push kuralları

### 3.1 Kontrolsüz commit yok

Commit atmadan önce **her seferinde**:

```bash
git status          # hangi dosyalar gidiyor
git diff --staged   # tam olarak ne gidiyor
```

- `git add .` alışkanlık hâline getirilmez. Dosyaları bilerek seçersin.
- Bir commit **tek bir işi** anlatır. "günün işleri" diye 40 dosyalık commit atılmaz.
- Çalışmayan, derlenmeyen kod push edilmez.
- `node_modules`, build çıktısı, ham ses kaydı, ekran görüntüsü repoya girmez.

### 3.2 Commit mesajları

**Kural: net İngilizce, insan gibi yazılmış, kısa ve açıklayıcı.**

- Emir kipi, küçük harfle başlar, sonunda nokta yok.
- 50-72 karakteri geçme. Gerekirse boş satır bırakıp gövdede *neden* yaptığını anlat.
- Emoji yok, `feat:`/`chore:` gibi etiketler yok, madde madde listeler yok.
- **AI kullanımı belli olmayacak.** Yapay zekâ imzası, "Generated with…", "Co-Authored-By: <AI>" satırı, aşırı düzenli/şablon kokan metin olmaz. Mesajı sen yazmışsın gibi durmalı — çünkü sorumluluk sende.

İyi:
```
add rms based silence detection to recorder
fix crash when microphone permission is denied
use 44 sample window for rms, matches the paper
```

Kötü:
```
✨ feat(audio): implement comprehensive RMS-based preprocessing pipeline
update
fixes
Implemented the requested changes as per the specification
```

### 3.3 Sızıntı denetimi — her commit öncesi

Repoya **hiçbir** kişisel veri veya sır girmez. Demo/test amaçlı olsa bile:

- şifre, API anahtarı, token, sertifika, `.env` (`.env.example` dahil — şablon dosyası da koymuyoruz)
- gerçek telefon numarası, e-posta, adres, TC kimlik, konum bilgisi
- sunucu IP'si, SSH bilgisi, veritabanı bağlantı satırı
- test hesabı şifresi — "nasılsa demo" diye bile

Kod içinde sabit yazılmış şifre/anahtar gördüğün an commit'i durdur.

Yanlışlıkla push edildiyse: **anahtarı hemen iptal et**, sonra ekibe haber ver. Sadece silmek yetmez, git geçmişinde kalır.

### 3.4 Push

- Günün sonunda kendi branch'ini push et, iş bilgisayarda kalmasın.
- `--force` yok. Kendi branch'inde mecbur kalırsan `--force-with-lease` ve önce ekibe haber.
- `main`'e force push kesinlikle yok.

---

## 4. Proje dokümanı (PDD) kuralı

Projenin güncel tanımı `proje-tahtasi.html` dosyasıdır. Neyin yapıldığı, neyin beklediği, hangi kararın neden alındığı orada durur.

- Herkesin tahtada tanımlı bir **taskı** var. Kendi taskında ilerlersin.
- Tahtadaki bir karar **haber verilmeden değiştirilmez.** Bir şeyi farklı yapman gerektiğini düşünüyorsan önce yaz, konuş, tahta güncellensin; sonra kod yazılır.
- Tahtada olmayan bir özelliği kendi kafana göre eklemezsin. "Zaten oradaydım, bunu da yaptım" olmaz.
- Karar değişince tahtayı güncelleyen commit ayrı atılır.

Herkes AI ile geliştirme yapacağı için bu daha da önemli: modelin ürettiği "iyi fikir" tahtayla çelişiyorsa tahta kazanır.

---

## 5. Kısa özet

| Yapılacak | Yapılmayacak |
|---|---|
| Kendi branch'inde çalış | `main`'e doğrudan push |
| Commit öncesi `git diff --staged` | Kör `git add .` |
| Sade, İngilizce, insan dili commit | AI imzası, emoji, şablon metin |
| Anahtarları özelden iste | Repoya sır/kişisel veri koymak |
| Karar değişikliğini önce bildir | Tahtayı sessizce aşmak |
