# C5.1 — Kalıcı Cephe: Süreli Savaş Yetkisi ve Güvenli Kurtarma

**Durum:** Yerel/geliştirme uygulaması; üretim veya kamusal oyun sunucusu **değil**. C4 Maçka test sektöründe çalışır.

## Çözülen problem

C3/C4 bir cepheyi PostgreSQL'de `OPEN` durumuna ve sektörü `CONTESTED` durumuna geçiriyordu. Oyun sunucusu beklenmedik biçimde kapanırsa `onDispose` çalışmayabilir; dolayısıyla sektör sonsuza kadar `CONTESTED` kalabilirdi. Ayrıca çok geciken eski bir oyun odasının sonradan skor göndererek sahiplik değiştirmesini engelleyen zaman sınırlaması yoktu.

C5.1 bu sorunu **maça kaldığı yerden devam ederek değil, terk edilmiş savaşı güvenle iptal ederek** ele alır.

## Veritabanı kuralları

- `004_frontline_recovery.sql` mevcut açık savaşlara 30 saniyelik geçiş süresi verir. Migration iki kez çalıştırılabilir. Mevcut savaşlar migration sırasında otomatik iptal edilmez.
- `FrontlineStore.begin()` yeni bir `OPEN` savaş açar ve `lease_expires_at` değerini PostgreSQL saatine göre 30 saniye sonraya yazar.
- `renewLease(battleId, sourceRoomId)` yalnız aynı oda ID'siyle, hâlâ `OPEN` ve süresi **dolmamış** bir savaşın yetkisini yenileyebilir.
- `settle()` aynı satırı kilitler ve lease süresi dolduysa `battle_lease_expired` ile sonucu reddeder. Eski sunucu gecikmeli “zafer” kaydedemez.
- `recoverExpired(limit)` yalnız PostgreSQL saatine göre süresi dolmuş `OPEN` savaşları `FOR UPDATE SKIP LOCKED` ile kilitler. Sektör mevcut sahibinde kalır, durum `OWNED` olur, dünya sürümü artar ve `frontline.cancelled` olayı `reason: lease_expired` ile saklanır.
- Aynı kaydı iki kurtarma işçisi temizlemeye çalışırsa tek PostgreSQL transaction/row lock nedeniyle yalnız bir başarılı iptal oluşur. Sektör sahipliği geçmişine sahte bir fetih eklenmez.

## Oyun odası davranışı

- `FrontlineLifecycle` aktif cephe yetkisini 5 saniyede bir yeniler.
- Yenileme kesin biçimde reddedilirse oda artık yeni skor kabul etmez ve `UNAVAILABLE` sonucu gösterir; yetkisiz sonucu yazmaya çalışmaz.
- Sunucu açılırken **zaten süresi dolmuş** savaşlar otomatik geri alınır (`online-server.ts` içindeki `beforeListen`).
- Yeni bir pilot odasında iki ülke hazır olduğunda, `CONTESTED` sektör için lease kontrolü yapılır. Eski savaşın lease'i hâlâ geçerliyse bu sektör **alınmaz**. Süresi dolduysa kurtarma çalıştırılıp yeni savaş başlatılabilir; bekleme durumunda yeniden deneme aralığı 5 saniyedir.
- Maç zamanlayıcısı 1–600 saniye arasında olabilir; lease süresi maç süresinden bağımsız olarak yenilenir.

## Operatör kurtarması

Yerel geliştirme ortamında migration uygulanmış bir veritabanı için:

```bash
DEV_FRONTLINE_RECOVERY_APPROVED=1 DATABASE_URL=postgresql://... npm run frontline:recover
```

`NODE_ENV=production` durumunda bu CLI bilinçli olarak çalışmaz. Komut, oyuncuların erişebildiği bir HTTP endpoint değildir. Beklenmeyen veritabanı hatalarında fail-closed olur.

## Test kanıtı

- `tests/frontline-recovery.test.ts`: aktif yetki temizlenmez; yanlış oda yenileyemez; süresi dolmuş yetki yenilenemez ve skorla sonuçlandırılamaz; iki kurtarma işçisi aynı kaydı ikinci kez işleyemez; sektör sahibi korunur; yeni bir maç başlatılıp normal şekilde sonuçlandırılabilir; migration tekrar uygulanabilir.
- PostgreSQL CI: https://github.com/bugsbuny243/paintball-nations/actions/runs/45039651316
- Çok oyunculu + Chrome CI: https://github.com/bugsbuny243/paintball-nations/actions/runs/45039651260

## Çözülmemiş üretim engelleri

Bu sürüm **tam maç devam ettirme sistemi değildir**: oyuncu konumları/skorlar çökme sonrası yeniden yüklenmez. Sunucu açıldığında hâlâ geçerli lease'i olan ölü maçlar, süre dolana kadar korunur; yeni iki pilot geldiğinde yeniden deneme yapılır. Hiç oyuncu gelmezse ve başlangıçtaki tarama henüz süresi dolmamış maçı görmüşse, yeniden tarama için operatör komutu gerekir; sürekli çalışan bağımsız kurtarma işçisi bu sürümde yoktur.

Veritabanı kesintisi, eşzamanlı yük, çok süreçli failover, gerçek kullanıcı hesabı ve moderasyon, Android performansı, 30 gerçek oyuncu, yedekleme/izleme ve TLS/WSS test edilmeden kamusal yayın açılmamalıdır. `NODE_ENV=production` başlatma koruması **kaldırılmadı**.

**Bir sonraki C5 işi:** otomatik periyodik kurtarma işçisi ile çok süreçli lease/failover testi; ardından kontrol noktaları ve ikmal hatları.
