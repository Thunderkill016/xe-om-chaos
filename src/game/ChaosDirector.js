import { random, distance, CONFIG } from "./config.js";

export const CHAOS = [
  {
    id: "rain",
    start: 18,
    duration: 38,
    vi: "MƯA RỒI! · ĐƯỜNG TRƠN",
    en: "DOWNPOUR · LESS GRIP",
  },
  {
    id: "rush",
    start: 39,
    duration: 50,
    vi: "GIỜ CAO ĐIỂM · GIỮ KHOẢNG CÁCH",
    en: "RUSH HOUR · FIND THE GAPS",
  },
  {
    id: "potholes",
    start: 60,
    duration: 34,
    vi: "Ổ GÀ PHÍA TRƯỚC · NHẢ GA",
    en: "POTHOLES · EASE OFF",
  },
  {
    id: "block",
    start: 87,
    duration: 43,
    vi: "ĐƯỜNG BỊ CHẮN · THỬ LỐI HẺM",
    en: "ROAD BLOCKED · TRY THE HẺM",
  },
  {
    id: "bus",
    start: 112,
    duration: 24,
    vi: "XE BUÝT QUA NGÃ TƯ!",
    en: "BUS CROSSING THE JUNCTION!",
  },
  {
    id: "flood",
    start: 139,
    duration: 40,
    vi: "NGẬP BẾN GIÓ · ĐI CHẬM LẠI",
    en: "CANAL ROAD FLOODED · SLOW DOWN",
  },
];
export class ChaosDirector {
  constructor(seed) {
    const rng = random(seed + ":chaos");
    this.schedule = CHAOS.map((event) => ({
      ...event,
      start: event.start + Math.floor(rng() * 4),
    }));
    this.active = new Set();
    this.announced = new Set();
    this.potholes = [
      { x: 2, z: 20 },
      { x: -36, z: 17 },
      { x: 72, z: 47 },
    ];
    this.lastPothole = -10;
    this.barrier = { x: 0, z: 36, w: 8.5, d: 2.5, active: false };
    this.bus = { x: -22, z: 0, w: 8, d: 2.8, active: false };
    this.pressure = 0;
  }
  update(run) {
    const p = run.player;
    this.active.clear();
    // The event deck is shared. Pressure controls feedback, never hidden catch-up traffic.
    this.pressure = Math.min(
      1,
      (p.speed / 34 +
        run.flow.combo / 8 +
        (run.missions.phase === "dropoff" && run.missions.deadline < 12
          ? 1
          : 0)) /
        3,
    );
    for (const event of this.schedule) {
      if (
        run.time >= event.start - 3 &&
        run.time < event.start + event.duration
      ) {
        if (!this.announced.has(event.id)) {
          this.announced.add(event.id);
          run.emit("chaos", event.vi);
        }
        if (run.time >= event.start) this.active.add(event.id);
      }
    }
    const event = [...this.schedule]
      .reverse()
      .find((e) => run.time >= e.start - 3 && run.time < e.start + e.duration);
    run.eventName = event ? event.vi : "";
    run.weather =
      this.active.has("rain") || this.active.has("flood") ? "rain" : "sun";
    run.rush = this.active.has("rush");
    if (this.active.has("flood") && p.x > 62 && p.z > 18) {
      p.speed = Math.min(p.speed, 10);
      run.stats.rainDistance += p.speed * CONFIG.step;
    }
    if (this.active.has("potholes") && run.time - this.lastPothole > 2) {
      for (const hole of this.potholes)
        if (distance(p, hole) < 1.55 && p.speed > 7) {
          p.bounce = 0.85;
          p.speed *= 0.65;
          this.lastPothole = run.time;
          run.emit("pothole", "ỐI! / BUMP!");
          run.moment("airtime", 0.85);
          break;
        }
    }
    const wanted = this.active.has("block");
    this.barrier.active =
      wanted && (this.barrier.active || distance(p, this.barrier) > 9);
    const busEvent = this.schedule.find((e) => e.id === "bus");
    if (!busEvent) throw new Error("Chaos schedule requires a bus event");
    this.bus.active = this.active.has("bus");
    this.bus.x = -22 + (run.time - busEvent.start) * 1.9;
    for (const obstacle of [this.barrier, this.bus])
      if (
        obstacle.active &&
        Math.abs(p.x - obstacle.x) < obstacle.w / 2 + CONFIG.radius &&
        Math.abs(p.z - obstacle.z) < obstacle.d / 2 + CONFIG.radius
      ) {
        if (p.speed > 4) run.crash();
        // Resolve penetration in the shallow axis. Immunity cannot turn barriers into ghosts.
        const dx = obstacle.w / 2 + CONFIG.radius - Math.abs(p.x - obstacle.x),
          dz = obstacle.d / 2 + CONFIG.radius - Math.abs(p.z - obstacle.z);
        if (dx < dz)
          p.x =
            obstacle.x +
            Math.sign(p.x - obstacle.x || 1) *
              (obstacle.w / 2 + CONFIG.radius + 0.05);
        else
          p.z =
            obstacle.z +
            Math.sign(p.z - obstacle.z || 1) *
              (obstacle.d / 2 + CONFIG.radius + 0.05);
        p.speed = Math.min(p.speed, 2);
        p.vx = 0;
        p.vz = 0;
      }
  }
}
