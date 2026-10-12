# İskelet Akrep 🦂

Ters kinematik (IK - Inverse Kinematics) ve metakronal dalga yürüyüşü ile çalışan, fare ve dokunmatik hareketleri pürüzsüz takip eden minimalist interaktif akrep simülasyonu.

## Özellikler

- **PWA (Progressive Web App) Desteği**: Masaüstünde ve mobilde bağımsız uygulama (standalone app) olarak ana ekrana yüklenebilir, çevrimdışı (offline) çalışabilir.
- **Prosedürel Yürüyüş & Eklemler**: Gerçekçi eklem fiziği ve ayarlanabilir bacak sayısı (6 - 20 bacak).
- **Etkileşim**: Dokunma, sürükleme, fare takibi, av fırlatma ve 360° kuyruk iğnesi saldırısı.
- **Kişiselleştirme**: Hız, boyut, çizgi kalınlığı, iğne hızı, omurga/kuyruk segmenti ve neon parlama ayarları.
- **Ses & Hissiyat**: Web Audio API ile prosedürel ses efektleri ve titreşim desteği.

## Geliştirme

```bash
# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın
npm run dev

# Üretim derlemesi
npm run build
```

## Dağıtım (Vercel)

Proje Vite tabanlı bir SPA ve PWA'dır. Vercel'e doğrudan GitHub reposu bağlanarak otomatik olarak dağıtılabilir (`dist/` çıktısı ile çalışır).
