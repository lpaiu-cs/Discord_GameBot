import { GameManager } from "../game/game";
import { Ruleset } from "../game/model";
import {
  buildPracticeScenarioDefinitions,
  createPracticeGame,
  PracticeScenarioDefinition,
  PracticeStep,
} from "./practice-scenarios";
import { DashboardAccessService } from "../web/access";
import { JoinTicketService } from "../web/join-ticket";
import { FixedBaseUrlProvider } from "../web/public-base-url";
import { SessionStore } from "../web/session-store";
import { DashboardServer } from "../web/server";

const DEFAULT_PORT = 3014;

async function main(): Promise<void> {
  const port = readInteger("DEV_PRACTICE_PORT", DEFAULT_PORT);
  const ruleset = readRuleset(process.env.PRACTICE_RULESET ?? "balance");
  const practiceBaseUrl = `http://localhost:${port}`;

  const manager = new GameManager();
  const definitions = selectPracticeScenarios(buildPracticeScenarioDefinitions(), process.env.PRACTICE_SCENARIO ?? "practice1");
  const games = definitions.map((definition) => ({
    definition,
    ...createPracticeGame(manager, definition, ruleset),
  }));

  const joinTicketService = new JoinTicketService(process.env.JOIN_TICKET_SECRET ?? "practice-join-ticket-secret");
  const sessionStore = new SessionStore(process.env.WEB_SESSION_SECRET ?? "practice-web-session-secret");
  const dashboardAccess = new DashboardAccessService(
    new FixedBaseUrlProvider(practiceBaseUrl),
    joinTicketService,
    5 * 60 * 1000,
  );
  const server = new DashboardServer({
    client: {} as never,
    gameManager: manager,
    joinTicketService,
    sessionStore,
    port,
  });

  await server.listen();

  const runtimeHandles = games.flatMap(({ definition, game, steps }) => startPracticeScenario(definition, game, steps));
  const links = await Promise.all(
    games.map(async ({ definition, game }) => ({
      id: definition.id,
      title: definition.title,
      summary: definition.summary,
      url: await dashboardAccess.issueJoinUrl(game.id, "practice-viewer"),
    })),
  );

  console.log("");
  console.log("[web-practice] practice server is ready");
  console.log(`[web-practice] ruleset=${ruleset} port=${port}`);
  console.log(`[web-practice] selected=${definitions.map((definition) => definition.id).join(", ")}`);
  console.log("[web-practice] open the URLs below. each scenario keeps a separate per-game session cookie.");
  for (const link of links) {
    console.log("");
    console.log(`[web-practice] ${link.title}`);
    console.log(`[web-practice] ${link.summary}`);
    console.log(`[web-practice] open: ${link.url}`);
  }
  console.log("");
  console.log("[web-practice] scenarios auto-play for about two in-game days.");
  console.log("[web-practice] you can still send chat and submit actions while the scripted timeline runs.");
  console.log("[web-practice] press Ctrl+C to stop");
  console.log("");

  const shutdown = async () => {
    for (const handle of runtimeHandles) {
      clearTimeout(handle);
    }
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

function startPracticeScenario(
  definition: PracticeScenarioDefinition,
  game: ReturnType<typeof createPracticeGame>["game"],
  steps: PracticeStep[],
): NodeJS.Timeout[] {
  return steps.map((step) =>
    setTimeout(() => {
      try {
        step.run(game);
        game.bumpStateVersion();
        console.log(`[web-practice] ${definition.id} -> ${step.label}`);
      } catch (error) {
        console.error(`[web-practice] ${definition.id} step failed`, error);
      }
    }, step.afterMs),
  );
}

function readInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) {
    throw new Error(`${name} must be an integer`);
  }

  return value;
}

function readRuleset(value: string): Ruleset {
  if (value === "initial" || value === "balance") {
    return value;
  }

  throw new Error(`unsupported PRACTICE_RULESET: ${value}`);
}

function selectPracticeScenarios(
  definitions: PracticeScenarioDefinition[],
  rawSelection: string,
): PracticeScenarioDefinition[] {
  if (rawSelection === "all") {
    return definitions;
  }

  const selected = definitions.find((definition) => definition.id === rawSelection);
  if (!selected) {
    throw new Error(`unsupported PRACTICE_SCENARIO: ${rawSelection}`);
  }

  return [selected];
}

void main().catch((error) => {
  console.error("[web-practice] failed to start", error);
  process.exit(1);
});
