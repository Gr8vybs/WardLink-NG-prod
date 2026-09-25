import type { OpQueueStorage, QueuedOp, QueuedOpType } from "./opQueue";

let counter = 0;

export class MemoryOpQueue implements OpQueueStorage {
  private ops: QueuedOp[] = [];

  async enqueue(type: QueuedOpType, payload: unknown): Promise<QueuedOp> {
    const op: QueuedOp = {
      id: `mem-${++counter}`,
      type,
      payload,
      status: "pending",
      error: null,
      createdAt: new Date().toISOString(),
    };
    this.ops.push(op);
    return op;
  }

  async listPending(): Promise<QueuedOp[]> {
    return this.ops.filter((o) => o.status === "pending");
  }

  async listAll(): Promise<QueuedOp[]> {
    return [...this.ops];
  }

  async markSynced(id: string): Promise<void> {
    const op = this.ops.find((o) => o.id === id);
    if (op) op.status = "synced";
  }

  async markFailed(id: string, error: string): Promise<void> {
    const op = this.ops.find((o) => o.id === id);
    if (op) {
      op.status = "failed";
      op.error = error;
    }
  }
}