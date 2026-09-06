import { EMPTY_INPUT } from "../game/Run.js";
export class Input {
  constructor() {
    /** @type {Record<keyof typeof EMPTY_INPUT, boolean>} */
    this.state = { ...EMPTY_INPUT };
    this.keys = new Set();
    this.pointers = new Map();
    this.hornQueued = false;
    this.bindings = {
      KeyW: "throttle",
      ArrowUp: "throttle",
      KeyS: "brake",
      ArrowDown: "brake",
      KeyA: "left",
      ArrowLeft: "left",
      KeyD: "right",
      ArrowRight: "right",
      ShiftLeft: "boost",
      ShiftRight: "boost",
      Space: "horn",
    };
    window.addEventListener("keydown", (event) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        document.querySelector("dialog[open]")
      )
        return;
      if (this.bindings[event.code]) {
        event.preventDefault();
        this.keys.add(event.code);
        if (this.bindings[event.code] === "horn") this.hornQueued = true;
        this.refresh();
      }
    });
    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
      this.refresh();
    });
    for (const button of document.querySelectorAll("[data-input]")) {
      if (!(button instanceof HTMLButtonElement)) continue;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        this.pointers.set(event.pointerId, button.dataset.input);
        if (button.dataset.input === "horn") this.hornQueued = true;
        button.classList.add("pressed");
        this.refresh();
      });
      const release = (event) => {
        this.pointers.delete(event.pointerId);
        if (event.type === "pointercancel") this.hornQueued = false;
        button.classList.remove("pressed");
        this.refresh();
      };
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("lostpointercapture", release);
    }
    window.addEventListener("blur", () => this.reset());
  }
  refresh() {
    Object.assign(this.state, EMPTY_INPUT);
    for (const key of this.keys) this.state[this.bindings[key]] = true;
    for (const action of this.pointers.values()) this.state[action] = true;
    this.state.horn ||= this.hornQueued;
  }
  consume() {
    // A short horn tap must survive keyup until a simulation tick observes it.
    this.hornQueued = false;
    this.refresh();
  }
  reset() {
    this.hornQueued = false;
    this.keys.clear();
    this.pointers.clear();
    Object.assign(this.state, EMPTY_INPUT);
    document
      .querySelectorAll(".pressed")
      .forEach((el) => el.classList.remove("pressed"));
  }
}
