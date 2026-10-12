/**
 * Ergonomic settings drawer and interactive control HUD.
 * Responsive for both mobile portrait/landscape and desktop.
 */

import React, { useState } from 'react';
import {
  Sliders,
  X,
  RotateCcw,
  Volume2,
  VolumeX,
  Compass,
  Moon,
  Sun,
  Crosshair,
  Sparkles,
  Bug,
} from 'lucide-react';
import { ScorpionConfig, LegCountOption } from '../lib/scorpionMath';

interface ControlsDrawerProps {
  config: ScorpionConfig;
  onChange: (updated: Partial<ScorpionConfig>) => void;
  onReset: () => void;
  onTriggerAttack: () => void;
  onSpawnPrey: () => void;
  preyCount?: number;
  stats?: { fps: number; speed: number; state: string };
}

const LEG_OPTIONS: LegCountOption[] = [6, 8, 10, 12, 14, 16, 18, 20];

export const ControlsDrawer: React.FC<ControlsDrawerProps> = ({
  config,
  onChange,
  onReset,
  onTriggerAttack,
  onSpawnPrey,
  preyCount,
  stats,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isLight = config.invertTheme;

  return (
    <>
      {/* Floating Responsive Action Bar */}
      <header className="fixed top-0 left-0 right-0 z-30 p-2.5 sm:p-6 flex items-start justify-between pointer-events-none">
        {/* Brand & Live State */}
        <div className="flex items-center gap-2.5 bg-black/80 backdrop-blur-md px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-white/10 pointer-events-auto shadow-xl">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm font-semibold tracking-tight text-white whitespace-nowrap">
              İskelet Akrep
            </span>
            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-zinc-400 font-mono tabular-nums">
              <span className="text-red-400 font-medium truncate max-w-[85px] sm:max-w-none">{stats?.state ?? 'Hazır'}</span>
              <span aria-hidden="true">·</span>
              <span>{config.legCount} B</span>
              <span aria-hidden="true">·</span>
              <span>{stats?.fps ?? 60} FPS</span>
            </div>
          </div>
        </div>

        {/* Toolbar: Desktop is horizontal flex; Mobile portrait is a vertical grid dock */}
        <div
          aria-label="Kontrol Araç Çubuğu"
          className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 sm:gap-2 pointer-events-auto"
        >
          {/* Quick Attack Button (Saldır) */}
          <button
            onClick={onTriggerAttack}
            className={`w-full sm:w-auto min-h-[42px] sm:min-h-[44px] px-3.5 sm:px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold tracking-wide transition-all active:scale-95 shadow-lg ${
              isLight
                ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                : 'bg-red-600 text-white hover:bg-red-500 shadow-red-600/30'
            }`}
            title="Saldırı Gerçekleştir (Kıskaç & 360° İğne)"
            aria-label="Saldır"
          >
            <Crosshair className="w-4 h-4 text-white shrink-0" />
            <span>Saldır</span>
          </button>

          {/* Spawn Prey Button (Av Ekle) */}
          <button
            onClick={onSpawnPrey}
            className={`w-full sm:w-auto min-h-[42px] sm:min-h-[44px] px-3.5 sm:px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold tracking-wide transition-all active:scale-95 shadow-lg ${
              isLight
                ? 'bg-amber-100 text-amber-950 border border-amber-300 hover:bg-amber-200'
                : 'bg-zinc-900/95 text-amber-400 border border-amber-500/40 hover:bg-amber-500/15 shadow-amber-500/20'
            }`}
            title="Ekrana Av Ekle (Böcek/Scarab)"
            aria-label="Av Ekle"
          >
            <Bug className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Av Ekle</span>
            {preyCount !== undefined && preyCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-400 font-mono font-bold leading-none">
                {preyCount}
              </span>
            )}
          </button>

          {/* Utility Buttons: Grid on mobile, inline on desktop */}
          <div className="grid grid-cols-3 sm:flex sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            {/* Sound Toggle */}
            <button
              onClick={() => onChange({ soundEnabled: !config.soundEnabled })}
              className="min-h-[42px] min-w-[42px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-xl bg-black/80 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 transition-colors active:scale-95 shadow-md"
              title={config.soundEnabled ? 'Sesi Kapat' : 'Sesi Aç'}
              aria-label="Ses Ayarı"
            >
              {config.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-red-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-zinc-500" />
              )}
            </button>

            {/* Theme Switcher */}
            <button
              onClick={() => onChange({ invertTheme: !config.invertTheme })}
              className="min-h-[42px] min-w-[42px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-xl bg-black/80 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 transition-colors active:scale-95 shadow-md"
              title={isLight ? 'Karanlık Moda Geç' : 'Aydınlık Kemik Moduna Geç'}
              aria-label="Tema Değiştir"
            >
              {isLight ? (
                <Moon className="w-4 h-4 text-zinc-300" />
              ) : (
                <Sun className="w-4 h-4 text-red-400" />
              )}
            </button>

            {/* Open Settings Drawer */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`min-h-[42px] min-w-[42px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-xl backdrop-blur-md border transition-all active:scale-95 shadow-md ${
                isOpen
                  ? 'bg-red-600 text-white border-red-500'
                  : 'bg-black/80 text-white border-white/10 hover:bg-white/10'
              }`}
              title="Simülasyon Ayarları"
              aria-label="Ayarlar Panelini Aç"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>


      {/* Slide-out Settings Drawer / Side Modal */}
      {isOpen && (
        <>
          {/* Mobile backdrop to click outside and close */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm sm:hidden transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-label="Akrep Ayarları"
            className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 h-[100dvh] max-h-screen bg-zinc-950/95 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col text-white transition-all animate-in slide-in-from-right duration-200"
          >
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-md px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-red-500" />
                <h2 className="text-base font-semibold">Simülasyon Ayarları</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-6">
              {/* Leg Count Selector: Vertically arranged 2-column grid on mobile! */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-300 font-medium">Bacak Sayısı Seçimi</span>
                  <span className="text-red-400 font-mono tabular-nums font-semibold">
                    {config.legCount} Bacak (Dalga Yürüyüşü)
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {LEG_OPTIONS.map((count) => {
                    const isActive = config.legCount === count;
                    return (
                      <button
                        key={count}
                        onClick={() => onChange({ legCount: count })}
                        className={`min-h-[44px] py-2 px-3 text-xs font-medium rounded-xl border flex items-center justify-center transition-all ${
                          isActive
                            ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-900/40'
                            : 'bg-zinc-900 text-zinc-300 border-white/10 hover:border-white/30 hover:bg-zinc-800'
                        }`}
                      >
                        {count} Bacak
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Speed Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-300 font-medium">Hareket & Yönelme Hızı</span>
                  <span className="text-zinc-400 font-mono tabular-nums">
                    {config.speed.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={config.speed}
                  onChange={(e) => onChange({ speed: parseFloat(e.target.value) })}
                  className="w-full accent-red-500 bg-zinc-800 rounded-lg h-2 cursor-pointer"
                />
              </div>

              {/* Size Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-300 font-medium">İskelet Boyutu</span>
                  <span className="text-zinc-400 font-mono tabular-nums">
                    {Math.round(config.size * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.5"
                  step="0.05"
                  value={config.size}
                  onChange={(e) => onChange({ size: parseFloat(e.target.value) })}
                  className="w-full accent-red-500 bg-zinc-800 rounded-lg h-2 cursor-pointer"
                />
              </div>

              {/* Line Width Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-300 font-medium">İskelet Çizgi Kalınlığı</span>
                  <span className="text-zinc-400 font-mono tabular-nums">
                    {config.lineWidth.toFixed(1)} px
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="3.5"
                  step="0.2"
                  value={config.lineWidth}
                  onChange={(e) => onChange({ lineWidth: parseFloat(e.target.value) })}
                  className="w-full accent-red-500 bg-zinc-800 rounded-lg h-2 cursor-pointer"
                />
              </div>

              {/* Strike Velocity */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-300 font-medium">360° İğne Savurma Çevikliği</span>
                  <span className="text-zinc-400 font-mono tabular-nums">
                    {config.stingerStrikeSpeed.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="2.5"
                  step="0.1"
                  value={config.stingerStrikeSpeed}
                  onChange={(e) =>
                    onChange({ stingerStrikeSpeed: parseFloat(e.target.value) })
                  }
                  className="w-full accent-red-500 bg-zinc-800 rounded-lg h-2 cursor-pointer"
                />
              </div>

              {/* Tail Segments Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-300 font-medium">Kuyruk Omur Sayısı</span>
                  <span className="text-zinc-400 font-mono tabular-nums">
                    {config.tailSegments} Omur
                  </span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="14"
                  step="1"
                  value={config.tailSegments}
                  onChange={(e) =>
                    onChange({ tailSegments: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-red-500 bg-zinc-800 rounded-lg h-2 cursor-pointer"
                />
              </div>

              {/* Feature Toggles */}
              <div className="pt-2 border-t border-white/10 space-y-3">
                {/* Auto Wander Toggle */}
                <label className="flex items-center justify-between cursor-pointer min-h-[44px]">
                  <div className="flex items-center gap-2.5">
                    <Compass className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-zinc-300">Oto-Gezinti (Otonom Avlanma)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.autoWander}
                    onChange={(e) => onChange({ autoWander: e.target.checked })}
                    className="w-5 h-5 accent-red-500 rounded cursor-pointer"
                  />
                </label>

                {/* Luminescence Glow Toggle */}
                <label className="flex items-center justify-between cursor-pointer min-h-[44px]">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-red-500" />
                    <span className="text-xs text-zinc-300">Kırmızı Neon İskelet Işıltısı</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.glowEffect}
                    onChange={(e) => onChange({ glowEffect: e.target.checked })}
                    className="w-5 h-5 accent-red-500 rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Sticky Footer with Vertical Grid on mobile */}
            <div className="sticky bottom-0 z-10 bg-zinc-950/95 backdrop-blur-md px-5 py-4 border-t border-white/10 shrink-0">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={onReset}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors border border-white/10"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Sıfırla</span>
                </button>
                <button
                  onClick={onTriggerAttack}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-red-900/40"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Saldır</span>
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
  </>
  );
};
