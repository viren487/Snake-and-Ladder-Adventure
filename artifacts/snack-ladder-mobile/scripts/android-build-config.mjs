import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Public build configuration only. Never put credentials into an APK.
export function normalizeBackendDomain(input = "") {
  if (typeof input !== "string") {
    throw new Error("Backend URL must be text.");
  }
  const value = input.trim();
  if (!value) return "";

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Use a complete HTTPS backend URL, or leave it empty for offline play.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Backend URL must be HTTPS with no credentials, page path, query, or fragment.");
  }
  if (
    !url.hostname.includes(".") ||
    url.hostname.endsWith(".local") ||
    url.hostname.endsWith(".invalid") ||
    /^[\d.]+$/.test(url.hostname) ||
    !/^[a-z0-9.-]+(?::\d+)?$/i.test(url.host)
  ) {
    throw new Error("Use an internet-accessible backend hostname, not a local device address.");
  }
  return url.host;
}

export function githubEnvironment(domain) {
  // Domain is normalized by URL above; user text never becomes shell commands.
  return `EXPO_PUBLIC_DOMAIN=${normalizeBackendDomain(domain ? `https://${domain}` : "")}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const domain = normalizeBackendDomain(process.env.APK_BACKEND_URL ?? "");
    if (process.env.GITHUB_ENV) {
      appendFileSync(process.env.GITHUB_ENV, githubEnvironment(domain));
    }
    const mode = domain
      ? "Online-enabled APK. Its configured backend must be published and reachable."
      : "Offline APK: local/Pass & Play only. Rebuild with a backend URL for online rooms.";
    console.log(mode);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Build mode\n${mode}\n\n`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}