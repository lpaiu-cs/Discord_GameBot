import { resolve as resolvePath } from "node:path";
import { readFile } from "node:fs/promises";
import { RouteContext } from "./context";
import { sendJson } from "./utils";

export async function handleResource(ctx: RouteContext, filename: string): Promise<void> {
  const resourceDir = resolvePath(__dirname, "../../../resource");
  const filePath = resolvePath(resourceDir, filename);
  if (!filePath.startsWith(resourceDir)) {
    sendJson(ctx.response, 403, { error: "접근이 거부되었습니다." });
    return;
  }

  try {
    const data = await readFile(filePath);
    ctx.response.statusCode = 200;
    let contentType = "application/octet-stream";
    if (filename.endsWith(".svg")) contentType = "image/svg+xml";
    else if (filename.endsWith(".png")) contentType = "image/png";
    else if (filename.endsWith(".mp3")) contentType = "audio/mpeg";
    ctx.response.setHeader("content-type", contentType);
    ctx.response.setHeader("cache-control", "public, max-age=86400, immutable");
    ctx.response.end(data);
  } catch {
    sendJson(ctx.response, 404, { error: "리소스를 찾을 수 없습니다." });
  }
}

export async function handleClientAsset(ctx: RouteContext, filename: string): Promise<void> {
  // __dirname 은 src/web/routes/
  const candidateDirs = [
    resolvePath(__dirname, "../client"),
    resolvePath(process.cwd(), "src/web/client"),
    resolvePath(process.cwd(), "dist/web/client"),
  ];

  for (const clientDir of candidateDirs) {
    const filePath = resolvePath(clientDir, filename);
    if (!filePath.startsWith(clientDir)) {
      sendJson(ctx.response, 403, { error: "접근이 거부되었습니다." });
      return;
    }

    try {
      const data = await readFile(filePath);
      ctx.response.statusCode = 200;
      let contentType = "application/octet-stream";
      if (filename.endsWith(".js")) contentType = "application/javascript";
      else if (filename.endsWith(".css")) contentType = "text/css";
      ctx.response.setHeader("content-type", contentType);
      ctx.response.setHeader("cache-control", "public, max-age=86400");
      ctx.response.end(data);
      return;
    } catch {
      // 다음 후보 경로를 확인한다.
    }
  }

  sendJson(ctx.response, 404, { error: "클라이언트 자산을 찾을 수 없습니다." });
}
