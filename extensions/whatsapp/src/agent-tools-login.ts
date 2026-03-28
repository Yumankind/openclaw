import { Type } from "@sinclair/typebox";
import type { ChannelAgentTool } from "openclaw/plugin-sdk/channel-contract";
import {
  startWebLoginWithCode,
  startWebLoginWithQr,
  waitForWebLogin,
} from "../login-qr-api.js";

export function createWhatsAppLoginTool(): ChannelAgentTool {
  return {
    label: "WhatsApp Login",
    name: "whatsapp_login",
    ownerOnly: true,
    description:
      "Link WhatsApp via QR code or phone-number pairing code, or wait for the pairing to complete.",
    // NOTE: Using Type.Unsafe for action enum instead of Type.Union([Type.Literal(...)]
    // because Claude API on Vertex AI rejects nested anyOf schemas as invalid JSON Schema.
    parameters: Type.Object({
      action: Type.Unsafe<"start" | "start_code" | "wait">({
        type: "string",
        enum: ["start", "start_code", "wait"],
      }),
      phoneNumber: Type.Optional(Type.String()),
      timeoutMs: Type.Optional(Type.Number()),
      force: Type.Optional(Type.Boolean()),
    }),
    execute: async (_toolCallId, args) => {
      const action = (args as { action?: string })?.action ?? "start";
      if (action === "wait") {
        const result = await waitForWebLogin({
          timeoutMs:
            typeof (args as { timeoutMs?: unknown }).timeoutMs === "number"
              ? (args as { timeoutMs?: number }).timeoutMs
              : undefined,
        });
        return {
          content: [{ type: "text", text: result.message }],
          details: { connected: result.connected },
        };
      }

      if (action === "start_code") {
        const phoneNumber = (args as { phoneNumber?: string }).phoneNumber;
        if (!phoneNumber) {
          return {
            content: [{ type: "text", text: "Phone number is required for pairing code login." }],
            details: { pairingCode: false },
          };
        }
        const result = await startWebLoginWithCode({
          phoneNumber,
          timeoutMs:
            typeof (args as { timeoutMs?: unknown }).timeoutMs === "number"
              ? (args as { timeoutMs?: number }).timeoutMs
              : undefined,
          force:
            typeof (args as { force?: unknown }).force === "boolean"
              ? (args as { force?: boolean }).force
              : false,
        });
        return {
          content: [{ type: "text", text: result.message }],
          details: { pairingCode: Boolean(result.pairingCode) },
        };
      }

      const result = await startWebLoginWithQr({
        timeoutMs:
          typeof (args as { timeoutMs?: unknown }).timeoutMs === "number"
            ? (args as { timeoutMs?: number }).timeoutMs
            : undefined,
        force:
          typeof (args as { force?: unknown }).force === "boolean"
            ? (args as { force?: boolean }).force
            : false,
      });

      if (!result.qrDataUrl) {
        return {
          content: [
            {
              type: "text",
              text: result.message,
            },
          ],
          details: { qr: false },
        };
      }

      const text = [
        result.message,
        "",
        "Open WhatsApp → Linked Devices and scan:",
        "",
        `![whatsapp-qr](${result.qrDataUrl})`,
      ].join("\n");
      return {
        content: [{ type: "text", text }],
        details: { qr: true },
      };
    },
  };
}
