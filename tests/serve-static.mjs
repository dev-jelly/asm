import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.ASM_E2E_PORT ?? "4173", 10);
const outputRoot = resolve("dist/client");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

if (!existsSync(join(outputRoot, "index.html"))) {
  throw new Error("dist/client/index.html이 없습니다. 먼저 npm run build를 실행하세요.");
}

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`);
  if (requestUrl.pathname === "/asm") {
    response.writeHead(308, { location: "/asm/" });
    response.end();
    return;
  }

  const relativePath = requestUrl.pathname.startsWith("/asm/")
    ? requestUrl.pathname.slice("/asm/".length)
    : requestUrl.pathname.slice(1);
  const decodedPath = decodeURIComponent(relativePath);
  const normalizedPath = normalize(decodedPath || "index.html").replace(
    /^(\.\.(\/|\\|$))+/,
    "",
  );
  const filePath = resolve(join(outputRoot, normalizedPath));

  if (
    !filePath.startsWith(outputRoot) ||
    !existsSync(filePath) ||
    !statSync(filePath).isFile()
  ) {
    const notFoundPath = join(outputRoot, "404.html");
    response.writeHead(404, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    createReadStream(notFoundPath).pipe(response);
    return;
  }

  response.writeHead(200, {
    "content-type":
      contentTypes[extname(filePath)] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
  process.stdout.write(`ASM LAB static server: http://${host}:${port}/asm/\n`);
});

const close = () => server.close(() => process.exit(0));
process.on("SIGINT", close);
process.on("SIGTERM", close);
