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
    if (wanted && !this.barrier.active && trafficClear && distance(p, this.barrier) > 12)
      this.barrier.active = true;
    else if (!wanted) this.barrier.active = false;
    this.bus.active = this.active.has("bus");
    if (this.bus.active) {
      const event = this.schedule.find((e) => e.id === "bus");
      this.bus.x = -22 + clamp((run.time - event.start) / event.duration, 0, 1) * 44;
    } else this.bus.x = -22;
  }
}
