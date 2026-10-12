# Interaktif İskelet Akrep (Procedural Kinematics Scorpion)

Kullanıcının fare ve dokunmatik hareketlerini pürüzsüz ters kinematik (Inverse Kinematics - IK) ile takip eden, beyaz minimalist iskelet hatlarına sahip, tıklama ile kıskaç ve kuyruk iğnesi saldırısı yapabilen, tamamen çevrimdışı ve mobil uyumlu etkileşimli bir simülasyon deneyimi.

> [!IMPORTANT]
> **Aşama 1'de Onaylanan Kararlar:**
> - **Çizim Motoru**: Yüksek performans ve 60–120 FPS akıcılık için optimize edilmiş HTML5 Canvas 2D ve prosedürel ters kinematik (IK).
> - **Etkileşim Hareketleri**: Çift kıskaç açılıp kapanma (pinch/snap) ile birlikte tıklama/dokunmada zehirli kuyruk batırma (stinger strike) animasyonu.
> - **Kullanıcı Ayarları & Modlar**: Akrep hızı, bacak eklem yapısı, iskelet hat kalınlığı, kuyruk kavis sertliği ve tema seçiciyi (Minimalist Siyah Void vs. Kemik Beyazı / Kemik Negatifi) içeren kontrol çekmecesi.

---

## 1. Genel Bakış ve Temel Konsept

- **Ne Yapar**: Ekranda süzülen, imlecin veya parmağın peşinden gerçekçi eklem hareketleriyle (8 bacak, 2 dev kıskaç ve boğumlu zehirli kuyruk) yürüyen, farenin yönüne pürüzsüz açısal sönümleme (angular lerp) ile dönen etkileşimli bir iskelet akrep sunar.
- **Hedef Kitle & Kullanım Senaryosu**: Yaratıcı kodlama, biyomekanik ve minimalist dijital sanat meraklıları; masaüstü ve mobil cihazlarda akıcı, dokunsal bir etkileşim arayan kullanıcılar.
- **Temel Değer**: Sıfır dış bağımlılıkla tamamen yerel (offline) çalışan, pil dostu, 60–120 FPS tepki süresi sunan ve hem dikey hem yatay ekranlarda kusursuz çalışan prosedürel biyomekanik deneyim.

---

## 2. Kullanıcı Deneyimi ve Görsel Tasarım

### A. Kullanıcı Akışları & Etkileşimler
1. **Giriş ve Keşif (Zero-State)**: Kullanıcı uygulamayı açtığında tam ekran minimalist bir atmosferle (varsayılan: mutlak derin siyah `#000000`) karşılaşır. Akrep ekranın ortasında dinlenir, kuyruğu hafifçe nefes alır gibi salınır.
2. **Takip ve Yönelme (Smooth Tracking)**: Kullanıcı fareyi hareket ettirdiğinde veya ekrana dokunduğunda akrebin gövdesi hedef koordinata doğru yumuşak ivmelenmeyle yönelir. Dönüş açısı ani sıçramalar yerine trigonometrik açı yumuşatması (`atan2` + açısal `lerp`) ile imlece kilitlenir.
3. **Bacak Kinematiği (Procedural Stepping)**: 8 bacak, zıt çiftler halinde (metakronal yürüyüş ritmi) adım atar. Ayak ucu hedeften uzaklaştığında doğal bir yay çizerek yeni basma noktasına hareket eder.
4. **Saldırı ve Kıskaç Hareketi (Click / Tap Strike)**:
   - Fare tıklandığında veya parmakla hızlıca basıldığında her iki kıskaç sert ve yaylı bir ivmeyle (`spring physics`) anlık olarak kenetlenir ve gevşer.
   - Aynı anda kuyruk hızla gerilerek hedef noktaya doğru yıldırım hızında iğne saplama (stinger thrust) refleksi sergiler ve eski kavisli pozisyonuna döner.
5. **Özelleştirme ve Ayar Çekmecesi**: Ekranın sağ üst/alt köşesindeki zarif minimal kontrol butonu ile ayar paneli açılır. Hız, iskelet boyutu, hat kalınlığı, kuyruk kıvrımı ve tema anında gerçek zamanlı ayarlanabilir.

### B. Görsel Kimlik ve Tipografi
- **Estetik Yönelim**: Minimalist biyomekanik, fütüristik anatomik iskelet sanatı, X-Ray / tel kafes benzeri zarif beyaz kemik hatları.
- **Renk Paleti**:
  - *Karanlık Mod (Varsayılan)*: Zemin mutlak siyah (`#000000`), iskelet hatları saf beyaz (`#FFFFFF`) ve hafif parıltılı saydam katmanlar (`rgba(255, 255, 255, 0.85)`).
  - *Aydınlık / Bone Modu*: Zemin saf açık gri/beyaz (`#F8FAFC`), iskelet hatları derin obsidyen kömürü (`#09090B`).
  - *Vurgu Rengi*: Kıskaç eklemleri ve zehir iğnesinde çok hafif buzul ışıltısı (`#38BDF8` veya `#E2E8F0`).
- **Tipografi**: Başlık ve kontroller için `Plus Jakarta Sans`, sayısal değerler ve göstergeler için `font-mono tabular-nums`.

---

## 3. Ürün Kararları ve Mimari Tercihler

| Karar | Seçilen Yaklaşım | Tercih Nedeni | Alternatifler |
| :--- | :--- | :--- | :--- |
| **Görselleştirme** | HTML5 Canvas 2D + Vektör Kinematiği | Sıfır yükleme süresi, hafif bundle boyutu, mobil cihazlarda 120 FPS pürüzsüzlük. | Three.js (ağır model indirme gerektirir), SVG (yüksek DOM yükü). |
| **Bacak Hareketi** | Prosedürel 2-Segment Ters Kinematik (IK) | Bacakların doğal yürüyüş ritmini ve yere tutunma hissini gerçekçi simüle eder. | Sabit sprite animasyonları (tekdüze ve yönelmede kopuk). |
| **Kuyruk Hareketi** | Boğumlu Verle / Yay İskelet Zinciri (10-12 Segment) | Akrebin kuyruğunun gövdeyi esnek bir şekilde takip etmesini ve darbede kırbaç gibi uzamasını sağlar. | Rijit kemik modeli. |
| **Girdi Yönetimi** | Birleşik Pointer & Touch Event Sistemi | Fare, çoklu dokunmatik (multi-touch), ekran döndürme (orientation change) tam uyumlu. | Ayrı mouse/touch event karmaşası. |
| **Çevrimdışı Çalışma** | Sıfır Harici API, Yerel Bundle, LocalStorage | Ağ bağlantısı olmadan kusursuz çalışır, kullanıcı ayarları tarayıcıda saklanır. | CDN veya uzak sunucu bağımlılıkları. |

---

## 4. Teknik Mimari ve Bileşen Yapısı

### A. Sistem ve Bileşen Hiyerarşisi

```
┌─────────────────────────────────────────────────────────────────┐
│                           App.tsx                               │
│  - Tema Yönetimi (Dark / Light)                                 │
│  - Kullanıcı Konfigürasyon State'i (hız, boyut, kalınlık vb.)   │
│  - Çevrimdışı hazır ve duyarlı ekran çerçevesi                  │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
┌───────────────────────────────┐         ┌───────────────────────────────┐
│     ScorpionCanvas.tsx        │         │      ControlsDrawer.tsx       │
│ - Resize & Retina DPR desteği │         │ - Hız (Speed Multiplier)      │
│ - Pointer & Touch dinleyicisi │         │ - İskelet Çizgi Kalınlığı     │
│ - 60-120 FPS RAF döngüsü      │         │ - Kuyruk Esnekliği            │
│ - Kinematik & Çizim Motoru    │         │ - Kıskaç Açıklığı             │
│ - Saldırı Fizik Tetikleyicisi │         │ - Tema Değiştirici            │
└───────────────────────────────┘         └───────────────────────────────┘
```

### B. Prosedürel Akrep Matematik Modeli (IK & Physics)
- **Gövde**: Konum $(x, y)$, Hız $(\Delta x, \Delta y)$, Yön Açısı $(\theta)$. Hedefe doğru yay yumuşatması (`spring lerp`).
- **Kıskaçlar (Sağ & Sol)**: 3 eklemli kol hiyerarşisi + 2 hareketli çene (dactil/propodus). Tıklamada açı 35°'den 2°'ye anlık kapanır.
- **8 Bacak**: Gövdenin solunda 4, sağında 4. Her bacakta kalça (coxa), uyluk (femur) ve baldır (tibia) segmentleri; 2-joint analitik ters kinematik formülü:
  $$\cos(\alpha) = \frac{L_1^2 + D^2 - L_2^2}{2 \cdot L_1 \cdot D}$$
- **Kuyruk (Metasoma & Telson)**: Gövdenin arkasından başlayan 10 boğumlu esnek zincir ve ucunda zehir kesesi + iğne ucu. Saldırıda hedef noktaya doğru vektör uzaması.

---

## 5. Uygulama Adımları

1. **Çekirdek Simülasyon Kütüphanesi (`src/lib/scorpionMath.ts`)**:
   - Analitik ters kinematik, açısal yumuşatma (angular lerp), yay fiziği ve bacak basma (step target) algoritmalarının oluşturulması.
2. **Yüksek Performanslı Canvas Bileşeni (`src/components/ScorpionCanvas.tsx`)**:
   - `requestAnimationFrame` döngüsü, cihaz piksel oranı (DPR) ölçekleme, tam ekran pencere/dokunmatik dinleyicileri.
   - Minimalist beyaz iskelet render metotları (boğumlar, kabuk hatları, kıskaç dişleri, kuyruk omurları).
   - Tıklama/dokunma ile kıskaç kapma ve zehir iğnesi batırma saldırısı.
3. **Kullanıcı Kontrol Arayüzü (`src/components/ControlsDrawer.tsx`)**:
   - Ekran ergonomisine uygun (mobilde alt çekmece, masaüstünde yüzen zarif panel), tek satırlı erişilebilir kaydırıcılar ve tema anahtarı.
4. **Metadata & HTML Güncellemesi**:
   - `metadata.json`, `index.html` başlık ve açıklamaların güncellenmesi, tam çevrimdışı çalışma ve mobil PWA/dokunmatik optimizasyonları.
5. **Doğrulama**:
   - Farklı pencere boyutlarında, dikey/yatay modda test edilip `compile_applet` ile doğrulanması.
