import { SqliteOpQueue } from "./sqliteOpQueue";

/** Single shared queue instance for the whole app. */
export const opQueue = new SqliteOpQueue();