import { random, distance, clamp, CONFIG } from "./config.js";

export const CHAOS = [
  {
    id: "rain",
    start: 18,
    duration: 38,
    vi: "Mưa tới rồi, đường bắt đầu trơn đó.",
    en: "Here comes the rain. The road's getting slick.",
  },
  {
    id: "rush",
    start: 39,
    duration: 50,
    vi: "Tan tầm rồi, xe đông lên thấy rõ.",
    en: "Rush hour just kicked in. Traffic's thickening up.",
  },
  {
    id: "potholes",
    start: 60,
    duration: 34,
    vi: "Đoạn này ổ gà hơi nhiều, nhả ga chút.",
    en: "Rough stretch ahead. Ease off the throttle.",
  },
  {
    id: "block",
    start: 87,
    duration: 43,
    vi: "Phía trước chặn đường rồi. Có hẻm bên cạnh đó.",
    en: "Road's blocked ahead. There's a hẻm off to the side.",
  },
  {
    id: "bus",
    start: 112,
    duration: 24,
    vi: "Xe buýt cắt ngang kìa, coi chừng!",
    en: "Bus coming across the junction. Watch it!",
  },
  {
    id: "flood",
    start: 139,
    duration: 40,
    vi: "Bến Gió ngập rồi, chạy chậm thôi.",
    en: "Bến Gió's flooded. Take it easy through there.",
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
          run.emit("pothole", "Ổ gà!");
          run.moment("airtime", 0.85);
          break;
        }
    }
    const wanted = this.active.has("block");
    const trafficClear = !run.traffic.some(
      (vehicle) =>
        vehicle.active &&
        vehicle.axis === "z" &&
        vehicle.road === this.barrier.x &&
        Math.abs(vehicle.z - this.barrier.z) < 12,
    );
    // Do not materialize a roadblock under the rider or through an NPC. Once a
    // clean gap arrives, central traffic has enough approach distance to bend
    // around the outside edges rather than ghosting through the barrier.
    this.barrier.active =
      wanted &&
      (this.barrier.active || (distance(p, this.barrier) > 9 && trafficClear));

    // The roadblock sits across both lanes of the central north/south avenue.
    // Preserve longitudinal cadence and move each direction toward its own curb;
    // this avoids introducing braking queues that would destroy junction timing.
    for (const vehicle of run.traffic) {
      if (vehicle.axis !== "z" || vehicle.road !== this.barrier.x) continue;
      const baseLane = vehicle.road + vehicle.direction * 2.75;
      let targetLane = baseLane;
      if (this.barrier.active) {
        const toBarrier = (this.barrier.z - vehicle.z) * vehicle.direction;
        if (toBarrier < 18 && toBarrier > -10) {
          const approach = clamp((18 - toBarrier) / 8, 0, 1),
            departure = clamp((toBarrier + 10) / 6, 0, 1),
            envelope = Math.min(approach, departure),
            clearance =
              this.barrier.w / 2 +
              (vehicle.halfWidth ?? 0.5) +
              0.45 -
              Math.abs(baseLane - this.barrier.x);
          targetLane += vehicle.direction * Math.max(0, clearance) * envelope;
        }
      }
      vehicle.lane +=
        (targetLane - vehicle.lane) * Math.min(1, CONFIG.step * 8);
    }

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
