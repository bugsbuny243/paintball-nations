# Paintball Nations — Tam Oyun Altyapı Kurulum Sırası ve Kabul Planı V2

**Statü:** Tasarım ve doğrulama planı. "Kabul kriteri" bir testtir; geçilmediyse özellik hazır değildir.  
**İlişkili belgeler:** [Tek dünya mimarisi](world-architecture-v2.md) · [Oyun/simülasyon sistemleri](world-game-systems-v2.md).  
**Hedef:** Yeni bir demo yerine, aynı monorepo içinde tek, kalıcı dünya ürününün tüm sistemlerini uçtan uca geliştirmek ve sürümlemek.

## 1) Envanter ve tasarım sınırı

| Sistem | Bugün ne var? | Tam oyunda gerekli | İş durum |
|---|---|---|---|
| PlayCanvas FPS | Mobil çevrim dışı boya antrenmanı | Otoriter ağ katmanı ve ortak UI | Mevcut prototip korunacak |
| Gerçek coğrafya | Maçka OSM, 56 yol / 18 bina / 3 yeşil alan | Navmesh, GLB tile, collider, atlas ve içerik sürümü | Deneysel geometri |
| Dünya sektörü | Yok | Tek worldId, sektörler, komşuluk, global sahiplik | Tasarlandı |
| Ülke/klan | Sadece antrenman menüsü ve maketler | Üyelik, roller, komuta, ittifak | Tasarlandı |
| Kaynak/ekonomi | Yok | Üretim/ikmal/harcama, ledger, maliyet | Tasarlandı |
| Üsler | Kurgusal üs çizimleri | Slot, yükseltme, savunma, bakım | Tasarlandı |
| Bot AI | Hareketli hedef ve maketler | Mikro/meso/makro AI ve garnizonlar | Tasarlandı |
| 15v15 | 15 kırmızı maket + oyuncu dahil 15 mavi slot | 30 *gerçek* ağ oturumu ve sunucu yetkisi | Tasarlandı |
| Satın alma | Yok | Kozmetik, güvenli katalog, işlem doğrulama | İleride, onay/yasa kontrolleri sonrası |
| Kalıcı yayın | Statik önizleme, GitHub workflow | Oyun API, World Coordinator, 24/7 WSS, PostgreSQL | Dağıtılmadı |
| CI | Browser smoke/sözdizimi ve OSM veri testi | DB/AI/network/yük/Android/failover | Genişletilecek |

## 2) Kod organizasyonu — planlanan monorepo

\`\`\`
paintball-nations/
  apps/
    web-game/                # PlayCanvas istemci: tek giriş / dünya + FPS
    game-backend/            # tek TypeScript Node runtime
      src/api/               # login, profil, katalog
      src/world/             # sector coordinator + events
      src/economy/           # resource ledger/production/supply
      src/faction/           # teams, clan roles, diplomacy
      src/command/           # intelligence/fog/commands
      src/ai/                # bot director, 3 simulation tiers
      src/rooms/             # Colyseus frontend battle room
      src/social/            # safety/abuse/moderation
  packages/
    protocol/                # versioned client/server events and schema
    rules/                   # economy, territory, battle and AI game rules
    world-map/               # global XZ / OSM projection / tile manifests
    ui-kit/                  # shared menus, HUD and state indication
  data/
    migrations/              # Postgres schema and constraints
    seeds/                   # local world generation (not paid/deployed)
  content/
    osm/                     # attributed raw and simplified OSM geometries
    tiles/                   # generated GLB/navmesh/collision/LOD
    equipment/               # free marker and cosmetic styles
  docs/
    world-architecture-v2.md
    world-game-systems-v2.md
    delivery-roadmap-v2.md
  tests/
    unit/                    # economy, fog, territory invariants
    integration/             # API+DB+world+single room
    e2e/                     # 2 real browser players / handoff
    load/                    # 30 network clients / tick and bandwidth
    chaos/                   # crash/replay/failover
    mobile/                  # real Android thermals and fps
  .github/workflows/
    tests-and-build.yml      # static checks, tests, staged artifact
    release.yml              # gated staging then prod, rollback
  # Existing index.html, maps/, playcanvas/ remain until migration verified
\`\`\`

**İlk tasarım ilkesi:** Bir modüler backend ile başla; gerçek ölçek ihtiyacı kanıtlanmadan sistemi on mikroservise ayırma. Klasör düzeni ölçeklendirme imkânını kapatmaz.

## 3) Uçtan uca işlerin zorunlu uygulanma sırası

Tüm sistemler tek nihai ürünü hedefler; iş paketleri bitmiş ayrı oyunlar olarak pazarlanmaz.

| Kapı | Tamamlanması gereken entegre yolculuk | Kesin kabul koşulları |
|---|---|---|
| A0 Mimari anlaşma | Modül sınırları, protokol, otorite, DB kimliği, taktik kurallar, harita lisansı netleşir | Protokol sürümü, sektör atomikliği, bot kaynak bütçesi ve güvenlik kontratları yazılı; çelişki yok |
| A1 Dünya çekirdeği | Sahibi belli bir sektörde kaynak üretilir, bir üs tesisi kurulur, dünya sürümü yükselir ve yeniden başlatınca korunur | Negatif kaynak yok, olay tekrarında çift harcama yok, restore testi |
| A2 İki kişi aynı dünyada | İki farklı browser cihazı aynı Maçka bölgesine giriş yapar, birbirini görür ve ortak takım sonucunu sunucu hesaplar | Yetkili hareket ve boya, reconnect, sunucu sahte skor mesajını reddeder |
| A3 Cephe değişimi | Takım Maçka sınırını kazanır → sektör sahibi güncellenir → ikmal ve ekonomi değişir → küresel harita güncellenir | Çift match sonucu mülkiyeti tekrar değiştiremez, çakışan battle test edilir |
| A4 Bot canlılığı | 0/3/10/30 oyunculu senaryolarda garnizon ve üretim boşa durmaz, botlar kaynak sınırına uyar | Mikro/meso/makro CPU ölçümü; bot etiketi; oyuncu yoksa sonsuz fetih yok |
| A5 30 kişi | Gerçek 15v15 ağı + tek dünya sektör sonucu + ülke/klan rol/komuta sistemi | 30 eşzamanlı bağlantı, hareket/isabet, state replication, gecikme, mobil bellek ve FPS raporu |
| A6 Büyük dünya | En az 2 bitişik sektör; güvenilir geçiş/koridorda asset streaming, görünür cephe değişimi | Sektör/oda geçişinde duplicate entity veya kayıp oturum yok |
| A7 Tam içerik | Ülke üsleri, lojistik, komuta, savunmalar, 5 temalı bölge ve ana UI | Her oynanış yolu aynı kod tabanından; bütün kaynak işlemleri otoriter |
| A8 Sosyal/ticari hazır | Profil, sıralama, moderasyon, kozmetik haklar, ödeme sandbox, gizlilik ve kullanım kuralları | Sandbox işlem doğrulama, idempotency, blok/rapor ve veri silme/erişim testleri |
| A9 Tam ürün yayını | 24/7 dünya, izleme, yedekleme, bölge savaşı, profil, bot, oyuncu ve kalıcı veri | Uçtan uca ve gerçek mobil saha testleri, performans ve maliyet limitleri, restore ve rollback |

**Sınır:** A2 "online oyun çalıştı" göstergesidir, "tam Paintball Nations bitti" göstergesi değildir. A9 öncesinde erken erişim yapılabilir ama eksikler açıkça listelenir.

## 4) Kapsamı koruyan tasarım sırası

**Önce detaylı tasarlanacak kontratlar:**
- Identity/session, faction permission, worldVersion, sector snapshot/delta.
- ClientInput / ServerCombatState / BattleResult.
- EconomyLedger, ResourceSpend, SupplyRouteResult, UpgradeStructure.
- AI policy/garrison budget and simulation catch-up.
- MapTileManifest / collision / renderer ABI.
- Reconnect and world room handoff.
- Moderation report and restricted communication.
- Catalog/Entitlement; gerçek ödeme sadece kontrol ve onay sonrası.

**Değişmez işletim kuralları**:
1. **Unique events:** \`world_id + event_id\`; kaynak ve sektör sonuçları idempotent.
2. **Authority:** Taraf değişikliği ve ekonomi yalnız sunucuda. İstemci yanıtı "işlendi" görünmeden eşya/dünya değişmiş gibi sunulmaz.
3. **Immutable evidence:** World event ve ledger tarihçesi ayıklanabilir, operatör eylemleri izlenebilir.
4. **Graceful degradation:** Postgres yoksa yeni sahiplik/resmi skor teslimi durur; yanlış sonuç yazılmaz.
5. **No false population:** Gerçek kullanıcı, gönüllü bot, dünya AI garnizonu UI'da ayrı istatistik.
6. **No pay advantage:** Kozmetik kayıtları oyun kuralları bağımlılık listesine erişemez.
7. **Client privacy:** Şeffaf yetkiler; oyuncu telefon konumuna erişim zorunluluğu yok.
8. **Map provenance:** Her tile OSM attribution ve lisans bilgisiyle sürümlü saklanır.

## 5) Ağ/ölçek hedefleri (test edilmemiş başlangıç varsayımları)

- **Maç kapasitesi:** 2 takım x en fazla 15 gerçek kullanıcı. Toplam dünya CCU, odaların toplamıdır; bir oda server kapasitesiyle karıştırılmamalıdır.
- **Simülasyon denemesi:** 20 Hz server authoritative combat; network snapshots 5–10 Hz AOI/interest management ile. Hedefler performans testinden sonra seçilir.
- **Dünya ekonomisi denemesi:** 1 dakika world tick; meso/macro AI aralığı ve sektör sayısı CPU ile uyarlanır.
- **Kopma kurtarma:** Kısa oturum/room reconnection limiti, tek aktif oturum, oda kapanmışsa checkpoint'e dön.
- **Yavaş cihazlar:** GLB tile LOD, batch, GPU memory ve draw-call metrikleri; sadece kritik tile önceden yüklenir.
- **Veri ölçeği:** OSM'deki her node'u kalıcı online entity olarak saklama. Ağda sektör id/owner/version, maçta ilgili dinamik entity gönder.
- **Yük denemesi:** 30 sanal bağlantı tek mobil cihaz performansını kanıtlamaz; gerçek Android testi ayrı geçmeli.

## 6) Risk testi kataloğu

| Test | Beklenen sistem davranışı |
|---|---|
| Aynı battle sonucu 3 kere gelir | Bir sektör sahipliği değişimi, bir ödül hareketi |
| İki oda aynı sektörü kazanır | Önceden tanımlı sektör lock/sürüm politikasıyla yalnız geçerli sonuç |
| Üs yükseltme iki cihazdan aynı anda | Bir kaynak harcaması ve bir yükseltme |
| Oyuncu bağlantısı cephede kopar | Yeniden bağlanır veya güvenli checkpoint'e döner |
| Bot 5 dakika sonra tekrar tick alır | Kaynak harcamaları bütçeyi ve tavanı aşmaz |
| Oyuncu hiç yokken 1 gün geçer | Dünya geçerli ekonomi özetiyle devam eder; savaş otomatik sonsuz fethe dönüşmez |
| Çok büyük klan tüm sektörü kaplar | Ana üs güvencesi / ikmal maliyeti / saldırı penceresi dengesi korunur |
| Yanlış istemci başka ülke stokunu görmeye çalışır | API ve state filtresi reddeder |
| İstemci ateş hızını keyfi artırır | Sunucu cooldown ve input rate sınırı uygular |
| Sunucu maç sonunda DB'ye erişemez | Sonuç kalıcıymış gibi gösterilmez; güvenli yeniden deneme |
| OSM tile CDN'den gelmez | Yeniden deneme, yeterli hata ekranı, yanlış/boş çatışma başlamaz |
| Satın alma webhook'u iki kez gelir | Tek kozmetik entitlement, kullanıcıya iki defa teslim yok |
| Bot kıtlığı olur | Görünür gerçek/bot sayaçları, açık erişimli katılım/üretim görevi |
| Çocuk kullanıcıya serbest metinle taciz | Güvenli varsayılan ayarlar, şikâyet/engelleme/moderasyon |
| Güncelleme mobil FPS'yi düşürür | Release gate ve sürüm geri dönüşü |

## 7) Dağıtım, maliyet, operasyon tasarımı

- **Depo:** Bugünkü GitHub tek kaynak; workflow ile test ve build.
- **Web istemcisi:** Küçük immutable sürümlü statik dosyalar/CDN. Mevcut ücretsiz önizleme üretim hosting olarak değerlendirilmez.
- **Backend:** Başlangıçta 1 kalıcı Node + PostgreSQL (Railway aday), staging ayrı DB; üretim ölçeklenince Colyseus çok proses + Redis presence/driver gerekebilir.
- **Ölçek:** CCU, boyalı hedef AI miktarı, sektör sayısı artınca ayrı process sınırları açılır. Sırf tasarımda var diye Redis/Kubernetes maliyeti başta açılmaz.
- **Güvenlik:** Prod sırları GitHub'a koyma, DB backup encryption, rate limit, WSS, izinli origin, bağımsız sonuç doğrulaması.
- **İzleme:** Sunucu p95 tick, WebSocket kopma, reconnect başarısı, ekonomi/outbox gecikme, bot CPU, odaların doluluğu, DB işlem kilidi, malzeme/sahiplik sapması.
- **Faturalandırma:** Saatlik servis/bellek/CPU/network/DB/backup sınırları görünür olacak. Kullanıcı onayı olmadan ücretli servis açılmaz.
- **Release:** Staging → 2 cihaz → 30 client → gerçek mobil cihaz → backup/rollback → prod. Hatalı sürüm tüm dünya verisini bozamamalı.

## 8) Karar kayıtları (öneri / henüz kod değil)

| ADR | Karar | Alternatif / neden erteledik |
|---|---|---|
| ADR-01 | Tek mantıksal dünya, sektör tabanlı işlem | Tek dev 3D server process ölçek riski |
| ADR-02 | Colyseus authoritative FPS room | Salt peer-to-peer hile/sahiplik riski |
| ADR-03 | Modüler Node TypeScript backend | İlk günden 15 microservice operasyon yükü |
| ADR-04 | Postgres tek kalıcı işlem kaynağı | Sadece Redis veri kaybı, client-side skor riski |
| ADR-05 | Outbox ile dünya etkileri | Maç DB commit + mesaj gönderme ikili yazma riski |
| ADR-06 | 3 AI simülasyon seviyesi | Tüm dünyada sürekli 3D bot işleme maliyeti |
| ADR-07 | Harita source OSM, custom spor içerik | Raster tile/tek parça dev 3D asset ve lisans riski |
| ADR-08 | Başta kozmetik, pay-to-win yok | Ücretli istatistik eşitsizliği ve oyun sağlığı |
| ADR-09 | Merkez üssü güvenli; ilerleyen toprak kapışması | Nüfusu düşük ülkenin oyundan silinmesi |
| ADR-10 | Gerçek oyuncu/bot ayrımı şeffaf | Sahte dolu dünya yanıltması |

## 9) Her sprint sonunda tek doğru soru
"Bu değişiklik **kalıcı dünyanın aynı kod tabanında** hangi uçtan uca davranışını tamamlıyor, hangi testle doğruladık?"

**Dikkat:** Sonraki adım sürüm A0 sözleşmelerini otomatik test/şemaya dönüştürüp ardından A1 dünya çekirdeği inşasıdır. Bu belgenin varlığı A1'in uygulanmış olduğu anlamına gelmez.
