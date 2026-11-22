# Paintball Nations — C2 Kalıcı Pilot / Maç Sunucusu Bağlantısı

**Tarih:** 22 Kasım 2026  
**Durum:** PostgreSQL 17, Colyseus ve iki gerçek Chrome/PlayCanvas penceresinde test edilmiş geliştirme prototipi. Halka açık oyun sunucusu henüz yok.

## Gerçekten uygulanan

1. PostgreSQL üzerinde UUID ve oyun içi ülke seçimiyle takma adlı pilot profili oluşturulur. Gerçek milliyet veya konum bilgisi istenmez.
2. Yerel pilot oturumu veritabanında yalnız SHA-256 özetiyle saklanır; istemcide geçici oturum anahtarı bulunur.
3. Maç katılımı öncesinde sunucu PostgreSQL oturumunu sorgular. Geçerliyse 90 saniyelik HMAC imzalı pilot bileti verir.
4. Colyseus oda katılımında bileti ve ilgili veritabanı oturumunun hâlen aktif olup olmadığını doğrular.
5. Pilotun TR fraksiyonu mavi, DE fraksiyonu kırmızı takıma sunucu tarafından atanır. Takımda 15 kişi sınırı korunur.
6. Oturum iptali yeni maç katılımını engeller. Hâlihazırda bağlı oyuncuyu anında oyundan atma henüz uygulanmadı.
7. Eski misafir Maçka modu aynı tarayıcı paketinde çalışmaya devam eder.
8. Yerel Chrome testinde iki farklı kalıcı profil aynı Maçka haritasına bağlanır ve birbirinin hareketini görür.

## Kod konumları

- apps/game-backend/src/auth/pilot-match-ticket.ts — maç bileti üretimi/doğrulama
- apps/game-backend/src/auth/dev-pilot-db.ts — ortak geliştirme veritabanı erişimi
- apps/game-backend/src/pilot-store.ts — aktif profil/oturum ve iptal kontrolü
- apps/game-backend/src/online-server.ts — yerel pilot kaydı ve maç bileti uçları
- apps/game-backend/src/rooms/macka-room.ts — pilot doğrulama ve sunucu tarafında takım atama
- maps/macka-online-client.js — tarayıcı istemcisi; misafir ve pilot modu
- tests/pilot-match.test.ts — ayrı Colyseus süreçte PostgreSQL pilotları
- tests/smoke-online-pilot.mjs — iki Chrome penceresinde bağlantı
- .github/workflows/online-ci.yml — entegre otomatik doğrulama

## Kanıt

**Başarılı GitHub Actions kaydı:** https://github.com/bugsbuny243/paintball-nations/actions/runs/45016303715

- 7/7 ağ, güvenlik kuralı ve simülasyon testi geçti.
- PostgreSQL migration, TypeScript ve web paket derlemesi geçti.
- İki Chrome ile önce misafir Maçka bağlantısı, ardından TR/DE kalıcı pilot bağlantısı geçti.
- Tarayıcı istemci paketi GitHub'a yazıldı.

**Sınır:** Bu çalışma 30 eşzamanlı gerçek WebSocket bağlantısını, Android FPS performansını veya herkese açık 7/24 sunucuyu doğrulamaz.

## Yerel test URL parametreleri

Yalnız uygun geliştirme sunucusu çalışırken:

- Misafir: maps/macka.html?online=1
- Türkiye pilotu: maps/macka.html?online=1&pilot=1&faction=TR
- Almanya pilotu: maps/macka.html?online=1&pilot=1&faction=DE

Pilot kayıt uçları yalnız loopback üzerinde ve üretim dışı durumda açıktır. Geliştirme oyuncu anahtarı tarayıcı sessionStorage içinde tutulur. Bu, gerçek kullanıcı hesabı veya güvenli hesap kurtarma sistemi değildir.

## Açık güvenlik ve yayın engelleri

- **Güncellenen negatif ağ doğrulaması:** Biletsiz/sahte biletler ve PostgreSQL oturumu iptal edilmiş pilot gerçek ağda [reddedildi](https://github.com/bugsbuny243/paintball-nations/actions/runs/45038047401). İlk çoklu test sunucusu başlangıcı `ERR_HTTP_HEADERS_SENT` ürettiğinden yeniden başlatma/failover güvenliği hâlâ ayrıca test edilmelidir. Sunucu kamuya açık dağıtıma hazır değildir.
- Gerçek hesap kurtarma, oturum yenileme, moderasyon, topluluk güvenliği ve erişim yetkileri tamamlanmadı.
- Oturum iptalinin açık maç bağlantısını anında bitirmesi henüz yapılmadı.
- Maç sonu C4 geliştirme entegrasyonunda kalıcı Maçka sektörüne yazılıyor; kariyer puanı sistemi henüz entegre değil.
- Gerçek Android, 30 kişi ağ/yük, izleme ve veri yedekleme testleri tamamlanmadı.
- Yeni ücretli hizmet veya genel erişimli sunucu açılmadı.

**Sonraki iş:** Geçersiz bağlantıların yeniden başlatma/failover koşullarını doğrulamak, oturum iptalinin devam eden maça etkisini tanımlamak ve kalıcı C4 sektör sonucunu kariyer/strateji ekonomisine genişletmek.
