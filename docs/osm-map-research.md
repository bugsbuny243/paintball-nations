# Paintball Nations — OpenStreetMap 3D Harita Araştırması
**Tarih:** 18 Kasım 2026
**Durum:** Araştırma tamamlandı; gerçek OSM geometrileri henüz indirilmedi veya oyuna entegre edilmedi.

## Araştırma sorusu
Android'de PlayCanvas FPS antrenman prototipinden 15'e 15 çevrim içi maçlara ilerlerken, **gerçek coğrafi verilerden türetilmiş**, rekabetçi ve düşük maliyetli arenası olan çok ülkeli bir oyun kurabilir miyiz?

**Sonuç:** Evet. OSM yolları, bina oturumları, park sınırları, bazı yükseklik/çatı etiketleri için veri kaynağıdır. Hazır AAA oyun sahnesi veya topografyanın eksiksiz 3D modeli değildir. Rekabetçi oynanış için oynanabilir sınırlar, spawn noktaları, bariyerler, görüş hatları ve malzemeler ayrıca tasarlanmalıdır.

## Dünya haritaları aday listesi
Bu yerler **gerçekte paintball oynanan tesisler olduğu iddiası değildir**. Dijital oyuna aktarılacak harita dokusu için aday konumlardır.

| Kod | Ülke / şehir | OSM çevresi için aday | Merkez (lat, lon) | Oyun atmosferi | Öncelik |
|---|---|---|---|---|---|
| TR-MACKA | 🇹🇷 İstanbul | Maçka Demokrasi Parkı, Şişli | 41.044264, 28.993724 | Kent parkı, eğimli yaya yolları, ağaçlık alan; çevrede bina dokusu | **1. pilot** |
| DE-TEMPELHOF | 🇩🇪 Berlin | Tempelhofer Feld | 52.476, 13.395 | Açık pist / geniş yarışma alanı; kendi güvenli paintball bariyer tasarımımızla kapalı arena | 2 |
| BR-OLIMPICO | 🇧🇷 Rio de Janeiro | Parque Olímpico da Barra | -22.97835, -43.39468 | Spor kompleksi, geniş yaya alanları | 3 |
| JP-YOYOGI | 🇯🇵 Tokyo | Yoyogi Park, Shibuya | 35.671975, 139.697685 | Yürüyüş yolları ve yeşil alan | 4 |
| UK-OLYMPIC | 🇬🇧 Londra | Queen Elizabeth Olympic Park | 51.53862, -0.01665 | Spor parkı, su kanalı/park yolu teması | 5 |

**Yer kaynakları:**
- Maçka: https://istanbuldacocuk.com/mekan/macka-demokrasi-parki/
- Berlin: https://www.berlin.de/sen/uvk/natur-und-gruen/stadtgruen/stadtgruen-projekte/tempelhofer-feld/
- Rio: https://parqueolimpico.rio.br/onde-fica-o-parque-olimpico/
- Tokyo: https://www.gotokyo.org/en/spot/21/
- Londra: https://mapcarta.com/27686752

## İstanbul pilotu: veri sorgusu
Sadece Şişli / Maçka çevresindeki yaklaşık 320 x 335 metrelik araştırma alanı (tahmini, doğrulanmış OSM harita kapsamı değil):
- SW (south/west): `41.0428,28.9917`
- NE (north/east): `41.0457,28.9957`
- Birinci sorgu: [`maps/queries/istanbul-macka.overpassql`](../maps/queries/istanbul-macka.overpassql)
- Editör: https://overpass-turbo.eu/

Sorgu, `highway`, `building`, `landuse`, `leisure`, `natural` ve `barrier` özelliklerini ve bağlı düğümleri XML olarak isteyecek şekilde yazıldı. **Sorgu henüz çalıştırılmadı; bu bölge için herhangi bir özellik sayısı veya bina yüksekliği tespit edilmiş değildir.** Multipolygon relation geometrileri için ikinci veri turu gerekebilir.

## İki uygulanabilir iş hattı

### A — Öncelikli: basit OSM -> PlayCanvas mesh üretimi
1. Küçük bir bölgenin OSM `.osm`/Overpass verilerini al.
2. 3D sahne merkezini (lat/lon) yerel metrik X/Z koordinatlarına dönüştür.
3. OSM'den yollar, bina oturumları ve alan çokgenlerini ayır.
4. Eksik `height` ve `building:levels` bilgilerini açıkça tahmini görsel varsayımlarla doldur; gerçek yükseklik gibi gösterme.
5. Araziyi düşük ayrıntılı, tekil mesh gruplarıyla oluştur; rekabetçi spor bariyerlerini ayrı, özgün modüller olarak ekle.
6. Çıktıyı PlayCanvas'ın önerdiği GLB formatına dönüştür veya küçük modelleri runtime geometri olarak kullan.
7. 30 oyunculu oyuna geçmeden önce Android cihazında FPS, ağ ve draw-call ölçümleri yap.

Artıları: Oyunda kullanılmayan ağır coğrafi ayrıntılardan kaçınmak kolay, GitHub Actions ile otomatikleştirilebilir. Eksileri: 3D yollar, çokgen kesişimleri ve bina modelleme kodu gerekiyor.

### B — OSM2World -> GLB -> PlayCanvas
- OSM2World OSM verisinden glTF / GLB / OBJ oluşturabilir; komut satırında da kullanılabilir.
- GLB'yi fazla ayrıntılardan sadeleştir, LOD/texture/batching uygula, sonra PlayCanvas'a aktar.
- OSM2World uygulaması sunucuda veya GitHub Actions içinde çalışabilir; **henüz test edilmedi**.
- Bu yol, küçük tekil haritaların hızlı prototipi için uygun.

Kaynaklar:
- https://osm2world.org/
- https://developer.playcanvas.com/user-manual/assets/models/
- https://developer.playcanvas.com/user-manual/graphics/advanced-rendering/batching/
- https://dev.overpass-api.de/overpass-doc/en/full_data/bbox.html
- https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_API_by_Example

## Android ve 15v15 için tasarım sınırları
- İlk maç haritası hedefi: **200 x 250 metre** (tasarım kararı; doğrulanmış performans hedefi değil).
- Önce düşük-orta cihazlarda küçük bir haritayla ölçüm yap, şehir ölçeğinde yüzlerce ayrı bina ile başlama.
- Yakın çevre yüksek ayrıntı, uzak çevre sade model / dekor; statik çevre malzemeleri birleştirilmeli.
- OSM yolları ve binaları yalnızca *temel coğrafi şekil*; takımların doğacağı alanlar ve oyun bariyerleri OSM verisi değildir.
- Erişim yoksa bile önceden hazırlanmış GLB cache sayesinde maç sırasında OSM API çağrısı gerekmemeli.
- Harita teması ile gerçek kamu parkında paintball etkinliği aynı şey değildir; tasarım tamamen sanaldır.

## Lisans kontrol listesi
- OSM verisi ODbL 1.0 ile kullanımına açıktır; ticari oyunlarda da kullanılabilir.
- Oyundaki harita bilgisi / kredilerde okunabilir **© OpenStreetMap contributors** ve **https://www.openstreetmap.org/copyright** kaynağı gösterilir.
- OSM verisinin türetilmiş veri tabanı dağıtılıyorsa ODbL paylaşım yükümlülükleri ayrıca değerlendirilir.
- `tile.openstreetmap.org` harita görüntülerini oyun için sınırsız ticari tile servisi gibi kullanma.
- Yalnız coğrafi veriye dayalı model oluşturmak, hava fotoğrafı, bina kaplama dokusu veya başka servislerin görsel içeriğini otomatik lisanslamaz.

Lisans: https://osmfoundation.org/wiki/Licence_and_Legal_FAQ
Atıf: https://osmfoundation.org/wiki/Licence/Attribution_Guidelines

## Net sonraki karar
**İlk pilot TR-MACKA.** Bir sonraki aşamada OSM verisi gerçekten indirilip içerik sayımı ve geometri bütünlüğü kontrol edildikten sonra küçük, optimize edilmiş 3D saha inşa edilecek. V0.2 canlı prototipe bundan önce hiçbir harita değişikliği yapılmadı.
