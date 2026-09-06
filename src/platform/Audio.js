export class Audio {
  constructor() {
    this.context = /** @type {AudioContext | null} */ (null);
    this.volume = 0.45;
    this.muted = false;
    this.engine = /** @type {OscillatorNode | null} */ (null);
    this.engineGain = /** @type {GainNode | null} */ (null);
    this.master = /** @type {GainNode | null} */ (null);
    this.rainGain = /** @type {GainNode | null} */ (null);
    this.skidGain = /** @type {GainNode | null} */ (null);
  }
  async start() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.context.destination);
      this.engine = this.context.createOscillator();
      this.engine.type = "sawtooth";
      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0.02;
      this.engine.connect(this.engineGain).connect(this.master);
      this.engine.start();
    }
    if (!this.master) throw new Error("Audio master was not initialized");
    if (!this.rainGain) {
      // One reusable noise buffer powers rain and tire texture, without audio downloads.
      const buffer = this.context.createBuffer(
          1,
          this.context.sampleRate * 2,
          this.context.sampleRate,
        ),
        data = buffer.getChannelData(0);
      let noise = 781;
      for (let i = 0; i < data.length; i++) {
        noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
        data[i] = noise / 2147483648 - 1;
      }
      for (const kind of ["rain", "skid"]) {
        const source = this.context.createBufferSource(),
          filter = this.context.createBiquadFilter(),
          gain = this.context.createGain();
        source.buffer = buffer;
        source.loop = true;
        filter.type = "lowpass";
        filter.frequency.value = kind === "rain" ? 950 : 1600;
        gain.gain.value = 0;
        source.connect(filter).connect(gain).connect(this.master);
        source.start();
        if (kind === "rain") this.rainGain = gain;
        else this.skidGain = gain;
      }
    }
    await this.context.resume();
  }
  level(volume, muted) {
    this.volume = volume;
    this.muted = muted;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        muted ? 0 : volume,
        this.context.currentTime,
        0.03,
      );
  }
  tone(freq, duration, gain = 0.12, type = "sine", delay = 0) {
    if (!this.context || !this.master) return;
    const time = this.context.currentTime + delay,
      osc = this.context.createOscillator(),
      envelope = this.context.createGain();
    osc.type = /** @type {OscillatorType} */ (type);
    osc.frequency.setValueAtTime(freq, time);
    envelope.gain.setValueAtTime(gain, time);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(envelope).connect(this.master);
    osc.start(time);
    osc.stop(time + duration);
    osc.onended = () => {
      osc.disconnect();
      envelope.disconnect();
    };
  }
  event(type) {
    if (type === "horn") {
      this.tone(440, 0.2, 0.13, "square");
      this.tone(554, 0.22, 0.09, "square", 0.06);
    } else if (type === "reply") this.tone(330, 0.2, 0.07, "square", 0.22);
    else if (type === "crash") this.tone(65, 0.35, 0.25, "triangle");
    else if (type === "pothole") {
      this.tone(130, 0.12, 0.2, "triangle");
      this.tone(260, 0.16, 0.08, "sine", 0.1);
    } else if (type === "delivery" || type === "pickup") {
      this.tone(660, 0.2);
      this.tone(880, 0.25, 0.12, "sine", 0.12);
    } else if (type === "thread") {
      this.tone(660, 0.12, 0.08);
      this.tone(990, 0.14, 0.09, "sine", 0.08);
      this.tone(1320, 0.2, 0.09, "sine", 0.16);
    } else if (type === "flow") this.tone(990, 0.15, 0.08);
  }
  update(run, playing) {
    const speed = run.player.speed;
    if (this.engine && this.context && this.engineGain) {
      this.engine.frequency.setTargetAtTime(
        42 + speed * 5,
        this.context.currentTime,
        0.1,
      );
      this.engineGain.gain.setTargetAtTime(
        playing ? 0.015 + speed * 0.0008 : 0,
        this.context.currentTime,
        0.15,
      );
      this.rainGain?.gain.setTargetAtTime(
        playing && run.weather === "rain" ? 0.09 : 0,
        this.context.currentTime,
        0.5,
      );
      this.skidGain?.gain.setTargetAtTime(
        playing && Math.abs(run.player.lean) > 0.23 && speed > 10 ? 0.035 : 0,
        this.context.currentTime,
        0.1,
      );
    }
  }
}
