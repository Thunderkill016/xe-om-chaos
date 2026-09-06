import { CONFIG, clamp, random, distance } from "./config.js";
import {
  surface,
  makeTraffic,
  trafficPose,
  hiddenLaneAt,
  vehicleClearance,
} from "../world/map.js";
import { Missions } from "./Missions.js";
import { ChaosDirector } from "./ChaosDirector.js";

/** @typedef {{throttle:boolean,brake:boolean,left:boolean,right:boolean,boost:boolean,horn:boolean}} DriveInput */
/** @type {Readonly<DriveInput>} */
export const EMPTY_INPUT = Object.freeze({
  throttle: false,
  brake: false,
  left: false,
  right: false,
  boost: false,
  horn: false,
});
export class Run {
  constructor(seed, mode = "daily") {
    this.seed = seed;
    this.mode = mode;
    this.tick = 0;
    this.time = 0;
    this.ended = false;
    this.player = {
      x: 3,
      z: -43,
      angle: 0,
      speed: 0,
      vx: 0,
      vz: 0,
      lean: 0,
      boost: 1,
      boosting: false,
      recovery: 0,
      immune: 0,
      bounce: 0,
      hornCooldown: 0,
    };
    this.stats = {
      score: 0,
      style: 0,
      money: 0,
      deliveries: 0,
      nearMisses: 0,
      crashes: 0,
      distance: 0,
      bestCombo: 1,
      horns: 0,
      alleys: 0,
      maxSpeed: 0,
      rainDistance: 0,
      threads: 0,
    };
    this.flow = { combo: 1, actions: 0, energy: 0, idle: 0 };
    this.missions = new Missions(random(seed + ":missions"));
    this.director = new ChaosDirector(seed);
    this.traffic = makeTraffic(
      random(seed + ":traffic"),
      CONFIG.trafficCount,
      CONFIG.rushCount,
    );
    this.events = [];
    this.moments = [];
    /** @type {{version:string,seed:string,mode:string,inputs:number[],poses:number[][],events:{type:string,text:string,value:number,time:number}[]}} */
    this.record = {
      version: CONFIG.version,
      seed,
      mode,
      inputs: [],
      poses: [],
      events: [],
    };
    this.weather = "sun";
    this.eventName = "";
    this.rush = false;
    this.alleyDistance = 0;
    this.alleyEntry = { x: 0, z: 0 };
    this.wasAlley = false;
    this.alleyRewarded = false;
    this.speedFlow = 0;
    this.lastSafePass = { time: -100, side: 0, vehicle: -1 };
    this.discoveredLanes = new Set();
    this.reactionCooldown = 0;
    this.traffic.forEach((v) => {
      trafficPose(v, 0);
      // Preserve stream spacing. Vehicles that would start on top of the rider or pickup
      // remain temporarily inactive instead of being individually re-phased into another car.
      v.spawnBlocked =
        distance(v, this.player) < 18 || distance(v, this.missions.pickup) < 9;
      v.active = v.id < CONFIG.trafficCount && !v.spawnBlocked;
    });
    this.player.immune = 3;
  }
  emit(type, text, value = 0) {
    const event = { type, text, value, time: this.time };
    this.events.push(event);
    // A three-minute run produces bounded data; keep unusual event storms bounded too.
    if (this.events.length > 20) this.events.shift();
    if (this.record.events.length < 1200) this.record.events.push(event);
  }
  moment(type, value) {
    this.moments.push({
      type,
      value,
      time: this.time,
      x: this.player.x,
      z: this.player.z,
    });
    if (this.moments.length > 64) this.moments.shift();
  }
  award(text, points, eventType = "flow") {
    this.flow.actions++;
    this.flow.combo = Math.min(8, 1 + Math.floor(this.flow.actions / 2));
    this.flow.energy = 1;
    const award = points * this.flow.combo;
    this.stats.style += award;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.flow.combo);
    this.emit(eventType, text, award);
  }
  crash() {
    const p = this.player;
    if (p.immune > 0 || p.recovery > 0) return;
    p.recovery = CONFIG.recoverySeconds;
    p.immune = CONFIG.immunitySeconds;
    p.speed = 0;
    p.vx = 0;
    p.vz = 0;
    this.stats.crashes++;
    this.missions.rideCrashes++;
    this.flow.combo = 1;
    this.flow.actions = 0;
    this.flow.energy = 0;
    this.lastSafePass.time = -100;
    this.emit("crash", "ỦA?!");
    this.moment("crash", this.stats.crashes);
  }
  step(input = EMPTY_INPUT) {
    if (this.ended) return;
    const dt = CONFIG.step;
    this.tick++;
    this.time = this.tick * dt;
    const p = this.player;
    this.director.update(this);
    const mask =
      Number(input.throttle) |
      (Number(input.brake) << 1) |
      (Number(input.left) << 2) |
      (Number(input.right) << 3) |
      (Number(input.boost) << 4) |
      (Number(input.horn) << 5);
    this.record.inputs.push(mask);
    p.recovery = Math.max(0, p.recovery - dt);
    p.immune = Math.max(0, p.immune - dt);
    p.bounce = Math.max(0, p.bounce - dt);
    p.hornCooldown = Math.max(0, p.hornCooldown - dt);
    this.reactionCooldown = Math.max(0, this.reactionCooldown - dt);
    if (input.horn && p.hornCooldown === 0) {
      p.hornCooldown = 0.65;
      this.stats.horns++;
      this.emit("horn", "BÍP BÍP!");
      let replies = 0;
      for (const vehicle of this.traffic)
        if (vehicle.active && distance(p, vehicle) < 17) {
          vehicle.honkedAt = this.time;
          vehicle.honkedUntil = this.time + 1.4;
          replies++;
        }
      if (replies > 0) this.emit("reply", "BÍP!", replies);
    }
    const steer = Number(input.left) - Number(input.right);
    p.boosting =
      input.boost &&
      input.throttle &&
      !input.brake &&
      p.boost > 0.02 &&
      p.recovery === 0;
    p.boost = clamp(p.boost + (p.boosting ? -0.3 : 0.1) * dt, 0, 1);
    if (p.recovery === 0) {
      const acceleration = input.brake
        ? -CONFIG.braking
        : input.throttle
          ? CONFIG.acceleration
          : -CONFIG.drag;
      p.speed = clamp(
        p.speed + acceleration * dt,
        0,
        p.boosting ? CONFIG.boostSpeed : CONFIG.maxSpeed,
      );
      if (p.boosting)
        p.speed = Math.min(
          CONFIG.boostSpeed,
          p.speed + CONFIG.acceleration * dt,
        );
      const turning =
        (CONFIG.steering * (0.45 + 0.55 * Math.min(p.speed / 8, 1))) /
        (1 + p.speed / 42);
      // Facing follows thumb intent; grip interpolation supplies a small recoverable rear slide.
      p.angle += steer * turning * dt;
      p.lean +=
        (-steer * Math.min(p.speed / 40, 0.45) - p.lean) * Math.min(dt * 10, 1);
      const grip = this.weather === "rain" ? 4.2 : 9;
      p.vx += (Math.sin(p.angle) * p.speed - p.vx) * dt * grip;
      p.vz += (Math.cos(p.angle) * p.speed - p.vz) * dt * grip;
      const nx = p.x + p.vx * dt,
        nz = p.z + p.vz * dt;
      if (surface(nx, nz, CONFIG.radius) !== "wall") {
        this.stats.distance += Math.hypot(nx - p.x, nz - p.z);
        p.x = nx;
        p.z = nz;
      } else {
        // Slide along a wall and retain steering so no recovery can trap the player.
        if (surface(nx, p.z, CONFIG.radius) !== "wall") p.x = nx;
        if (surface(p.x, nz, CONFIG.radius) !== "wall") p.z = nz;
        if (p.speed > 7) this.crash();
        else {
          p.speed *= 0.92;
          p.vx *= 0.7;
          p.vz *= 0.7;
        }
      }
    }
    this.stats.maxSpeed = Math.max(this.stats.maxSpeed, p.speed);
    for (const v of this.traffic) {
      trafficPose(v, this.time);
      const enabled = v.id < CONFIG.trafficCount || this.rush;
      if (
        v.spawnBlocked &&
        distance(v, p) > 18 &&
        distance(v, this.missions.pickup) > 9
      )
        v.spawnBlocked = false;
      v.active = enabled && !v.spawnBlocked;
      if (!v.active) continue;

      // A stopped xe ôm should not be visibly driven through by scripted traffic.
      // Straight-stream NPCs make a small deterministic sidestep when the rider is
      // ahead and nearly stationary. Moving riders still have to avoid traffic.
      if (v.axis && p.speed < 4 && p.recovery === 0) {
        const dx = p.x - v.x,
          dz = p.z - v.z,
          forwardX = Math.sin(v.angle),
          forwardZ = Math.cos(v.angle),
          sideX = Math.cos(v.angle),
          sideZ = -Math.sin(v.angle),
          ahead = dx * forwardX + dz * forwardZ,
          lateral = dx * sideX + dz * sideZ;
        if (ahead > -1 && ahead < 8 && Math.abs(lateral) < 2.2) {
          const strength =
            (1 - Math.max(0, ahead) / 8) * (v.kind === "car" ? 0.85 : 1.05);
          const side =
            Math.abs(lateral) > 0.15 ? -Math.sign(lateral) : v.id % 2 ? 1 : -1;
          v.x += sideX * strength * side;
          v.z += sideZ * strength * side;
        }
      }

      const clearance = vehicleClearance(v, p);
      if (clearance < CONFIG.radius && p.immune === 0) {
        this.crash();
        v.near = false;
        v.closest = Infinity;
        v.lastNear = this.time;
      } else if (
        clearance < CONFIG.nearMissRadius &&
        p.speed > CONFIG.nearMissSpeed &&
        p.immune === 0 &&
        this.time - v.lastNear > CONFIG.nearMissCooldown
      ) {
        v.near = true;
        if (clearance < v.closest)
          v.nearSide = Math.sign(
            (v.x - p.x) * Math.cos(p.angle) - (v.z - p.z) * Math.sin(p.angle),
          );
        v.closest = Math.min(v.closest, clearance);
      } else if (v.near && clearance > CONFIG.nearMissRadius) {
        // The cooldown already prevents jitter-farming. End the manoeuvre as soon
        // as the rider has genuinely cleared the same geometric near-miss zone.
        if (p.immune === 0) {
          this.stats.nearMisses++;
          this.missions.rideNear++;
          this.award("LÁCH ĐẸP! / NEAR MISS", 100);
          this.moment("near-miss", this.flow.combo);
          const previous = this.lastSafePass;
          if (
            this.time - previous.time < CONFIG.threadWindow &&
            previous.vehicle !== v.id &&
            previous.side * v.nearSide < 0
          ) {
            this.stats.threads++;
            this.award("LÁCH KÉP! +BOOST", 350, "thread");
            p.boost = Math.min(1, p.boost + CONFIG.threadBoost);
            this.moment("thread", this.flow.combo);
            previous.time = -100;
          } else {
            previous.time = this.time;
            previous.side = v.nearSide;
            previous.vehicle = v.id;
          }
        }
        v.near = false;
        v.closest = Infinity;
        v.lastNear = this.time;
      }
    }
    const alley = surface(p.x, p.z) === "alley";
    const lane = hiddenLaneAt(p.x, p.z);
    if (lane && alley && !this.discoveredLanes.has(lane.id)) {
      this.discoveredLanes.add(lane.id);
      this.emit("discovery", lane.name + " · LỐI TẮT!");
      this.moment("discovery", this.discoveredLanes.size);
    }
    if (this.missions.phase === "dropoff" && this.reactionCooldown === 0) {
      const passenger = this.missions.passenger;
      const reacts =
        (passenger.id === "grandma" && p.speed > 16) ||
        (passenger.id === "office" && this.missions.deadline < 10) ||
        (passenger.id === "student" && Boolean(lane));
      if (reacts) {
        this.emit("passenger", passenger.line);
        this.reactionCooldown = 8;
      }
    }
    if (alley && !this.wasAlley) {
      this.alleyEntry.x = p.x;
      this.alleyEntry.z = p.z;
      this.alleyRewarded = false;
    }
    const alleyDropoff =
      this.missions.phase === "dropoff" &&
      distance(p, this.missions.target) < CONFIG.stopRadius &&
      p.speed < CONFIG.stopSpeed;
    if (
      (!alley || alleyDropoff) &&
      this.wasAlley &&
      !this.alleyRewarded &&
      distance(p, this.alleyEntry) > 15 &&
      p.immune === 0
    ) {
      this.alleyRewarded = true;
      this.stats.alleys++;
      this.missions.rideAlleys++;
      this.award("HẺM MASTER", 200);
      this.moment("alley", this.flow.combo);
    }
    this.wasAlley = alley;
    if (p.speed > 18 && p.immune === 0) {
      this.speedFlow += dt;
      if (this.speedFlow > 7) {
        this.speedFlow = 0;
        this.award("MƯỢT! / CLEAN RUN", 50);
      }
    } else this.speedFlow = 0;
    const stoppingAtTarget =
      distance(p, this.missions.target) < CONFIG.stopRadius + 2;
    this.flow.idle = p.speed < 2 && !stoppingAtTarget ? this.flow.idle + dt : 0;
    if (this.flow.idle > 4) {
      this.flow.actions = 0;
      this.flow.combo = 1;
    }
    this.flow.energy = Math.max(0, this.flow.energy - dt / 9);
    this.missions.update(this, dt);
    this.stats.score =
      this.stats.style +
      Math.floor(this.stats.money / 100) +
      this.stats.deliveries * 500;
    if (this.tick % (60 / CONFIG.recordHz) === 0)
      this.record.poses.push([this.tick, p.x, p.z, p.angle, p.lean]);
    if (this.tick >= CONFIG.runSeconds / dt) {
      this.ended = true;
      this.emit("end", "HẾT CA!");
    }
  }
  result() {
    return {
      version: CONFIG.version,
      seed: this.seed,
      mode: this.mode,
      ...this.stats,
      title:
        this.stats.alleys >= 3
          ? "HẺM LEGEND"
          : this.stats.nearMisses >= 12
            ? "TRAFFIC MAGICIAN"
            : this.stats.horns >= 20
              ? "HORN ENTHUSIAST"
              : this.stats.crashes >= 5
                ? "ỦA?! SURVIVOR"
                : "SAIGON RIDER",
      moments: this.moments,
    };
  }
}
