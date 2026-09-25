import { getDb } from "./db";
import type { OpQueueStorage, QueuedOp, QueuedOpType } from "./opQueue";

function generateId(): string {
  return `op-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

/**
 * SQLite-backed specifically because an in-memory queue would lose
 * every unsynced write the moment the app closes or crashes — the
 * entire point of an offline queue is surviving an outage of unknown
 * length.
 */
export class SqliteOpQueue implements OpQueueStorage {
  async enqueue(type: QueuedOpType, payload: unknown): Promise<QueuedOp> {
    const db = await getDb();
    const op: QueuedOp = {
      id: generateId(),
      type,
      payload,
      status: "pending",
      error: null,
      createdAt: new Date().toISOString(),
    };
    await db.runAsync(
      `INSERT INTO op_queue (id, type, payload, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [op.id, op.type, JSON.stringify(op.payload), op.status, op.error, op.createdAt],
    );
    return op;
  }

  async listPending(): Promise<QueuedOp[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(`SELECT * FROM op_queue WHERE status = 'pending' ORDER BY created_at ASC`);
    return rows.map(rowToOp);
  }

  async listAll(): Promise<QueuedOp[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(`SELECT * FROM op_queue ORDER BY created_at ASC`);
    return rows.map(rowToOp);
  }

  async markSynced(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(`UPDATE op_queue SET status = 'synced' WHERE id = ?`, [id]);
  }

  async markFailed(id: string, error: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(`UPDATE op_queue SET status = 'failed', error = ? WHERE id = ?`, [error, id]);
  }
}

function rowToOp(row: any): QueuedOp {
  return {
    id: row.id,
    type: row.type,
    payload: JSON.parse(row.payload),
    status: row.status,
    error: row.error,
    createdAt: row.created_at,
  };
}