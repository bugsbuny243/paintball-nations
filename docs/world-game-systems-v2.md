# Paintball Nations — Sistem Tasarımı ve Oyun Kuralları V2

**Statü:** Ürün tasarım önerisi; uygulanmış oyun özellikleri değildir.  
**Referans mimari:** [world-architecture-v2.md](world-architecture-v2.md).  
**Ana motto:** "Savaş nişanla başlar, zekâyla kazanılır."

## A. Oyuncunun gördüğü tek dünya

- Dünya haritasında sektör/koridor, ülke üsleri, kaynak noktaları, ticaret/ikmal yolları, sınır cepheleri ve harita üzerinde görünür etkinlikler vardır.
- Oyuncu ülke/klan seçerek başlar; ülke sembolleri kurgusal spor rekabeti içindir, gerçek ulusal kökenin doğrulanması yoktur.
- Her ülkenin **yıkılamayan güvenli ana merkezi** vardır. Ele geçirilebilir ileri üsler ve diğer stratejik alanlar kaybedilebilir.
- Dünya durumunu oturum kapatmak/maç bitirmek sıfırlamaz; ama yeni/az nüfuslu oyuncuların sistemden kalıcı olarak dışlanmasını önleyen iyileşme mekanizmaları vardır.
- Diğer oyuncular veya botlar görünmüyorsa bile stratejik harita güncellenir; ancak oyuncu olmadığı hâlde tüm dünyada sürekli 3D animasyon üretilmez.
- "Okyanus gibi büyük" his için yön bulma, hızlı lojistik transit, aktiviteler arası geçiş, dinamik cephe çağrıları ve harita olayları gereklidir; dev boş yüzey tek başına içerik değildir.

## B. Ülke/klan yönetimi

Roller:
- **Oyuncu:** Boya maçına katılır, kaynak noktası görevlerini üstlenir, kişisel kozmetiğini seçer.
- **Keşif uzmanı:** Sektörün bilgi sisini açar; yetkisiz düşman verisini göremez.
- **Lojistik sorumlusu:** Onaylı rota ve taşıma öncelikleri belirler.
- **Savunma mimarı:** Üs içi inşa slotlarını seçer ve garnizon bakımını yönetir.
- **Cephe lideri:** 15 kişilik maçta hedef, rota ve toplanma işaretleri verir.
- **Klan komutanı:** Yapı/kaynak önceliği, ittifak ve cephe başlatma kararlarını alır; bütçe ve oylama kurallarına tabidir.

Rol tabanlı erişim kontrolü (RBAC): Gözlem/komuta/harcama/ittifak onayları ayrı izinlerdir. Bir kişinin tüm klan kasasını tek tuşla geri dönüşsüz boşaltması yasaktır. Çifte onay veya günlük sınır yüksek kaynak transferi için varsayılan.

## C. Kaynak ekonomisi ve bağımlılıklar

**Üç başlangıç kaynağı** — isimler çalışma önerisidir:
1. **Pigment**: Boya lojistiği, üs bakımı, savunma tedariki.
2. **Malzeme**: Spor bariyeri, kule modeli, depo/araç kapasitesi, üs geliştirme.
3. **İstihbarat Puanı**: Keşif sinyali, rakibin ikmal durumunu analiz, istihbarat raporu.

**Ekonomik döngü**:
\`Kontrol edilen saha → Üretim → Depoya kapasite sınırı → İkmal rotası → Üs veya cephe → Kullanım / inşa → Bakım maliyeti\`

Gerçek oyuncuya düşük stokta oyunun neden çalışmadığı açıklanır: "Depo dolu", "İkmal kesildi", "Bakım kaynağı yetersiz" gibi. İstatistikler sunucu tarafından hesaplanır. Aynı kaynak iki kez harcanamaz.

**Dengeleme koruyucuları**:
- Depo, üretim ve lojistik kapasitesi tavanları.
- Uzak/toprakça aşırı yayılan ülkelere artan ikmal bakım maliyeti.
- Eski oyuncu avantajını sınırlayan maliyet-etkinlik eğrisi.
- Yeni başlayanlara temel kozmetik dışı aynı savaş kuralları.
- Ücretsiz başlangıç ekipmanının işlevsel olarak rekabetçi kalması.
- Gerçek parayla stratejik kaynak alınmaması.

## D. Üs sistemi ve savunma kuleleri

- Üs içi slotlardan **depo**, **pigment tesisi**, **onarım atölyesi**, **istihbarat merkezi**, **savunma kulesi**, **takım toplanma alanı** yapılabilir.
- Stratejik seçim yaratmak için slot, bakım, enerji/ikmal ve yükseltme önkoşulları vardır. Her kule her rolü bir arada üstlenemez.
- Kuleler çizgi görüşü, etki alanı, bakım ve hedef önceliği kurallarına uyar; gerçek dünyadaki herhangi bir sistem için teknik talimat değildir, oyun simülasyonudur.
- Savunmalar aşırı güçlü olursa saldırı imkânsızlaşır; baskı altında bakım tüketimi veya zamanla etkisizleşme gibi *oyun içi karşı hamleler* tasarlanır.
- Yapı inşaatı ve bakım dünya ekonomisinde işlem olarak kaydedilir; istemci sayısal değerleri değiştiremez.

## E. 15v15 cephe ve toprak ele geçirme

Cephe durumu:
\`AVAILABLE → DECLARED → FORMING → ACTIVE → RESULT_PENDING → SETTLED → COOLDOWN\`

Önerilen ilk kazanma koşulu:
1. Saldıran tarafın bitişik bölgede geçerli ikmal hattı bulunur.
2. Maç sunucusu taraf başına 15 gerçek kullanıcıyı destekler (boş slot olursa bot ayrı sayılır).
3. Sahada seçilen kontrol noktalarında boya sporuna dayalı üstünlük/işaretleme puanı toplanır.
4. Bitiş puanı + ikmal koşulları birlikte gerçekleşirse hedef sektör için **bir** \`BattleResult\` oluşur.
5. Dünya sunucusu sonucu doğrular; sektör sahibi ve kaynak zinciri tek transaction'da güncellenir.
6. Cephe cooldown'a girer; aynı sektör için üst üste çifte sonuç uygulanamaz.

**Maçta boyanma**: Güvenli, çizgi film estetiğinde boya ile işaretlenen oyuncu kısa süre etkinlik dışı kalır, sonra spor üssünden dönmeye hak kazanır. Gerçek zarar/yaralanma simülasyonu gerekmez.

**Tartışmalı kararlar**: İttifaklar, kuşatma pencereleri ve düşük nüfusta savunma AI kapasitesi; önce ölçümler sonra parametrik oyun dengesi.

## F. İstihbarat ve bilgi haritaları

Oyuncunun ekranda gördüğü bilgi = \`factionRole + alliedVisibility + scoutReports + publicWorldStatus\`.

Üç bilgi katmanı:
- **Herkes**: Sektör adı, kamuya açık kontrol rengi, aktif cephe uyarısı.
- **Müttefikler**: Kendi kaynaklarının yaklaşık seviyesi, komuta hedefleri, savunma talepleri.
- **Keşif sonucu**: Güncel ama süresi ve doğruluk sınırı olan raporlar. Eski rapor belirgin biçimde eski işaretlenir.

**Karşı hamle ve belirsizlik**:
- Sınırlı komuta bütçesiyle keşif veya savunma arasında seçim.
- Rekabet adil olmak zorunda; bilinmezlik gizli yönetici avantajı değildir.
- Boş ekran "zeka oyunu" yapmaz; her önemli karara anlaşılabilir geri bildirim verilmeli.

## G. Bot/AI ekosistemi

### Üç farklı AI işi
1. **Aktif bot**: Oyuncuyla aynı 3D sektörde görünür. Yalnız oyun içi sanal boya kurallarına uyar, takıma destek olur.
2. **Garnizon yönetimi**: Oyuncu yokken savunma, bakım, lojistik ve yaklaşan cephe durumu hesaplar.
3. **Stratejik AI**: Oyuncu sayısını, riski, tedarik kapasitesini ve komutan emirlerini kullanarak kaynak dağıtımı önerir; her hamlesi açıklanabilir ve sınırlandırılır.

### Canlılık politikasının ön koşulları
- Botların stratejik harcama bütçesi olmalı; yoktan kaynak üretmezler.
- Uzun süre offline olan küçük klanlar otomatik fetihle tamamen elenmez.
- Oyuncu yokken bot-bot çarpışmasını her adımda gerçek FPS olarak canlandırmak yerine düşük frekanslı bir sonuç modeli çalıştırırız.
- Botlar **gerçek oyuncu gibi gösterilmez**. Nüfus göstergesinde kullanıcı ve bot ayrı ayrı yazılır.
- İsteyen ülkeler garnizon politikalarını düzenleyebilir ama AI'nin gerçek para harcaması yoktur.
- Aktif oyuncu varsa kötü bot davranışları göze batacağından animasyon, algı ve yol bulma için ayrıca test gerekir.

### Canlılık metriği
Sadece eşzamanlı oyuncu sayısı değil:
- Aktif cephe sayısı, ortalama cepheye erişim süresi,
- Oyuncu olmayan saatlerde tamamlanan anlamlı ekonomik işlem,
- Yeni gelen oyuncunun ilk 10 dakika içinde yapabileceği yararlı görev,
- Savunmasız ülke oranı, topraklaşma yoğunluğu,
- Kaynak darboğazından dolayı kilitlenen oyuncu yüzdesi,
- Bot kaynak kullanımı ve sunucu CPU bütçesi.

## H. Aktif dünya döngüsü

1. Oyuncu üs ekranında "İkmal zayıf" uyarısı görür.
2. İstihbarat haritasından hangi yolun ve kaynağın stratejik önemde olduğunu değerlendirir.
3. Klan, malzeme taşıma / boya deposu yükseltme / baskın yerine savunma önceliği belirler.
4. Önemli sınırda 15v15 cephe açılır; rol dağılımı ve kurallı takım koordinasyonu yapılır.
5. Başarılı sonuç sektörü ele geçirebilir; ekonominin gelecek üretim değerleri değişir.
6. Dünya haritasında yeni renk ve geçmiş kaydı görünür.
7. Bot garnizonları yeni ikmal planına göre güncellenir; oyuncu çıkış yapsa da dünyanın kayıtları durur.
8. Rakip yeni hamlesini planlayabilir; harita asla tek bir maç sonunda tamamen sıfırlanmaz.

## I. Yeni başlayanların korunması ve uzun ömür

- Güvenli ana üssü asla sıfırla/yok etme.
- İlk girişte kolay ikmal, keşif ve basit boya hedefleri, strateji öğrenme görevleri.
- Saldırı pencerelerini uyku saatlerine karşı istismar etmeyi önleyecek koruma.
- İttifakların sınırlarını ve büyük ülkelerin yayılma maliyetini dengelemek için sezon bazlı ölçümler.
- Ekonomi krizinde oyuncuların geriye dönebilmesi için onarılabilir temel üretim kapısı.
- Klan büyüklüğü ve coğrafi grupları ayıran haksız eşleştirmeyi engelleme.

## J. Açık sınırlar

Burada anlatılan sistemler **öneri**. Gerçek savaş AI, ekonomi, kullanıcı hesapları, ülkeler arası ittifak ve dünya sıralaması henüz kodlanmadı. Daha sonra savaş hızı, para dengesi, ajan zekâsı ve yerleşim için oynanış testleri yapılacak.

**Kaynak:** [Tam dünya mimarisi](world-architecture-v2.md).
