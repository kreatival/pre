import assert from "node:assert/strict";
import test from "node:test";
import { isSubscriptionActive } from "../src/lib/subscription";

test("active subscription stays valid until expiry", () => {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  assert.equal(isSubscriptionActive("ACTIVE", future), true);
});

test("expired subscription is blocked", () => {
  const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  assert.equal(isSubscriptionActive("ACTIVE", past), false);
});

test("paused or cancelled subscriptions are inactive", () => {
  assert.equal(isSubscriptionActive("PAUSED", new Date(Date.now() + 60 * 60 * 1000).toISOString()), false);
  assert.equal(isSubscriptionActive("CANCELLED", new Date(Date.now() + 60 * 60 * 1000).toISOString()), false);
});
