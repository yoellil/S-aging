/**
 * api.js — S-Aging backend client.
 *
 * streamSimulation() POST /api/simulate and calls onFrame() for each
 * NDJSON line (one per simulated month, 0-30).
 */

const AUTH_URL = "http://localhost:3001";

// ── Simulation ──────────────────────────────────────────────────────────────

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

// ── Auth-service helpers ────────────────────────────────────────────────────

function _authHeaders(sessionToken) {
  return {
    "Content-Type": "application/json",
    ...(sessionToken ? { "Authorization": `Bearer ${sessionToken}` } : {}),
  };
}

async function _authFetch(method, path, sessionToken, body = null) {
  const opts = {
    method,
    headers: _authHeaders(sessionToken),
  };
  if (body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(`${AUTH_URL}${path}`, opts);
  return res.json();
}

// ── Logout ──────────────────────────────────────────────────────────────────

export async function authLogout(sessionToken) {
  return _authFetch("POST", "/api/auth/logout", sessionToken);
}

// ── Profile ─────────────────────────────────────────────────────────────────

export async function getProfile(sessionToken) {
  return _authFetch("GET", "/api/profile", sessionToken);
}

export async function updateProfile(sessionToken, data) {
  return _authFetch("PUT", "/api/profile", sessionToken, data);
}

export async function updateUsername(sessionToken, newUsername) {
  return _authFetch("PUT", "/api/profile/username", sessionToken, { new_username: newUsername });
}

export async function updatePassword(sessionToken, currentPassword, newPassword) {
  return _authFetch("PUT", "/api/profile/password", sessionToken, {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export async function uploadProfilePicture(sessionToken, file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${AUTH_URL}/api/profile/picture`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${sessionToken}`,
      // Do NOT set Content-Type — browser sets multipart boundary automatically
    },
    body: formData,
  });
  return res.json();
}

export async function deleteProfilePicture(sessionToken) {
  return _authFetch("DELETE", "/api/profile/picture", sessionToken);
}

// ── Activity logs ───────────────────────────────────────────────────────────

export async function getActivityLogs(sessionToken, limit = 10, offset = 0) {
  return _authFetch("GET", `/api/logs?limit=${limit}&offset=${offset}`, sessionToken);
}
