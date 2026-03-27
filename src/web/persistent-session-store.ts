import { InMemorySessionStore, WebSession } from "./session-store";
import { JsonFileStore } from "../persistence/json-file-store";

interface SessionStoreSnapshot {
  sessions: WebSession[];
  currentByGameUser: Array<[string, string]>;
}

export class PersistentSessionStore extends InMemorySessionStore {
  private readonly fileStore: JsonFileStore<SessionStoreSnapshot>;
  private persistTimer: NodeJS.Timeout | null = null;

  constructor(
    secret: string,
    filePath: string,
    maxIdleMs?: number,
  ) {
    super(secret, maxIdleMs);
    this.fileStore = new JsonFileStore(filePath, "session store");
    const snapshot = this.fileStore.read({ sessions: [], currentByGameUser: [] });
    this.loadSnapshot(snapshot);
  }

  override create(gameId: string, discordUserId: string): WebSession {
    const session = super.create(gameId, discordUserId);
    this.schedulePersist();
    return session;
  }

  override get(sessionId: string): WebSession | null {
    const session = super.get(sessionId);
    if (!session) {
      this.schedulePersist();
    }
    return session;
  }

  override touch(sessionId: string): WebSession | null {
    const session = super.touch(sessionId);
    this.schedulePersist();
    return session;
  }

  override invalidate(sessionId: string): void {
    super.invalidate(sessionId);
    this.schedulePersist();
  }

  override invalidateForGameUser(gameId: string, discordUserId: string): void {
    super.invalidateForGameUser(gameId, discordUserId);
    this.schedulePersist();
  }

  override invalidateGame(gameId: string): void {
    super.invalidateGame(gameId);
    this.schedulePersist();
  }

  public async flush(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
      this.fileStore.scheduleWrite(this.snapshotState());
    }

    await this.fileStore.flush();
  }

  private schedulePersist(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.fileStore.scheduleWrite(this.snapshotState());
    }, 100);
    this.persistTimer.unref?.();
  }
}
