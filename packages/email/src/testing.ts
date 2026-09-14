// Test-only driver. Deliberately NOT exported from "." — nothing in the app
// should be able to reach for an in-memory transport by accident.
import type { EmailTransportDriver, OutgoingEmail } from "./transport.ts";

export interface MemoryTransportDriver extends EmailTransportDriver {
  readonly sent: OutgoingEmail[];
  clear(): void;
}

export function memoryDriver({ failWith }: { failWith?: Error } = {}): MemoryTransportDriver {
  const sent: OutgoingEmail[] = [];
  return {
    kind: "memory",
    sent,
    clear() {
      sent.length = 0;
    },
    send(message) {
      if (failWith) return Promise.reject(failWith);
      sent.push(message);
      return Promise.resolve({ messageId: `memory-${sent.length}` });
    },
    verify() {
      return failWith ? Promise.reject(failWith) : Promise.resolve();
    },
  };
}
