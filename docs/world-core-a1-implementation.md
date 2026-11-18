# Paintball Nations — A1 Dünya Çekirdeği Uygulama Durumu

**Tarih:** 18 Kasım 2026
**Durum:** PostgreSQL üzerinde test edilmiş, fakat 24/7 sunucuya henüz dağıtılmamış temel altyapı.

## Gerçekten uygulananlar

- packages/protocol/src/index.ts — sürümlü dünya, sektör ve kaynak veri tipleri.
- apps/game-backend/sql/001_world.sql — tek dünya, ülke/klan test takımları, Maçka sektörü, kaynak bakiyeleri, üs yapıları, işlem ve olay kayıtları.
- apps/game-backend/src/world-store.ts — transaction, sürümlü dünya anlık görüntüsü, zaman tabanlı üretim, kaynak harcama ve idempotent üs yükseltme.
- apps/game-backend/src/server.ts — sağlık ve dünya okuma API'si; operatör tokenı gerektiren kaynak ve yapı işlemleri.
- apps/game-backend/src/migrate.ts — iki kez çalıştırılabilen başlangıç SQL şeması.
- tests/world-core.test.ts — gerçek PostgreSQL veritabanında işlem tekrarları, eşzamanlılık, stok yetersizliği, rollback, üretim ve HTTP erişim testleri.
- .github/workflows/world-core-ci.yml — GitHub Actions üzerinde PostgreSQL 17 ve Node.js 22 ile test.

## Test kanıtı

https://github.com/bugsbuny243/paintball-nations/actions/runs/44369060443

TypeScript tip kontrolü başarılı. SQL şeması iki kez uygulanarak tekrar çalışabilirliği doğrulandı. Node test koşumunda 9 test geçti, 0 test başarısız oldu.

## A1 oyun kuralları — test değerleri

- Tek dünya ID: paintball-nations
- Maçka pilot sektör ID: TR-MACKA
- Başlangıç test sahibi: TR (sanal takım mülkiyeti)
- Test fraksiyonları: TR ve DE
- İlk bakiye: takım başına 100 pigment ve 100 malzeme
- Birinci seviye bina maliyeti: 10 pigment + 25 malzeme
- Dakikalık üretim: 2 pigment + 1 malzeme
- Depolama kapasitesi: 1000 birim
- Uzun ara sonrası tek işlemde yakalama üst sınırı: 60 dakika

Bunlar oyun dengesi için önerilen, değiştirilebilir başlangıç değerleridir; gerçek bir ülkeyi veya ekonomik veriyi temsil etmez.

## Güvenlik sınırları

Dünya API'sinde yazma eylemleri yalnız uzun operatör tokenı ile erişilebilen yönetim uçlarına bağlıdır. Operatör tokenı GitHub deposunda saklanmaz. Henüz normal oyuncu kimlik doğrulaması yoktur; bu nedenle oyuncunun kaynak harcayabileceği herkese açık bir uç açılmamıştır. Uygulamanın uzaktan erişilecek şekilde yayına alınması TLS, güvenli token saklama, hesap yönetimi ve ilave güvenlik çalışmaları gerektirir.

## Henüz uygulanmayanlar

Canlı PlayCanvas bağlantısı, Colyseus maç sunucusu, gerçek iki oyunculu/15v15 ağ oyunu, otomatik 24/7 ekonomi zamanlayıcısı, bot stratejisi, sektör fethi, kalıcı üretim veritabanı, mağaza ve çok sektörlü dünya henüz yok. Çalışan çevrim dışı Maçka antrenmanı korunmuştur.

## Sonraki teknik iş

Ortak protokol ile güvenli oyuncu oturumunu birleştirmek, Colyseus'ta iki gerçek istemcinin katıldığı Maçka odasını kurmak ve tüm hareket/maç sonuçlarını sunucuda doğrulamak. İkinci adımda maç sonucu tek dünya sektör durumuna güvenli ve tek seferlik işlem olarak bağlanacak.

Ana mimari: world-architecture-v2.md
Tam geliştirme kapıları: delivery-roadmap-v2.md
