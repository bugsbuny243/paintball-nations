# Paintball Nations — A3 Geçici Oyun Oturumu Altyapısı

**Tarih:** 20 Kasım 2026  
**Durum:** Geliştirme ortamındaki misafir bileti ve PlayCanvas/Colyseus bağlantısı uygulandı; otomatik pozitif bağlantı ve imza testleri geçti. **Üretime dağıtılmadı.**

## Kod ve davranış

- `apps/game-backend/src/auth/guest-ticket.ts`: Sunucuda rastgele UUID ile geçici misafir kimliği oluşturur. Biletler HMAC-SHA256 ile imzalanır, 10 dakika geçerlidir. İmza, zaman damgası, audience, sürüm ve payload yapısı doğrulanır.
- `apps/game-backend/src/online-server.ts`: `POST /api/v1/guest-ticket` üzerinden geliştirme bileti üretir. Origin allowlist (varsayılan yerel test origin'leri), `no-store`, IP başına dakikada en fazla 12 bilet şeklinde **geliştirme amaçlı** temel sınırlama vardır.
- `apps/game-backend/src/rooms/macka-room.ts`: Oda girişinde verilen bilet doğrulanır. Aynı kısa süreli misafir kimliğinin aynı odada ikinci oturum açması reddedilir.
- `maps/macka-online-client.js`: `?online=1` ile açılan PlayCanvas istemcisi önce misafir bileti alır, sonra biletle `macka_frontline` odasına katılır.
- `maps/macka-online.bundle.js`: CI tarafından oluşturulan tarayıcı paketi.
- `tests/online-macka.test.ts` ve `tests/smoke-online-macka.mjs`: Bilet doğrulaması, iki Colyseus SDK bağlantısı, 30 slotluk oyun içi takım simülasyonu ve iki gerçek Chrome tarayıcısıyla oda paylaşım testi.
- `.github/workflows/online-ci.yml`: TypeScript kontrolü, bundle, SDK testleri ve Chrome PlayCanvas testi.

## Kanıtlanan testler

**GitHub Actions:** https://github.com/bugsbuny243/paintball-nations/actions/runs/44660851253

- TypeScript kontrolü **geçti**.
- Tarayıcı bundle derlemesi **geçti**.
- Test paketi **5 geçti, 0 başarısız**.
- Geçerli biletli iki Colyseus SDK bağlantısı aynı odada hareket bilgisi paylaştı.
- Biletsiz/sahte/süresi dolmuş biletlerin doğrulama ve oda giriş kuralı *fonksiyon düzeyindeki* testleri geçti.
- İki Chrome/PlayCanvas penceresinin yerel sunucuda bağlanıp birbirinin hareketini gördüğü smoke testi **geçti**.

**Kanıtlanmayanlar:** Uzak internet koşulları, Android donanımı, 30 gerçek eşzamanlı WebSocket bağlantısı, hesap güvenliği, uzun oturum süresi, yeniden bağlantı ve üretim ölçeği.

## Açık bloklayıcı — Colyseus reddetme yolu

Colyseus 0.18.10 ve seçili test altyapısında, SDK'nın geçersiz/biletsiz oda girişinin reddedilmesini uçtan uca sınayan testte `ERR_HTTP_HEADERS_SENT: Cannot remove headers after they are sent to the client` üretildi. Bu hata static ve instance `onAuth` reddetme yöntemiyle görüldü. Çalışan süreci kilitleyebildiğinden söz konusu negatif ağ testi şimdilik CI'dan çıkarıldı ve yerine gerçek oda doğrulama fonksiyonunun **doğrudan testi** kullanıldı.

**Bunun anlamı:** Sunucu üretime hazır veya kötü niyetli istemcilere dirençli olarak değerlendirilemez. Açık sorun çözülmeden / geçersiz bağlantılarla gerçek HTTP ve WebSocket negatif test geçmeden açık internete dağıtım yapılmamalıdır. Bu bloklayıcı saklanmış/çözülmüş değildir.

## Üretim güvenliği sınırları

- Bunlar **misafir geliştirme biletleri**: kalıcı oyuncu hesabı, yaş doğrulaması, kullanıcı ban/revocation, cihaz başına kimlik, sınırsız kötüye kullanım veya hile koruması sağlamaz.
- Herkes yeni geliştirme bileti isteyebilir; sadece CORS allowlist güvenlik sınırı değildir. Basit IP limiti de üretim hızı/kötüye kullanım kontrolü yerine geçmez.
- `NODE_ENV=production` ile `online-server.ts` doğrudan çalıştırılması **bilinçli olarak reddediliyor**; mevcut üretim engeli kaldırılmamalı.
- `DEV_GUEST_TICKET_SECRET` (varsa) en az 32 bayt; eksikse süreç başına rastgele bir anahtar üretilir. Gizli anahtar GitHub deposunda bulunmaz.
- Yerel tarayıcıda `http://127.0.0.1:8765` ve `http://localhost:8765` varsayılan origin'lerdir; başka geliştirme origin'i yalnız `DEV_GAME_ORIGIN` ile açıkça eklenebilir.
- Kalıcı çok oyunculu oyun yayınından önce gerçek hesap/kimlik altyapısı, doğrulama, moderasyon, hız sınırlama, oturum kapatma ve hesap/veri mahremiyeti gereklidir.

## Sonraki mühendislik kararı

1. **Önce bloklayıcıyı çöz:** Colyseus sürümü ve matchmaker HTTP error handler ile biletsiz/uydurma bilet girişinin güvenli biçimde reddedildiğini gerçek ağ seviyesinde doğrula.
2. Ardından gerçek oyuncu hesapları/oturum iptali ve yetkili maç katılımını PostgreSQL kayıtlarına bağla.
3. Test yükünü 30 gerçek bağlantıya artır; sonra gerçek Android'de 3D FPS ve gecikme ölçümleri yap.
4. Bu parçalar tamamlanmadan 24/7 maliyetli sunucu veya kamusal erişim açma.

Bu belge **A3 geliştirme prototipinin sonuç kaydıdır**; önceki [tek dünya mimarisi](world-architecture-v2.md) ve [uygulama yol haritası](delivery-roadmap-v2.md) yerine geçmez.
