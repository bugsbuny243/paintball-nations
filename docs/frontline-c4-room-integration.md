# Paintball Nations — C4 Colyseus Maç Sonu → Kalıcı Dünya

**Doğrulama tarihi:** 22 Kasım 2026  
**Durum:** İki doğrulanmış Colyseus pilot istemcisi ve PostgreSQL ile **otomatik entegrasyon testi başarılı**. **Canlı sunucu değil**, üretim modu kapalı. C4 yalnız özel bir geliştirme ayarıyla çalışır.

## Çalışan veri akışı

1. Colyseus Maçka odası oluşturulur. C4 yalnızca `DEV_ENABLE_FRONTLINES=1` ve `DEV_REQUIRE_PILOT=1` birlikteyken etkin olur; normal çevrim dışı oyun ve C2 misafir modu etkilenmez.
2. İki farklı oyun içi ülkeye (`TR` ve `DE`) ait pilotlar, PostgreSQL’de hâlâ geçerli oturuma dayalı C2 imzalı maç biletiyle bağlanır. Oda takım bilgisini istemci isteğinden değil, doğrulanmış biletten alır.
3. Her iki takım aynı odadaysa sunucu `TR-MACKA` sektörünün gerçek veritabanı sahibini okur, karşı tarafı saldıran olarak belirler. `FrontlineStore.begin()` ile benzersiz `battleId` açılır; sektör `CONTESTED` olur.
4. Colyseus, istemciden yalnız hareket/atış niyeti kabul eder. Sanal paintball isabetleri ve mavi/kırmızı skor sunucuda hesaplanır. **Oyuncuların `winnerFactionId`, `ownerFactionId`, `score` veya `worldVersion` yazma yetkisi yoktur.**
5. Maç süresi dolduğunda son sunucu skoru kilitlenir; yeni hareket/atış girdileri sonucu değiştiremez. Varsayılan geliştirici tur süresi 150.000 ms (2 dakika 30 saniye), sınırları 1–600 saniyedir. CI testinde yalnız hız için 2 saniye kullanılır.
6. Skorlar eşitse veya her iki ülke artık temsil edilmiyorsa `FrontlineStore.cancel()` ile sektör korunur. Kazanan varsa `FrontlineStore.settle()` tek PostgreSQL işlemiyle sonuç, olay ve sektör sahibini kaydeder.
7. Sonuç `world_state` mesajıyla `sectorId`, durum, sahip ülke, dünya sürümü ve sonuç etiketi olarak odaya yayınlanır.
8. PlayCanvas Maçka HUD’u `world_state` bildirimini dinler, "Çekişmeli / Fethedildi / Savunuldu / Berabere" durumlarını ve sahibi gösterir.
9. Oda süre dolmadan kapanırsa `onDispose` açık cepheyi iptal etmeyi dener. Sunucu/veritabanı çökmesindeki yetim `OPEN` kayıtlar için ileride zamanlanmış kurtarma mekanizması gereklidir.

## Kod

| Kaynak | İşlev |
|---|---|
| `apps/game-backend/src/rooms/frontline-lifecycle.ts` | Bir odanın açılış/maç saati/sonuç/iptal yaşam döngüsü; son skorun sabitlenmesi, güvenli tekrar deneme |
| `apps/game-backend/src/rooms/macka-room.ts` | Yalnız pilotlu geliştirme C4 anahtarı, sunucu maç döngüsü ve `world_state` yayını |
| `apps/game-backend/src/frontline-store.ts` | C3 atomik ve idempotent dünya sahipliği işlemleri |
| `maps/macka-online-client.js` | Mobil/web oyun HUD’unda dünya sahibini ve durumunu görüntüleme |
| `tests/frontline-room.test.ts` | İki gerçek Colyseus bağlantısı, fethin veritabanına yazılması, dünya bildirimi, sahte alanların reddi, skor kilidi ve beraberlik |
| `.github/workflows/online-ci.yml` | TypeScript, paket derleme, PostgreSQL şema, ağ ve iki Chrome tarayıcılı regresyon testleri |

**Güncel başarılı GitHub Actions:** https://github.com/bugsbuny243/paintball-nations/actions/runs/45018585732

- Colyseus/oyun oturumu ağ testleri **8/8 geçti, 0 başarısız**; bunlardan biri C4'ün iki pilotla gerçek oda ve PostgreSQL entegrasyon testidir.
- TypeScript, tarayıcı bundle ve DB migration başarılı.
- İki gerçek Chrome/PlayCanvas tarayıcısıyla **mevcut** C2 misafir ve pilot bağlantı regresyonları başarılı.
- **Önemli test sınırı:** C4'ün `world_state` ağ mesajı SDK testinde doğrulandı. C4 etkin modundaki HUD görseli henüz gerçek Android/Chrome uçtan uca testinde ayrıca doğrulanmadı. Testteki maç sonucu, gerçek oyuncunun simüle edilmiş bir sunucu isabetiyle temsil edildi; tam oyuncu maçı/yük testi yapılmadı.
- Önceden bağımsız çalışan C3 PostgreSQL mülkiyet işlem testleri 24/24 geçti: https://github.com/bugsbuny243/paintball-nations/actions/runs/45017167171

## Çözümlenmemiş meseleler

- **Güncel A3/C2 ağ testleri:** Geçersiz/biletsiz bilet, iptal edilmiş pilot ve bilinmeyen oda isteği [izole test sürecinde reddedildi](https://github.com/bugsbuny243/paintball-nations/actions/runs/45038047401). Önceki çoklu `boot()` düzeninde görülen `ERR_HTTP_HEADERS_SENT` operasyonel yeniden başlatma ve süreç toparlama açısından henüz kapatılmış değildir. Kamuya açık dağıtım engeli devam ediyor.
- Maç bitmeden hesap oturumunun iptali o andaki oyuncuyu derhâl atma politikasına bağlı değil.
- Kısa süreli ağ bağlantı kopuşları, süreç çökmesi, DB kesintisi ve yeniden katılım sırasında dünya fethini tamamlayıcı operasyonel testler eksik.
- Maç sonucu şimdilik oyuncu isabet skorlarına dayanıyor; oyuncunun yüksek zekâ/strateji katkısını ölçen kontrol noktası, ikmal, istihbarat ve komutanlık puanları henüz C4'e bağlanmadı.
- **30 gerçek eşzamanlı oyuncu**, gerçek Android performansı, moderasyon, kalıcı hesap kurtarma, HTTPS/WSS operasyonu, yük testleri ve 7/24 sunucu henüz yok. C4 sistemi güvenlik nedeniyle varsayılan olarak **kapalı**.
- Dünya hâlâ tek Maçka pilot sektörüyle çalışıyor; çok sektörlü kıtasal dünya, ülke/klan merkezi, bot garnizonu ve özelleştirilmiş üretim tesisleri tasarımda.

## Sonraki kabul kapısı: C5

Çok oyunculu dünyanın merkezi için **yetkili sektör yaşam döngüsü kurtarma işi**, stratejik kontrol noktaları / ikmal hedefleri ve maç içinde görünen dünya haritasının gerçek oyuncularla Chrome/Android testleri. Yeniden başlatma/yanlış oturum dayanıklılığı, üretim hesap güvenliği ve yük testi tamamlanmadan kamuya açık sürüme geçilmeyecek.

**Bağlantılı belgeler:** [C3 dünya fethi veri katmanı](frontline-c3-implementation.md), [C2 pilot bağlantısı](pilot-match-c2.md), [Çekirdek sistemler V1](paintball-nations-core-systems-v1.md).
