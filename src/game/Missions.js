import { CONFIG, distance } from "./config.js";
import { STOPS } from "../world/map.js";

export const PASSENGERS = [
  {
    id: "office",
    vi: "Khách công sở",
    en: "Office worker",
    line: "Anh chạy lẹ giúp em chút nha. Em sắp vô họp rồi, mà giờ này đường lại kẹt.",
    subtitle: "Please tell me we can beat the traffic. I'm late for a meeting.",
    fare: 16000,
    deadline: 40,
    colour: "#eab76e",
  },
  {
    id: "grandma",
    vi: "Cô Tư",
    en: "Cô Tư",
    line: "Cô không gấp đâu con. Con chạy êm êm giùm cô là được rồi.",
    subtitle: "Easy, kid. Nice and smooth for me, okay?",
    fare: 20000,
    deadline: 60,
    colour: "#b3c9b2",
  },
  {
    id: "student",
    vi: "Sinh viên",
    en: "Student",
    line: "Em đi khu này hoài. Anh thấy hẻm nào thông thì quẹo vô nha, nhiều khi lẹ hơn đường lớn.",
    subtitle:
      "I know this part of town. If a hẻm goes through, take it — it's often quicker than the main road.",
    fare: 12000,
    deadline: 48,
    colour: "#81b8c5",
  },
  {
    id: "chaos",
    vi: "Khách khoái cảm giác mạnh",
    en: "Thrill seeker",
    line: "Em không ngại chạy nhanh đâu. Anh lách gọn thì em khoái, miễn đừng quẹt xe người ta nha.",
    subtitle:
      "Speed doesn't scare me. Just keep the close passes clean and don't hit anybody.",
    fare: 15000,
    deadline: 46,
    colour: "#e99880",
  },
];
export class Missions {
  constructor(rng) {
    this.sequence = Array.from({ length: 24 }, (_, i) => ({
      passenger: i === 0 ? 0 : Math.floor(rng() * PASSENGERS.length),
      // First trip exposes the authored shortcut; later trips use the full district.
      destination: i === 0 ? 4 : (i + 1) % STOPS.length,
    }));
    this.index = 0;
    this.phase = "pickup";
    this.pickup = STOPS[0];
    this.destination = STOPS[this.sequence[0].destination];
    this.passenger = PASSENGERS[0];
    this.deadline = 0;
    this.dwell = 0;
    this.smoothSeconds = 0;
    this.rideCrashes = 0;
    this.rideNear = 0;
    this.rideAlleys = 0;
  }
  get target() {
    return this.phase === "pickup" ? this.pickup : this.destination;
  }
  update(run, dt) {
    const inside = distance(run.player, this.target) < CONFIG.stopRadius;
    if (this.phase === "dropoff") {
      this.deadline -= dt;
      if (
        run.player.speed > 2 &&
        run.player.speed < 15 &&
        Math.abs(run.player.lean) < 0.2
      )
        this.smoothSeconds += dt;
    }
    this.dwell =
      inside && Math.abs(run.player.speed) < CONFIG.stopSpeed
        ? this.dwell + dt
        : 0;
    if (this.dwell < CONFIG.boardingSeconds) return;
    this.dwell = 0;
    if (this.phase === "pickup") {
      this.phase = "dropoff";
      this.deadline = this.passenger.deadline;
      this.smoothSeconds = 0;
      this.rideCrashes = 0;
      this.rideNear = 0;
      this.rideAlleys = 0;
      run.emit("pickup", this.passenger.line, 0);
    } else {
      const preference =
        this.passenger.id === "grandma"
          ? this.smoothSeconds * 160
          : this.passenger.id === "student"
            ? this.rideAlleys * 2000
            : this.passenger.id === "chaos"
              ? this.rideNear * 1200
              : Math.max(0, this.deadline) * 100;
      const fare = Math.round(
        Math.max(
          3000,
          this.passenger.fare +
            Math.max(0, this.deadline) * 120 +
            preference -
            this.rideCrashes * 2000,
        ),
      );
      run.stats.money += fare;
      run.stats.deliveries++;
      if (this.deadline >= 0 && this.deadline < 3)
        run.moment("deadline", this.deadline);
      run.emit(
        "delivery",
        this.deadline >= 0
          ? "Khách đã xuống xe ở điểm trả."
          : "Cuốc bị trễ, nhưng khách đã xuống xe ở điểm trả.",
        fare,
      );
      const previous = this.destination;
      this.index = (this.index + 1) % this.sequence.length;
      const next = this.sequence[this.index];
      this.passenger = PASSENGERS[next.passenger];
      this.pickup = STOPS[(next.destination + 4) % STOPS.length];
      if (this.pickup === previous)
        this.pickup = STOPS[(next.destination + 3) % STOPS.length];
      this.destination = STOPS[next.destination];
      this.phase = "pickup";
    }
  }
}
