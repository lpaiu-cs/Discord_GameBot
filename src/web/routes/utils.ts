import { ServerResponse } from "node:http";

export function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  const json = JSON.stringify(payload);
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(json);
}

export function sendHtml(response: ServerResponse, statusCode: number, html: string): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(html);
}
