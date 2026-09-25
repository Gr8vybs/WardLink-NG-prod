export type QueuedOpType = "fieldOp" | "note" | "handoffCreate" | "acknowledge";

export interface QueuedOp {
  id: string;
  type: QueuedOpType;
  payload: unknown;
  status: "pending" | "synced" | "failed";
  error: string | null;
  createdAt: string;
}

export interface OpQueueStorage {
  enqueue(type: QueuedOpType, payload: unknown): Promise<QueuedOp>;
  listPending(): Promise<QueuedOp[]>;
  listAll(): Promise<QueuedOp[]>;
  markSynced(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}