// OpenCode plugin: reports OpenCode's state to the Herdr desktop app.
//
// The Herdr app (herdr-core) shows a terminal as an agent when its program
// reports a status with OSC 7501: ESC ] 7501 ; state=<state> : app=<name> ESC \
// This plugin writes that sequence to OpenCode's terminal whenever its state
// changes: working, blocked (waiting for you) or idle.
//
// It only acts inside a Herdr app terminal (HC_TERMINAL_ID is set), so it can
// sit beside Herdr TUI's own OpenCode integration without double reporting.
//
// Install: copy this file to ~/.config/opencode/plugins/
// License: MIT

import fs from "node:fs";

const APP = "opencode";

// OpenCode session status kinds mapped to Herdr states.
const STATUS_STATE = {
  busy: "working",
  retry: "working",
  idle: "idle",
};

// Events that change the state whatever the session's status says.
const EVENT_STATE = {
  "permission.asked": "blocked",
  "question.asked": "blocked",
  "permission.replied": "working",
  "question.replied": "working",
  "question.rejected": "working",
  "session.compacted": "working",
  "session.idle": "idle",
};

// Sub-agent sessions (session id -> parent id). Their status must not replace
// the main session's, but their permission and question prompts still block you.
const parents = new Map();
const CHILD_EVENTS = new Set(["permission.asked", "question.asked", "permission.replied", "question.replied", "question.rejected"]);

let tty;            // file descriptor of the controlling terminal, opened once
let lastState;      // last state written, to report changes only

// Whether this process owns a Herdr app terminal: OpenCode's TUI or `opencode run`,
// not a shared server (`serve`, `web`) whose sessions belong to other terminals.
function ownsTerminal() {
  if (!process.env.HC_TERMINAL_ID) return false;
  const command = process.argv.slice(2).find((arg) => !arg.startsWith("-"));
  return command !== "serve" && command !== "web";
}

function write(sequence) {
  try {
    if (tty === undefined) tty = fs.openSync(process.platform === "win32" ? "CONOUT$" : "/dev/tty", "w");
    fs.writeSync(tty, sequence);
  } catch {
    tty = null; // no terminal to write to: stay silent from now on
  }
}

function report(state) {
  if (!state || state === lastState || tty === null) return;
  lastState = state;
  write(`\x1b]7501;state=${state}:app=${APP}\x1b\\`);
}

function isChild(sessionID) {
  return typeof sessionID === "string" && parents.has(sessionID);
}

function stateFor(event) {
  const { type, properties = {} } = event ?? {};
  if (type === "session.status") {
    const kind = typeof properties.status === "string" ? properties.status : properties.status?.type;
    return STATUS_STATE[kind];
  }
  if (type === "session.error") {
    // An interrupt (Esc) is not a failure: the session just stops.
    return properties.error?.name === "MessageAbortedError" ? "idle" : "blocked";
  }
  return EVENT_STATE[type];
}

export const HerdrAppStatus = async () => {
  if (!ownsTerminal()) return {};
  report("idle"); // show up as an agent as soon as OpenCode starts

  return {
    "chat.message": async ({ sessionID }) => {
      if (!isChild(sessionID)) report("working");
    },
    event: async ({ event }) => {
      const properties = event?.properties ?? {};
      const info = properties.info;
      if (info?.id && info.parentID) parents.set(info.id, info.parentID);
      if (event?.type === "session.deleted" && info?.id) parents.delete(info.id);

      const sessionID = properties.sessionID ?? info?.id;
      if (isChild(sessionID) && !CHILD_EVENTS.has(event?.type)) return;
      report(stateFor(event));
    },
  };
};

export default { id: "herdr-app-status", server: HerdrAppStatus };
