import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBackendDomain, githubEnvironment } from "./android-build-config.mjs";

test("empty backend intentionally produces an offline APK", () => {
  assert.equal(normalizeBackendDomain(), "");
  assert.equal(normalizeBackendDomain(" \n "), "");
  assert.equal(githubEnvironment(""), "EXPO_PUBLIC_DOMAIN=\n");
});

test("HTTPS origin becomes the host expected by the mobile API client", () => {
  assert.equal(normalizeBackendDomain(" https://GAME.example.com/ "), "game.example.com");
  assert.equal(normalizeBackendDomain("https://game.example.com:8443"), "game.example.com:8443");
  assert.equal(githubEnvironment("game.example.com"), "EXPO_PUBLIC_DOMAIN=game.example.com\n");
});

test("rejects credentials, cleartext, deep links, queries and local addresses", () => {
  for (const input of [
    "game.example.com", "http://game.example.com", "file:///app",
    "https://name:password@game.example.com", "https://game.example.com/mobile",
    "https://game.example.com/?token=example", "https://game.example.com/#room",
    "https://localhost", "https://127.0.0.1", "https://192.168.1.5",
    "https://phone.local", "https://offline.invalid", "https://[::1]",
    "https://game.example.com\nINJECTED=true",
  ]) {
    assert.throws(() => normalizeBackendDomain(input), undefined, input);
  }
  assert.throws(() => normalizeBackendDomain(123));
});

test("environment output cannot inject another variable", () => {
  assert.throws(() => githubEnvironment("game.example.com\nINJECTED=true"));
  assert.throws(() => githubEnvironment("name:password@game.example.com"));
  assert.equal(githubEnvironment("game.example.com").split("\n").length, 2);
});