import { mkdirSync, readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class JsonFileStore<T> {
  private writeChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly label: string,
  ) {}

  read(fallback: T): T {
    try {
      const raw = readFileSync(this.filePath, "utf8");
      return JSON.parse(raw) as T;
    } catch (error) {
      if (isMissingFileError(error)) {
        return fallback;
      }

      console.error(`failed to read ${this.label}`, error);
      return fallback;
    }
  }

  scheduleWrite(value: T): void {
    const payload = JSON.stringify(value, null, 2);
    this.writeChain = this.writeChain
      .catch(() => undefined)
      .then(async () => {
        mkdirSync(dirname(this.filePath), { recursive: true });
        const tempPath = `${this.filePath}.tmp`;
        await writeFile(tempPath, payload, "utf8");
        await rename(tempPath, this.filePath);
      })
      .catch((error) => {
        console.error(`failed to write ${this.label}`, error);
      });
  }

  async flush(): Promise<void> {
    await this.writeChain;
  }
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT",
  );
}
