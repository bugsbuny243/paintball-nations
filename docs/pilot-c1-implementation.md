# Paintball Nations — C1 Kalıcı Oyuncu Profili

**Tarih:** 22 Kasım 2026
**Durum:** PostgreSQL 17 üzerinde test edilmiş yerel geliştirme kimliği. Üretime dağıtılmadı.

## Uygulanan bileşenler

- apps/game-backend/sql/002_pilots.sql: UUID oyuncu kaydı, oyun içi ülke bağı, takma isim, oturum hash'i, son kullanma ve iptal tarihi.
- apps/game-backend/src/migrate.ts: A1 ve C1 SQL şemalarını tekrar uygulanabilir biçimde kurar.
- apps/game-backend/src/pilot-store.ts: Pilot-... biçiminde rastgele takma isim ve UUID; 14 günlük 256 bit rastgele oturum anahtarı, veritabanında yalnız SHA-256 hash.
- apps/game-backend/src/server.ts: Yerel pilot oluşturma, profil okuma, yalnız bağlı ülkenin ortak kaynaklarını görüntüleme, çıkış/oturum iptali.
- tests/pilot-profile.test.ts: Gerçek PostgreSQL/HTTP üstünde kimlik, ülke yalıtımı, sunucu yeniden başlatma, oturum iptali ve süre aşımı.
- .github/workflows/world-core-ci.yml: Mevcut A1 ekonomisinin 9 ve C1 pilotun 6 testi.

**Test kanıtı:** https://github.com/bugsbuny243/paintball-nations/actions/runs/45010029239 — toplam 15 test geçiş, 0 başarısız.

## Yerel geliştirme API'si

| HTTP | Yol | Yetki |
|---|---|---|
| POST | /api/v1/pilots/dev-register | Yalnız yerel loopback IP ve üretim dışı, dakikada en fazla 4 istek |
| GET | /api/v1/pilots/me | Oyuncu Bearer oturumu |
| GET | /api/v1/pilots/me/economy | Giriş yapan oyuncunun ülkesine bağlı ortak kaynaklar |
| POST | /api/v1/pilots/logout | Doğrulanmış oturum iptali |

## Üretim sınırları

- TR ve DE şimdilik sanal spor fraksiyonlarıdır. Gerçek dünya milliyeti, telefon, adres, gerçek konum veya e-posta bilgisi toplanmaz.
- Kalıcı oyuncu kaydı var, fakat kaybolan 14 günlük oturum için hesap kurtarma ve anahtar yenileme sistemi yok. Bu, gerçek oyuncu giriş sistemi yerine geçmez.
- C1 pilot oturumuyla 10 dakikalık A3 Colyseus misafir bileti henüz bağlanmadı. C1 kaydının varlığı çevrim içi oyuna kalıcı hesapla girilebildiği anlamına gelmez.
- Kaynak miktarı ülke düzeyindedir. Pilot yalnız kendi oyun içi ülkesinin stokunu okuyabilir; kaynak harcamak ve bina yükseltmek için rol/izin sistemi gerekecek. Şu anda bunlar operatör işlemleridir.
- Profilin PlayCanvas kullanıcı arayüzüne bağlantısı henüz yok; genel internette 24/7 oyun sunucusu çalışmıyor.
- Yaşa uygun moderasyon, veri koruma ve hesap kurtarma olmadan üretim yayını yapılmayacak.

## Sıradaki bütünleşik iş

1. Geçersiz Colyseus biletinin gerçek HTTP katmanında sorunsuz reddedilmesini doğrula.
2. Güvenli pilot oturumunu sunucu tarafında geçici maç biletine bağla; istemcinin kendisini farklı ülke veya yönetici olarak göstermesini reddet.
3. Maç sonucu, stratejik kariyer katkısı ve dünya sektörü olaylarını doğrulanmış sunucu işlemiyle birleştir.
4. 30 gerçek ağ bağlantısı, Android performansı, moderasyon ve hesap kurtarma testlerini tamamla.

Kaynak tasarım: paintball-nations-core-systems-v1.md ve world-architecture-v2.md.
