# Manuel test listesi – Transfer-Planer (Year-End Conference)

Bu listede **yalnızca benim (otomatik testle) yapamadığım şeyler** var: gerçek cihazlar, gerçek Excel, gerçek veri ve "mantıklı mı?" kararları.
Otomatik tarafta 22 mantık testi + 336 tarayıcı denemesi geçiyor (`npm test`, `npm run test:e2e`).

Her madde: **ne yapılır → ne görülmeli**. Sorun bulursanız madde numarasıyla yazmanız yeterli (örn. "B7: renkler solmuş").

Hazırlık: `npm run dev` → http://localhost:5173/carpool.html. Telefonda denemek için bilgisayar ve telefon aynı Wi-Fi'de olsun, adres: `http://<bilgisayarın IP'si>:5173/carpool.html` (Vite açıkken `npm run dev -- --host`).

---

## A · Gerçek cihazlar ve tarayıcılar

- [ ] **A1 iPhone (Safari):** Sayfayı aç → yatay kaydırma yok, üst çubuk yapışkan, yazılar okunuyor.
- [ ] **A2 iPhone:** Bir yolcuya dokun, sonra başka koltuğa dokun → yer değiştiriyor. Altta "Abbrechen" çubuğu çıkıyor, çubuk ekranın altındaki ince çizginin (home bar) üstünde kalıyor.
- [ ] **A3 iPhone:** Kalkış saati alanına dokun → sayısal klavye açılıyor. `1450` yaz → `14:50`. Klavye açıkken alan görünür kalıyor.
- [ ] **A4 iPhone:** ☰ yan menü → sağdan yumuşak kayıyor, kapatınca yumuşak çıkıyor, menü açıkken arkadaki sayfa kaymıyor.
- [ ] **A5 Android (Chrome):** A1–A4'ü tekrarla.
- [ ] **A6 Tablet (iPad / Android):** Dikey ve yatay çevir → düzen bozulmuyor, "Etappe" çubuğunda dışa aktar düğmesi sağ üstte.
- [ ] **A7 Windows Chrome:** Sürükle-bırak (fareyle bir yolcuyu başka koltuğa sürükle) çalışıyor, sürüklerken isim balonu fareyi izliyor.
- [ ] **A8 Windows Edge:** Hızlı bir tur (plan, kural, Excel).
- [ ] **A9 Firefox:** Hızlı bir tur. Özellikle: dropdown'lar, sürükle-bırak, Excel indirme.
- [ ] **A10 Mac Safari (varsa):** Hızlı bir tur. Özellikle: dropdown'lar, yan menü animasyonu, dosya yükleme.
- [ ] **A11 Telefonu yan çevir (landscape):** Yan menü ve kurallar penceresi ekrana sığıyor, kaydırılabiliyor.
- [ ] **A12 Küçük telefon (iPhone SE gibi, 320–375px):** Hiçbir yazı kesilmiyor, "Layout" çubuğu ve kural kartları sığıyor.
- [ ] **A13 Tarayıcıyı %200 yakınlaştır (Ctrl +):** Sayfa kullanılabilir, düğmeler ulaşılabilir.
- [ ] **A14 İşletim sistemi koyu mod:** Sayfa okunuyor (sayfanın koyu teması yok, ama yazılar kaybolmamalı).

## B · Excel (gerçek Excel'de!)

İndir: **Etappe çubuğunun sağındaki "Plan exportieren"** → `transfer-plan-2026-11-27.xlsx`.

- [ ] **B1 Açılış:** Excel'de uyarı/hata olmadan açılıyor ("dosya bozuk, onarılsın mı?" çıkmamalı).
- [ ] **B2 Sayfalar:** Übersicht, Etappe 1, Etappe 2, Anwesenheit 1, Anwesenheit 2, Personen, Nachrichten, Kosten, Hinweise (hint varsa).
- [ ] **B3 Renkler ve düzen:** Siyah başlıklar, mor (araba), mavi (ÖPNV), yeşil (taksi) bloklar; sütunlar okunuyor, yazı kesilmiyor.
- [ ] **B4 Personen sayfası:** İlk satır sabit (aşağı kaydırınca başlık duruyor), filtre okları var, bir sütunda filtre dene.
- [ ] **B5 Kosten sayfası:** Sarı hücrelerdeki fiyatı değiştir (30 → 40) → toplamlar **kendiliğinden** güncelleniyor.
- [ ] **B6 Anwesenheit sayfası – yazdır önizleme:** Dosya → Yazdır → **yatay A4, tek sayfa genişliğinde**, başlık her sayfada tekrar ediyor, "☐" kutuları görünüyor.
- [ ] **B7 Nachrichten sayfası:** Mesajlar okunuyor, bir hücreyi kopyalayıp mail/Slack'e yapıştır → düzgün Almanca/cümle.
- [ ] **B8 Kopyala-yapıştır:** Bir kişinin mesajını Outlook'a yapıştır → biçim bozulmuyor.
- [ ] **B9 Excel'de düzenle + geri yükle (en önemlisi):** Dosyada **Personen** sayfasında şunları yap, Excel'de **.xlsx olarak kaydet**, uygulamada **"Plan laden"** ile seç:
  - [ ] bir kişinin "Zuordnung"unu `Taxi 1` yap, "Rolle"yi boşalt
  - [ ] bir kalkış saatini elle yaz (`14:40`)
  - [ ] bir kişinin takımını değiştir
  - [ ] en alta yeni bir kişi ekle (sadece isim)
  - [ ] birini etap 2'de `nicht dabei` yap
  → hepsi uygulamada doğru görünüyor. Yeni kişi boş bir yere yerleşiyor.
- [ ] **B10 Excel'i değiştirmeden geri yükle:** Hiçbir şeyi değiştirmeden aynı dosyayı yükle → plan tamamen aynı.
- [ ] **B11 Google Sheets:** Dosyayı Google Sheets'e yükle → renkler ve formüller çalışıyor; Sheets'te düzenleyip .xlsx indir, uygulamaya yükle.
- [ ] **B12 LibreOffice (varsa):** Aç → bozuk görünüm yok.
- [ ] **B13 Mac Excel / Excel Online (varsa):** Aç → B1–B3.
- [ ] **B14 Yabancı dosya:** Alakasız bir Excel'i "Plan laden" ile seç → hata mesajı çıkıyor, mevcut plan değişmiyor.

## C · Gerçek kişi listesi (CSV / Excel)

- [ ] **C1 Almanca Excel'de "CSV (Trennzeichen-getrennt)" kaydet** (ANSI), isimlerde ä ö ü ß olsun → "CSV laden" → isimler **doğru** çıkıyor. (Bunu bugün düzelttim; sizin dosyanızla doğrulayın.)
- [ ] **C2 "CSV UTF-8" olarak kaydet:** Aynı dosya → isimler doğru.
- [ ] **C3 Sütunlar:** `Name; Auto; Plätze; Etappe 1; Etappe 2; Team; Sprache; Notiz` — sadece **Name** zorunlu. Önce sadece isim sütunuyla dene.
- [ ] **C4 Özel isimler:** Türkçe (ş ğ ı İ), Rusça, aksanlı (é), çift isim, çok uzun isim → doğru görünüyor, tasarım bozulmuyor.
- [ ] **C5 Aynı isimde iki kişi:** İkisi de listede kalıyor.
- [ ] **C6 Büyük liste (gerçek sayınız, belki 100+):** Sayfa akıcı, Excel indirme hızlı.
- [ ] **C7 Takım ve dil:** Takım adları dropdown'da çıkıyor; dil sütununda `Deutsch/English/Russisch` yazsan da DE/EN/RU oluyor.
- [ ] **C8 Boş satırlar, fazla boşluk:** Atlanıyor, hata vermiyor.

## D · Günlük iş akışı (İK gözüyle, baştan sona)

- [ ] **D1** Listeyi yükle → araba sahiplerini işaretle, koltuk sayısını gir (kabriyo = 2).
- [ ] **D2** Etap 1 planına bak: araçlar dolu mu, tram grupları 5'er kişi mi, taksi var mı. **Mantıklı mı?**
- [ ] **D3** "Zusammen reisen nach: Team" ya da "Sprache" → aynı ekip/dil yan yana oturuyor mu?
- [ ] **D4** Birkaç kişiyi elle taşı (dokun-dokun ve sürükle). Bilet alıcısını değiştir.
- [ ] **D5** Kural ekle: iki kişi ayrı, her araçta bir DE konuşan, ekip sınırı, "Rollstuhl" notlu kişi tramla gitmesin. Hint'ler **doğru kuralı** gösteriyor mu?
- [ ] **D6** Kalkış saatlerini araç başına ayarla (14:50 gibi).
- [ ] **D7** "Etappe 2 = Etappe 1" → akşam yemeği planı aynı araçlarla başlıyor. İhtiyaca göre elle düzelt.
- [ ] **D8** Excel'i indir, **Nachrichten** sayfasından mesajları dağıtmayı dene (gerçekten kullanışlı mı?).
- [ ] **D9** Etkinlik günü: bir kişi gelmiyor → kişiyi çıkar ya da etap kutusunu kapat → plan kendini düzeltiyor, elle yaptıklarınız bozulmuyor.
- [ ] **D10** Etkinlik günü: **Anwesenheit** sayfasını yazdır → kalkışta kullanılabilir mi?
- [ ] **D11** Yeni plan yapıp **"Plan speichern"** ile yedekle → sonra "Plan laden" ile geri yükle → aynı.

## E · Veri, gizlilik, kayıt

- [ ] **E1 Veri tarayıcıdan çıkmıyor:** Tarayıcıda F12 → **Network** sekmesi → bir kişi ekle, plan değiştir, Excel indir → isimlerin gittiği bir istek **olmamalı** (yalnızca ilk sayfa dosyaları).
- [ ] **E2 Yenile (F5):** Liste, plan, kurallar, kalkış saatleri, Layout varyantları duruyor.
- [ ] **E3 Başka tarayıcı / gizli pencere:** Veri **görünmüyor** (beklenen, sunucu yok). Önemli: yedek için "Plan speichern" kullanılmalı.
- [ ] **E4 Tarayıcı verisini sil, sonra "Plan laden":** Yedekten her şey geri geliyor.
- [ ] **E5 Aynı anda iki sekme:** İkisinde de düzenlemeyi dene → sonuncu kaydeden kazanıyor (uyarı yok). Gerçek hayatta tek sekmede çalışın.
- [ ] **E6 "Testdaten" düğmesi:** Onay soruyor, sonra tüm listeyi siliyor. "Rückgängig" ile geri alınıyor mu?

## F · Görsel ve metin kontrolü

- [ ] **F1 Almanca metinler:** Bütün sayfayı oku → yazım/üslup hatası var mı? ("Hinweise", "Regeln", mesaj cümleleri).
- [ ] **F2 İngilizce metinler:** Dil düğmesiyle EN → aynı kontrol. Çevrilmemiş (Almanca kalmış) yer var mı?
- [ ] **F3 Renkler:** Zemin ve kutu renkleri (açıldı), mor/mavi/yeşil kutular, alseda mavisi beklentiniz var mı? (Marka renklerine geçiş hâlâ yapılmadı.)
- [ ] **F4 Koltuk yazıları:** Arabada isimler, dil kodu (sağ üst), not işareti (sağ alt) okunuyor, üst üste binmiyor.
- [ ] **F5 Yan menü başlığı:** "Planer-Menü" / "Planner Menu" doğru ve ortada.
- [ ] **F6 Hero fotoğrafı (telefonda):** Konuşmacı görünüyor, yazılar okunuyor.
- [ ] **F7 Animasyonlar:** Yan menü açılış/kapanış, bölümlere kayma, Layout çubuğu — akıcı mı, rahatsız eden var mı?

## G · İçerik doğruluğu (kuralların gerçeğe uygunluğu)

- [ ] **G1 Etap saatleri ve rotalar:** 15:00 otel → Altes Polizeipräsidium, 18:00 Polizeipräsidium → Casa Isoletta. Adresler doğru mu? (Canlı agenda'dan alınıyor.)
- [ ] **G2 Grup bileti kuralı:** En fazla **5 kişi**, 3'ten az artık kişi taksiye gidiyor. RMV'nin güncel kuralına uyuyor mu?
- [ ] **G3 Taksi:** En fazla **4 kişi**. Gerçek taksilerde de öyle mi?
- [ ] **G4 Kosten sayfası fiyatları:** 30 € / 15 € **sembolik**. Gerçek fiyatlarla değiştirin.
- [ ] **G5 Arabalar:** Sürücü dahil koltuk sayısı. Kabriyo (2) gibi özel durumlar doğru girilmiş mi?
- [ ] **G6 Tarih:** Her yerde "27. November 2026" (sabit). Etkinlik tarihi değişirse kodda değişmesi gerekir.

## H · Bilinen sınırlar (hata değil, bilmeniz gerekenler)

- Veri yalnızca **kendi tarayıcınızda** durur; birden çok İK çalışanı aynı planı **eşzamanlı** göremez (Excel/JSON paylaşımıyla).
- Excel'den yüklemede kişiler **isim ve satır sırasıyla** tanınır; yüklenince **kişiye bağlı kurallar** (iki kişi, kişi kuralı) silinir. Dil/takım/not kuralları kalır.
- **Takım adı** arayüzden yazılamaz (dropdown'da yalnızca listedeki takımlar); yeni takım için CSV/Excel'de yazın.
- Dil seçenekleri yalnızca **DE / EN / RU**.
- Yalnızca **iki etap** var (otel→Polizeipräsidium, Polizeipräsidium→Casa Isoletta).
- "Tek tip değil" bilgi satırı çoğu zaman çıkar (4 araba × 5 kişi, 3 dil/5 takım tam bölünmez). Bu bir hata değil.
- Sayfa yazdırma stili yok (yazdırma için Excel'in **Anwesenheit** sayfaları var).
- Harita bağlantısı eklenmedi (kararlaştırıldı).
