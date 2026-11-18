# Paintball Nations 🎨

PlayCanvas üzerinde **FPS 3D paintball antrenman prototipi**.

- PlayCanvas proje ID: `1650317`
- PlayCanvas sahne ID: `2659278`
- Durum: **V0.1**, çevrim dışı antrenman sahnesi; gerçek 15'e 15 çevrim içi oyun henüz yok.
- Oyun kodu: [playcanvas/paintballNations.js](playcanvas/paintballNations.js)

## GitHub → PlayCanvas otomatik script aktarımı

Bu depoda `.github/workflows/playcanvas-sync.yml` iş akışı bulunur. Önce **kapalıdır**; gerekli ayarlar yapılınca çalışır. PlayCanvas REST API üzerinden `paintballNations.js` adlı script varlığını oluşturur veya günceller. **Sahneye otomatik nesne eklemez; scripti Entity'ye ilk kez bağlama işlemi editörde yapılır.**

### Telefonda bir defalık kurulum

1. PlayCanvas hesabının **Account / API Tokens** bölümünden erişim tokenı oluştur. PlayCanvas resmî API rehberi: https://developer.playcanvas.com/user-manual/api/
2. GitHub deposunda **Settings → Secrets and variables → Actions → Secrets → New repository secret** bölümüne gir. Adı `PLAYCANVAS_TOKEN`, değeri oluşturduğun PlayCanvas tokenı olsun. **Tokenı sohbet mesajına, kaynak koda veya README'ye yapıştırma.**
3. PlayCanvas Editor'deki **Version Control** menüsünden kullandığın dalın kimliğini (**Copy branch ID**) kopyala.
4. GitHub **Settings → Secrets and variables → Actions → Variables** bölümünde `PLAYCANVAS_BRANCH_ID` değişkenini bu değerle oluştur.
5. Aynı yerde `PLAYCANVAS_SYNC_ENABLED` adlı değişkeni `true` yap. Bu ayar olmadan iş akışı PlayCanvas'a veri yazmaz.
6. GitHub **Actions → Sync Paintball Nations to PlayCanvas → Run workflow** ile ilk aktarımı manuel başlat.
7. PlayCanvas'ın **Assets** panelinde `paintballNations.js` script varlığını gör. Ayrı boş sahnede root `Scene` altında yeni bir **PaintballGame** Entity oluştur, **Script Component** ekle ve bu scripti Entity'ye bağla. **2D Screen altına ekleme.** Play'e basarak test et.
8. Sonraki `playcanvas/paintballNations.js` dosyası değişiklikleri, `main` dalına geldiğinde aktarılır.

### Güvenlik ve sınırlar

- Bu akış yalnızca script varlığını günceller; PlayCanvas sahnelerini veya mevcut oyun nesnelerini silmez.
- Aynı adla birden fazla asset bulunursa güvenlik için işlem durur.
- GitHub deposu **Public**; hiçbir tokenı, şifreyi veya kişisel bilgiyi commit etme.
- Script sözdizimi GitHub Actions içinde kontrol edilir, ancak Android üzerinde oyun performansı ve PlayCanvas Editor çalışması ayrıca test edilmelidir.
- İptal etmek için `PLAYCANVAS_SYNC_ENABLED` değerini `false` yapabilir, PlayCanvas'ta tokenı iptal edebilirsin.

## Referanslar

- [PlayCanvas REST API](https://developer.playcanvas.com/user-manual/api/)
- [Asset create](https://developer.playcanvas.com/user-manual/api/asset-create/)
- [Asset update](https://developer.playcanvas.com/user-manual/api/asset-update/)
- [Script ekleme](https://developer.playcanvas.com/user-manual/editor/scenes/components/script/)
