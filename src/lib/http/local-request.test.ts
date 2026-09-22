import assert from "node:assert/strict";
import test from "node:test";
import { isLocalRequest } from "./local-request";

function request(host: string, origin?: string, site?: string) {
  return new Request("http://localhost/api/test", {
    headers: {
      host,
      ...(origin ? { origin } : {}),
      ...(site ? { "sec-fetch-site": site } : {}),
    },
  });
}

test("allows loopback reads and same-origin mutations", () => {
  assert.equal(isLocalRequest(request("127.0.0.1:3000")), true);
  assert.equal(
    isLocalRequest(
      request("127.0.0.1:3000", "http://127.0.0.1:3000"),
      true,
    ),
    true,
  );
});

test("rejects remote hosts, cross-site requests, and missing mutation origins", () => {
  assert.equal(isLocalRequest(request("example.com")), false);
  assert.equal(
    isLocalRequest(
      request("localhost:3000", "http://evil.test", "cross-site"),
      true,
    ),
    false,
  );
  assert.equal(isLocalRequest(request("localhost:3000"), true), false);
});
