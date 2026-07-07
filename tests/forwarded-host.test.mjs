import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeDefaultPortHost,
  normalizeForwardedHostHeaders,
} from "../scripts/forwarded-host.mjs";

test("normalizes https default port from forwarded host", () => {
  assert.equal(normalizeDefaultPortHost("www.hangge.xyz:443", "https"), "www.hangge.xyz");
});

test("normalizes http default port from forwarded host", () => {
  assert.equal(normalizeDefaultPortHost("www.hangge.xyz:80", "http"), "www.hangge.xyz");
});

test("keeps explicit non-default ports", () => {
  assert.equal(normalizeDefaultPortHost("www.hangge.xyz:3000", "https"), "www.hangge.xyz:3000");
});

test("keeps default port when it conflicts with the forwarded protocol", () => {
  assert.equal(normalizeDefaultPortHost("www.hangge.xyz:443", "http"), "www.hangge.xyz:443");
  assert.equal(normalizeDefaultPortHost("www.hangge.xyz:80", "https"), "www.hangge.xyz:80");
});

test("normalizes bracketed IPv6 default ports", () => {
  assert.equal(normalizeDefaultPortHost("[::1]:443", "https"), "[::1]");
});

test("mutates forwarded host headers before Next handles the request", () => {
  const headers = {
    "x-forwarded-proto": "https",
    "x-forwarded-host": "www.hangge.xyz:443",
    host: "127.0.0.1:3000",
  };

  const changed = normalizeForwardedHostHeaders(headers);

  assert.deepEqual(changed, [
    {
      headerName: "x-forwarded-host",
      from: "www.hangge.xyz:443",
      to: "www.hangge.xyz",
    },
  ]);
  assert.equal(headers["x-forwarded-host"], "www.hangge.xyz");
  assert.equal(headers.host, "127.0.0.1:3000");
});
