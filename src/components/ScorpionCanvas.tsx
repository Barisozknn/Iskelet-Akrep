/**
 * High-performance full-screen Canvas 2D procedural scorpion simulation.
 * Features:
 * - Perfectly synchronized, harmonious metachronal ripple walking wave (senkron ve ahenkli dalga yürüyüşü).
 * - Geometrically stable 2-bone knee IK (femur & tibia with guaranteed outward arachnid knee arch).
 * - Dedicated, non-crossing lateral leg lanes (bacaklar birbirine çarpmaz, asla gövde altına dolanmaz).
 * - Boundary-steering prey system (avlar kenarlara sıkışmaz, duvardan seker).
 * - Ultra-fast GPU-friendly alpha bloom for solid 60-120 FPS.
 * - Lingering decaying crimson neon trails when walking with glowEffect enabled.
 */

import React, { useEffect, useRef, useCallback, useImperativeHandle } from 'react';
import {
  Point,
  ScorpionConfig,
  normalizeAngle,
  lerpAngle,
  lerp,
  clamp,
  dist,
  LegState,
  SpineSegment,
} from '../lib/scorpionMath';
import {
  playPincerSnap,
  playStingerStrike,
  playFootstep,
  playPreyStruck,
  triggerHaptic,
} from '../lib/audio';

export interface ScorpionCanvasHandle {
  spawnPrey: () => void;
  triggerAttack: (x?: number, y?: number) => void;
}

interface ScorpionCanvasProps {
  config: ScorpionConfig;
  onStatsUpdate?: (stats: { fps: number; speed: number; state: string }) => void;
  onAttackTriggered?: () => void;
  onPreyCountChange?: (count: number) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
}

interface FootPrint {
  x: number;
  y: number;
  alpha: number;
}

interface StrikeWave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

interface TailNode {
  x: number;
  y: number;
  angle: number;
  radius: number;
}

interface NeonTrailNode {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  decay: number;
  isFootstep?: boolean;
}

interface Prey {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  alive: boolean;
  legPhase: number;
  fleeTimer: number;
  pulsePhase: number;
}

export const ScorpionCanvas = React.forwardRef<ScorpionCanvasHandle, ScorpionCanvasProps>(({
  config,
  onStatsUpdate,
  onAttackTriggered,
  onPreyCountChange,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const simRef = useRef({
    width: 0,
    height: 0,
    dpr: 1,

    // Head / Prosoma state
    headPos: { x: 0, y: 0 } as Point,
    headAngle: 0,
    linearSpeed: 0,
    bodyRecoil: { x: 0, y: 0 } as Point,

    // Pointer target & touch interaction
    targetPos: { x: 0, y: 0 } as Point,
    isPointerActive: false,
    lastPointerMoveTime: Date.now(),
    pointerDownPos: { x: 0, y: 0 } as Point,
    pointerDownTime: 0,
    hasDragged: false,

    // Autonomous wandering (strictly active ONLY if config.autoWander === true)
    wanderAngle: 0,
    wanderTimer: 0,
    wanderTarget: { x: 0, y: 0 } as Point,

    // Articulated Curved Spine (Tergite vertebrae chain)
    spineSegments: [] as SpineSegment[],

    // Articulated Legs & Master Gait Phase
    legs: [] as LegState[],
    masterGaitPhase: 0,

    // Pedipalps (Pincers)
    pincerAngle: 0.28,
    pincerSnapProgress: 0,
    pincerSnapVel: 0,

    // Tail: Articulated Chain attached to the VERY REAR
    tailSegments: [] as TailNode[],

    // Stinger Strike
    isStriking: false,
    strikeTimer: 0,
    strikeTarget: { x: 0, y: 0 } as Point,
    screenShake: 0,

    // Interactive Prey System
    preyList: [] as Prey[],
    preyIdCounter: 1,

    // Crimson Neon Trails
    neonTrails: [] as NeonTrailNode[],
    trailTimer: 0,

    // Visual FX
    particles: [] as Particle[],
    footprints: [] as FootPrint[],
    strikeWaves: [] as StrikeWave[],

    // Performance
    frameCount: 0,
    lastFpsUpdate: performance.now(),
    currentFps: 60,
  });

  // Calculate body vertebrae with proportionate spacing based on leg count
  const initSpine = useCallback((headPos: Point, headAngle: number, legCount: number, scale: number) => {
    const pairs = legCount / 2;
    const segments: SpineSegment[] = [];
    const spacing = (20 + (pairs <= 4 ? 4 : 0)) * scale;

    for (let i = 0; i < pairs; i++) {
      const frac = i / (pairs - 1 || 1);
      const width = lerp(18, 12, frac) * scale;
      const distFromHead = (22 + i * spacing) * scale;
      segments.push({
        x: headPos.x - Math.cos(headAngle) * distFromHead,
        y: headPos.y - Math.sin(headAngle) * distFromHead,
        angle: headAngle,
        width,
        height: spacing,
      });
    }
    return segments;
  }, []);

  // Initialize articulated legs with clean, non-crossing lateral lanes
  const initLegs = useCallback((spine: SpineSegment[], legCount: number, scale: number) => {
    const legs: LegState[] = [];
    const pairs = legCount / 2;

    for (let p = 0; p < pairs; p++) {
      const seg = spine[p] || { x: 0, y: 0, angle: 0, width: 14 * scale };
      const frac = pairs > 1 ? p / (pairs - 1) : 0.5;

      // Clean fan angle from front (49° / 0.86 rad) to rear (127° / 2.22 rad)
      const fanAngle = lerp(0.86, 2.22, frac);
      const legReach = lerp(66, 80, Math.sin(frac * Math.PI * 0.8 + 0.2)) * scale;

      for (const side of [-1, 1] as const) {
        const idx = p * 2 + (side === 1 ? 1 : 0);

        const coxaX = seg.x - Math.sin(seg.angle) * (side * seg.width);
        const coxaY = seg.y + Math.cos(seg.angle) * (side * seg.width);

        const footAngle = seg.angle + side * fanAngle;
        const wx = seg.x + Math.cos(footAngle) * legReach;
        const wy = seg.y + Math.sin(footAngle) * legReach;

        // Equalized anatomical bone proportions (Femur: ~38, Tibia: ~42)
        const boneBase = (38 + Math.sin(frac * Math.PI) * 5) * scale;

        legs.push({
          index: idx,
          pairIndex: p,
          side,
          wavePhase: 0,
          coxaBase: { x: coxaX, y: coxaY },
          currentFoot: { x: wx, y: wy },
          targetFoot: { x: wx, y: wy },
          stepStartFoot: { x: wx, y: wy },
          stepProgress: 1,
          isStepping: false,
          liftZ: 0,
          l1: boneBase * 0.95,
          l2: boneBase * 1.05,
        });
      }
    }

    return legs;
  }, []);

  // Initialize Tail extending from rear of body
  const initTail = useCallback((rearPos: Point, rearAngle: number, segmentCount: number, scale: number) => {
    const segments: TailNode[] = [];
    const segLen = 14 * scale;

    for (let i = 0; i < segmentCount; i++) {
      const frac = i / (segmentCount - 1 || 1);
      const angle = rearAngle;
      const x = rearPos.x - Math.cos(angle) * ((i + 1) * segLen);
      const y = rearPos.y - Math.sin(angle) * ((i + 1) * segLen);

      segments.push({
        x,
        y,
        angle,
        radius: lerp(7.5, 4.0, frac) * scale,
      });
    }
    return segments;
  }, []);

  // Calculate dynamic physical tail reach from head/pincers into combat zone (~257px at default settings)
  const getTailReach = useCallback((tailSegments: number, size: number) => {
    return (240 + tailSegments * 7.5) * size + 50;
  }, []);

  // Trigger attack (360-degree direct stinger strike & pincer snap within enhanced combat reach)
  const triggerAttack = useCallback((targetX?: number, targetY?: number) => {
    const sim = simRef.current;
    
    const maxTailReach = getTailReach(config.tailSegments, config.size);

    let finalTargetX = targetX;
    let finalTargetY = targetY;

    if (finalTargetX === undefined || finalTargetY === undefined) {
      const alivePrey = sim.preyList.filter(p => p.alive);
      if (alivePrey.length > 0) {
        let closest = alivePrey[0];
        let minDist = dist(sim.headPos, closest);
        for (const p of alivePrey) {
          const d = dist(sim.headPos, p);
          if (d < minDist) {
            minDist = d;
            closest = p;
          }
        }
        // Auto-target closest prey if within physical tail striking reach!
        if (minDist <= maxTailReach) {
          finalTargetX = closest.x;
          finalTargetY = closest.y;
        }
      }
    }

    const rawTarget: Point = finalTargetX !== undefined && finalTargetY !== undefined
      ? { x: finalTargetX, y: finalTargetY }
      : { ...sim.targetPos };

    // Clamp strike target to physical reach from head so stinger whips within natural reach
    const dx = rawTarget.x - sim.headPos.x;
    const dy = rawTarget.y - sim.headPos.y;
    const strikeDist = Math.hypot(dx, dy);
    const strikeAngle = Math.atan2(dy, dx);
    const clampedDist = Math.min(strikeDist, maxTailReach);

    const target: Point = {
      x: sim.headPos.x + Math.cos(strikeAngle) * clampedDist,
      y: sim.headPos.y + Math.sin(strikeAngle) * clampedDist,
    };

    sim.pincerSnapProgress = 1;
    sim.pincerSnapVel = -0.32;

    sim.isStriking = true;
    sim.strikeTimer = 0;
    sim.strikeTarget = target;

    const recoilForce = Math.min(22, Math.max(10, strikeDist * 0.05)) * config.size;
    sim.bodyRecoil.x = -Math.cos(strikeAngle) * recoilForce;
    sim.bodyRecoil.y = -Math.sin(strikeAngle) * recoilForce;

    sim.screenShake = 6;

    if (config.soundEnabled) {
      playPincerSnap(0.45);
      playStingerStrike(0.55);
    }
    if (config.hapticEnabled) {
      triggerHaptic(35);
    }

    sim.strikeWaves.push({
      x: target.x,
      y: target.y,
      radius: 4,
      maxRadius: 55 * config.size,
      alpha: 1.0,
    });

    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16 + (Math.random() - 0.5) * 0.5;
      const speed = 3.5 + Math.random() * 6.0;
      sim.particles.push({
        x: target.x,
        y: target.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1.6 + Math.random() * 2.0,
        alpha: 1.0,
        color: '#EF4444',
      });
    }

    if (onAttackTriggered) {
      onAttackTriggered();
    }
  }, [config.size, config.tailSegments, config.soundEnabled, config.hapticEnabled, onAttackTriggered]);

  // Spawn prey function
  const spawnPrey = useCallback(() => {
    const sim = simRef.current;
    const w = sim.width || window.innerWidth;
    const h = sim.height || window.innerHeight;
    const margin = 100;

    let spawnX = margin + Math.random() * (w - margin * 2);
    let spawnY = margin + Math.random() * (h - margin * 2);

    if (Math.hypot(spawnX - sim.headPos.x, spawnY - sim.headPos.y) < 160) {
      spawnX = sim.headPos.x > w * 0.5 ? margin + Math.random() * (w * 0.3) : w - margin - Math.random() * (w * 0.3);
      spawnY = sim.headPos.y > h * 0.5 ? margin + Math.random() * (h * 0.3) : h - margin - Math.random() * (h * 0.3);
    }

    const newPrey: Prey = {
      id: sim.preyIdCounter++,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      angle: Math.random() * Math.PI * 2,
      alive: true,
      legPhase: 0,
      fleeTimer: 0,
      pulsePhase: Math.random() * Math.PI * 2,
    };

    sim.preyList.push(newPrey);

    if (onPreyCountChange) {
      onPreyCountChange(sim.preyList.filter(p => p.alive).length);
    }

    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      const spd = 2.5 + Math.random() * 3.0;
      sim.particles.push({
        x: spawnX,
        y: spawnY,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        radius: 1.6,
        alpha: 1.0,
        color: '#F59E0B',
      });
    }

    if (config.hapticEnabled) {
      triggerHaptic(20);
    }
  }, [config.hapticEnabled, onPreyCountChange]);

  // Expose imperative handle
  useImperativeHandle(ref, () => ({
    spawnPrey,
    triggerAttack,
  }), [spawnPrey, triggerAttack]);

  // Handle Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const sim = simRef.current;
      sim.width = width;
      sim.height = height;
      sim.dpr = dpr;

      if (sim.headPos.x === 0 && sim.headPos.y === 0) {
        sim.headPos = { x: width * 0.5, y: height * 0.5 };
        sim.targetPos = { x: width * 0.5, y: height * 0.5 };
        sim.headAngle = -Math.PI * 0.5;

        sim.spineSegments = initSpine(sim.headPos, sim.headAngle, config.legCount, config.size);
        sim.legs = initLegs(sim.spineSegments, config.legCount, config.size);
        
        const lastSeg = sim.spineSegments[sim.spineSegments.length - 1];
        const rearPos = {
          x: lastSeg.x - Math.cos(lastSeg.angle) * (lastSeg.height * 0.5),
          y: lastSeg.y - Math.sin(lastSeg.angle) * (lastSeg.height * 0.5),
        };
        sim.tailSegments = initTail(rearPos, lastSeg.angle, config.tailSegments, config.size);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [initSpine, initLegs, initTail, config.legCount, config.size, config.tailSegments]);

  // Pointer & Touch handlers
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const sim = simRef.current;
    sim.targetPos = { x, y };
    sim.isPointerActive = true;
    sim.lastPointerMoveTime = Date.now();
    sim.pointerDownPos = { x, y };
    sim.pointerDownTime = performance.now();
    sim.hasDragged = false;
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const sim = simRef.current;
    const dx = x - sim.pointerDownPos.x;
    const dy = y - sim.pointerDownPos.y;
    if (Math.hypot(dx, dy) > 10) {
      sim.hasDragged = true;
    }

    sim.targetPos = { x, y };
    sim.isPointerActive = true;
    sim.lastPointerMoveTime = Date.now();
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const sim = simRef.current;
    const elapsed = performance.now() - sim.pointerDownTime;
    const distMoved = Math.hypot(x - sim.pointerDownPos.x, y - sim.pointerDownPos.y);

    if (!sim.hasDragged && elapsed < 320 && distMoved < 22) {
      const maxTailReach = getTailReach(config.tailSegments, config.size);
      const dToTap = Math.hypot(x - sim.headPos.x, y - sim.headPos.y);

      // Check if user tapped directly on or near an alive prey
      const alivePrey = sim.preyList.filter(p => p.alive);
      const tappedPrey = alivePrey.find(p => Math.hypot(p.x - x, p.y - y) < 48);

      if (tappedPrey) {
        const dPreyToHead = Math.hypot(tappedPrey.x - sim.headPos.x, tappedPrey.y - sim.headPos.y);
        if (dPreyToHead <= maxTailReach) {
          triggerAttack(tappedPrey.x, tappedPrey.y);
        } else {
          // Stalk towards prey if tapped from afar
          sim.targetPos = { x: tappedPrey.x, y: tappedPrey.y };
          sim.isPointerActive = true;
          sim.lastPointerMoveTime = Date.now();
        }
      } else if (dToTap <= maxTailReach) {
        // Tapped within combat radius: execute direct strike!
        triggerAttack(x, y);
      } else {
        // If an alive prey is already within striking reach, any tap executes attack on it!
        const closePrey = alivePrey.find(p => Math.hypot(p.x - sim.headPos.x, p.y - sim.headPos.y) <= maxTailReach);
        if (closePrey) {
          triggerAttack(closePrey.x, closePrey.y);
        } else {
          // Tapped far away in open space: guide scorpion towards the target!
          sim.targetPos = { x, y };
          sim.isPointerActive = true;
          sim.lastPointerMoveTime = Date.now();
        }
      }
    } else {
      sim.isPointerActive = false;
    }
  }, [triggerAttack, getTailReach, config.tailSegments, config.size]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        triggerAttack();
      } else if ((e.key === 'b' || e.key === 'B') && !e.repeat) {
        spawnPrey();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerAttack, spawnPrey]);

  // Re-sync spine, legs, and tail if configuration changes
  useEffect(() => {
    const sim = simRef.current;
    if (sim.width > 0) {
      sim.spineSegments = initSpine(sim.headPos, sim.headAngle, config.legCount, config.size);
      sim.legs = initLegs(sim.spineSegments, config.legCount, config.size);
      const lastSeg = sim.spineSegments[sim.spineSegments.length - 1];
      const rearPos = {
        x: lastSeg.x - Math.cos(lastSeg.angle) * (lastSeg.height * 0.5),
        y: lastSeg.y - Math.sin(lastSeg.angle) * (lastSeg.height * 0.5),
      };
      sim.tailSegments = initTail(rearPos, lastSeg.angle, config.tailSegments, config.size);
    }
  }, [config.legCount, config.size, config.tailSegments, initSpine, initLegs, initTail]);

  // Main Animation & Simulation Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      animId = requestAnimationFrame(loop);

      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      const sim = simRef.current;
      const { width, height, dpr } = sim;
      if (width === 0 || height === 0) return;

      // FPS tracking
      sim.frameCount++;
      if (currentTime - sim.lastFpsUpdate >= 500) {
        sim.currentFps = Math.round((sim.frameCount * 1000) / (currentTime - sim.lastFpsUpdate));
        sim.frameCount = 0;
        sim.lastFpsUpdate = currentTime;

        const aliveCount = sim.preyList.filter(p => p.alive).length;
        if (onStatsUpdate) {
          onStatsUpdate({
            fps: sim.currentFps,
            speed: Math.round(sim.linearSpeed * 10) / 10,
            state: sim.isStriking
              ? 'Yıldırım Saldırısı (Strike)'
              : aliveCount > 0
              ? `Av Peşinde (${aliveCount} Av)`
              : sim.linearSpeed > 0.5
              ? 'Avlanıyor (Crawling)'
              : 'Pusuda (Ambush)',
          });
        }
      }

      // --- 1. INTELLIGENT PREY SIMULATION & EDGE-AVOIDANCE STEERING ---
      const alivePreys = sim.preyList.filter(p => p.alive);

      alivePreys.forEach((prey) => {
        const distToScorpion = Math.hypot(prey.x - sim.headPos.x, prey.y - sim.headPos.y);

        const wallMargin = 90;
        let wallPushX = 0;
        let wallPushY = 0;

        if (prey.x < wallMargin) wallPushX += (wallMargin - prey.x) / wallMargin;
        if (prey.x > width - wallMargin) wallPushX -= (prey.x - (width - wallMargin)) / wallMargin;
        if (prey.y < wallMargin) wallPushY += (wallMargin - prey.y) / wallMargin;
        if (prey.y > height - wallMargin) wallPushY -= (prey.y - (height - wallMargin)) / wallMargin;

        const isNearWall = wallPushX !== 0 || wallPushY !== 0;

        if (distToScorpion < 230 * config.size) {
          const fleeAngle = Math.atan2(prey.y - sim.headPos.y, prey.x - sim.headPos.x);
          let targetAngle = fleeAngle;

          if (isNearWall) {
            const wallAngle = Math.atan2(wallPushY, wallPushX);
            targetAngle = lerpAngle(fleeAngle, wallAngle, 0.65);
          }

          prey.angle = lerpAngle(prey.angle, targetAngle, 0.22);
          const fleeSpeed = 125 * config.size;
          prey.vx = Math.cos(prey.angle) * fleeSpeed;
          prey.vy = Math.sin(prey.angle) * fleeSpeed;
          prey.legPhase += dt * 30;
        } else {
          prey.fleeTimer -= dt;
          if (prey.fleeTimer <= 0 || isNearWall) {
            prey.fleeTimer = 1.2 + Math.random() * 2.0;
            if (isNearWall) {
              const centerAngle = Math.atan2(height * 0.5 - prey.y, width * 0.5 - prey.x);
              prey.angle = centerAngle + (Math.random() - 0.5) * 0.8;
            } else {
              prey.angle += (Math.random() - 0.5) * 1.5;
            }
          }
          const crawlSpeed = 26 * config.size;
          prey.vx = Math.cos(prey.angle) * crawlSpeed;
          prey.vy = Math.sin(prey.angle) * crawlSpeed;
          prey.legPhase += dt * 10;
        }

        prey.x += prey.vx * dt;
        prey.y += prey.vy * dt;

        const boundaryPad = 48;
        if (prey.x < boundaryPad) {
          prey.x = boundaryPad;
          prey.vx = Math.abs(prey.vx) + 10;
          prey.angle = Math.atan2(prey.vy, prey.vx);
        } else if (prey.x > width - boundaryPad) {
          prey.x = width - boundaryPad;
          prey.vx = -Math.abs(prey.vx) - 10;
          prey.angle = Math.atan2(prey.vy, prey.vx);
        }
        if (prey.y < boundaryPad) {
          prey.y = boundaryPad;
          prey.vy = Math.abs(prey.vy) + 10;
          prey.angle = Math.atan2(prey.vy, prey.vx);
        } else if (prey.y > height - boundaryPad) {
          prey.y = height - boundaryPad;
          prey.vy = -Math.abs(prey.vy) - 10;
          prey.angle = Math.atan2(prey.vy, prey.vx);
        }

        prey.pulsePhase += dt * 4;
      });

      // Close-quarters ambush: When the scorpion's head and pincers get right on top of prey
      // Strictly active ONLY if config.autoWander is true! (oto gezinti kapalıyken asla oto saldırı yapmaz)
      if (config.autoWander) {
        alivePreys.forEach((prey) => {
          const dHead = Math.hypot(sim.headPos.x - prey.x, sim.headPos.y - prey.y);
          const pincerReach = 42 * config.size + 10;
          if (dHead < pincerReach && !sim.isStriking) {
            triggerAttack(prey.x, prey.y);
          }
        });
      }

      // --- 2. TARGET SELECTION (AUTO-WANDER / PREY STALKING) ---
      let effectiveTarget = { ...sim.targetPos };

      if (config.autoWander && !sim.isPointerActive) {
        if (alivePreys.length > 0) {
          let closest = alivePreys[0];
          let minDist = dist(sim.headPos, closest);
          for (const p of alivePreys) {
            const d = dist(sim.headPos, p);
            if (d < minDist) {
              minDist = d;
              closest = p;
            }
          }
          effectiveTarget = { x: closest.x, y: closest.y };

          const maxTailReach = getTailReach(config.tailSegments, config.size);
          if (minDist <= maxTailReach && !sim.isStriking) {
            triggerAttack(closest.x, closest.y);
          }
        } else {
          sim.wanderTimer -= dt;
          if (sim.wanderTimer <= 0) {
            sim.wanderTimer = 2.5 + Math.random() * 3.0;
            const padding = 100;
            sim.wanderTarget = {
              x: padding + Math.random() * (width - padding * 2),
              y: padding + Math.random() * (height - padding * 2),
            };
          }
          effectiveTarget = sim.wanderTarget;
        }
      }

      // --- 3. HEAD MOVEMENT & ROTATION ---
      const dx = effectiveTarget.x - sim.headPos.x;
      const dy = effectiveTarget.y - sim.headPos.y;
      const targetDist = Math.hypot(dx, dy);

      const stopDistance = 32 * config.size;
      let moveSpeed = 0;

      if (targetDist > 16) {
        const targetAngle = Math.atan2(dy, dx);
        const turnSpeed = clamp(6.8 * config.speed * dt, 0.06, 0.38);
        sim.headAngle = lerpAngle(sim.headAngle, targetAngle, turnSpeed);
      }

      if (targetDist > stopDistance) {
        const maxSpeed = 160 * config.speed;
        moveSpeed = Math.min((targetDist - stopDistance) * 2.8, maxSpeed);
        const forwardX = Math.cos(sim.headAngle);
        const forwardY = Math.sin(sim.headAngle);

        const angleDiff = Math.abs(normalizeAngle(Math.atan2(dy, dx) - sim.headAngle));
        const forwardAlignment = Math.max(0.25, Math.cos(angleDiff));

        sim.headPos.x += forwardX * moveSpeed * forwardAlignment * dt;
        sim.headPos.y += forwardY * moveSpeed * forwardAlignment * dt;
      }

      sim.headPos.x += sim.bodyRecoil.x * dt * 30;
      sim.headPos.y += sim.bodyRecoil.y * dt * 30;
      sim.bodyRecoil.x *= 0.82;
      sim.bodyRecoil.y *= 0.82;

      if (sim.screenShake > 0) {
        sim.screenShake *= 0.78;
        if (sim.screenShake < 0.1) sim.screenShake = 0;
      }

      sim.linearSpeed = lerp(sim.linearSpeed, moveSpeed, 0.15);

      const boundMargin = 35;
      sim.headPos.x = clamp(sim.headPos.x, boundMargin, width - boundMargin);
      sim.headPos.y = clamp(sim.headPos.y, boundMargin, height - boundMargin);

      // --- 4. ARTICULATED CURVED SPINE KINEMATICS ---
      const pairs = config.legCount / 2;
      const spacing = (20 + (pairs <= 4 ? 4 : 0)) * config.size;
      let prevX = sim.headPos.x;
      let prevY = sim.headPos.y;
      let prevAngle = sim.headAngle;

      for (let p = 0; p < pairs; p++) {
        const seg = sim.spineSegments[p];
        if (!seg) continue;

        const bendDamping = clamp(11.0 * config.speed * dt, 0.12, 0.38);
        seg.angle = lerpAngle(seg.angle, prevAngle, bendDamping);

        seg.x = prevX - Math.cos(seg.angle) * spacing;
        seg.y = prevY - Math.sin(seg.angle) * spacing;

        prevX = seg.x;
        prevY = seg.y;
        prevAngle = seg.angle;
      }

      // --- 5. SYNCHRONIZED METACHRONAL WAVE WALKING (AHENKLI VE SENKRON ARDIŞIK ADIMLAR) ---
      const isMoving = sim.linearSpeed > 0.5;
      if (isMoving) {
        // Continuous wave cadence proportional to linear velocity and speed config
        const speedFactor = clamp(sim.linearSpeed / 60, 0.5, 3.0);
        const cadence = 4.4 * speedFactor * config.speed;
        sim.masterGaitPhase = (sim.masterGaitPhase + cadence * dt) % (Math.PI * 2);
      }

      // Update neutral resting targets along each vertebra's fan sector
      sim.legs.forEach((leg) => {
        const seg = sim.spineSegments[leg.pairIndex];
        if (!seg) return;

        const frac = pairs > 1 ? leg.pairIndex / (pairs - 1) : 0.5;
        const fanAngle = lerp(0.86, 2.22, frac);
        const legReach = lerp(66, 80, Math.sin(frac * Math.PI * 0.8 + 0.2)) * config.size;

        leg.coxaBase = {
          x: seg.x - Math.sin(seg.angle) * (leg.side * seg.width),
          y: seg.y + Math.cos(seg.angle) * (leg.side * seg.width),
        };

        const footAngle = seg.angle + leg.side * fanAngle;
        leg.targetFoot = {
          x: seg.x + Math.cos(footAngle) * legReach,
          y: seg.y + Math.sin(footAngle) * legReach,
        };
      });

      // Synchronized cascading wave step cycle:
      // Front leg moves first -> next leg delayed -> next leg delayed -> rear leg!
      // Swing phase: 34% of cycle (leg lifts, arcs forward, touches ground)
      // Stance phase: 66% of cycle (leg firmly planted on ground, supporting body)
      const swingDuration = 0.34;
      // Delay per pair propagates the wave cleanly from front to rear
      const delayPerPair = (Math.PI * 2 * 0.78) / Math.max(1, pairs);

      sim.legs.forEach((leg) => {
        const seg = sim.spineSegments[leg.pairIndex] || sim.spineSegments[0];
        const frac = pairs > 1 ? leg.pairIndex / (pairs - 1) : 0.5;
        const fanAngle = lerp(0.86, 2.22, frac);
        const legReach = lerp(66, 80, Math.sin(frac * Math.PI * 0.8 + 0.2)) * config.size;

        // Front to back sequential delay:
        // pairIndex 0 hits 0 first, then pairIndex 1, then pairIndex 2...
        const pairOffset = leg.pairIndex * delayPerPair;
        // Left (-1) and Right (+1) alternate in half-cycle antiphase for organic stability
        const sideOffset = leg.side === 1 ? Math.PI : 0;

        const legPhase = ((sim.masterGaitPhase - pairOffset + sideOffset) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const cycleU = legPhase / (Math.PI * 2); // strictly in [0, 1)

        // Ideal neutral landing foot position for this vertebra:
        const footAngle = seg.angle + leg.side * fanAngle;
        const neutralX = seg.x + Math.cos(footAngle) * legReach;
        const neutralY = seg.y + Math.sin(footAngle) * legReach;

        // Forward stride lead: foot steps forward ahead of the moving body
        const strideLead = clamp(sim.linearSpeed * 0.20 * config.speed, 16, 42 * config.size);
        const landingTargetX = neutralX + Math.cos(sim.headAngle) * strideLead;
        const landingTargetY = neutralY + Math.sin(sim.headAngle) * strideLead;

        if (isMoving && cycleU < swingDuration) {
          // --- SWING PHASE: Clean, airborne high step ---
          const u = cycleU / swingDuration; // [0, 1]

          if (!leg.isStepping) {
            leg.isStepping = true;
            leg.stepStartFoot = { ...leg.currentFoot };
          }

          // Smooth Hermite cubic interpolation
          const easeU = u * u * (3 - 2 * u);
          leg.currentFoot.x = lerp(leg.stepStartFoot.x, landingTargetX, easeU);
          leg.currentFoot.y = lerp(leg.stepStartFoot.y, landingTargetY, easeU);

          // Graceful high parabolic lift
          leg.liftZ = Math.sin(u * Math.PI) * (20 * config.size);
        } else {
          // --- STANCE PHASE: Firm ground contact ---
          if (leg.isStepping) {
            leg.isStepping = false;
            leg.liftZ = 0;

            if (config.soundEnabled && isMoving) {
              playFootstep(0.08);
            }

            sim.footprints.push({
              x: leg.currentFoot.x,
              y: leg.currentFoot.y,
              alpha: 0.45,
            });
            if (sim.footprints.length > 25) sim.footprints.shift();

            if (config.glowEffect && sim.neonTrails.length < 20) {
              sim.neonTrails.push({
                x: leg.currentFoot.x,
                y: leg.currentFoot.y,
                radius: 3.0 * config.size,
                maxRadius: 10 * config.size,
                alpha: 0.9,
                decay: 0.9,
                isFootstep: true,
              });
            }
          }

          if (isMoving) {
            // While moving in stance: The foot is PLANTED firmly on the ground!
            // Safeguard against bone stretching if body moves very fast or turns sharply
            const curDist = Math.hypot(leg.currentFoot.x - leg.coxaBase.x, leg.currentFoot.y - leg.coxaBase.y);
            const maxBoneReach = (leg.l1 + leg.l2) * 0.86;
            if (curDist > maxBoneReach) {
              const vAng = Math.atan2(leg.currentFoot.y - leg.coxaBase.y, leg.currentFoot.x - leg.coxaBase.x);
              leg.currentFoot.x = leg.coxaBase.x + Math.cos(vAng) * maxBoneReach;
              leg.currentFoot.y = leg.coxaBase.y + Math.sin(vAng) * maxBoneReach;
            }
          } else {
            // When completely stopped: Gently ease feet to pristine resting pose
            leg.currentFoot.x = lerp(leg.currentFoot.x, leg.targetFoot.x, 0.15);
            leg.currentFoot.y = lerp(leg.currentFoot.y, leg.targetFoot.y, 0.15);
            leg.liftZ = 0;
            leg.isStepping = false;
          }
        }
      });

      // --- 6. NEON WALKING TRAILS GENERATION ---
      if (config.glowEffect && isMoving) {
        sim.trailTimer += dt;
        if (sim.trailTimer >= 0.09 && sim.neonTrails.length < 20) {
          sim.trailTimer = 0;
          const lastSeg = sim.spineSegments[sim.spineSegments.length - 1];
          if (lastSeg) {
            sim.neonTrails.push({
              x: lastSeg.x + (Math.random() - 0.5) * 6 * config.size,
              y: lastSeg.y + (Math.random() - 0.5) * 6 * config.size,
              radius: 3.0 * config.size,
              maxRadius: 14 * config.size,
              alpha: 0.8,
              decay: 0.95,
            });
          }
        }
      }

      // --- 7. PINCER ANGLE & SNAPPING ---
      const breath = Math.sin(currentTime * 0.003) * 0.05;
      const basePincerAngle = 0.28 + breath;

      if (sim.pincerSnapProgress > 0) {
        sim.pincerSnapProgress += sim.pincerSnapVel * dt * 60;
        if (sim.pincerSnapProgress <= 0) {
          sim.pincerSnapProgress = 0;
          sim.pincerSnapVel = 0;
        } else {
          sim.pincerSnapVel -= 0.22 * dt * 60;
        }
      }
      sim.pincerAngle = lerp(basePincerAngle, 0.015, sim.pincerSnapProgress);

      // --- 8. TAIL UPDATE & STINGER COLLISION ON PREY ---
      const tailCount = config.tailSegments;
      const lastSpineSeg = sim.spineSegments[sim.spineSegments.length - 1] || {
        x: sim.headPos.x,
        y: sim.headPos.y,
        angle: sim.headAngle,
        height: 15 * config.size,
      };

      const tailRoot: Point = {
        x: lastSpineSeg.x - Math.cos(lastSpineSeg.angle) * (lastSpineSeg.height * 0.5),
        y: lastSpineSeg.y - Math.sin(lastSpineSeg.angle) * (lastSpineSeg.height * 0.5),
      };

      const tailSegLen = 14 * config.size;

      if (sim.isStriking) {
        sim.strikeTimer += dt * 3.5 * config.stingerStrikeSpeed;
        if (sim.strikeTimer >= 1.0) {
          sim.isStriking = false;
          sim.strikeTimer = 0;
        }

        const strikeFrac = sim.strikeTimer < 0.5
          ? (sim.strikeTimer / 0.5)
          : (1.0 - (sim.strikeTimer - 0.5) / 0.5);

        const strikeAngle = Math.atan2(
          sim.strikeTarget.y - tailRoot.y,
          sim.strikeTarget.x - tailRoot.x
        );
        const distToTarget = dist(tailRoot, sim.strikeTarget);
        const strikeReach = distToTarget * strikeFrac;

        for (let i = 0; i < tailCount; i++) {
          const seg = sim.tailSegments[i];
          if (!seg) continue;
          const u = (i + 1) / tailCount;
          const currentD = u * strikeReach;

          const arcOffset = Math.sin(u * Math.PI) * (22 * config.size) * (1 - strikeFrac);
          const perpAngle = strikeAngle + Math.PI * 0.5;

          seg.x = tailRoot.x + Math.cos(strikeAngle) * currentD + Math.cos(perpAngle) * arcOffset;
          seg.y = tailRoot.y + Math.sin(strikeAngle) * currentD + Math.sin(perpAngle) * arcOffset;
          seg.angle = strikeAngle;
        }

        // Prey hit detection - requires physical contact with the stinger tip or impact zone at apex
        const tipNode = sim.tailSegments[sim.tailSegments.length - 1];
        if (tipNode) {
          alivePreys.forEach((prey) => {
            const dTip = Math.hypot(tipNode.x - prey.x, tipNode.y - prey.y);
            const physicalHitRadius = 30 * config.size + 18;
            const isAtApex = sim.strikeTimer >= 0.30 && sim.strikeTimer <= 0.70;
            const dTarget = Math.hypot(sim.strikeTarget.x - prey.x, sim.strikeTarget.y - prey.y);

            // Kill if the stinger tip physically intersects the prey, or strike apex impacts target
            if (dTip < physicalHitRadius || (isAtApex && dTarget < physicalHitRadius)) {
              prey.alive = false;

              if (config.soundEnabled) {
                playPreyStruck(0.7);
              }
              if (config.hapticEnabled) {
                triggerHaptic(50);
              }

              sim.screenShake = 9;

              sim.strikeWaves.push({
                x: prey.x,
                y: prey.y,
                radius: 4,
                maxRadius: 48 * config.size,
                alpha: 1.0,
              });

              for (let k = 0; k < 22; k++) {
                const a = (Math.PI * 2 * k) / 22 + (Math.random() - 0.5) * 0.4;
                const spd = 3.5 + Math.random() * 6.0;
                sim.particles.push({
                  x: prey.x,
                  y: prey.y,
                  vx: Math.cos(a) * spd,
                  vy: Math.sin(a) * spd,
                  radius: 1.6 + Math.random() * 2.0,
                  alpha: 1.0,
                  color: k % 2 === 0 ? '#F59E0B' : '#EF4444',
                });
              }

              if (onPreyCountChange) {
                onPreyCountChange(sim.preyList.filter(p => p.alive).length);
              }
            }
          });
        }
      } else {
        if (tailCount > 0) {
          const seg0 = sim.tailSegments[0];
          const dx0 = tailRoot.x - seg0.x;
          const dy0 = tailRoot.y - seg0.y;
          seg0.angle = Math.atan2(dy0, dx0);
          seg0.x = tailRoot.x - Math.cos(seg0.angle) * tailSegLen;
          seg0.y = tailRoot.y - Math.sin(seg0.angle) * tailSegLen;

          for (let i = 1; i < tailCount; i++) {
            const prev = sim.tailSegments[i - 1];
            const curr = sim.tailSegments[i];
            const dxI = prev.x - curr.x;
            const dyI = prev.y - curr.y;
            curr.angle = Math.atan2(dyI, dxI);
            curr.x = prev.x - Math.cos(curr.angle) * tailSegLen;
            curr.y = prev.y - Math.sin(curr.angle) * tailSegLen;
          }
        }
      }

      // --- 9. RENDER SCENE ---
      ctx.save();
      ctx.scale(dpr, dpr);

      if (sim.screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * sim.screenShake;
        const shakeY = (Math.random() - 0.5) * sim.screenShake;
        ctx.translate(shakeX, shakeY);
      }

      const isLight = config.invertTheme;
      ctx.fillStyle = isLight ? '#F4F4F5' : '#000000';
      ctx.fillRect(0, 0, width, height);

      const boneWhite = isLight ? '#18181B' : '#FFFFFF';
      const boneMuted = isLight ? 'rgba(24, 24, 27, 0.45)' : 'rgba(255, 255, 255, 0.45)';
      const redNeon = '#EF4444';
      const strokeWidth = config.lineWidth;

      const timeSec = currentTime * 0.001;
      const waveSpeed = 2.4;
      const globalWave = (timeSec * waveSpeed) % (Math.PI * 2);

      // Render decaying crimson neon trails
      if (sim.neonTrails.length > 0) {
        sim.neonTrails.forEach((node) => {
          node.alpha -= dt * node.decay;
          node.radius += dt * 4 * config.size;

          if (node.alpha > 0) {
            const r = Math.min(node.radius, node.maxRadius);
            ctx.beginPath();
            ctx.arc(node.x, node.y, r * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(239, 68, 68, ${node.alpha * 0.15})`;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(239, 68, 68, ${node.alpha * 0.75})`;
            ctx.lineWidth = 1.0;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(node.x, node.y, r * 0.35, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(239, 68, 68, ${node.alpha * 0.5})`;
            ctx.fill();
          }
        });
        sim.neonTrails = sim.neonTrails.filter((n) => n.alpha > 0);
      }

      // Footprints
      sim.footprints.forEach((fp) => {
        fp.alpha -= dt * 0.3;
        if (fp.alpha > 0) {
          ctx.beginPath();
          ctx.arc(fp.x, fp.y, 2.2 * config.size, 0, Math.PI * 2);
          ctx.fillStyle = isLight
            ? `rgba(24, 24, 27, ${fp.alpha * 0.22})`
            : `rgba(255, 255, 255, ${fp.alpha * 0.22})`;
          ctx.fill();
        }
      });
      sim.footprints = sim.footprints.filter((f) => f.alpha > 0);

      // Shockwaves
      sim.strikeWaves.forEach((w) => {
        w.radius += dt * 115;
        w.alpha -= dt * 1.9;
        if (w.alpha > 0) {
          ctx.beginPath();
          ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(239, 68, 68, ${w.alpha})`;
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }
      });
      sim.strikeWaves = sim.strikeWaves.filter((w) => w.alpha > 0);

      // Particles
      sim.particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.93;
        p.vy *= 0.93;
        p.alpha -= dt * 1.4;
        if (p.alpha > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
      });
      sim.particles = sim.particles.filter((p) => p.alpha > 0);

      // Draw alive preys
      alivePreys.forEach((prey) => {
        ctx.save();
        ctx.translate(prey.x, prey.y);
        ctx.rotate(prey.angle);

        const pSize = 7.5 * config.size;
        const pulse = Math.sin(prey.pulsePhase) * 0.5 + 0.5;

        ctx.beginPath();
        ctx.arc(0, 0, pSize * 1.8 + pulse * 4 * config.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
        ctx.fill();

        ctx.strokeStyle = isLight ? '#78350F' : '#FBBF24';
        ctx.lineWidth = 1.3;
        ctx.lineCap = 'round';
        for (const side of [-1, 1] as const) {
          for (let legIdx = 0; legIdx < 3; legIdx++) {
            const legOff = (legIdx - 1) * 3.5 * config.size;
            const legWiggle = Math.sin(prey.legPhase + legIdx * 1.6) * 0.38;
            const legAngle = side * (0.85 + legIdx * 0.32) + legWiggle;
            const legLen = 8 * config.size;
            const lx = legOff + Math.cos(legAngle) * legLen;
            const ly = side * 3 * config.size + Math.sin(legAngle) * legLen;
            ctx.beginPath();
            ctx.moveTo(legOff, side * 2.2 * config.size);
            ctx.lineTo(lx, ly);
            ctx.stroke();
          }
        }

        ctx.beginPath();
        ctx.moveTo(pSize * 0.85, -2 * config.size);
        ctx.lineTo(pSize * 1.65, -5 * config.size);
        ctx.moveTo(pSize * 0.85, 2 * config.size);
        ctx.lineTo(pSize * 1.65, 5 * config.size);
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(0, 0, pSize, pSize * 0.65, 0, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? '#FEF3C7' : '#1C1917';
        ctx.fill();
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(pSize * 0.1, 0, pSize * 0.55, pSize * 0.35, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#F59E0B';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pSize * 0.85, 0, 2.8 * config.size, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? '#92400E' : '#FBBF24';
        ctx.fill();

        ctx.restore();
      });

      // Spine energy pulse
      if (config.glowEffect) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(sim.headPos.x, sim.headPos.y);
        sim.spineSegments.forEach((seg) => {
          ctx.lineTo(seg.x, seg.y);
        });
        sim.tailSegments.forEach((seg) => {
          ctx.lineTo(seg.x, seg.y);
        });

        const pulseBrightness = 0.5 + 0.5 * Math.sin(globalWave);
        ctx.strokeStyle = isLight
          ? `rgba(225, 29, 72, ${0.25 + pulseBrightness * 0.25})`
          : `rgba(239, 68, 68, ${0.35 + pulseBrightness * 0.35})`;
        ctx.lineWidth = strokeWidth * 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.strokeStyle = isLight
          ? `rgba(225, 29, 72, 0.85)`
          : `rgba(239, 68, 68, 0.95)`;
        ctx.lineWidth = strokeWidth * 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // --- DRAW ARTICULATED LEGS WITH 100% STABLE GEOMETRIC KNEE IK ---
      sim.legs.forEach((leg) => {
        const seg = sim.spineSegments[leg.pairIndex] || sim.spineSegments[0];

        // Outward normal vector from this specific vertebra:
        // Points strictly to the left (-1) or strictly to the right (+1)
        const outNx = -Math.sin(seg.angle) * leg.side;
        const outNy = Math.cos(seg.angle) * leg.side;

        // Airborne foot contact shadow on ground (gives instant visual height to steps)
        if (leg.liftZ > 0.8) {
          const shadowAlpha = clamp(leg.liftZ / (20 * config.size), 0, 0.45);
          ctx.beginPath();
          ctx.ellipse(
            leg.currentFoot.x,
            leg.currentFoot.y,
            (2.8 + leg.liftZ * 0.08) * config.size,
            (1.8 + leg.liftZ * 0.05) * config.size,
            sim.headAngle,
            0,
            Math.PI * 2
          );
          ctx.fillStyle = isLight ? `rgba(0, 0, 0, ${shadowAlpha * 0.3})` : `rgba(0, 0, 0, ${shadowAlpha * 0.7})`;
          ctx.fill();
        }

        // Visual foot location with perspective lift
        let fvx = leg.currentFoot.x;
        let fvy = leg.currentFoot.y - leg.liftZ * 0.22;

        // Clamp distance so leg stays within bone reach
        const maxBoneReach = (leg.l1 + leg.l2) * 0.86;
        const curDist = Math.hypot(fvx - leg.coxaBase.x, fvy - leg.coxaBase.y);
        if (curDist > maxBoneReach) {
          const vAng = Math.atan2(fvy - leg.coxaBase.y, fvx - leg.coxaBase.x);
          fvx = leg.coxaBase.x + Math.cos(vAng) * maxBoneReach;
          fvy = leg.coxaBase.y + Math.sin(vAng) * maxBoneReach;
        }
        const footVisual = { x: fvx, y: fvy };

        // 2-BONE ANALYTICAL IK WITH GUARANTEED OUTWARD KNEE ARCH:
        const cdx = footVisual.x - leg.coxaBase.x;
        const cdy = footVisual.y - leg.coxaBase.y;
        const chordLen = clamp(Math.hypot(cdx, cdy), 8, maxBoneReach);

        // Law of Cosines for knee along-chord and perpendicular height
        const chordDist = (chordLen * chordLen + leg.l1 * leg.l1 - leg.l2 * leg.l2) / (2 * chordLen);
        const calcKneeHeight = Math.sqrt(Math.max(0, leg.l1 * leg.l1 - chordDist * chordDist));
        // Enforce guaranteed minimum knee arch so knees ALWAYS stay bent outwards
        const minKneeArch = 16 * config.size;
        const kneeHeight = Math.max(minKneeArch, calcKneeHeight);

        const udx = cdx / chordLen;
        const udy = cdy / chordLen;

        // Candidate perpendicular unit vectors:
        // Must point outward along outNx, outNy so knees never point under body!
        let perpX = -udy;
        let perpY = udx;
        if (perpX * outNx + perpY * outNy < 0) {
          perpX = -perpX;
          perpY = -perpY;
        }

        // Base 2D knee position:
        const kneeBaseX = leg.coxaBase.x + udx * chordDist + perpX * kneeHeight;
        const kneeBaseY = leg.coxaBase.y + udy * chordDist + perpY * kneeHeight;

        // Dynamic knee elevation during airborne swing:
        const kneeLift = leg.liftZ * 0.9;
        const kneeVisual = {
          x: kneeBaseX + outNx * (kneeLift * 0.4),
          y: kneeBaseY + outNy * (kneeLift * 0.4),
        };

        // BONE 1: FEMUR (Coxa to High Knee)
        ctx.beginPath();
        ctx.moveTo(leg.coxaBase.x, leg.coxaBase.y);
        ctx.lineTo(kneeVisual.x, kneeVisual.y);
        ctx.strokeStyle = boneWhite;
        ctx.lineWidth = strokeWidth * 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // BONE 2: TIBIA (Knee to Foot Claw)
        ctx.beginPath();
        ctx.moveTo(kneeVisual.x, kneeVisual.y);
        ctx.lineTo(footVisual.x, footVisual.y);
        ctx.lineWidth = strokeWidth * 1.25;
        ctx.stroke();

        // COXA SOCKET
        ctx.beginPath();
        ctx.arc(leg.coxaBase.x, leg.coxaBase.y, 2.4 * config.size, 0, Math.PI * 2);
        ctx.fillStyle = boneWhite;
        ctx.fill();

        // KNEE CONDYLE RING
        ctx.beginPath();
        ctx.arc(kneeVisual.x, kneeVisual.y, 2.7 * config.size, 0, Math.PI * 2);
        ctx.fillStyle = boneWhite;
        ctx.fill();

        if (config.glowEffect) {
          ctx.beginPath();
          ctx.arc(kneeVisual.x, kneeVisual.y, 3.8 * config.size, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
          ctx.fill();
        }

        // KNEE NEON PIVOT
        ctx.beginPath();
        ctx.arc(kneeVisual.x, kneeVisual.y, 1.4 * config.size, 0, Math.PI * 2);
        ctx.fillStyle = redNeon;
        ctx.fill();

        // FOOT CLAW
        ctx.beginPath();
        ctx.arc(footVisual.x, footVisual.y, 1.8 * config.size, 0, Math.PI * 2);
        ctx.fillStyle = redNeon;
        ctx.fill();

        const clawAngle = Math.atan2(footVisual.y - kneeVisual.y, footVisual.x - kneeVisual.x);
        const clawLen = 8 * config.size;
        const clawTipX = footVisual.x + Math.cos(clawAngle + leg.side * 0.35) * clawLen;
        const clawTipY = footVisual.y + Math.sin(clawAngle + leg.side * 0.35) * clawLen;

        ctx.beginPath();
        ctx.moveTo(footVisual.x, footVisual.y);
        ctx.quadraticCurveTo(
          footVisual.x + Math.cos(clawAngle) * (clawLen * 0.45),
          footVisual.y + Math.sin(clawAngle) * (clawLen * 0.45),
          clawTipX,
          clawTipY
        );
        ctx.strokeStyle = boneWhite;
        ctx.lineWidth = strokeWidth * 1.35;
        ctx.stroke();
      });

      // --- DRAW PEDIPALPS (PINCERS) ---
      const drawPincer = (side: 1 | -1) => {
        const cosH = Math.cos(sim.headAngle);
        const sinH = Math.sin(sim.headAngle);
        const armBaseOffset = 18 * config.size;
        const armBaseLateral = side * 11 * config.size;

        const p1: Point = {
          x: sim.headPos.x + cosH * armBaseOffset - sinH * armBaseLateral,
          y: sim.headPos.y + sinH * armBaseOffset + cosH * armBaseLateral,
        };

        const humerusAngle = sim.headAngle + side * 0.65;
        const humerusLen = 22 * config.size;
        const p2: Point = {
          x: p1.x + Math.cos(humerusAngle) * humerusLen,
          y: p1.y + Math.sin(humerusAngle) * humerusLen,
        };

        const forearmAngle = sim.headAngle + side * 0.22;
        const forearmLen = 24 * config.size;
        const p3: Point = {
          x: p2.x + Math.cos(forearmAngle) * forearmLen,
          y: p2.y + Math.sin(forearmAngle) * forearmLen,
        };

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.strokeStyle = boneWhite;
        ctx.lineWidth = strokeWidth * 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(p2.x, p2.y, 2.8 * config.size, 0, Math.PI * 2);
        ctx.fillStyle = boneWhite;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p2.x, p2.y, 1.4 * config.size, 0, Math.PI * 2);
        ctx.fillStyle = redNeon;
        ctx.fill();

        const palmAngle = forearmAngle - side * 0.12;
        const palmLen = 18 * config.size;
        const palmEnd: Point = {
          x: p3.x + Math.cos(palmAngle) * palmLen,
          y: p3.y + Math.sin(palmAngle) * palmLen,
        };

        ctx.beginPath();
        ctx.ellipse(
          (p3.x + palmEnd.x) * 0.5,
          (p3.y + palmEnd.y) * 0.5,
          palmLen * 0.55,
          5.5 * config.size,
          palmAngle,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = isLight ? '#E4E4E7' : '#09090B';
        ctx.fill();
        ctx.strokeStyle = boneWhite;
        ctx.lineWidth = strokeWidth * 1.3;
        ctx.stroke();

        const clawLen = 19 * config.size;
        const innerClawAngle = palmAngle - side * sim.pincerAngle;
        const outerClawAngle = palmAngle + side * sim.pincerAngle;

        const tipInner: Point = {
          x: palmEnd.x + Math.cos(innerClawAngle) * clawLen,
          y: palmEnd.y + Math.sin(innerClawAngle) * clawLen,
        };
        const cpInner: Point = {
          x: palmEnd.x + Math.cos(innerClawAngle - side * 0.35) * (clawLen * 0.6),
          y: palmEnd.y + Math.sin(innerClawAngle - side * 0.35) * (clawLen * 0.6),
        };

        ctx.beginPath();
        ctx.moveTo(palmEnd.x, palmEnd.y);
        ctx.quadraticCurveTo(cpInner.x, cpInner.y, tipInner.x, tipInner.y);
        ctx.strokeStyle = boneWhite;
        ctx.lineWidth = strokeWidth * 1.5;
        ctx.stroke();

        const tipOuter: Point = {
          x: palmEnd.x + Math.cos(outerClawAngle) * clawLen,
          y: palmEnd.y + Math.sin(outerClawAngle) * clawLen,
        };
        const cpOuter: Point = {
          x: palmEnd.x + Math.cos(outerClawAngle + side * 0.35) * (clawLen * 0.6),
          y: palmEnd.y + Math.sin(outerClawAngle + side * 0.35) * (clawLen * 0.6),
        };

        ctx.beginPath();
        ctx.moveTo(palmEnd.x, palmEnd.y);
        ctx.quadraticCurveTo(cpOuter.x, cpOuter.y, tipOuter.x, tipOuter.y);
        ctx.strokeStyle = boneWhite;
        ctx.lineWidth = strokeWidth * 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(tipInner.x, tipInner.y, 1.8 * config.size, 0, Math.PI * 2);
        ctx.arc(tipOuter.x, tipOuter.y, 1.8 * config.size, 0, Math.PI * 2);
        ctx.fillStyle = redNeon;
        ctx.fill();
      };

      drawPincer(-1);
      drawPincer(1);

      // --- DRAW ARTICULATED CURVED BODY & CEPHALOTHORAX ---
      sim.spineSegments.forEach((seg, p) => {
        const vertWave = Math.sin(globalWave - p * 0.45) * 0.5 + 0.5;

        ctx.save();
        ctx.translate(seg.x, seg.y);
        ctx.rotate(seg.angle);

        if (config.glowEffect) {
          ctx.beginPath();
          ctx.ellipse(0, 0, seg.height * 0.8, seg.width * 1.25, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(239, 68, 68, ${0.12 + vertWave * 0.25})`;
          ctx.lineWidth = strokeWidth * 1.2;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.ellipse(0, 0, seg.height * 0.65, seg.width * 1.05, 0, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? '#E4E4E7' : '#09090B';
        ctx.fill();
        ctx.strokeStyle = boneMuted;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, -seg.width * 0.9);
        ctx.lineTo(0, seg.width * 0.9);
        ctx.strokeStyle = boneWhite;
        ctx.lineWidth = strokeWidth * 1.1;
        ctx.stroke();

        if (config.glowEffect) {
          ctx.beginPath();
          ctx.arc(0, 0, (3.2 + vertWave * 1.5) * config.size, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(0, 0, (1.8 + (config.glowEffect ? vertWave * 0.5 : 0)) * config.size, 0, Math.PI * 2);
        ctx.fillStyle = redNeon;
        ctx.fill();

        ctx.restore();
      });

      // 2. Draw Cephalothorax
      const headWave = Math.sin(globalWave) * 0.5 + 0.5;

      ctx.save();
      ctx.translate(sim.headPos.x, sim.headPos.y);
      ctx.rotate(sim.headAngle);

      const headL = 24 * config.size;
      const headW = 15 * config.size;

      if (config.glowEffect) {
        ctx.beginPath();
        ctx.moveTo(headL * 1.05, 0);
        ctx.lineTo(headL * 0.63, -headW * 1.08);
        ctx.lineTo(-headL * 0.38, -headW * 0.98);
        ctx.lineTo(-headL * 0.48, 0);
        ctx.lineTo(-headL * 0.38, headW * 0.98);
        ctx.lineTo(headL * 0.63, headW * 1.08);
        ctx.closePath();
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.15 + headWave * 0.25})`;
        ctx.lineWidth = strokeWidth * 1.3;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.moveTo(headL, 0);
      ctx.lineTo(headL * 0.6, -headW);
      ctx.lineTo(-headL * 0.35, -headW * 0.9);
      ctx.lineTo(-headL * 0.45, 0);
      ctx.lineTo(-headL * 0.35, headW * 0.9);
      ctx.lineTo(headL * 0.6, headW);
      ctx.closePath();

      ctx.fillStyle = isLight ? '#E4E4E7' : '#09090B';
      ctx.fill();
      ctx.strokeStyle = boneWhite;
      ctx.lineWidth = strokeWidth * 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(headL, -3.5 * config.size);
      ctx.lineTo(headL + 5 * config.size, -1.8 * config.size);
      ctx.moveTo(headL, 3.5 * config.size);
      ctx.lineTo(headL + 5 * config.size, 1.8 * config.size);
      ctx.strokeStyle = redNeon;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();

      ctx.save();
      if (config.glowEffect) {
        ctx.shadowColor = 'rgba(239, 68, 68, 0.95)';
        ctx.shadowBlur = 10 * config.size;
      }
      ctx.beginPath();
      ctx.arc(headL * 0.35, -2.5 * config.size, 2.0 * config.size, 0, Math.PI * 2);
      ctx.arc(headL * 0.35, 2.5 * config.size, 2.0 * config.size, 0, Math.PI * 2);
      ctx.fillStyle = redNeon;
      ctx.fill();
      ctx.restore();

      for (let eye = -1; eye <= 1; eye++) {
        ctx.beginPath();
        ctx.arc(headL * 0.55 + eye * 2.5, -headW * 0.75, 1.3 * config.size, 0, Math.PI * 2);
        ctx.arc(headL * 0.55 + eye * 2.5, headW * 0.75, 1.3 * config.size, 0, Math.PI * 2);
        ctx.fillStyle = redNeon;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.moveTo(headL * 0.8, 0);
      ctx.lineTo(-headL * 0.35, 0);
      ctx.strokeStyle = boneWhite;
      ctx.lineWidth = strokeWidth * 1.3;
      ctx.stroke();

      ctx.restore();

      // --- DRAW TAIL ---
      let lastSegPoint = tailRoot;

      sim.tailSegments.forEach((seg, i) => {
        const tailWave = Math.sin(globalWave - (pairs + i) * 0.4) * 0.5 + 0.5;

        ctx.beginPath();
        ctx.moveTo(lastSegPoint.x, lastSegPoint.y);
        ctx.lineTo(seg.x, seg.y);
        ctx.strokeStyle = boneWhite;
        ctx.lineWidth = strokeWidth * lerp(2.2, 1.4, i / (tailCount - 1 || 1));
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(seg.x, seg.y, seg.radius, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? '#E4E4E7' : '#09090B';
        ctx.fill();
        ctx.strokeStyle = boneWhite;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();

        if (config.glowEffect) {
          ctx.beginPath();
          ctx.arc(seg.x, seg.y, 3.2 * config.size, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(seg.x, seg.y, (1.5 + (config.glowEffect ? tailWave * 0.4 : 0)) * config.size, 0, Math.PI * 2);
        ctx.fillStyle = redNeon;
        ctx.fill();

        lastSegPoint = seg;
      });

      // Telson
      if (sim.tailSegments.length > 0) {
        const tipSeg = sim.tailSegments[sim.tailSegments.length - 1];
        const prevSeg = sim.tailSegments[sim.tailSegments.length - 2] || tailRoot;
        const telsonAngle = Math.atan2(tipSeg.y - prevSeg.y, tipSeg.x - prevSeg.x);
        const telsonWave = Math.sin(globalWave - (pairs + tailCount) * 0.4) * 0.5 + 0.5;

        ctx.save();
        ctx.translate(tipSeg.x, tipSeg.y);
        ctx.rotate(telsonAngle);

        const bulbLen = 14 * config.size;
        const bulbWidth = 8.5 * config.size;

        ctx.beginPath();
        ctx.ellipse(bulbLen * 0.45, 0, bulbLen * 0.5, bulbWidth * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? '#E4E4E7' : '#09090B';
        ctx.fill();
        ctx.strokeStyle = boneWhite;
        ctx.lineWidth = strokeWidth * 1.5;
        ctx.stroke();

        ctx.save();
        if (config.glowEffect) {
          ctx.shadowColor = 'rgba(239, 68, 68, 1.0)';
          ctx.shadowBlur = 12 * config.size;
        }
        ctx.beginPath();
        ctx.arc(bulbLen * 0.4, 0, (3.2 + (config.glowEffect ? telsonWave * 0.8 : 0)) * config.size, 0, Math.PI * 2);
        ctx.fillStyle = redNeon;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(bulbLen * 0.85, 0);
        ctx.quadraticCurveTo(
          bulbLen * 1.35,
          -bulbWidth * 0.6,
          bulbLen * 1.6,
          -bulbWidth * 1.3
        );
        ctx.strokeStyle = redNeon;
        ctx.lineWidth = strokeWidth * 1.8;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(bulbLen * 1.6, -bulbWidth * 1.3, (2.4 + (config.glowEffect ? telsonWave * 1.2 : 0)) * config.size, 0, Math.PI * 2);
        ctx.fillStyle = redNeon;
        ctx.fill();
        ctx.restore();

        ctx.restore();
      }

      ctx.restore();
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [config, initSpine, initLegs, initTail, onStatsUpdate, onPreyCountChange, triggerAttack]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="absolute inset-0 block w-full h-full cursor-crosshair touch-none select-none"
    />
  );
});

ScorpionCanvas.displayName = 'ScorpionCanvas';
