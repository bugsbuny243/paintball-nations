# Paintball Nations — Kalıcı Dünya / FPS / Strateji Altyapısı V2
**Tarih:** 18 Kasım 2026  
**Statü:** *Önerilen bütüncül mimari tasarım*. Dosyanın GitHub'a yazılması, sunucu veya sistemlerin uygulanıp test edildiği anlamına gelmez.  
**Ürün:** Tek ve kalıcı çok oyunculu oyun; FPS paintball karşılaşmaları + ülke/klan stratejisi + kaynak zinciri + üsler + lojistik + savunma botları + dünya ekonomisi.  
**Mevcut sürüm:** OSM Maçka verili çevrim dışı FPS antrenmanı, iki tarayıcı arasında gerçek oyun henüz yok.

## 0. Yönetici özeti ve vazgeçilmez ilkeler
1. **Tek mantıksal dünya**: Ülkelerin sınırları, üsleri, kaynakları ve cephe sonuçları tek otoriter kayıt sisteminde yaşar. Sırf harita çok büyük diye ayrı, tutarsız oyuncu evrenleri oluşturulmaz.
2. **Tek fiziksel sunucu şart değildir**: Oyuncu açısından tek dünya; sunucuda sektör ve maç odalarına bölünebilir. Harita, aynı koordinat ve aynı dünya tarihçesini kullanır.
3. **Cephe savaşları 15v15**: Aynı sınırda birden fazla çatışma olabilir. Her savaşın 30 *gerçek oyuncu* üst sınırı vardır. Botlar ayrıca ve açıkça işaretlenir.
4. **FPS tek başına yeterli değil**: İstihbarat, lojistik, doğru yatırım, diplomasi, takım komutası ve kaynak kesintileri önemli karşı hamleler sunmalıdır.
5. **İstemci güvenilmezdir**: Oyuncu hareket ve eylem *niyeti* gönderir. İsabet, ele geçirme, stok, para, maç sonucu ve ödül sunucuda doğrulanır.
6. **Offline dünya dondurulmaz**: Arka planda düşük sıklıklı ekonomi, bölge ve bot simülasyonu işler; aktif bölgelerde tam hareket/FPS simülasyonu çalışır.
7. **Fair play ve eşit erişim**: Ücretli oyun gücü, ücretli rastgele ganimet kutusu yoktur; premium içerik yalnız kozmetik veya benzer rekabet dışı görseldir.
8. **Önce bütün mimari, ardından bütünleşik dikey oyun döngüleri**: Her uygulama adımı aynı oyunu ilerletir. Test edilmeyen hiçbir vaat tamamlandı diye sunulmaz.
9. **Android önceliği**: Telefonda geliştirme/yönetim yapılabilir; yerelde Unity, masaüstü veya pahalı sanal masaüstü gerekmemelidir. Sunucu maliyeti ise ayrı bir konudur.

## 1. Mantıksal dünya ve coğrafya

### Dünya topolojisi
- **WorldId**: Tek üretim dünyası. Sezon sıfırlaması zorunlu değil; sezon puanı sıfırlanabilir fakat oyuncu altyapısına etkisi önceden duyurulur.
- **Sector**: Kalıcı benzersiz ID, arazi verisi, komşu sektörler, ülke/klan sahipliği, savunma değeri, kaynak noktaları, tesisler, ikmal yolları, etkin cepheler, OSM referansı, son sürüm.
- **MapTile**: Çizim amaçlı küçük çevre verisi/GLB, LOD, çarpışma ve navmesh. Sektör = oyun/sahiplik birimi, tile = görsel akış birimi; birbirine karıştırılmaz.
- **Frontline**: Sınırda bitişik sahiplik bölgeleri arasında çatışma hakkı. Her frontline savaşının benzersiz ID'si, iki tarafı, hedefi, zaman penceresi ve room ID'si vardır.
- **Base**: Ülkenin güvenli ana üssü ve ele geçirilebilir ileri karakolları ayrı tiplerdir. Ana üs yok edilip yeni/az oyunculu ülke oyundan çıkarılmaz.
- **Global koordinat**: OSM için WGS84 kaynak koordinat; oyun için metre tabanlı yerel X/Z + yüksekliği belirleyen Y. Her tile'ın dünya dönüşümü ve sürümü manifestte tanımlanır. Sınırda sesli/ışıklı görsel kopma olmamalı.
- **OSM sınırı**: Sokak ve bina *yerleşimi* gerçek geometride olabilir; şato, boya tesisi, cephe hattı, kule ve spor bariyeri özgün sanal içeriktir. Eksik bina yükseklikleri "tahmini" olarak tutulur.
- **Büyütme**: İstanbul Maçka pilotu → ülke çapında sınırlı sektörler → tek dünyada yeni şehir/ülkeler. 1:1 Dünya yüzeyinin tümünün oynanabilir olması bir V1 koşulu değildir. Birbirinden kopuk rastgele beş arena yerine, global dünya haritasına bağlı stratejik yerler olmalıdır.

### Sector statü makinesi
\`NEUTRAL → OWNED → CONTESTED → RESOLVING → OWNED\`. Duyuru veya savaş başlatma yalnız yetkili komuta/sunucu kurallarıyla yapılır; aynı sektör için birden fazla sonucu aynı anda işleyip mülkiyeti çift değiştirmek yasaktır.

### Oyuncu/cephe deneyimi
- Dünya haritasında global sahiplik/ekonomi aynı kaynaktan görünür.
- Oyuncu üssünden lojistik hattına ve cepheye gidip kuyruk/çatışma noktasına katılabilir.
- İlk sürümde 15v15 aktif cepheler **ayrı sunucu room'u** olabilir, fakat maç sonucu anında ve tek bir işlemle dünya sektörüne yansır.
- Daha sonra sınır geçişini gizleyen "handoff" ve aynı anda görünür komşu sektörlere ilgililik alanı (AOI) eklenir. Kesintisiz geçişi *başlangıçtan tamamlandı* saymıyoruz; ciddi ağ/ölçek testi gerekir.
- Sadece ekranı kapatıp tekrar açmak bölge sahipliğini değiştirmemelidir.

## 2. Çalışma zamanı: basit başlangıç, açık büyüme yolu

\`\`\`mermaid
flowchart TB
 C["Android / Web PlayCanvas Client<br/>Girdi, grafik, mobil UI"] -->|HTTPS| A["Game API / Gateway<br/>Oturum, profil, katalog"]
 C -->|WSS| F["Colyseus Frontline Rooms<br/>sunucu yetkili FPS, 15v15"]
 C -->|HTTPS / WSS| W["World Coordinator<br/>Sektör, ekonomi, üsler, AI makro"]
 W -->|battle ticket + version| F
 F -->|BattleResult: idempotent| W
 W --> P[("PostgreSQL: Kalıcı dünya")]
 A --> P
 W --> J["Outbox / Event Journal"]
 J --> R["Sıralama, bildirim, analiz türevleri"]
 M["OSM Geodata + Harita Derleme"] --> S["Statik 3D Tiles / CDN"]
 S --> C
 B["Bot Director: Aktif savaş / Uzak özet"] --> F
 B --> W
 W --> A
 \`\`\`

**Başlangıç dağıtımı**: Node.js + TypeScript içindeki modüler tek backend (API/World/Room aynı process içinde ayrı sorumluluklar) + PostgreSQL + statik PlayCanvas. Kritik yük çıkınca API/World/Room ayrı süreçlere ayrılabilir. Başlangıçta Redis, message broker, ayrı bot sunucuları, Kubernetes **zorunlu değil**.

**Büyüme yolu**: Colyseus odaları ayrı süreçlere dağıtılır; çok süreçte presence ve room driver için paylaşılmış altyapı gerekir. Colyseus dokümanındaki Redis seçenekleri ölçeklendirme aşamasında değerlendirilir. Dünya koordinatörü sektör sahipliğini PostgreSQL işlem sınırlarıyla korur. Tek bir Colyseus Room = tek evren **değildir**.

**Barındırma kararı**: Prototip GitHub Actions + statik dosyalarla geliştirilebilir; gerçek zamanlı 24/7 oyunda sürekli çalışan backend/DB gerekir. Railway, kalıcı Node servislerini destekleyen **aday** altyapıdır; mevcut Railway hesabının bağlanmış olması bu oyunun konuşlandırıldığı anlamına gelmez. Ücretli dağıtım için kullanıcı onayı gerekir.

## 3. Modül kayıt defteri ve tek sorumluluk

| ID | Modül | Sorumluluk | Otorite / bağımlılık |
|---|---|---|---|
| M01 | Game Client | PlayCanvas FPS, harita akışı, HUD, strateji panosu, ayarlar | Girdi/istek gönderir, puan/sahiplik hesaplayamaz |
| M02 | Gateway/Identity | Giriş, misafir, ülke/klan profili, oturum, API yetkileri | Tek hesap, kısa süreli bağlantı bileti |
| M03 | World Coordinator | Tek dünya sürümü, sektör sahipliği, kural yürütme, bölge savaş yaşam döngüsü | M09 DB; tüm dünya değişikliklerini atomik işlemler |
| M04 | Economy & Logistics | Üretim, depolama, nakliye, tüketim, kaynak defteri, altyapı yükseltmeleri | M03/M09; negatif stok yasak |
| M05 | Territory & Diplomacy | Komşuluk, kuşatma/ele geçirme, ittifak süreleri, saldırı saatleri, üstünlük dengelemesi | M03, M04, M09 |
| M06 | Frontline Combat | 15v15 Colyseus rooms, girdi, hareket, boya isabeti, sonuç, yeniden bağlanma | Sunucu sonuç yetkilisi; M03'e yalnız onaylı BattleResult |
| M07 | Bot Director | AI bot garnizonları, komuta kuralları, aktif bot taktikleri, düşük nüfus simülasyonu | M03/M04/M06; açık oyuncu/bot ayrımı |
| M08 | Intelligence & Command | Keşif, görüş, harita sisleri, komutan işaretleri, emirler, ittifak bilgisi | Bilgi yetkisini M02/M03 belirler |
| M09 | Persistence | Postgres tabloları, sektör sürümleri, ledger, battle sonuçları, event outbox, geri dönüş | İşlem/tekilleştirme/backup |
| M10 | Map Pipeline | OSM kaynak, GLB/LOD, çarpışma, yollar, navmesh, tile manifest, atıf | Salt-okunur sürümlü içerik; üretim sırasında OSM'ye canlı çağrı yok |
| M11 | Cosmetics & Payments | Kozmetik katalog, envanter, teslimat; ödeme webhook doğrulama | İstemci "ödeme yaptım" dediği için yetki verilmez |
| M12 | Social, Safety & Moderation | Arkadaş/klan yönetimi, raporlama, sosyal iletişim kuralları, istismar önleme | Yaşa uygun iletişim varsayılanları, ölçülü veri |
| M13 | Operations | CI, tek sürüm, test, izleme, maliyet, sürüm geri alma, erişilebilirlik | Korunan ana dal, sır yönetimi ve ortam ayrımı |
| M14 | Strategy AI / Balance | Bot saldırı ve kaynak tercihleri, sezon dengesi, anti-snowball | Açıklanabilir karar ağacı; gizli AI ücret avantajı yok |

## 4. Güven sınırları, protokol ve sunucu sözleşmeleri

### İstemcinin gönderebildikleri
- \`SessionJoin {protocolVersion, worldId, ticket}\`
- \`PlayerInput {seq, clientTick, moveX, moveZ, lookYaw, lookPitch, fire, stance}\`
- \`CommandIntent {clientIdempotencyKey, targetSectorId, commandType, arguments}\`
- \`BuildIntent {key, baseId, buildingType, slotId}\`
- \`TradeIntent {key, resourceType, amount, destinationBase}\`
- \`QueueFrontline {sectorId, factionId, partyId}\`
- \`ChatSignal {presetSignalId, sectorId}\` (serbest metin ilk sürüm için şart değil)

### Sunucunun döndürdükleri
- \`WorldSnapshot {worldVersion, sectors[], resources[], serverTime}\` (*yalnız yetkili/fog of war ile izin verilen alanlar*)
- \`WorldDelta {baseVersion, nextVersion, changes[]}\` (version atlandıysa tekrar snapshot)
- \`RoomJoined {roomId, team, playerSlot, spawn, mapAssetVersion}\`
- \`CombatSnapshot {tick, entities[], matchClock, score}\`
- \`PaintHit {tick, shooterId, targetId, paintType, award}\`
- \`FrontlineEnded {battleId, winningFactionId, outcome, worldVersion}\`
- \`InventoryChanged {ledgerVersion, items[]}\`

**Sözleşme kuralları:** Oturum doğrulama; tip/limit/tekrar kontrolü; sequence monotonic; flood/rate limit; input artıkları reddedilir; her dış API için sürüm; benzersiz \`commandId\`, \`battleId\` ve \`idempotencyKey\` ile tekrar mesajlar ikinci kez stok/ödül/sahiplik değiştirmez.

**Otoriter combat:** Sunucu hareket hızı, konum, çarpışma, menzil, boya isabeti, cephane/atıcı süresi, yeniden doğma, maç süresi ve puanı doğrular. Colyseus 0.18+ sabit tick, istemci tahmini ve gecikme telafisi için API'ler sağlıyor, fakat oyuna özel fizik ve çarpışma testleri yine gerekli.

**Oda/sınır devri:** Bir oyuncunun aynı anda iki frontline odasında aktif combat hakkı olamaz. Geçiş bileti kısa süreli, tek kullanımlık ve sunucu onaylıdır. Kaybedilen bağlantı için süre sınırlı yeniden bağlanma; ardından güvenli üs/son checkpoint'e dönüş. Sektör savaşı kapanmışsa eski odaya dönülmez.

## 5. Kalıcı veriler ve tutarlılık

**Minimum mantıksal veri modeli** (fiziksel SQL henüz tasarlanmadı):

| Varlık | Çekirdek alanlar | Korunması gereken kural |
|---|---|---|
| player | player_id, account_state, display_name, faction_id, profile_version | Benzersiz kimlik, hesap yaş/mahremiyet kuralları |
| faction / clan / membership | faction_id, clan_id, role, membership_version | Rol değişiklikleri izlenir, üye yetkileri denetlenir |
| sector | sector_id, tile_manifest_id, owner_faction_id, state, version | Her sektör için tek güncel sahiplik |
| border / supply_route | from_sector, to_sector, capacity, status, version | Kaynak üretimi lojistikten bağımsız sınırsız olamaz |
| base / structure | base_id, sector_id, owner, type, level, defense, version | Yükseltme için kaynak kaydı ile eşzamanlı işlem |
| resource_balance | owner_id, resource_type, quantity, version | \`quantity >= 0\`, sınır/aşım koruması |
| resource_ledger | tx_id, actor, source, destination, amount, reason, created_at | Tekilleştirme ve değişiklik izi |
| frontline / battle | battle_id, sector_id, room_id, status, attacker/defender, result_version | Tek battle sonuç kaydı |
| battle_participant | battle_id, player_id, faction_id, score, is_bot | Botu oyuncu diye gösterme |
| sector_ownership_history | event_id, old_owner, new_owner, battle_id, server_time | Geri izlenebilir tarihçe |
| bot_garrison / ai_policy | sector_id, level, budget, behavior_policy, last_simulated_at | Üretim maliyeti ve AI karar sınırı |
| world_event / outbox | event_id, aggregate_id, version, payload, published_at | Tekrarlanan olay etkisiz |
| season / leaderboard | season_id, faction_id, computed_from | Liderlik tablosu sunucudan türetilir |
| item / entitlement / order | item_id, player_id, payment_ref, status | Ücretli hak yalnız doğrulanmış işlemle |
| report / sanction | actor, target, reason, reviewed_status | Moderasyon ve hesap mahremiyeti |

**Temel akış (boya kaynağı ele geçirme)**:
1. Saldıran takım sınır cephesinde ilgili hedefi tamamlar.
2. M06 \`BattleResult\` üretir; gönderici ve kazanan takım sunucudan doğrulanır.
3. M03, PostgreSQL transaction içinde battle_id'nin daha önce uygulanıp uygulanmadığını kontrol eder.
4. Sector row lock/version ile doğrular: bölge durumu, karşılık gelen battle, kaynak kesintisi ve geçerli saldırı koşulları.
5. Sector sahibi, kaynak/lojistik sonuçları, tarihçe ve outbox **tek işlemde** yazılır.
6. Commit'ten sonra istemcilere worldVersion delta yayılır; başarısız yayım outbox'tan tekrar denenir.
7. Crash/retry durumunda aynı battle sonucu **bir kez** uygulanır.

**Yedekleme**: RPO/RTO hedefleri prod öncesi tanımlanır ve restore tatbikatıyla doğrulanır. Geçici bot kararları yeniden üretilebilir; mülkiyet, envanter ve ledger kaybolamaz. Veritabanı kapalıyken battle sonuçları kalıcı hale gelmiş gibi gösterilmez; kuyruk/maç modunda güvenli bozunma uygulanır.

## 6. Simülasyon katmanları: dünya boşalmayacak

| Katman | Etkin olduğu yer | Planlanan işlem tarzı | Kalıcılık |
|---|---|---|---|
| MICRO — Aktif FPS | Gerçek oyuncuların bulunduğu cepheler/üsler | Sunucu otoriteli sabit FPS tick; bot hareket/atış, çarpışma, network state | Oda canlı; sonuç/world event kalıcı |
| MESO — Yakın garnizon | Oyuncuya yakın ama doğrudan savaş olmayan bölgeler | Daha seyrek devriye/ikmal ve olay güncellemesi | Son durum/snapshot |
| MACRO — Uzak dünya | Görülmeyen binlerce bölge | Dakika bazında üretim/tüketim, savaş katsayıları, ikmal durumları ve AI karar özeti | DB snapshot + event |

**Ölçüm için ilk deneme değerleri (henüz test edilmedi):** micro 20 Hz; istemciye güncelleme 5–10 Hz, macro 60 saniye; uzak AI sektör değerlendirmesi 5–15 dakika. Bunlar vaat değil; gerçek Android ve 30 kullanıcı stres testine göre değiştirilecek.

**Bot ilkeleri**:
- Oyuncu sayısı düşerken garnizonları güçlendirebilir; bot adedi savunma bütçesi/supply ile sınırlandırılır.
- Oyuncu yoksa dünya hareketi durmaz ama sınırsız otomatik fetih de olmaz.
- Botlar da ekonomik kaynak tüketir, görüş/ikmal kurallarına uyar, özel gizli avantaj almaz.
- Bir cepheye giren gerçek oyuncular için bot seviyesi hesaplı ve anlaşılır şekilde ayarlanır.
- Kullanıcı arayüzü **15/15 oyuncu var** diye sahte iddia kurmaz: \`Gerçek oyuncu 3 + bot 12\` gibi açıkça gösterilir.
- Harita aylar içinde sadece büyük ülkelerin eline geçmesin diye güvenli ana üs, ikmal verim kaybı, tedarik maliyeti ve yeniden toparlanma kuralı gerekir.

## 7. Stratejik zeka — kazanma yolu

Amaç gerçek insan IQ puanı toplamak **değil**; akıllıca planları ödüllendirmek.

- **Kısıtlı bilgi**: Rakiplerin tüm hareketleri gözükmez; keşif, sahte iz, iz sürme ve karşı istihbarat sistemleri vardır. Tarafların tutarlı bilgi erişim sınırları sunucu tarafından korunur.
- **Ekonomik seçim**: Pigment, koruyucu malzeme, enerji/lojistik kapasitesi ayrı kaynaklar olabilir; aşırı üretim depolama veya lojistik tavanına çarpar.
- **Karşı hamle**: Kule savunmasının altyapı maliyeti ve kör noktaları, hızlı saldırının ikmal maliyeti, ağır savunmanın hareket kısıtı gibi dengeleyici etkiler olur.
- **Komuta rollerinin etki alanı**: Bölge komutanı rota işaretleme, savunma emri, takviye önceliği belirleme; tek kişi tüm klanın kaynaklarını geri dönüşsüz harcayamaz.
- **Oyuncu katkısı**: Nişan alma, keşif, nakliye, üs yapımı, diplomasi ve takım organizasyonu başarıya ayrı ayrı katkı verir.
- **Ülkeler**: Takımlar oyun içi tercihle seçilir. Gerçek milliyet kanıtı veya oyuncunun bulunduğu gerçek konuma erişim gerekmez; ülke teması nefret söylemi veya hedef göstermeye dönüşmez.

## 8. Çok oyunculu performans, güvenlik ve yaşa uygun tasarım

**Oyun içi güvenlik**
- Hesapta server-issued session + TLS/WSS; raw playerId ve nick güvenlik sınırı değildir.
- Hareket/firing rate limit, görünürlük kontrolü, tekrar paket ve hız hilesi koruması.
- İstemcide görünmemesi gereken rakip bilgisi gönderilmez; fog-of-war sadece UI maskelemesi değildir.
- Ücretli ekipman **yalnız kozmetik**; hız, isabet, menzil, enerji maliyeti satın alınamaz.
- İlk sosyal sürüm: hazır takım işaretleri, güvenli kullanıcı adları, raporla/engelle. Gelişmiş sohbet moderasyon altyapısı olmadan aktif edilmez.
- Gereksiz hassas/gerçek dünya konum bilgisi toplanmaz; kimlik ve ödeme için uygun yaş/gizlilik kuralları izlenir.

**Performans ve kalite kapıları**
- 30 katılımcılı **gerçek ağ yük testi** ve mobil oyun testi olmadan "15v15 hazır" denmez.
- FPS frame-time, GPU draw calls, bellek, ağ band genişliği, state delta büyüklüğü, server tick gecikmesi, DB commit süresi ölçülür.
- OSM kaynaklar render için LOD, paketlenmiş GLB, batching ve tile streaming ile sadeleştirilir; statik yapı için her kare ayrı ağ mesajı gönderilmez.
- Harita değiştirme/kopma sonrası oyuncu durumunda kayıp/duplikasyon testi.
- Büyük dünyada kamera yakınındaki nesnelere AOI: yakından etkin, uzakta özet; botlar tüm dünyada tam FPS tick çalıştırılmaz.

**Operasyon**
- Ayrı test/üretim worldId; staging'in üretim para ve ülke skoruna dokunamaması.
- CI: tür/sözdizimi, unit, simülasyon determinism, database idempotency, 2 client, 30 bot/network, Android gerçek cihaz, failover, OSM atıf.
- İzleme: active CCU, frontier occupancy, queue time, server tick p95, client FPS p50/p10, world event lag, db locks, AI sim backlog, error rate ve maliyet.
- Backup + restore + olay tekrarı + release rollback tatbikatları.
- Yük yokken sunucu masrafı ayrı gözlenir; işlemci/ram/band genişliği sınırları ve bütçe uyarıları tanımlanır.

## 9. Bilinçli olarak ertelenenler

- Kubernetes, çok bölge aktif-aktif tutarlılık, gerçek dünyayı 1:1 boyutta haritalama, kesintisiz dünya sınır geçişi, tamamen otonom binlerce 3D bot **ilk üretim gününde garanti değil**.
- Ücretli mağaza/ödeme, kullanıcı güvenliği ve hukuk incelemesi tamamlanana kadar kapalı.
- Oyuna yetişkin/yaş sınırını aşmaya yönlendiren sohbet ve ticaret özellikleri eklenmez.
- Oyunda komuta/ticaret/siyasi roller tasarım içindir; gerçek ülke politikası veya gerçek dünyada örgütlenmeye bağlanmaz.

## 10. Açık kararlar — mühendislik için ilk varsayım

| Konu | Varsayılan öneri | Kararı netleştirecek kanıt |
|---|---|---|
| Dünya ölçeği | Tek worldId, sektör katmanlı harita | 2 aktif sektör / sınır geçişi testi |
| FPS motoru | PlayCanvas | Android FPS / renderer ve GLB örnek testi |
| Maç simülasyonu | Colyseus 0.18+ Node + TypeScript | 30 websocket, tick gecikmesi, yeniden bağlanma |
| Kalıcı veri | PostgreSQL | Çok eşzamanlı battle_result idempotency test |
| Ayrık cache / pubsub | Başta yok; çoklu süreçte Redis | Room scale ve world delta sınırı |
| Map source | OSM + kurgusal spor yapıları | Lisans, indirilen geometri kalitesi |
| AI | Mikro/Meso/Makro 3 katman | 1000 sektör örnek simülasyonu, CPU bütçesi |
| Barındırma | GitHub otomasyon + statik preview; backend aday Railway | Maliyet tavanı/onay, 24/7 websocket sağlık |
| Ürün geliri | Kozmetik ve güvenli mağaza | Ödeme, yasal/gizlilik ve yaş kontrolleri |

## 11. Kaynaklar
- Colyseus server, rooms ve ölçekleme: https://docs.colyseus.io/ , https://docs.colyseus.io/scalability
- Colyseus 0.18+ authoritative netcode: https://docs.colyseus.io/netcode
- PlayCanvas + Colyseus: https://developer.playcanvas.com/tutorials/real-time-multiplayer-colyseus/
- PlayCanvas dinamik varlık akışı: https://developer.playcanvas.com/user-manual/assets/loading-unloading/
- Railway kalıcı Node servisleri: https://docs.railway.com/build-deploy
- OSM atıf ve ODbL: https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
- Mevcut repo durumu: https://github.com/bugsbuny243/paintball-nations

## Sonuç
**Hedef oyun komple tanımlandı fakat altyapı henüz uygulanmadı.** Sıradaki uygulama, "tek dünya"nın küçük ama tam doğrulanan kesitidir: iki gerçek istemci + tek kalıcı Maçka sektörü + bir cephe + kaynak ve üs işlemi + sunucu otoritesi + reconnect. Sonra aynı protokol ile 30 oyuncu ve çok sektöre ölçeklenir. Bu, farklı oyunlar geliştirmek değil aynı ürünün altyapısını uçtan uca kanıtlamaktır.
