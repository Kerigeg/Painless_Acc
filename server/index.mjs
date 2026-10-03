import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { createEnkaHandler } from "./enka.mjs";
import { createAccounts } from "./accounts.mjs";
const accounts = createAccounts();
const root = resolve("dist");
const api = createEnkaHandler();
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const server = createServer(async (req, res) => {
  if (await accounts.handler(req, res)) return;
  if (await api(req, res)) return;
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end();
      return;
    }
    const path = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    let file = resolve(root, "." + path);
    if (file !== root && !file.startsWith(root + "/")) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (path === "/") file = resolve(root, "index.html");
    try {
      if (!(await stat(file)).isFile()) throw Error();
    } catch {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.setHeader(
      "Content-Type",
      types[extname(file)] ?? "application/octet-stream",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(req.method === "HEAD" ? undefined : await readFile(file));
  } catch {
    res.writeHead(500);
    res.end("Unable to serve request");
  }
});
server.listen(
  Number(process.env.PORT ?? 5173),
  process.env.HOST ?? "127.0.0.1",
  () => console.log("Teyvat Clinic server ready"),
);
