/**
 * Mathematical utilities, procedural gait coordination, and kinematics
 * for the enhanced procedural skeletal scorpion.
 */

export interface Point {
  x: number;
  y: number;
}

export type LegCountOption = 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20;

export interface ScorpionConfig {
  speed: number;              // 0.5 to 2.5 (movement speed multiplier)
  size: number;               // 0.6 to 1.6 (scale multiplier)
  lineWidth: number;          // 1 to 4 px
  stingerStrikeSpeed: number; // 0.8 to 2.5
  legCount: LegCountOption;   // 6, 8, 10, 12, 14, 16, 18, 20 legs
  tailSegments: number;       // 6 to 14 segments
  autoWander: boolean;        // Autonomous wandering when idle
  invertTheme: boolean;       // False: Dark (Black/White/Red Neon), True: Light (White/Charcoal/Ruby)
  soundEnabled: boolean;      // Web Audio FX
  hapticEnabled: boolean;     // Touch haptics
  glowEffect: boolean;        // Neon skeletal luminescence
}

export const DEFAULT_CONFIG: ScorpionConfig = {
  speed: 1.2,
  size: 1.0,
  lineWidth: 1.6,
  stingerStrikeSpeed: 1.5,
  legCount: 8,
  tailSegments: 9,
  autoWander: false,
  invertTheme: false,
  soundEnabled: true,
  hapticEnabled: true,
  glowEffect: true,
};

/**
 * Normalizes an angle into the range [-PI, PI].
 */
export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Interpolates smoothly between two angles along the shortest circular arc.
 */
export function lerpAngle(current: number, target: number, t: number): number {
  const diff = normalizeAngle(target - current);
  return current + diff * t;
}

/**
 * Linear interpolation between two numbers.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp a number between min and max.
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Distance between two points.
 */
export function dist(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.hypot(dx, dy);
}

/**
 * 2-Joint Analytical Inverse Kinematics.
 * Solves the knee/elbow position given origin, target, and bone lengths.
 */
export function solve2JointIK(
  p1: Point,
  p2: Point,
  l1: number,
  l2: number,
  bendDir: 1 | -1 = 1
): Point {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  let d = Math.hypot(dx, dy);

  // Avoid singularity and clamp max stretch
  const maxReach = l1 + l2 - 0.001;
  const minReach = Math.abs(l1 - l2) + 0.001;
  d = clamp(d, minReach, maxReach);

  const baseAngle = Math.atan2(dy, dx);

  // Law of Cosines: a^2 + b^2 - 2ab*cos(C) = c^2
  const cosAlpha = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const alpha = Math.acos(clamp(cosAlpha, -1, 1));

  const jointAngle = baseAngle + alpha * bendDir;

  return {
    x: p1.x + Math.cos(jointAngle) * l1,
    y: p1.y + Math.sin(jointAngle) * l1,
  };
}

/**
 * Articulated body vertebra segment for flexible spine curving.
 */
export interface SpineSegment {
  x: number;
  y: number;
  angle: number;
  width: number;
  height: number;
}

/**
 * Tail segment with spring-damper velocity.
 */
export interface SpringTailSegment {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
}

/**
 * Articulated leg state with metachronal wave coordination.
 */
export interface LegState {
  index: number;
  pairIndex: number;      // 0 to pairs-1 (along body vertebrae)
  side: -1 | 1;           // -1: Left, 1: Right
  wavePhase: number;      // Individual phase in the metachronal walking wave [0, 1]
  coxaBase: Point;        // Root joint socket on body carapace
  currentFoot: Point;     // Actual planted foot position in world space
  targetFoot: Point;      // Resting foot position relative to body
  stepStartFoot: Point;   // Where the foot lifted off
  stepProgress: number;   // 0 (lifting) to 1 (planted)
  isStepping: boolean;
  liftZ: number;          // Height off ground during step
  l1: number;             // Femur length
  l2: number;             // Tibia length
}
