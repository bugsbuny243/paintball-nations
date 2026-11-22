# Paintball Nations — Çekirdek Oyun Sistemleri V1

**Tasarım tarihi:** 22 Kasım 2026  
**Kapsam:** Birbirine bağlı, tek kalıcı dünyaya sahip strateji–FPS oyununun oyun sistemleri tasarımı.  
**Durum:** **TASARIM / ÖNERİ**. Bu belge üretim sistemi, veritabanı migration'ı, çalışan mağaza, görev sistemi veya rütbe motoru oluşturulduğu anlamına gelmez.  
**Teknik üst mimari:** [Kalıcı dünya V2](world-architecture-v2.md), [Oyun sistemleri V2](world-game-systems-v2.md), [uygulama kapıları](delivery-roadmap-v2.md). “V1” burada **çekirdek oyun sistemleri belgesinin ilk sürümü** anlamına gelir; eski oda tabanlı mimariye dönüş değildir.

## 1) Kaynak ekranlardan aldığımız tasarım ilkeleri

Oyuncunun sağladığı OldOrbit ekran görüntülerinde şu **görünen arayüz olguları** bulunmaktadır:

| Görünen kaynak | Fotoğrafta görülen | Paintball Nations için **yeni ve özgün tasarım** |
|---|---|---|
| Skylab paneli | Farklı toplayıcılar, rafineriler, depo, taşıma ve temel modül; seviye/enerji göstergeleri | **Üs Endüstrisi:** pigment atölyesi, malzeme tesisi, depolama ve ikmal ağı |
| Rütbe puanları | Tecrübe, şeref, seviye, görev vb. kalemlerden oluşan çarpanlı tablo | **Stratejik Kariyer:** çatışma, keşif, ikmal ve takım başarısını gösteren şeffaf puan karnesi |
| Şirket rütbeleri | Kontenjan / alt puan / dolu / en düşük sütunlarıyla kıyaslamalı sıralama | **Ülke Ligleri:** sezonluk performans yüzdeliği ve sınırlı prestij unvanları |
| Kısayol düzeni | Farklı oyun panellerini seçip altı yuvaya koyma | **Komuta Çubuğu:** mobilde altı kişiselleştirilebilir, erişilebilir kısayol |
| Galaksi kapıları | Seçilebilir hedefler, ilerleme ve enerji/ödül kontrolleri | **Özel Operasyonlar:** rota ve bilgi seçimine bağlı, önceden belirlenmiş ödüllü görev zinciri |

**Kaynak sınırı:** Ekran görüntüleri gerçek sunucu algoritmalarını, ödeme akışını, veri modelini ya da kaynak kodunu kanıtlamaz. Buradaki çeviri sistem tasarımına yönelik **bizim önerimizdir**. Üçüncü tarafın ikonları, ekran yerleşimi, görselleri, birebir adları ve sayısal denge değerleri aktarılmayacak.

## 2) Tam oyunun oyuncu yolculuğu

1. Oyuncu misafir antrenman veya güvenli kalıcı hesapla dünyaya girer; kurgusal spor ülkesini/klanını seçer.
2. Kendi ülke ana üssünde dünya haritasını, açık ikmal sorununu, en yakın cepheyi ve bugünkü görevleri görür.
3. Üretim merkezinde sınırlı kaynak ve kapasiteyi yönetir: **üret → depola → taşı → inşa et / savun**.
4. Keşif raporu için kaynak veya zaman harcayıp rakibin hangi koridoru savunduğunu anlamaya çalışır.
5. Komutan/ekip 15v15 cepheye ya da küçük takım özel operasyonuna karar verir. Oyuncu ister FPS, ister lojistik, ister keşif katkısı yapar.
6. Sunucu tarafından doğrulanmış karşılaşma sonucu toprak/ikmal durumuna, ekonomik gelire ve oyuncunun kariyer puanlarına yansır.
7. Oyuncu üniforma/atıcı görünümü gibi kozmetikleri seçer, rolüne göre komuta çubuğunu düzenler, yeni stratejik hedefini belirler.
8. Oyuncu çıksa da dünyanın mülkiyet ve kaynak geçmişi kalır; bot garnizonları belirli bütçeler dâhilinde işlerini sürdürür.

**Oyunun ana kuralı:** Tek kişinin nişan alma başarısı tüm ekonomi, rütbe veya ülke kontrolüne tek başına hükmedemez. İyi plan + koordinasyon + kaynak yönetimi + sahadaki icra birlikte değer üretir.

## 3) CORE-01 — Üs Endüstrisi: Üretim, depo ve lojistik

### Özgün tesis türleri
| Tesis | İşlev | Stratejik karşı hamle |
|---|---|---|
| Pigment Atölyesi | Boya tedariki için pigment üretir | Artan üretim depoya ve nakliye kapasitesine takılır |
| Malzeme İmalathanesi | Spor bariyerleri ve üs yapıları için malzeme üretir | Yüksek seviye daha çok bakım ister |
| Depo Merkezi | Stok tavanı ve kayıp koruması sağlar | Fazla yatırım üretim kapasitesini yavaşlatır |
| İkmal Terminali | Üsler/cepheler arasında transfer kapasitesi sağlar | Bozulan rota tedarik hızını düşürür |
| Saha Analiz Merkezi | Keşif ve istihbarat görevleri açar | Daha iyi bilgi daha fazla operasyon bütçesi ister |
| Savunma Koordinatörü | Sanal boya işaretleme kulelerine görev verir | Görüş, bakım, örtü ve ikmal sınırı vardır |

### Kaynak sınıfları
- **Pigment:** Üretilip tüketilen takıma ait fiziksel ekonomi birimi.
- **Malzeme:** Üretim, yükseltme, spor bariyerleri ve üs bakımı için stok.
- **İstihbarat puanı:** Keşif ve veri analizinde kullanılan, **ayrı yetki ve muhasebe** gerektiren stratejik kaynak; A1 veritabanında henüz yok.
- **Enerji / kapasite:** Oyuncunun para karşılığı satın aldığı “oynama hakkı” değil; oyun içi üretim kapasitesi sınırı. Üretim tesislerinin denge parametresi olarak düşünülecek.

**Başlangıç ekonomi formülü (taslak; mevcut A1 kodunu değiştirmez):**

\`netProduction = min(plantRate × supplyEfficiency, freeStorageSpace, logisticsAllowance) - upkeep\`

Kaynak defteri ve olay günlükleri **PostgreSQL** tarafından otoriter tutulur. Kullanıcı ekranda hangi kararın neden sonucu değiştirdiğini görebilmeli. Offline üretim belirli süre sınırına göre catch-up işlemidir; sınırsız/ücretsiz kaynak oluşturmaz.

**Başarı metriği:** Oyuncu yalnız “yükselt”e basmak yerine “şimdi daha çok depo mu, üretim mi, ikmal mi?” kararını verebilmeli.

## 4) CORE-02 — Stratejik Kariyer ve Ülke Ligleri

### İki ayrı ilerleme ekseni
1. **Kariyer Seviyesi:** Eğitim/görev/FPS katılımıyla ilerleyen kalıcı öğrenme ve profil ölçüsü. Tek başına komutan yetkisi vermez.
2. **Sezonluk Stratejik Katkı (SK):** Belirli sezonda doğrulanan sonuçlarla hesaplanır; ülke ligindeki prestij sırasını etkiler.

**İlk önerilen şeffaf SK puanı:**
\`SK = 25% Takım Başarısı + 25% Stratejik Hedef + 20% Lojistik Katkı + 15% Keşif Kalitesi + 15% Sportmenlik/Görev Disiplini\`

Bu yüzdeler **denge deneyine açıktır**, mevcut oyunda hesaplanmıyor. Her kalem, ham aktivite sayısına değil sunucuda doğrulanmış **nitelikli katkıya** bağlanmalı. Bir oyuncu aynı kolay görevi tekrar tekrar yaparak üst rütbeye çıkamamalı; maç eşleştirme ve nüfus farklılıkları için adil normalizasyon gerekir.

**İlk prestij başlıkları (özgün):**
\`Çaylak → Saha Görevlisi → Ekip Lideri → Cephe Lideri → Operasyon Koordinatörü → Bölge Stratejisti → Baş Stratejist\`.

**Ülke ligi kuralı:** İlk sürümde sezon katılımcı sayısına bağlı **yüzdelik dilimler** ve sınırlı üst unvanlar. Eski oyuncuların her üst kontenjanı kalıcı kilitlemesine izin verilmez. Başlangıçta örnek eşik: aktif ve yeterli maç oynayan oyuncuların en iyi %1'i “Baş Stratejist” adaylığına girebilir; minimum nüfus ve sezon yeterliliği şarttır. Kesin unvan/slot sayısı gerçek oyun nüfusu testinden sonra sabitlenecek.

**Rütbe ≠ Yetki:** Klan kaynak harcaması, ittifak veya cephe açma izinleri liderlik/üyelik rolleriyle verilir. Ülke liginde yüksek puan toplayan bir oyuncu diğer oyuncuların kaynaklarını kendiliğinden yönetemez.

**Görüntüleme:** Oyuncu kendisinin puan kalemlerini, katsayıları, sezon bitişini ve sıralama eşiğini görür. Diğer kullanıcıların özel kayıtları ifşa edilmez.

## 5) CORE-03 — Özel Operasyonlar

Tekrarlı bir enerji düğmesi yerine oyuncuyu **bilgiyle karar vermeye** zorlayan çok aşamalı görev sistemi.

**Önerilen operasyon tipleri:**
- **Sisli Koridor:** Keşif haritasındaki sınırlı ipuçlarıyla güvenli ikmal rotasını bul.
- **Pigment Hattı:** Üretim ve lojistiği dengeleyerek bir cepheye yeterli boya tedariki ulaştır.
- **Sessiz Karakol:** Küçük bir spor takımıyla sanal kontrol noktalarını süresi içinde işaretle.
- **Kayıp Konvoy:** Birden çok rotadan düşük maliyet / yüksek risk tercihleri yap.
- **Kale Savunması:** Savunma kulelerinin görüş ve bakım bütçesini optimize et.

Her operasyonda \`operationId\`, tür, hedef sektör, katılımcılar, keşfedilen bilgi, kontrol noktaları, süre, tamamlanma durumu ve sunucu onaylı ödül kaydı olur.

**Kazanım:** Kozmetik, unvan, öğrenme/ilerleme puanı veya makul ekonomik kaynak. Ücretli rastgele çekiliş, “şansını artırmak için öde”, loot-box ve güçlü avantaj yok. Başarısızlıktan sonra oyuncuya **ne öğrendiği** gösterilir.

**Denge:** Operasyonlar ana dünyadan bağımsız boş minigame değil; bölgenin keşif verisini, ikmal durumunu ya da eğitim ilerlemesini etkileyen kurallı etkinliklerdir. Dünya sahipliğini rastgele tek düğmeyle değiştirmez.

## 6) CORE-04 — Ülke, klan ve komuta

- Ülke: Kalıcı güvenli ana üs, kamuya açık sektör kontrolü, stratejik büyüme.
- Klan: Ülke altında ekiplenme, üye rolleri, ortak bina ve kısıtlı bütçe kararları.
- Komuta: Cephe hedefi, işaretleme, kaynak önceliği, rota seçimi, savunma düzeni.
- Diplomasi: İttifak için yetkili oy/çift onay ve önceden duyurulan süre.
- Güvenli merkez: Kaybeden ülke tamamen oyundan elenmez; bir geri dönüş yolu daima vardır.
- Yönetsel kötüye kullanımın azaltılması: Harcama sınırı, işlem geçmişi, geri dönüşsüz büyük eylemlerde ikinci onay.

**Bir örnek zor karar:** Sınırlı malzeme ile kuzeydeki boya ikmal koridorunu mu koruyacaksın, yoksa güneydeki yeni pigment sahasını mı alacaksın? Seçimin birkaç farklı sonuç yaratmalı; “her iki seçeneği aynı anda bedavaya al” olmamalı.

## 7) CORE-05 — Cephe FPS ve toprak hâkimiyeti

- 15 mavi + 15 kırmızı gerçek oyuncuya kadar **maç odası kapasitesi hedefi**. Botlar ayrı sayılır; eksik gerçek oyuncu için bot desteği etiketi görünür.
- **Kazanmak yalnız işaretleme puanı değil:** boya kontrol alanları, ikmal koşulları, bilgi ve oyun içinde tamamlanan görevler de etkiler.
- Oyuncuların işaretlenmesi çizgi film estetiğinde, güvenli ve kısa süreli saha dışı/yeniden doğma kurallarıyla temsil edilir.
- Sunucu hareket, çarpışma, isabet, maç sonucu ve ödül doğrulamasını yapar.
- Maç sonucu dünya koordinatörüne \`battleId\` ile gönderilir; sector owner ve kaynak etkileri **tek transaction**, tekrarlı sonuçlar **idempotent**.
- Sektör durumu: \`OWNED → CONTESTED → RESOLVING → OWNED\`.
- Taarruz/korunma stratejileri birbirinin açık karşı hamlesini göstermeli. Ekipman yükseltmeleri avantaj yaratıyorsa oyun içi kazanılabilir, maliyeti dengeli ve açıkça karşılanabilir olmalıdır; **para ödeyip daha güçlü oyuncu olma modeli yoktur**.

## 8) CORE-06 — Bot dünyası: MMO'nun boş kalmaması

| Katman | Ne zaman? | Simülasyon |
|---|---|---|
| Micro | Oyuncunun bulunduğu cephe | Gerçek konum, yapay zekâ hareketi, boya isabeti |
| Meso | Aktif oyuncuya yakın sektör | Düşük frekanslı devriye, savunma ve lojistik |
| Macro | Ekranda olmayan uzak dünya | Üretim/ikmal/AI kararları için aralıklı ekonomik özet |

İleri karakol bot sayısı stok/enerji/bakım bütçesine bağlı olacak. Oyuncu yokken dünya işlemeye devam eder ama otomatik sınırsız fetih yapılmaz.

**Şeffaflık:** Ekran \`Gerçek 2/15 • AI destek 13/15\` diyebilir; botları gizleyip “15 insan oynuyor” demez.

## 9) CORE-07 — Kişiselleştirilebilir Komuta Çubuğu

Mobilde **altı kısayol yuvası**. Kullanıcı bunları şu özgün panellere bağlayabilir: \`Dünya Haritası\`, \`Cephe Durumu\`, \`Üs Endüstrisi\`, \`İkmal\`, \`İstihbarat\`, \`Operasyonlar\`, \`Klan\`, \`Kariyer\`, \`Ekipman\`, \`Ayarlar\`.

- Kaydırılabilir ve ekran okuyucuyla anlaşılır adlar.
- Her panel tam ekran, küçük açılır pencere ya da özet kart olabilir; aktif FPS sırasında dikkati dağıtan otomatik pencereler yok.
- Görüş açısı ve savaş alanı boğulmaz; HUD, strateji ekranından ayrılır.
- Kısayol tercihi hesapla eşitlenebilir; çevrim dışı misafirde sadece cihazda kalır.
- Üçüncü taraf oyunun yerleşimi, ikon seti, renk kodları ve çizimleri **birebir alınmaz**.

## 10) CORE-08 — Görevler, sezonlar ve başarımlar

- Günlük görev: kısa eğitim veya takım katkısı; kaçırılan gün için ceza ve FOMO tuzağı yok.
- Haftalık görev: takım ikmali, yeni taktik, sportif işaretleme, güvenli geri dönüş.
- Uzun süreli ülke hedefi: üç ayrı lojistik koridorundan seçim, belirli stratejik tesisleri bakımda tutma.
- Sezon lig sırası ve kariyer ayrı tutulur; sezon sıfırlanırken kalıcı hesapta kazanılmış görünümler silinmez.
- Başarımlar, düşük nüfus saatlerinde bile oynanabilecek keşif ve lojistik görevleri içerir.
- Görev kazançları sunucu olaylarına bağlanır. İstemcide sayaç yükseltmek tek başına ödül hak ettirmez.

## 11) CORE-09 — Ekipman, kozmetik ve mağaza

- Her oyuncuda ücretsiz, dengeli temel **spor boya atıcısı** ve gerekli koruyucu ekipman bulunur.
- Yapı yükseltmeleri sadece daha fazla *seçenek* ve saha rolü açabilir; güçlü eşya otomatik zafer olmamalı.
- Kozmetikler görsel değişikliktir; isabet, menzil, hız, bilgi sisi veya stratejik ekonomik gelir sağlamaz.
- Ücretli enerji/şans çarkı/ödül çekilişi ve avantaj satın alma yok.
- Her ödeme yetkisi yalnız doğrulanmış sunucu işlemiyle teslim edilir; kullanıcı/yaş/gizlilik koşulları karşılanana kadar gerçek ödeme açılmaz.
- Ticari sistem **şimdi yok**; tasarım bağımlılıkları tanımlanmıştır.

## 12) Tek ürün teknik sözleşmeleri (önerilen)

| Sözleşme | Üreten otorite | Tüketen modüller | Değişmez kural |
|---|---|---|---|
| \`WorldSnapshot / WorldDelta\` | World Coordinator | İstemci/strateji HUD | Dünya sürümü tek kaynaktır |
| \`ProductionTick / ResourceLedger\` | Ekonomi / PostgreSQL | Endüstri paneli / üs / ikmal | Stok eksiye düşmez, tekrar etkisiz |
| \`StructureUpgrade\` | Dünya/ekonomi | Üs Endüstrisi | Maliyet ve sahiplik sunucuda doğrulanır |
| \`StrategicContributionEvent\` | Otoriter oyun kuralları | Kariyer, lig, görev | İstemci sahte kariyer puanı yazamaz |
| \`RankSnapshot\` | Sezon servisleri | Kariyer, ülke tabloları | Sezon/nüfus/eşik etiketi bulunur |
| \`OperationProgress\` | Operasyon servisleri | Görev haritası / HUD | Ödül yalnız onaylı ilerlemeden |
| \`BattleResult\` | Colyseus oda sunucusu | Dünya sektörü / görevler / sıralama | Tek \`battleId\`, atomik sahiplik |
| \`BotGarrisonSnapshot\` | Bot Director | Dünya / cephe ekranı | Gerçek oyuncu ve bot ayrımı |
| \`ShortcutProfile\` | Profil servisi | İstemci | Yalnız UI tercihi, komuta yetkisi değil |
| \`Entitlement\` | Doğrulanmış ödeme servisi | Ekipman/kozmetik | Ücretli öğe oyun gücünü değiştirmez |

**Bağımlılık sırası:** \`Kimlik + dünya + ekonomi → stratejik olaylar → kariyer/rütbe + görevler → bot ve operasyonlar → tek dünya UI → güvenli kozmetik\`. Gerçek ağ maçının güvenli reddetme yolu ayrıca giderilmelidir.

### Var olan A1 / A2 / A3 ile farklar
- **Gerçekte kodlanmış:** A1'de iki kaynak türü (pigment, malzeme) ve Maçka sektörü; A2/A3'te iki bağlantılı Colyseus prototipi, sunucu imzalı geliştirme bileti.
- **Henüz kodlanmamış:** üçüncü stratejik istihbarat kaynağı, yeni üretim tesisleri, kademeli rütbe, ülke ligleri, gerçek operasyon görevleri, görev ödülü, panel kısayolları, bot garnizonları, kalıcı ülke/klan komutası, canlı ödeme.
- **Mevcut güvenlik bloklayıcısı:** Geçersiz Colyseus girişinin uçtan uca HTTP reddi \`ERR_HTTP_HEADERS_SENT\` problemi, [A3 raporunda](guest-session-a3.md) kayıtlı; kamuya açık dağıtım için çözülmeli.

## 13) Ürünü bütün hâlinde geliştirmek için teslimat kapıları

| Kapı | Oyuncunun gerçekten yapacağı şey | Kabul kanıtı |
|---|---|---|
| C0 — Mevcut | Maçka'da yerel antrenman ve iki tarayıcıyla geçerli biletli yerel ağ testi | [A3 CI](https://github.com/bugsbuny243/paintball-nations/actions/runs/44660851253); kapsamı sınırlı |
| C1 — Stratejik başlangıç | Hesapla gir → üssünde pigment/malzeme üret → depo/ikmal seç → yeniden girişte kayıt korunur | Postgres transaction, tekrar/yetki, browser UI akışı |
| C2 — Ortak cephe | İki hesap aynı Maçka sektöründe oynar → sunucu sonucu onaylar → sahiplik/ikmal ve görev ilerlemesi güncellenir | Gerçek 2 istemci + DB ve battle-result idempotency |
| C3 — Kariyer ve operasyon | Tamamlanan keşif/ikmal/cephe faaliyeti kariyer karnesi ve özel operasyon ilerlemesini günceller | Sahte puan reddi, ödül tekrarlarında tek teslim, mobil UI |
| C4 — Canlı dünya | Oyuncusuz sektör bot/ekonomi simülasyonuyla yaşar; çok oyuncu sayısı artınca 15v15 odaya çıkar | 0/2/30 bağlantı, bot bütçesi, gerçek Android performansı |
| C5 — Tam arayüz | Komuta çubuğu, rütbeler, üs ekranı, ligler, görev ve ekipman aynı hesap/dünyaya bağlanır | Uçtan uca gezinme, gerçek cihazda akıcı kontrol |
| C6 — Açık beta | Herkes için doğrulanmış hesap, güvenli reddetme, moderasyon, yayında kalıcı oyun ve izleme | TLS, yük testi, güvenlik kontrolü, yedekleme, kullanıcı onayı |

**Bu kapılar ayrı oyunlar değildir.** Her kapı mevcut bütünleşik ürünün son kullanıcı açısından anlamlı bir davranışını tamamlar.

## 14) Karar kayıtları ve ilk geliştirme önceliği

**Önerilen ürün kararları:**
- Oyun **kalıcı tek dünya MMO + 15v15 cephe FPS + kaynak stratejisi** olarak kalır.
- OldOrbit ekranları yalnız **tasarım inceleme kaynağıdır**; özgün mekanik kuralları ve özgün tasarım dili hazırlanır.
- Rütbe, sadece çok oynayan değil *akıllıca takım katkısı yapan* oyuncuyu ödüllendirir; komuta yetkisi rütbeden bağımsızdır.
- Endüstri merkezi, görev, rütbe ve kıta cephesi **aynı dünya olaylarını** tüketir. Ayrı puan defteri/işletim sistemi oluşturulmaz.
- Yeni kaynak ve puan türleri A1 şemasına ancak sürümlü migration + geriye dönük testle eklenir.
- A3 güvenlik bloklayıcısı çözülmeden kamuya açık oyun sunucusu açılmaz; ücretli hosting veya gerçek para işletimi bu belgeyle yetkilendirilmez.

**Teknik sıradaki iş:** A3 reddetme hatasını gidermek ve C1'de ilk gerçek oyuncu profilini mevcut Postgres ekonomi çekirdeğine bağlamak. Böylece üretilen her alt sistem gerçek kullanıcının aynı oyundaki adımı hâline gelir.
