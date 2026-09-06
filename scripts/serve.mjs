import http from "node:http";
import { realpathSync } from "node:fs";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

// Keep development credentials and files outside the project off the static host,
// including access through symlinks. The game still uses native ES modules.
export function createStaticServer(root = process.cwd()) {
  const publicRoot = realpathSync(root);
  const isPublicFile = (file) => {
    const relative = path.relative(publicRoot, file);
    return (
      relative !== "" &&
      !path.isAbsolute(relative) &&
      !relative.split(/[\\/]/).some((part) => part.startsWith("."))
    );
  };

  return http.createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
    } catch {
      response.writeHead(400).end("Bad request");
      return;
    }
    if (
      pathname.includes("\0") ||
      pathname.split(/[\\/]/).some((part) => part.startsWith("."))
    ) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    const file = path.resolve(
      publicRoot,
      "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname),
    );
    if (!isPublicFile(file)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    try {
      const canonicalFile = await realpath(file);
      if (!isPublicFile(canonicalFile)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const body = await readFile(canonicalFile);
      response
        .writeHead(200, {
          "Content-Type":
            types[path.extname(file)] || "application/octet-stream",
          "Cache-Control": "no-cache",
          "Content-Length": body.length,
        })
        .end(request.method === "HEAD" ? undefined : body);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const server = createStaticServer();
  server.listen(Number(process.env.PORT || 4173), "127.0.0.1", () => {
    console.log("Xe Ôm Chaos: http://localhost:" + server.address().port);
  });
}
