import { ServerResponse, IncomingMessage } from "node:http";
import { Client } from "discord.js";
import { GameManager } from "../../game/game";
import { JoinTicketService } from "../join-ticket";
import { SessionStore, WebSession } from "../session-store";
import { RateLimiter } from "./rate-limit";

export interface RouteContext {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  gameManager: GameManager;
  joinTicketService: JoinTicketService;
  sessionStore: SessionStore;
  secureCookies: boolean;
  userSession?: WebSession;
  client?: Client;
  authRateLimit: RateLimiter;
  stateRateLimit: RateLimiter;
  actionRateLimit: RateLimiter;
  chatRateLimit: RateLimiter;
  cookieBaseName: string;
}
