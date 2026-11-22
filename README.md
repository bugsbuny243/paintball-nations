# Paintball Nations 🎨

## 🛠️ C5.1 — Çökme sonrası güvenli cephe kurtarma (geliştirme)

- [C5 teknik uygulama: 30 saniyelik savaş yetkisi, yenileme, süresi dolunca iptal, PostgreSQL eşzamanlılık testi](docs/frontline-c5-recovery.md)
- [PostgreSQL CI](https://github.com/bugsbuny243/paintball-nations/actions/runs/45039651316) ve [Colyseus/Chrome CI](https://github.com/bugsbuny243/paintball-nations/actions/runs/45039651260) başarılı.
- Beklenmedik süreç kapanmasında süresi dolan savaş **eski ülke sahibini koruyarak** iptal edilir. Gecikmiş eski sunucu sahte fetih yazamaz. Bu, eski maçın kaldığı yerden devam etmesi değildir.
- **Henüz kamusal yayın yok:** bağımsız sürekli kurtarma işçisi, üretim hesapları, gerçek Android ve yük/failover testleri eksik. `NODE_ENV=production` kilidi korunur.


## ✅ C4 — Maçka çevrim içi maç → kalıcı bölge sonucu

- [C4 uygulama ve sınırlar: Colyseus otoriter sonuç, PostgreSQL sektör devri, dünya HUD bildirimi](docs/frontline-c4-room-integration.md)
- [8/8 başarılı Colyseus ağ testi ve 2 Chrome/PlayCanvas regresyonu](https://github.com/bugsbuny243/paintball-nations/actions/runs/45018585732)
- Geçerli TR/DE pilotları aynı odaya girdiğinde geliştirme modu sektörü çekişmeli başlatır. Maç sonu **sunucunun tuttuğu ve kilitlediği skor** üzerinden sonuç C3 PostgreSQL işlemiyle bölgeye uygulanır. Beraberlikte sektör korunur; `world_state` sonucu oyun HUD’una yayınlanır.
- **Varsayılan olarak kapalı:** Yalnız `DEV_ENABLE_FRONTLINES=1` + `DEV_REQUIRE_PILOT=1` olan *yerel geliştirme* odasında çalışır. Normal misafir ve çevrim dışı Maçka korunmuştur.
- **Açık güvenlik sorunu:** Geçersiz Colyseus matchmaking isteğinin reddindeki `ERR_HTTP_HEADERS_SENT` hâlâ çözülmedi; bu aşama üretime veya halka açık sunucuya dağıtılmadı.
- Yalnız tek test sektörü var; 30 gerçek bağlantı, gerçek Android ve C4 HUD görsel testi, botlar ve stratejik kontrol noktaları henüz tamamlanmadı.


## ✅ C3 — Kalıcı Cephe / Bölge Fethi Veri Altyapısı

- [C3 uygulaması, transaction kuralları ve kalan entegrasyon](docs/frontline-c3-implementation.md)
- [PostgreSQL'de başarılı 24/24 test (9 dünya, 6 profil, 9 cephe)](https://github.com/bugsbuny243/paintball-nations/actions/runs/45017167171)
- Maçın kimliği ve kaynağı, çekişmeli sektör, tek seferlik sonuç, ülke sahipliği geçmişi, kaynak üretiminin yeni ülkeye devri ve maç iptali **sunucu/veritabanı katmanında** uygulandı.
- **Henüz maç odasına otomatik bağlanmadı.** Colyseus'taki bir gerçek karşılaşmanın bu kayıtları güncellemesi bir sonraki C4 adımıdır. Kamuya açık sunucu bulunmuyor.


## ✅ C2 — Kalıcı oyuncu → Colyseus → PlayCanvas entegrasyonu

- [Çalışan C2 pilot/maç oturumu, test kanıtı ve üretim sınırları](docs/pilot-match-c2.md)
- [7/7 ağ ve oyun kuralı testi + iki gerçek Chrome'da kalıcı pilot bağlantısı](https://github.com/bugsbuny243/paintball-nations/actions/runs/45016303715)
- Sunucu doğrulanmış TR/DE pilot kimliği ve 90 saniyelik maç bileti; ülkeye göre takım atama ve oturum iptali testi tamamlandı.
- **Henüz canlı oyun değildir.** Colyseus biletsiz eşleştirme hata yolu, gerçek hesap güvenliği, Android testi ve 30 gerçek oyuncu yük testi çözülmeden kamusal yayın açılmayacaktır.


## ✅ C1 — Kalıcı oyuncu profili ve ülke ekonomisi bağlantısı

- [C1 teknik uygulama, güvenlik sınırları ve test raporu](docs/pilot-c1-implementation.md)
- [PostgreSQL üzerinde 15/15 başarılı test](https://github.com/bugsbuny243/paintball-nations/actions/runs/45010029239)
- Rastgele takma isim, sunucuda UUID profil, 14 günlük hash'lenmiş ve iptal edilebilir yerel geliştirme oturumu; yalnız oyuncunun bağlı olduğu ülkenin kaynaklarını okuma.
- **Aşama notu:** C1 profil çekirdeği C2 geliştirme bağlantısıyla PlayCanvas/Colyseus'a bağlandı; yine de kamusal canlı sunucu yok. A3 biletsiz giriş hatası ve gerçek hesap kurtarma/izin sistemi tamamlanmadan yayın yapılmayacak.


## 🧠 Çekirdek Oyun Sistemleri V1 — Kalıcı Dünya Ürün Tasarımı

- [Tam tasarım: Üs Endüstrisi, Stratejik Kariyer, Ülke Ligleri, Özel Operasyonlar, Komuta Çubuğu, botlar ve 15v15](docs/paintball-nations-core-systems-v1.md)
- **Tasarımdır; uygulandı anlamına gelmez.** Mevcut A1 ekonomi ve A2/A3 çevrim içi prototipleri korunuyor. OldOrbit ekranlarından çıkarılan mekanik ilkeler kopyalanmadan özgün Paintball Nations kurallarına dönüştürülmüştür.
- Güncel teknik üst mimari: [Kalıcı Dünya V2](docs/world-architecture-v2.md). A3 kimlik reddetme bloklayıcısı çözülmeden kamusal sunucu açılmaz.


## 🔐 A3 — Geliştirme misafir biletleri / doğrulanmış pozitif bağlantı

- [A3 kodu, test sonuçları ve çözülmemiş güvenlik bloklayıcısı](docs/guest-session-a3.md)
- [5/5 geçen Colyseus ve iki Chrome tarayıcısı testi](https://github.com/bugsbuny243/paintball-nations/actions/runs/44660851253)
- Sunucu imzalı, 10 dakikalık geçici bilet; istemci `?online=1` modunda bileti alıp Maçka odasına katılır.
- **Bloklayıcı:** Biletsiz bağlantının ağ seviyesinde reddedilmesi Colyseus 0.18.10 altında `ERR_HTTP_HEADERS_SENT` hatası doğuruyor. Bu negatif ağ testi henüz geçmedi; şu anda yalnız fonksiyon düzeyinde reddetme doğrulaması var. **Kamusal üretim dağıtımı kapalı.**
- Gerçek oyuncu hesabı, oturum iptali, moderasyon, 30 eşzamanlı ağ bağlantısı ve 24/7 sunucu henüz yok.


## ✅ A2 — Maçka çok oyunculu ağ prototipi

- [A2 çevrim içi altyapısı: kod, test sonucu ve sınırlar](docs/online-a2-implementation.md)
- [İki gerçek tarayıcıda başarılı Colyseus + PlayCanvas testi](https://github.com/bugsbuny243/paintball-nations/actions/runs/44389900415)
- Sunucu: `apps/game-backend/src/online-server.ts`, `rooms/macka-room.ts`, `rooms/macka-simulation.ts`.
- İstemci: `maps/macka-online-client.js` ve otomatik üretilen `maps/macka-online.bundle.js`.
- Çevrim dışı antrenman değişmedi. Ağlı deneme modu `maps/macka.html?online=1` ile açılır ama **henüz kamusal bir WSS sunucusu yoktur**.
- Şimdilik gerçek iki istemci ve sunucu otoritesi doğrulandı; 30 kullanıcı yük testi, hesap sistemi, kalıcı dünya/maç sonucu entegrasyonu, 7/24 dağıtım ve gerçek Android performansı henüz tamamlanmadı.

## ✅ Altyapı geliştirme — A1 tamamlanan çekirdek

- [PostgreSQL dünya çekirdeği: uygulanmış kod, test kanıtı ve sınırlar](docs/world-core-a1-implementation.md)
- [9/9 geçen PostgreSQL CI testi](https://github.com/bugsbuny243/paintball-nations/actions/runs/44369060443)
- Kod: apps/game-backend, packages/protocol, tests/world-core.test.ts
- Gerçekleşen: idempotent üs yükseltme, kaynak defteri, sınırlı offline üretim hesabı, sürümlü dünya snapshot, operatör korumalı HTTP API.
- Henüz yapılmayan: 24/7 dağıtım, gerçek oyuncu oturumu, Colyseus 15v15, bot orduları ve PlayCanvas canlı bağlantısı. Mevcut V0.3 FPS antrenmanı korunuyor.

## Ana ürün mimarisi V2 — tek kalıcı dünya

**Yeni ana yön:** Paintball Nations yalnız 15v15 oda oyunu değil; ülke/klan üsleri, ekonomi, bölge fethi, cephelerde 15v15 FPS ve düşük nüfusta yaşayan bot dünyasıdır. OSM tabanlı gerçek yerleşimlerle tek mantıksal dünya tasarlanmıştır. Üretimde henüz uygulanmamış bileşenleri "tamamlandı" diye göstermiyoruz.

- [🌍 Tek dünya sunucu ve veri mimarisi — V2](docs/world-architecture-v2.md)
- [🧠 Ülke, üs, ekonomi, bot ve stratejik oyun sistemleri — V2](docs/world-game-systems-v2.md)
- [🛠️ Altyapı kurulum sırası, testler ve tam yayın kabul planı — V2](docs/delivery-roadmap-v2.md)
- [Eski oda tabanlı V1 planı — arşiv](docs/full-game-blueprint.md)

**Durum:** Yukarıdaki V2 belgeleri tasarımdır, çalışan backend veya aktif sunucu değildir. Önce mevcut antrenman korunacak; V2 tek kod tabanı içinde geliştirilecektir.

**Yeni: [OSM dünya haritası araştırması ve İstanbul sorgusu](docs/osm-map-research.md)**

**Mobil oynanabilir önizleme:** https://raw.githack.com/bugsbuny243/paintball-nations/main/index.html

**🎮 Maçka OSM Paintball FPS antrenmanı:** https://raw.githack.com/bugsbuny243/paintball-nations/main/maps/macka.html?play=1

**🗺️ Maçka OSM kuşbakışı harita incelemesi:** https://raw.githack.com/bugsbuny243/paintball-nations/main/maps/macka.html

Oynanabilir harita modunda 15 kırmızı boya hedefi, 14 mavi antrenman maketi + oyuncu, paintball bariyerleri, 2 dakika 30 saniyelik tur, skor sistemi, bina ve bariyer çarpışmaları ve mobil FPS kontrolleri vardır. **Bu yalnızca çevrim dışı bir antrenman oyunudur, gerçek 15v15 çevrim içi maç değildir.** Bina oturumları/yollar gerçek OSM'dendir, oyun objeleri kurgusaldır. Yükseklikler tahminî olabilir.

Harita için [gerçek OSM kaynak verisi](maps/istanbul-macka.json), [PlayCanvas 3D harita kodu](maps/macka-viewer.js) ve [GitHub doğrulama sonucu](https://github.com/bugsbuny243/paintball-nations/actions/workflows/check-osm-viewer.yml) bulunur. Kuşbakışı ve mobil yürüyüş modları eklendi. Bu ayrı bir harita görüntüleyicisidir; ana FPS maçına entegrasyon ve gerçek zamanlı oyuncu sistemi henüz tamamlanmadı.

Bu, GitHub deposundaki tek dosyalık web demosunun üçüncü taraf üzerinden sunulan geliştirme önizlemesidir. Bazı tarayıcılarda güvenlik onay sayfası gösterebilir. GitHub Pages henüz etkin değil; otomatik etkinleştirme denemesi GitHub token yetkisi nedeniyle başarısız oldu. Pages aktif olduğunda Actions variable `GITHUB_PAGES_ENABLED=true` ayarlanıp dağıtım kullanılabilir.

PlayCanvas üzerinde **FPS 3D paintball antrenman prototipi**.

- PlayCanvas proje ID: `1650317`
- PlayCanvas sahne ID: `2659278`
- Durum: **V0.2**, çevrim dışı antrenman sahnesi; gerçek 15'e 15 çevrim içi oyun henüz yok.
- Oyun kodu: [playcanvas/paintballNations.js](playcanvas/paintballNations.js)
- V0.2: Daha dolu arena, daha küçük FPS atıcısı, boya parçacıkları, örnek ülke seçimi ve yatay ekran uyarısı.
- Ülke seçimi şimdilik sadece yerel antrenman arayüzüdür; gerçek takım eşleşmesi değildir.

## GitHub → PlayCanvas otomatik script aktarımı

Bu depoda `.github/workflows/playcanvas-sync.yml` iş akışı bulunur. Önce **kapalıdır**; gerekli ayarlar yapılınca çalışır. PlayCanvas REST API üzerinden `paintballNations.js` adlı script varlığını oluşturur veya günceller. **Sahneye otomatik nesne eklemez; scripti Entity'ye ilk kez bağlama işlemi editörde yapılır.**

### Telefonda bir defalık kurulum

1. PlayCanvas hesabının **Account / API Tokens** bölümünden erişim tokenı oluştur. PlayCanvas resmî API rehberi: https://developer.playcanvas.com/user-manual/api/
2. GitHub deposunda **Settings → Secrets and variables → Actions → Secrets → New repository secret** bölümüne gir. Adı `PLAYCANVAS_TOKEN`, değeri oluşturduğun PlayCanvas tokenı olsun. **Tokenı sohbet mesajına, kaynak koda veya README'ye yapıştırma.**
3. GitHub **Settings → Secrets and variables → Actions → Variables** bölümüne git. `PLAYCANVAS_SYNC_ENABLED` adlı repository variable oluştur; değeri `true` olsun. Bu ayar olmadan iş akışı PlayCanvas'a veri yazmaz.
4. GitHub **Actions → Sync Paintball Nations to PlayCanvas → Run workflow** ile ilk aktarımı manuel başlat.
5. Script PlayCanvas'ın **main** dalının kimliğini resmî Branches API üzerinden kendisi bulur; ayrıca branch ID girmen gerekmez.
6. PlayCanvas'ın **Assets** panelinde `paintballNations.js` script varlığını gör. Ayrı boş sahnede root `Scene` altında yeni bir **PaintballGame** Entity oluştur, **Script Component** ekle ve bu scripti Entity'ye bağla. **2D Screen altına ekleme.** Play'e basarak test et.
7. Sonraki `playcanvas/paintballNations.js` dosyası değişiklikleri, `main` dalına geldiğinde aktarılır.

### Güvenlik ve sınırlar

- Bu akış yalnızca script varlığını günceller; PlayCanvas sahnelerini veya mevcut oyun nesnelerini silmez.
- Aynı adla birden fazla asset bulunursa güvenlik için işlem durur.
- GitHub deposu **Public**; hiçbir tokenı, şifreyi veya kişisel bilgiyi commit etme.
- Script sözdizimi GitHub Actions içinde kontrol edilir, ancak Android üzerinde oyun performansı ve PlayCanvas Editor çalışması ayrıca test edilmelidir.
- PlayCanvas'ın `main` dalı otomatik seçilir. Yanlış dalı değiştirmemek için API'den `main` bulunamazsa işlem güvenle durur.
- İptal etmek için `PLAYCANVAS_SYNC_ENABLED` değerini `false` yapabilir, PlayCanvas'ta tokenı iptal edebilirsin.

## Referanslar

- [PlayCanvas REST API](https://developer.playcanvas.com/user-manual/api/)
- [Asset create](https://developer.playcanvas.com/user-manual/api/asset-create/)
- [Asset update](https://developer.playcanvas.com/user-manual/api/asset-update/)
- [Script ekleme](https://developer.playcanvas.com/user-manual/editor/scenes/components/script/)
