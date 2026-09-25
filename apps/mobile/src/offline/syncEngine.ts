import { ApiClient, ApiError } from "../api/client";
import { pushFieldOps, FieldOpInput } from "../api/sync";
import { addNote } from "../api/handoff";
import { acknowledgeHandoff } from "../api/handoff";
import { createHandoff } from "../api/handoff";
import type { OpQueueStorage, QueuedOp } from "./opQueue";

interface NotePayload { handoffId: string; text: string; hlc: unknown; }
interface AcknowledgePayload { handoffId: string; hlc: unknown; }
interface HandoffCreatePayload { patientId: string; wardId: string; shiftPeriod: string; hlc: unknown; }

export interface FlushSummary {
  synced: number;
  failed: number;
  remaining: number;
  stoppedEarly: boolean;
}

/**
 * Processes every pending queue entry, in the order it was enqueued —
 * this matters specifically for fieldOp writes, where a later op's
 * baseHlc depends on an earlier one in the same batch having already
 * applied server-side.
 *
 * Two different kinds of failure are handled differently:
 *  - The SERVER rejects the write (ApiError): this write is genuinely
 *    bad and won't succeed by retrying it as-is. Mark it 'failed' and
 *    move on — don't let one bad write block everything behind it.
 *  - The REQUEST never reached the server at all (not an ApiError —
 *    a thrown network error): connectivity is down, not that the
 *    write was bad. Stop the whole flush here and leave this item (and
 *    everything after it) as 'pending' — retried on the next attempt.
 */
export async function flushQueue(client: ApiClient, queue: OpQueueStorage): Promise<FlushSummary> {
  const pending = await queue.listPending();
  pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  let synced = 0;
  let failed = 0;
  let stoppedEarly = false;

  for (let i = 0; i < pending.length; i++) {
    const op = pending[i];
    try {
      await applyOp(client, op);
      await queue.markSynced(op.id);
      synced++;
    } catch (err) {
      if (err instanceof ApiError) {
        await queue.markFailed(op.id, err.message);
        failed++;
        continue;
      }
      stoppedEarly = true;
      break;
    }
  }

  const remaining = (await queue.listPending()).length;
  return { synced, failed, remaining, stoppedEarly };
}

async function applyOp(client: ApiClient, op: QueuedOp): Promise<void> {
  switch (op.type) {
    case "fieldOp": {
      const payload = op.payload as FieldOpInput;
      const results = await pushFieldOps(client, [payload]);
      if (results[0]?.status === "conflict") {
        // A conflict is still a SUCCESSFUL sync of this op — the write
        // was recorded server-side, it just also opened a Conflict for
        // a human to resolve (visible via GET /conflicts).
      }
      return;
    }
    case "note": {
      const payload = op.payload as NotePayload;
      await addNote(client, payload.handoffId, payload.text, payload.hlc as any);
      return;
    }
    case "acknowledge": {
      const payload = op.payload as AcknowledgePayload;
      await acknowledgeHandoff(client, payload.handoffId, payload.hlc as any);
      return;
    }
    case "handoffCreate": {
      const payload = op.payload as HandoffCreatePayload;
      await createHandoff(client, payload.patientId, payload.wardId, payload.shiftPeriod, payload.hlc as any);
      return;
    }
  }
}