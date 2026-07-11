import { describe, expect, it } from "vitest";
import { listConversationsQuerySchema, sendMessageSchema } from "./validation";

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("sendMessageSchema", () => {
  it("accepts a minimal valid message", () => {
    expect(
      sendMessageSchema.safeParse({ key: "wgt_pub_abc", visitorId: VALID_UUID, message: "Hello" }).success,
    ).toBe(true);
  });

  it("accepts an optional conversationId", () => {
    expect(
      sendMessageSchema.safeParse({
        key: "wgt_pub_abc",
        visitorId: VALID_UUID,
        conversationId: VALID_UUID,
        message: "Hello",
      }).success,
    ).toBe(true);
  });

  it("rejects a non-uuid visitorId", () => {
    expect(
      sendMessageSchema.safeParse({ key: "wgt_pub_abc", visitorId: "not-a-uuid", message: "Hello" })
        .success,
    ).toBe(false);
  });

  it("rejects an empty or oversized message", () => {
    expect(sendMessageSchema.safeParse({ key: "k", visitorId: VALID_UUID, message: "" }).success).toBe(
      false,
    );
    expect(
      sendMessageSchema.safeParse({ key: "k", visitorId: VALID_UUID, message: "x".repeat(4001) }).success,
    ).toBe(false);
  });

  it("rejects a missing key", () => {
    expect(sendMessageSchema.safeParse({ visitorId: VALID_UUID, message: "hi" }).success).toBe(false);
  });
});

describe("listConversationsQuerySchema", () => {
  it("accepts an empty query", () => {
    expect(listConversationsQuerySchema.safeParse({}).success).toBe(true);
  });

  it("accepts a valid widgetId filter", () => {
    expect(listConversationsQuerySchema.safeParse({ widgetId: VALID_UUID }).success).toBe(true);
  });

  it("rejects an invalid widgetId", () => {
    expect(listConversationsQuerySchema.safeParse({ widgetId: "nope" }).success).toBe(false);
  });
});
