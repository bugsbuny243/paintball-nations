# Paintball Nations — C3 Kalıcı Cephe / Bölge Sonuçları

**Tarih:** 22 Kasım 2026  
**Durum:** PostgreSQL 17'de gerçek işlem/yineleme/eşzamanlılık testleri **başarılı**. **Henüz Colyseus maç sonu olayıyla otomatik bağlanmadı; üretime dağıtılmadı.**

## Gerçekten uygulananlar

- `apps/game-backend/sql/003_frontlines.sql`: Maç kimliği, kaynak oda kimliği, saldıran-savunan ülke, çekişme durumu, işlem geçmişi, benzersiz açık cephe sınırı ve sektör mülkiyet tarihçesi.
- `apps/game-backend/src/frontline-store.ts`: **Sunucu içi** `begin`, `settle` ve `cancel` işlemleri. Oyunculara açık API oluşturulmadı.
- `apps/game-backend/src/migrate.ts`: 001 + 002 + 003 şemaları birlikte tekrar uygulanabilir.
- `apps/game-backend/src/world-store.ts`: Çekişmeli sektörde tesis geliştirme engellendi.
- `tests/frontline-settlement.test.ts`: PostgreSQL ile açılış, tekrar açılış, farklı maçın çakışması, sahte oda, puan çelişkisi, paralel sonuç, tarihe tek kayıt, farklı sonucun reddi, kazanan ülkenin üretimi, savunma, iptal ve yeniden başlatma senaryolarını sınar.
- `.github/workflows/world-core-ci.yml`: Dünya, pilot profili ve cephe testlerini birlikte koşar.

**Doğrulama:** https://github.com/bugsbuny243/paintball-nations/actions/runs/45017167171 — dünya 9/9, pilot profili 6/6, cephe 9/9: toplam 24/24 test başarılı. TypeScript ve tekrar migration da geçti.

## Tasarlanan veri akışı

1. **Yetkili maç koordinatörü**, sektör ve iki sanal ülke için benzersiz `battleId` üretir.
2. `begin`: sektör sahibi/saldıran ülke doğrulanır; **en fazla bir aktif maç** açılır ve bölge `CONTESTED` olur.
3. Sahadaki gerçek PlayCanvas/Colyseus oyuncuları sadece kontrol niyeti gönderir; kazanan ve sayılar **sunucuda** hesaplanmalıdır.
4. `settle`: kaynak oda kimliği, kazanan taraf ve puan tutarlılığı kontrol edilir; sonuç **tek PostgreSQL transaction** içinde sektöre uygulanır.
5. Dünya sürümü ve olay günlüğü bir kez güncellenir. Kaybeden önceki ülkenin geçmiş üretim süresi yeni sahibine aktarılmaz.
6. Aynı `battleId` ve aynı sonuç tekrar gelirse **ilk kayıt döndürülür**, farklı sonuç gelirse `409` benzeri bir işlem çatışmasıyla reddedilir (iç store hatası).
7. İptal edilen tamamlanmamış maç `cancel` ile `OWNED` durumuna döner; dünya ve geçmiş kayıtları tutarlı kalır.

## Sınırlar ve alınacak kararlar

**Bu kod gerçek bir 15'e 15 fethin yaşandığı anlamına gelmez.** Şu an gerçek oyun odasından otomatik `BattleResult` çağrısı yapılmıyor; testler güvenilir sunucu girdisini simüle ediyor. `FrontlineStore` fonksiyonları **asla** oyuncuya açık endpoint olarak sunulmamalı.

- Henüz otomatik maç başlangıcı / bitiş süresi / gerçek skor sonucu, draw/beraberlik kuralı, sahadaki kontrol hedefleri ve iddia doğrulayan sonuç protokolü yok.
- Sektör mülkiyeti değişince üretim **bir sonraki tickte** yeni ülkeye yazılır; lojistik/supply-route ve bot garnizonu sonucu henüz entegre değil.
- `TR-MACKA` tek pilot bölgedir. Başlangıç fraksiyonları TR ve DE deneme amaçlıdır; gerçek ülke mülkiyetini temsil etmez.
- Kalıcı pilot kimliği Colyseus'a girişte zaten doğrulanıyor (C2), ancak maç bitişinde `battleId` ve `FrontlineStore` henüz ilişkilendirilmedi.
- Mevcut Colyseus 0.18.10 invalid-matchmaking `ERR_HTTP_HEADERS_SENT` hata yolu hâlâ açık güvenlik bloklayıcısıdır.
- Kalıcı dünya için yedekleme, moderasyon, güncel maç geri dönüşümü ve gerçek 30 oyuncu yük testi olmadan herkese açık yayın yapılmaz.

## Sonraki uygulama (C4)

**Tek sunucu sürecinde uçtan uca Maçka karşılaşma yaşam döngüsü:** Her iki takım gerçek pilot oturumuyla katılır → sunucu `battleId` oluşturur → sektör çekişmeli işaretlenir → süre/stratejik hedeflere bağlı skor sunucuda kapanır → `FrontlineStore.settle` sonucu uygular → global dünya sürümü ve sektör sahipliği iki bağlı tarayıcıda güncellenir.

C3 güvenlik sınırı korunacak: istemci `winnerFactionId`, `worldVersion`, `resourceBalance` veya maç sonucunu kendisi gönderemez.

**İlgili planlar:** [Kalıcı Dünya V2](world-architecture-v2.md) · [Çekirdek Sistemler V1](paintball-nations-core-systems-v1.md) · [C2 Pilot Oda Oturumu](pilot-match-c2.md).
