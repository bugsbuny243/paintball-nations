# Paintball Nations — A2 Maçka Çevrim İçi Altyapısı

**Tarih:** 18 Kasım 2026
**Durum:** Colyseus çok oyunculu ağ prototipi ve iki gerçek tarayıcı testi başarılı. Kalıcı bulut sunucusu **yok**; canlı 15v15 MMO tamamlandı iddiası **yok**.

## Uygulanan parçalar

- `apps/game-backend/src/online-server.ts` — Colyseus sunucu başlangıcı, `macka_frontline` oda tanımı; kimlik doğrulaması bulunmadığı için üretim ortamında açılması bilinçli olarak engellenir.
- `apps/game-backend/src/rooms/macka-room.ts` — en fazla 30 insan oturumuna uygun oda; giriş/çıkış, 100 ms aralıklı durum yayını, giriş mesajlarının sunucuya iletilmesi, 12 saniyelik kesinti sonrası yeniden bağlanma olanağı (tam uçtan uca yeniden bağlanma henüz test edilmedi).
- `apps/game-backend/src/rooms/macka-simulation.ts` — sunucu otoriteli 2D konum/hareket, OSM bina tabanlı çarpışma sınırları, sanal spor boya isabetleri, takım puanı. Kullanıcının gönderebildiği girdi hareket eksenleri, bakış yönü ve atış sinyalidir; koordinat/puan taklidi işlem görmez.
- `maps/macka-online-client.js` — PlayCanvas Maçka görüntüleyicisine bağlı çevrim içi istemci, sunucudan gelen diğer oyuncuların 3D gösterimi, mobil kontrol paylaşımı, canlı insan/bot sayacı, skor.
- `maps/macka-online.bundle.js` — GitHub Actions tarafından oluşturulan derlenmiş tarayıcı istemcisi.
- `maps/macka-viewer.js` — ağlı modda yerel konumu sunucudan okuyacak kontrol geçişi.
- `maps/macka.html` — çevrim içi istemci yalnızca `?online=1` parametresiyle yüklenir. Eski `?play=1` çevrim dışı antrenmanını değiştirmez.
- `tests/online-macka.test.ts` — iki gerçek Colyseus istemcisinin aynı odaya girmesi, gerçek kullanıcı sayısı, konum replikasyonu, geçersiz girdi ve istemcinin sahte skorunu reddetme.
- `tests/smoke-online-macka.mjs` — iki gerçek Chrome/PlayCanvas penceresi, aynı Maçka odası, canlı avatar ve uzaktan görünen konum değişikliği.
- `.github/workflows/online-ci.yml` — tip kontrolü, Colyseus testleri, tarayıcı paketi derleme, Chrome entegrasyon testi, başarılıysa derlenen JS'yi GitHub'a otomatik kaydetme.

## Bağımsız doğrulamalar

A2 test koşumu: https://github.com/bugsbuny243/paintball-nations/actions/runs/44389900415

- TypeScript kontrolü: geçti.
- İki gerçek Colyseus SDK bağlantısı: geçti.
- Gerçek Chrome'da iki PlayCanvas sekmesi: geçti.
- Aynı 3D OSM haritasında diğer oyuncu modeli: görüldü.
- Sunucudan gelen hareket değişikliği iki tarafta: doğrulandı.
- Derlenmiş web istemcisi GitHub'a kaydedildi.

Bu, internetten rastgele iki kullanıcının 24/7 açık bir sunucuya bağlandığını kanıtlamaz. Chrome testi GitHub çalıştırıcısında geçici, yerel HTTP ve WebSocket sunucusuyla yapıldı.

## Oyun modu ayrımı

- Çevrim dışı Maçka antrenmanı: `maps/macka.html?play=1`
- Kuşbakışı harita: `maps/macka.html`
- A2 ağlı Maçka test istemcisi: `maps/macka.html?online=1`

Çevrim içi test istemcisi **canlı sunucu dağıtılmadığı için** genel kullanımda bağlanamaz. Testte aynı makinedeki `http://127.0.0.1:2567` Colyseus sunucusu kullanılır. İleride TLS/WSS üzerinden barındırılacak, yaşa uygun kimlik ve hesap erişimiyle açılacaktır.

## Güvenlik sınırları

Henüz hesap/oyuncu kimliği yok, bu nedenle Colyseus test sunucusu doğrudan kamuya açık üretim hizmeti olarak dağıtılmamalıdır. Gerçek oyuncu listesi ve bot sayıları açıkça ayrı gösterilir. Girdi hızları, hareket, isabet ve takımlar sunucu kurallarıyla sınırlandırılır. Yakın haritanın OSM geometri dosyaları sunucu ve istemcide aynı sürüm olmalıdır; dünya/ülke sahipliği bu oda testinde değişmez.

## Sonraki bütünleşik adımlar

1. A2.1: Güvenli oyuncu oturumu ve kimlik bileti; gerçek cihazdan WSS girişi ve kesintiden geri bağlanma testi.
2. A3: Maç/cephe sonucunu A1 PostgreSQL dünya işlemine tek seferlik kayıt olarak bağlama.
3. A4: Bot garnizonu ve dünya ekonomisi, düşük nüfus için kurallı/izlenebilir simülasyon.
4. A5: 30 gerçek istemci bağlantısı ve Android FPS/memory testleri.

Büyük strateji-FPS MMO fikri [dünya mimarisi V2](world-architecture-v2.md) üzerinden geliştirilmeye devam ediyor; A2 yalnızca ilk çevrim içi katmandır.
