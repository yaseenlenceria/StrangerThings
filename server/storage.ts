// No storage needed for this real-time voice chat app
// All state is managed in-memory via WebSocket connections
export interface IStorage {}

export class MemStorage implements IStorage {
  constructor() {}
}

export const storage = new MemStorage();
