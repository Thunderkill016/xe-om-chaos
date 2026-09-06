export const CONFIG = Object.freeze({
  version: "saigon-v8",
  step: 1 / 60,
  runSeconds: 180,
  acceleration: 15,
  braking: 30,
  maxSpeed: 24,
  boostSpeed: 34,
  steering: 2.05,
  drag: 3.5,
  radius: 0.65,
  recoverySeconds: 1.2,
  immunitySeconds: 2.2,
  stopSpeed: 6,
  stopRadius: 5.5,
  boardingSeconds: 0.35,
  nearMissRadius: 2.6,
  nearMissSpeed: 9,
  nearMissCooldown: 8,
  // Two baseline vehicles per straight stream. Rush hour activates the third
  // pre-spaced slot instead of dumping extra vehicles into arbitrary gaps.
  trafficCount: 24,
  rushCount: 12,
  recordHz: 10,
  threadWindow: 0.6, // Two opposite-side safe passes inside one readable manoeuvre.
  threadBoost: 0.25,
});
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const angleDelta = (a, b) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));
export function random(seed) {
  let value = 2166136261;
  for (const character of String(seed))
    value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return () => {
    value += 0x6d2b79f5;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const dailySeed = (date = new Date()) => date.toISOString().slice(0, 10);
export function validSeed(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(+date) && dailySeed(date) === value;
}
