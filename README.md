# OpenCode status for the Herdr app

An [OpenCode](https://opencode.ai) plugin that makes OpenCode a full agent in the [Herdr](https://herdr.dev) desktop app: working, waiting for you, or idle, like Claude Code.

Herdr's own `herdr integration install opencode` targets Herdr TUI only. The desktop app reads an agent's state from [OSC 7501](https://herdr.dev/core/), which OpenCode doesn't emit. This plugin does.

## Install

```sh
mkdir -p ~/.config/opencode/plugins
curl -fsSL -o ~/.config/opencode/plugins/herdr-app-status.js \
  https://raw.githubusercontent.com/Rominou34/opencode-herdr-app/HEAD/herdr-app-status.js
```

Or copy `herdr-app-status.js` there by hand. Restart OpenCode.

## States

| OpenCode | Herdr app |
| --- | --- |
| Started, session idle, interrupted (Esc) | `idle` |
| Prompt sent, session busy or retrying, compacting | `working` |
| Permission or question pending (sub-agents too), session error | `blocked` |

## Notes

- Active only in Herdr app terminals (`HC_TERMINAL_ID` set). Safe beside Herdr TUI's integration.
- Skipped for `opencode serve` and `opencode web`: a shared server doesn't own a terminal.
- Writes to the controlling terminal, only when the state changes. No network, no dependencies.
- Tested with OpenCode 1.18.35 and Herdr app on Linux (WSL). Windows untested.

## License

MIT
