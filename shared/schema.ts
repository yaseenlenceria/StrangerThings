import { z } from "zod";

// WebSocket Message Types
export const wsMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("match"),
    partnerId: z.string(),
    initiator: z.boolean(),
  }),
  z.object({
    type: z.literal("offer"),
    sdp: z.string(),
    from: z.string(),
  }),
  z.object({
    type: z.literal("answer"),
    sdp: z.string(),
    from: z.string(),
  }),
  z.object({
    type: z.literal("ice"),
    candidate: z.any(),
    from: z.string(),
  }),
  z.object({
    type: z.literal("next"),
  }),
  z.object({
    type: z.literal("leave"),
  }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
  }),
]);

export type WSMessage = z.infer<typeof wsMessageSchema>;

// Connection States
export type ConnectionState = "idle" | "searching" | "connecting" | "connected";

export interface PeerInfo {
  id: string;
  isConnected: boolean;
}
