import { IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { GameRegistry, InMemoryGameRegistry } from "../game/game";
import { requireSessionForWs } from "./routes/utils";
import { buildDashboardState } from "./presenter";
import { SessionStore } from "./session-store";

export interface WsServerOptions {
  gameManager: GameRegistry;
  sessionStore: SessionStore;
  cookieBaseName: string;
}

export class DashboardWsServer {
  private readonly wss: WebSocketServer;

  constructor(private readonly options: WsServerOptions) {
    this.wss = new WebSocketServer({ noServer: true });

    this.options.gameManager.onGameStateChange = (gameId: string) => {
      this.broadcastGameState(gameId);
    };
  }

  public handleUpgrade(request: IncomingMessage, socket: any, head: Buffer): void {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const match = url.pathname.match(/^\/api\/game\/([^/]+)\/ws$/u);
    if (!match) {
      socket.destroy();
      return;
    }
    
    const gameId = match[1];
    const session = requireSessionForWs(request, gameId, this.options.cookieBaseName, this.options.sessionStore);
    if (!session) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    this.wss.handleUpgrade(request, socket, head, (ws) => {
      (ws as any).gameId = gameId;
      (ws as any).discordUserId = session.discordUserId;
      this.wss.emit("connection", ws, request);
    });
  }

  public broadcastGameState(gameId: string): void {
    const game = this.options.gameManager.findByGameId(gameId);
    if (!game) return;

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const clientGameId = (client as any).gameId;
        const userId = (client as any).discordUserId;
        if (clientGameId === gameId && userId) {
          try {
            const payload = buildDashboardState(game, userId);
            client.send(JSON.stringify({ type: "state", payload }));
          } catch (e) {
            // Ignore
          }
        }
      }
    });
  }
}
