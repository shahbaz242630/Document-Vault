import { describe, expect, it, vi } from "vitest";

import { configureDurableAuditLog } from "./durable-audit-log";

describe("configureDurableAuditLog", () => {
  it("attaches a Supabase audit sink when a client is available", () => {
    const auditLog = {
      setDurableSink: vi.fn(),
    };
    const client = {
      from: vi.fn(),
    };

    const configured = configureDurableAuditLog({
      auditLog,
      client,
    });

    expect(configured).toBe(true);
    expect(auditLog.setDurableSink).toHaveBeenCalledWith({
      recordEvent: expect.any(Function),
    });
  });

  it("leaves durable audit disabled when Supabase is not configured", () => {
    const auditLog = {
      setDurableSink: vi.fn(),
    };

    const configured = configureDurableAuditLog({
      auditLog,
      client: null,
    });

    expect(configured).toBe(false);
    expect(auditLog.setDurableSink).not.toHaveBeenCalled();
  });
});
