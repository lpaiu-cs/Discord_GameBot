import { InMemoryJoinTicketStore } from "./join-ticket";
import { JsonFileStore } from "../persistence/json-file-store";

interface JoinTicketStoreSnapshot {
  usedTicketIds: Array<[string, number]>;
}

export class PersistentJoinTicketStore extends InMemoryJoinTicketStore {
  private readonly fileStore: JsonFileStore<JoinTicketStoreSnapshot>;
  private persistTimer: NodeJS.Timeout | null = null;

  constructor(filePath: string) {
    super();
    this.fileStore = new JsonFileStore(filePath, "join ticket store");
    const snapshot = this.fileStore.read({ usedTicketIds: [] });
    this.loadEntries(snapshot.usedTicketIds);
  }

  override isUsed(jti: string): boolean {
    const used = super.isUsed(jti);
    this.schedulePersist();
    return used;
  }

  override markUsed(jti: string, expiresAt: number): void {
    super.markUsed(jti, expiresAt);
    this.schedulePersist();
  }

  public async flush(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
      this.fileStore.scheduleWrite({
        usedTicketIds: this.snapshotEntries(),
      });
    }

    await this.fileStore.flush();
  }

  private schedulePersist(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.fileStore.scheduleWrite({
        usedTicketIds: this.snapshotEntries(),
      });
    }, 50);
    this.persistTimer.unref?.();
  }
}
