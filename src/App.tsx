/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ScorpionCanvas, ScorpionCanvasHandle } from './components/ScorpionCanvas';
import { ControlsDrawer } from './components/ControlsDrawer';
import { ScorpionConfig, DEFAULT_CONFIG } from './lib/scorpionMath';

const STORAGE_KEY = 'procedural_scorpion_config_v1';

export default function App() {
  const canvasRef = useRef<ScorpionCanvasHandle | null>(null);
  const [preyCount, setPreyCount] = useState(0);

  // Load initial config from localStorage
  const [config, setConfig] = useState<ScorpionConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
        }
      } catch {
        // Ignore localStorage access restrictions
      }
    }
    return DEFAULT_CONFIG;
  });

  const [stats, setStats] = useState<{ fps: number; speed: number; state: string }>({
    fps: 60,
    speed: 0,
    state: 'Pusuda (Ambush)',
  });

  const [attackFlash, setAttackFlash] = useState(false);

  // Sync theme class to html tag for Tailwind
  useEffect(() => {
    const root = document.documentElement;
    if (config.invertTheme) {
      root.classList.remove('dark');
      document.body.style.backgroundColor = '#F4F4F5';
    } else {
      root.classList.add('dark');
      document.body.style.backgroundColor = '#000000';
    }
  }, [config.invertTheme]);

  // Persist config changes to localStorage
  const updateConfig = useCallback((updated: Partial<ScorpionConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updated };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignored
      }
      return next;
    });
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignored
    }
  }, []);

  // Handle attack event
  const handleAttackTriggered = useCallback(() => {
    setAttackFlash(true);
    setTimeout(() => setAttackFlash(false), 120);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 't' || e.key === 'T') {
        updateConfig({ invertTheme: !config.invertTheme });
      } else if (e.key === 'm' || e.key === 'M') {
        updateConfig({ soundEnabled: !config.soundEnabled });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config.invertTheme, config.soundEnabled, updateConfig]);

  return (
    <main
      className={`relative w-screen h-screen overflow-hidden select-none touch-none ${
        config.invertTheme ? 'bg-[#F4F4F5]' : 'bg-black'
      }`}
    >
      {/* Edge Flash on Strike Impact */}
      {attackFlash && (
        <div
          className={`absolute inset-0 pointer-events-none z-10 transition-opacity duration-150 ${
            config.invertTheme
              ? 'ring-8 ring-rose-500/30'
              : 'ring-8 ring-red-600/40'
          }`}
        />
      )}

      {/* Main Procedural Scorpion Canvas */}
      <ScorpionCanvas
        ref={canvasRef}
        config={config}
        onStatsUpdate={setStats}
        onAttackTriggered={handleAttackTriggered}
        onPreyCountChange={setPreyCount}
      />

      {/* Interactive HUD & Controls Drawer */}
      <ControlsDrawer
        config={config}
        onChange={updateConfig}
        onReset={resetConfig}
        onSpawnPrey={() => canvasRef.current?.spawnPrey()}
        preyCount={preyCount}
        onTriggerAttack={() => {
          // Trigger attack via keyboard event dispatch for space
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
        }}
        stats={stats}
      />
    </main>
  );
}
