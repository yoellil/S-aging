/**
 * api.js — S-Aging backend client.
 *
 * streamSimulation() POST /api/simulate and calls onFrame() for each
 * NDJSON line (one per simulated month, 0-30).
 */

/**
 * @param {object}   params           SimRequest body
 * @param {function} onFrame          Called with each parsed frame object
 * @param {function} [onDone]         Called when stream completes
 * @param {function} [onError]        Called with Error on failure
 */
export async function streamSimulation(params, onFrame, onDone, onError) {
  let response;
  try {
    response = await fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch (networkErr) {
    onError?.(new Error("Cannot reach simulation backend — is it running? " + networkErr.message));
    return;
  }

  if (!response.ok) {
    onError?.(new Error(`Backend error ${response.status}: ${response.statusText}`));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";   // save incomplete trailing line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          onFrame(JSON.parse(trimmed));
        } catch {
          console.warn("[S-Aging] Failed to parse frame JSON:", trimmed.slice(0, 80));
        }
      }
    }
    onDone?.();
  } catch (err) {
    onError?.(err);
  }
}

/** Quick health check — resolves true if backend is reachable. */
export async function checkBackend() {
  try {
    const r = await fetch("/api/health", { method: "GET" });
    return r.ok;
  } catch {
    return false;
  }
}
