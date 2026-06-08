import { describe, expect, it } from "vitest";

import { createAuditLog } from "./audit-log";

describe("createAuditLog", () => {
  it("starts with an empty event list", () => {
    const log = createAuditLog();

    expect(log.events).toHaveLength(0);
  });

  it("appends an event with auto-generated id and timestamp", () => {
    const log = createAuditLog();

    log.log({ deviceInfo: "test", eventType: "sign_in_attempt" });

    expect(log.events).toHaveLength(1);
    expect(log.events[0].eventType).toBe("sign_in_attempt");
    expect(log.events[0].id).toMatch(/^audit-\d+-\d+$/);
    expect(log.events[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("preserves optional userEmail and metadata", () => {
    const log = createAuditLog();

    log.log({
      deviceInfo: "test",
      eventType: "sign_in_failure",
      metadata: { reason: "invalid credentials" },
      userEmail: "partner@example.com",
    });

    expect(log.events[0].userEmail).toBe("partner@example.com");
    expect(log.events[0].metadata).toEqual({ reason: "invalid credentials" });
  });

  it("accepts sealed emergency code event types without secret metadata", () => {
    const log = createAuditLog();

    log.log({
      deviceInfo: "React Native",
      eventType: "sealed_emergency_code_created",
      metadata: { grantType: "sealed_emergency_code" },
    });

    expect(log.events[0]?.eventType).toBe("sealed_emergency_code_created");
    expect(log.events[0]?.metadata).toEqual({
      grantType: "sealed_emergency_code",
    });
  });

  it("returns a copy of events that cannot mutate internal state", () => {
    const log = createAuditLog();

    log.log({ deviceInfo: "test", eventType: "sign_in_attempt" });

    const snapshot = log.events;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (snapshot as any).push({
      deviceInfo: "tamper",
      eventType: "sign_in_success",
      id: "fake",
      timestamp: "fake",
    });

    expect(log.events).toHaveLength(1);
  });

  it("appends events in order", () => {
    const log = createAuditLog();

    log.log({ deviceInfo: "a", eventType: "sign_in_attempt" });
    log.log({ deviceInfo: "b", eventType: "sign_in_success" });
    log.log({ deviceInfo: "c", eventType: "vault_unlocked" });

    expect(log.events.map((e) => e.eventType)).toEqual([
      "sign_in_attempt",
      "sign_in_success",
      "vault_unlocked",
    ]);
  });

  it("does not expose a way to delete or modify existing events", () => {
    const log = createAuditLog();

    log.log({ deviceInfo: "test", eventType: "sign_in_attempt" });

    const event = log.events[0];
    expect(event).toBeDefined();
    expect(Object.isFrozen(event)).toBe(false); // plain object, not frozen
    // The important thing is that log.events returns a copy and there is no delete/clear method
    expect("delete" in log).toBe(false);
    expect("clear" in log).toBe(false);
  });

  it("anonymize strips userEmail from all events without removing them", () => {
    const log = createAuditLog();

    log.log({
      deviceInfo: "test",
      eventType: "sign_in_attempt",
      userEmail: "partner@example.com",
    });
    log.log({
      deviceInfo: "test",
      eventType: "sign_in_success",
      userEmail: "partner@example.com",
    });

    log.anonymize();

    expect(log.events).toHaveLength(2);
    expect(log.events[0].userEmail).toBeUndefined();
    expect(log.events[1].userEmail).toBeUndefined();
    expect(log.events[0].eventType).toBe("sign_in_attempt");
    expect(log.events[1].eventType).toBe("sign_in_success");
  });

  it("forwards durable audit events without raw user email", async () => {
    const durableEvents: unknown[] = [];
    const log = createAuditLog({
      durableSink: {
        async recordEvent(event) {
          durableEvents.push(event);
        },
      },
    });

    log.log({
      deviceInfo: "test",
      eventType: "sign_in_success",
      metadata: { method: "password" },
      userEmail: "partner@example.com",
    });
    await Promise.resolve();

    expect(durableEvents).toEqual([
      {
        deviceInfo: "test",
        eventType: "sign_in_success",
        metadata: { method: "password" },
      },
    ]);
  });

  it("does not throw when durable audit persistence fails", () => {
    const log = createAuditLog({
      durableSink: {
        async recordEvent() {
          throw new Error("network unavailable");
        },
      },
    });

    expect(() => {
      log.log({
        deviceInfo: "test",
        eventType: "vault_locked",
      });
    }).not.toThrow();
    expect(log.events).toHaveLength(1);
  });
});
