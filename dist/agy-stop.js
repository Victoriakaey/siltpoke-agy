// @bun
// src/hooks/agy-stop.ts
import { basename, dirname, join } from "path";
import { fileURLToPath } from "url";
async function readStdinAll() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
function resolveOnStopTarget(hereDir) {
  if (basename(hereDir) === "dist") {
    return join(hereDir, "siltpoke-stop.js");
  }
  return join(hereDir, "on-stop.ts");
}
function normalizeAgyStop(raw) {
  let input = {};
  try {
    const parsed = JSON.parse(raw || "{}");
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      input = parsed;
    }
  } catch {
    input = {};
  }
  const transcriptPath = typeof input.transcriptPath === "string" ? input.transcriptPath : undefined;
  const sessionId = typeof input.conversationId === "string" ? input.conversationId : "antigravity";
  const workspacePaths = Array.isArray(input.workspacePaths) ? input.workspacePaths : [];
  const cwd = typeof workspacePaths[0] === "string" ? workspacePaths[0] : process.cwd();
  const stopEventTimestampMs = typeof input.executionNum === "number" ? input.executionNum : undefined;
  return JSON.stringify({
    ...input,
    hook_event_name: "Stop",
    session_id: sessionId,
    transcript_path: transcriptPath,
    cwd,
    siltpoke_host: "antigravity",
    stop_event_timestamp_ms: stopEventTimestampMs
  });
}
function dispatchAgyReview(normalizedJson, onStopTarget, env, spawnFn) {
  try {
    const spawn = spawnFn ?? ((cmd, opts) => Bun.spawn(cmd, opts));
    const proc = spawn(["bun", onStopTarget], {
      stdio: ["pipe", "ignore", "ignore"],
      env: { ...env, SILTPOKE_SUPPRESSION_ENABLED: env.SILTPOKE_SUPPRESSION_ENABLED ?? "1" }
    });
    if (proc.stdin) {
      proc.stdin.write(normalizedJson);
      proc.stdin.end();
    }
    proc.unref();
  } catch {}
}
async function runAgyStopHook(opts) {
  const env = opts.env ?? process.env;
  const normalized = normalizeAgyStop(opts.rawJson);
  if (env.SILTPOKE_INTERNAL === "1") {
    return { normalized };
  }
  const hereDir = opts.hereDir ?? dirname(fileURLToPath(import.meta.url));
  const onStopTarget = resolveOnStopTarget(hereDir);
  dispatchAgyReview(normalized, onStopTarget, env, opts.spawnFn);
  return { normalized };
}
function writeStopResponse(out = process.stdout) {
  out.write("{}");
}
if (import.meta.main) {
  try {
    const raw = await readStdinAll();
    await runAgyStopHook({ rawJson: raw });
  } catch {} finally {
    writeStopResponse();
    process.exit(0);
  }
}
export {
  writeStopResponse,
  runAgyStopHook,
  resolveOnStopTarget,
  normalizeAgyStop
};
