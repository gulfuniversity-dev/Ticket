import "server-only";
import { randomBytes } from "node:crypto";

/** Cryptographically-secure, unguessable QR token (256-bit, base64url). */
export function generateQrToken(): string {
  return randomBytes(32).toString("base64url");
}

export type TicketStatus = "unused" | "used" | "cancelled";

export interface TicketRow {
  id: string;
  ticket_id: string;
  student_id: string;
  qr_token: string;
  ticket_number: number;
  total_tickets: number;
  status: TicketStatus;
  used_at: string | null;
  checked_in_by: string | null;
  created_at: string;
  updated_at: string;
}
