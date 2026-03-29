import { spawn, type ChildProcess } from "node:child_process";
import { loadConfig } from "openclaw/plugin-sdk/config-runtime";
import { generateSecureUuid } from "openclaw/plugin-sdk/infra-runtime";
import { info, danger, success, defaultRuntime, type RuntimeEnv } from "openclaw/plugin-sdk/runtime-env";
import { resolveSignalAccount } from "./accounts.js";
import { renderQrPngBase64 } from "./qr-image.js";

type ActiveLogin = {
  accountId: string;
  id: string;
  child: ChildProcess;
  startedAt: number;
  linkUri?: string;
  qrDataUrl?: string;
  connected: boolean;
  error?: string;
  waitPromise: Promise<void>;
};

const ACTIVE_LOGIN_TTL_MS = 3 * 60_000;
const activeLogins = new Map<string, ActiveLogin>();

function killChild(child: ChildProcess) {
  try {
    if (!child.killed) child.kill("SIGTERM");
  } catch {
    // ignore
  }
}

function resetActiveLogin(accountId: string, reason?: string) {
  const login = activeLogins.get(accountId);
  if (login) {
    killChild(login.child);
    activeLogins.delete(accountId);
  }
  if (reason) {
    defaultRuntime.log(info(reason));
  }
}

function isLoginFresh(login: ActiveLogin) {
  return Date.now() - login.startedAt < ACTIVE_LOGIN_TTL_MS;
}

/**
 * Spawn `signal-cli link` and capture the provisioning URI from stdout.
 * signal-cli prints a `sgnl://linkdevice?uuid=...&pub_key=...` URI that must
 * be rendered as a QR code for the phone to scan.
 */
function spawnLinkProcess(
  cliPath: string,
  deviceName: string,
  runtime: RuntimeEnv,
): { child: ChildProcess; uriPromise: Promise<string>; waitPromise: Promise<void> } {
  const args = ["link", "-n", deviceName];
  const child = spawn(cliPath, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let resolveUri: ((uri: string) => void) | null = null;
  let rejectUri: ((err: Error) => void) | null = null;
  const uriPromise = new Promise<string>((resolve, reject) => {
    resolveUri = resolve;
    rejectUri = reject;
  });

  let resolveWait: (() => void) | null = null;
  let rejectWait: ((err: Error) => void) | null = null;
  const waitPromise = new Promise<void>((resolve, reject) => {
    resolveWait = resolve;
    rejectWait = reject;
  });

  let uriFound = false;
  let stderrBuf = "";

  child.stdout?.on("data", (data: Buffer) => {
    const text = data.toString();
    runtime.log(info(`signal-cli link stdout: ${text.trim()}`));
    if (!uriFound) {
      // signal-cli outputs the sgnl:// URI on stdout
      const match = text.match(/(sgnl:\/\/linkdevice\?[^\s]+)/);
      if (match) {
        uriFound = true;
        resolveUri?.(match[1]);
      }
      // Also check for tsdevice:// URIs (some signal-cli versions)
      const match2 = text.match(/(tsdevice:\/\/[^\s]+)/);
      if (!uriFound && match2) {
        uriFound = true;
        resolveUri?.(match2[1]);
      }
    }
  });

  child.stderr?.on("data", (data: Buffer) => {
    const text = data.toString();
    stderrBuf += text;
    runtime.log(info(`signal-cli link stderr: ${text.trim()}`));
  });

  child.once("exit", (code: number | null) => {
    if (!uriFound) {
      rejectUri?.(
        new Error(
          `signal-cli link exited (code ${code}) before producing a URI. ${stderrBuf.trim()}`,
        ),
      );
    }
    if (code === 0) {
      resolveWait?.();
    } else {
      rejectWait?.(new Error(`signal-cli link exited with code ${code}. ${stderrBuf.trim()}`));
    }
  });

  child.on("error", (err: Error) => {
    const msg = `signal-cli link spawn error: ${String(err)}`;
    runtime.error(msg);
    if (!uriFound) rejectUri?.(new Error(msg));
    rejectWait?.(new Error(msg));
  });

  return { child, uriPromise, waitPromise };
}

export async function startSignalLinkWithQr(
  opts: {
    verbose?: boolean;
    timeoutMs?: number;
    force?: boolean;
    accountId?: string;
    runtime?: RuntimeEnv;
  } = {},
): Promise<{ qrDataUrl?: string; linkUri?: string; message: string }> {
  const runtime = opts.runtime ?? defaultRuntime;
  const cfg = loadConfig();
  const account = resolveSignalAccount({ cfg, accountId: opts.accountId });

  // If there is already an active login with a valid QR, return it.
  const existing = activeLogins.get(account.accountId);
  if (existing && isLoginFresh(existing) && existing.qrDataUrl && !opts.force) {
    return {
      qrDataUrl: existing.qrDataUrl,
      linkUri: existing.linkUri,
      message: "QR already active. Scan it in Signal → Linked Devices.",
    };
  }

  // Clean up any previous login.
  resetActiveLogin(account.accountId);

  const cliPath = account.config.cliPath?.trim() || "signal-cli";
  const deviceName = "OpenClaw";

  const { child, uriPromise, waitPromise } = spawnLinkProcess(cliPath, deviceName, runtime);

  const login: ActiveLogin = {
    accountId: account.accountId,
    id: generateSecureUuid(),
    child,
    startedAt: Date.now(),
    connected: false,
    waitPromise: waitPromise
      .then(() => {
        const current = activeLogins.get(account.accountId);
        if (current?.id === login.id) {
          current.connected = true;
        }
      })
      .catch((err) => {
        const current = activeLogins.get(account.accountId);
        if (current?.id === login.id) {
          current.error = String(err);
        }
      }),
  };
  activeLogins.set(account.accountId, login);

  // Wait for the URI with a timeout.
  const timeoutMs = Math.max(opts.timeoutMs ?? 30_000, 5000);
  let uri: string;
  try {
    uri = await Promise.race([
      uriPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timed out waiting for signal-cli link URI")), timeoutMs),
      ),
    ]);
  } catch (err) {
    resetActiveLogin(account.accountId);
    return {
      message: `Failed to get Signal link URI: ${String(err)}`,
    };
  }

  runtime.log(info("Signal link URI received, rendering QR code."));
  login.linkUri = uri;

  const base64 = await renderQrPngBase64(uri);
  login.qrDataUrl = `data:image/png;base64,${base64}`;

  return {
    qrDataUrl: login.qrDataUrl,
    linkUri: uri,
    message: "Scan this QR in Signal → Linked Devices on your phone.",
  };
}

export async function waitForSignalLink(
  opts: { timeoutMs?: number; runtime?: RuntimeEnv; accountId?: string } = {},
): Promise<{ connected: boolean; message: string }> {
  const runtime = opts.runtime ?? defaultRuntime;
  const cfg = loadConfig();
  const account = resolveSignalAccount({ cfg, accountId: opts.accountId });
  const login = activeLogins.get(account.accountId);

  if (!login) {
    return {
      connected: false,
      message: "No active Signal link in progress.",
    };
  }

  if (!isLoginFresh(login)) {
    resetActiveLogin(account.accountId);
    return {
      connected: false,
      message: "The link session expired. Please generate a new QR code.",
    };
  }

  const timeoutMs = Math.max(opts.timeoutMs ?? 120_000, 1000);
  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), timeoutMs),
  );
  const result = await Promise.race([login.waitPromise.then(() => "done"), timeout]);

  if (result === "timeout") {
    return {
      connected: false,
      message: "Still waiting for Signal link. Make sure you scanned the QR code.",
    };
  }

  if (login.error) {
    const message = `Signal link failed: ${login.error}`;
    resetActiveLogin(account.accountId, message);
    runtime.log(danger(message));
    return { connected: false, message };
  }

  if (login.connected) {
    const message = "Linked! Signal is ready.";
    runtime.log(success(message));
    resetActiveLogin(account.accountId);
    return { connected: true, message };
  }

  return { connected: false, message: "Link ended without a connection." };
}
