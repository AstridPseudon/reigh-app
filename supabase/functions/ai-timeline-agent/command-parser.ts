import type { TimelineConfig, AssetRegistry } from "../../src/tools/video-editor/types/index.ts";

export type ParsedCommand =
  | { type: "view" }
  | { type: "move"; clipId: string; at: number }
  | { type: "trim"; clipId: string; from?: number; to?: number; duration?: number }
  | { type: "delete"; clipId: string }
  | { type: "set"; clipId: string; property: string; value: number }
  | { type: "add-text"; track: string; at: number; duration: number; text: string }
  | { type: "set-text"; clipId: string; text: string }
  | { type: "duplicate"; clipId: string; count: number }
  | { type: "repeat"; count: number; varName: string; from: number; step: number; template: string }
  | { type: "find-issues" }
  | { type: "generate"; prompt: string; count: number }
  | { type: "error"; message: string };

const SETTABLE_PROPERTIES = new Set(["volume", "speed", "opacity", "x", "y", "width", "height"]);

function parseNumber(raw: string, label: string): number | string {
  const n = Number(raw);
  if (Number.isNaN(n)) return `${label} must be a number, got "${raw}"`;
  return n;
}

function parseFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

export function parseCommand(raw: string): ParsedCommand {
  const trimmed = raw.trim();
  if (!trimmed) return { type: "error", message: "Empty command." };

  // Split respecting quoted strings
  const tokens: string[] = [];
  const re = /"([^"]*)"|\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    tokens.push(m[1] ?? m[0]);
  }

  const cmd = tokens[0].toLowerCase();

  if (cmd === "view") {
    return { type: "view" };
  }

  if (cmd === "find-issues" || cmd === "findissues" || cmd === "issues") {
    return { type: "find-issues" };
  }

  if (cmd === "move") {
    if (tokens.length < 3) return { type: "error", message: "Usage: move <clipId> <seconds>" };
    const at = parseNumber(tokens[2], "seconds");
    if (typeof at === "string") return { type: "error", message: at };
    if (at < 0) return { type: "error", message: "seconds must be >= 0" };
    return { type: "move", clipId: tokens[1], at };
  }

  if (cmd === "trim") {
    if (tokens.length < 2) return { type: "error", message: "Usage: trim <clipId> [--from N] [--to N] [--duration N]" };
    const clipId = tokens[1];
    const rest = tokens.slice(2);
    const fromRaw = parseFlag(rest, "--from");
    const toRaw = parseFlag(rest, "--to");
    const durRaw = parseFlag(rest, "--duration");

    const from = fromRaw ? parseNumber(fromRaw, "--from") : undefined;
    if (typeof from === "string") return { type: "error", message: from };
    const to = toRaw ? parseNumber(toRaw, "--to") : undefined;
    if (typeof to === "string") return { type: "error", message: to };
    const duration = durRaw ? parseNumber(durRaw, "--duration") : undefined;
    if (typeof duration === "string") return { type: "error", message: duration };

    if (from === undefined && to === undefined && duration === undefined) {
      return { type: "error", message: "trim requires at least one of --from, --to, --duration" };
    }
    if (duration !== undefined && duration <= 0) {
      return { type: "error", message: "--duration must be > 0" };
    }

    return { type: "trim", clipId, from, to, duration };
  }

  if (cmd === "delete" || cmd === "rm") {
    if (tokens.length < 2) return { type: "error", message: "Usage: delete <clipId>" };
    return { type: "delete", clipId: tokens[1] };
  }

  if (cmd === "set") {
    if (tokens.length < 4) return { type: "error", message: "Usage: set <clipId> <property> <value>" };
    const property = tokens[2].toLowerCase();
    if (!SETTABLE_PROPERTIES.has(property)) {
      return { type: "error", message: `Unknown property "${property}". Valid: ${[...SETTABLE_PROPERTIES].join(", ")}` };
    }
    const value = parseNumber(tokens[3], "value");
    if (typeof value === "string") return { type: "error", message: value };
    return { type: "set", clipId: tokens[1], property, value };
  }

  if (cmd === "add-text" || cmd === "addtext" || cmd === "text") {
    if (tokens.length < 5) return { type: "error", message: 'Usage: add-text <track> <at> <duration> "<text>"' };
    const at = parseNumber(tokens[2], "at");
    if (typeof at === "string") return { type: "error", message: at };
    const duration = parseNumber(tokens[3], "duration");
    if (typeof duration === "string") return { type: "error", message: duration };
    if (duration <= 0) return { type: "error", message: "duration must be > 0" };
    const text = tokens.slice(4).join(" ");
    return { type: "add-text", track: tokens[1], at, duration, text };
  }

  if (cmd === "set-text" || cmd === "settext" || cmd === "update-text") {
    if (tokens.length < 3) return { type: "error", message: 'Usage: set-text <clipId> "<new text>"' };
    const text = tokens.slice(2).join(" ");
    return { type: "set-text", clipId: tokens[1], text };
  }

  if (cmd === "duplicate" || cmd === "dup" || cmd === "clone") {
    if (tokens.length < 2) return { type: "error", message: "Usage: duplicate <clipId> [count]" };
    const countRaw = tokens[2];
    const count = countRaw ? parseNumber(countRaw, "count") : 1;
    if (typeof count === "string") return { type: "error", message: count };
    return { type: "duplicate", clipId: tokens[1], count: Math.max(1, Math.round(count)) };
  }

  if (cmd === "repeat") {
    // repeat <count> <command> --start <N> --gap <N>
    // e.g. repeat 50 add-text V8 0.1 pee --start 2.74 --gap 0.1
    const rest = tokens.slice(1);
    if (rest.length < 2) return { type: "error", message: "Usage: repeat <count> <command...> --start <N> --gap <N>" };

    // First token after repeat is always the count
    const count = parseNumber(rest[0], "count");
    if (typeof count === "string") return { type: "error", message: count };
    if (count <= 0 || count > 500) return { type: "error", message: "count must be 1-500" };

    const commandTokens = rest.slice(1);
    const startRaw = parseFlag(commandTokens, "--start") ?? parseFlag(commandTokens, "--from") ?? parseFlag(commandTokens, "--at");
    const gapRaw = parseFlag(commandTokens, "--gap") ?? parseFlag(commandTokens, "--step") ?? parseFlag(commandTokens, "--interval");
    const varName = parseFlag(commandTokens, "--var") ?? "i";

    const from = startRaw ? parseNumber(startRaw, "--start") : 0;
    if (typeof from === "string") return { type: "error", message: from };
    const step = gapRaw ? parseNumber(gapRaw, "--gap") : 1;
    if (typeof step === "string") return { type: "error", message: step };

    // Strip flag pairs positionally to get the template
    const flagKeys = new Set(["--start", "--from", "--at", "--gap", "--step", "--interval", "--var"]);
    const skipIndices = new Set<number>();
    for (let idx = 0; idx < commandTokens.length; idx++) {
      if (flagKeys.has(commandTokens[idx]) && idx + 1 < commandTokens.length) {
        skipIndices.add(idx);
        skipIndices.add(idx + 1);
        idx++;
      }
    }
    let template = commandTokens.filter((_, idx) => !skipIndices.has(idx)).join(" ");

    // If no {i} in template, auto-insert it as the time parameter
    // For add-text: "add-text V8 0.1 pee" → "add-text V8 {i} 0.1 pee"
    if (!template.includes(`{${varName}}`)) {
      const parts = template.split(" ");
      if (parts[0] === "add-text" && parts.length >= 3) {
        // Insert {i} as the "at" parameter (position 2)
        parts.splice(2, 0, `{${varName}}`);
        template = parts.join(" ");
      }
    }

    if (!template) return { type: "error", message: "Usage: repeat <count> <command...> --start <N> --gap <N>" };

    return { type: "repeat", count: Math.round(count), varName, from, step, template };
  }

  if (cmd === "generate" || cmd === "gen") {
    if (tokens.length < 2) return { type: "error", message: "Usage: generate <prompt> [--count N]" };
    const rest = tokens.slice(1);
    const countRaw = parseFlag(rest, "--count");
    const count = countRaw ? parseNumber(countRaw, "--count") : 1;
    if (typeof count === "string") return { type: "error", message: count };
    const prompt = rest.filter((t) => t !== "--count" && t !== countRaw).join(" ");
    if (!prompt) return { type: "error", message: "generate requires a prompt" };
    return { type: "generate", prompt, count: Math.max(1, Math.round(count)) };
  }

  return { type: "error", message: `Unknown command "${cmd}". Available: view, move, trim, delete, set, add-text, find-issues, generate` };
}

/** Validate a parsed command against the current timeline state. */
export function validateCommand(
  parsed: ParsedCommand,
  config: TimelineConfig,
  _registry: AssetRegistry,
): string | null {
  if (parsed.type === "error" || parsed.type === "view" || parsed.type === "find-issues" || parsed.type === "generate") {
    return null;
  }

  // Validate clipId exists
  if ("clipId" in parsed) {
    const clip = config.clips.find((c) => c.id === parsed.clipId);
    if (!clip) {
      const ids = config.clips.map((c) => c.id).join(", ");
      return `Clip "${parsed.clipId}" not found. Available: ${ids}`;
    }
  }

  // Validate track exists for add-text
  if (parsed.type === "add-text") {
    const tracks = config.tracks ?? [];
    if (tracks.length > 0 && !tracks.some((t) => t.id === parsed.track)) {
      const ids = tracks.map((t) => t.id).join(", ");
      return `Track "${parsed.track}" not found. Available: ${ids}`;
    }
  }

  return null;
}
