import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createStore } from "./content-store.mjs";

const adminRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(adminRoot, "public");
const store = createStore();
const host = "127.0.0.1";
const port = Number(process.env.ADMIN_PORT ?? 4317);

const deployState = {
  running: false,
  status: "idle",
  previewUrl: null,
  updatedAt: null,
  log: []
};

let previewProcess = null;

function appendLog(line) {
  deployState.log.push(line);
  deployState.log = deployState.log.slice(-400);
  deployState.updatedAt = new Date().toISOString();
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendError(response, statusCode, error) {
  sendJson(response, statusCode, { error: error instanceof Error ? error.message : String(error) });
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 80 * 1024 * 1024) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function routePath(request) {
  return new URL(request.url, `http://${request.headers.host ?? `${host}:${port}`}`).pathname;
}

async function runCommand(command, args, options = {}) {
  appendLog(`$ ${command} ${args.join(" ")}`);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    child.stdout.on("data", (data) => appendLog(data.toString("utf8").trimEnd()));
    child.stderr.on("data", (data) => appendLog(data.toString("utf8").trimEnd()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}.`));
      }
    });
  });
}

async function startPreview() {
  if (previewProcess) {
    appendLog("Stopping previous local preview.");
    previewProcess.kill("SIGTERM");
    previewProcess = null;
  }

  const previewPort = Number(process.env.ADMIN_PREVIEW_PORT ?? 4322);
  deployState.previewUrl = `http://127.0.0.1:${previewPort}/`;
  appendLog(`Starting local preview on ${deployState.previewUrl}`);
  previewProcess = spawn("npm", ["run", "preview:local", "--", "--port", String(previewPort)], {
    cwd: store.siteRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  previewProcess.stdout.on("data", (data) => appendLog(data.toString("utf8").trimEnd()));
  previewProcess.stderr.on("data", (data) => appendLog(data.toString("utf8").trimEnd()));
  previewProcess.on("exit", (code, signal) => {
    appendLog(`Local preview exited (${signal ?? code}).`);
    if (previewProcess?.exitCode === code) previewProcess = null;
  });
}

function deployLocal() {
  if (deployState.running) {
    return false;
  }

  deployState.running = true;
  deployState.status = "running";
  deployState.log = [];
  appendLog("Local deployment started.");

  (async () => {
    try {
      await runCommand("npm", ["run", "validate:content"], { cwd: store.siteRoot });
      await runCommand("npm", ["run", "build"], { cwd: store.siteRoot });
      await startPreview();
      deployState.status = "success";
      appendLog("Local deployment complete.");
    } catch (error) {
      deployState.status = "failed";
      appendLog(error.message);
    } finally {
      deployState.running = false;
      deployState.updatedAt = new Date().toISOString();
    }
  })();

  return true;
}

async function handleApi(request, response, pathname) {
  try {
    if (request.method === "GET" && pathname === "/api/state") {
      sendJson(response, 200, { ...(await store.readState()), deploy: deployState });
      return;
    }

    if (request.method === "PUT" && pathname === "/api/site") {
      sendJson(response, 200, { site: await store.saveSite(await readJson(request)) });
      return;
    }

    if (request.method === "POST" && pathname === "/api/categories") {
      sendJson(response, 201, { category: await store.createCategory(await readJson(request)), state: await store.readState() });
      return;
    }

    const categoryMatch = pathname.match(/^\/api\/categories\/([a-z0-9-]+)$/);
    if (request.method === "PUT" && categoryMatch) {
      sendJson(response, 200, { category: await store.updateCategory(categoryMatch[1], await readJson(request)), state: await store.readState() });
      return;
    }

    if (request.method === "POST" && pathname === "/api/products") {
      sendJson(response, 201, { product: await store.createProduct(await readJson(request)), state: await store.readState() });
      return;
    }

    const productMatch = pathname.match(/^\/api\/products\/([a-z0-9-]+)$/);
    if (request.method === "PUT" && productMatch) {
      sendJson(response, 200, { product: await store.updateProduct(productMatch[1], await readJson(request)), state: await store.readState() });
      return;
    }

    if (request.method === "POST" && pathname === "/api/deploy/local") {
      if (!deployLocal()) {
        sendJson(response, 409, { deploy: deployState, error: "A local deployment is already running." });
        return;
      }
      sendJson(response, 202, { deploy: deployState });
      return;
    }

    if (request.method === "GET" && pathname === "/api/deploy/status") {
      sendJson(response, 200, { deploy: deployState });
      return;
    }

    sendError(response, 404, "Unknown API endpoint.");
  } catch (error) {
    sendError(response, 400, error);
  }
}

function contentType(filePath) {
  const extension = path.extname(filePath);
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

async function serveStatic(response, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(publicRoot, relative);
  const publicRelative = path.relative(publicRoot, filePath);
  if (publicRelative.startsWith("..") || path.isAbsolute(publicRelative)) {
    sendError(response, 403, "Forbidden.");
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not a file.");
    response.writeHead(200, { "content-type": contentType(filePath) });
    createReadStream(filePath).pipe(response);
  } catch {
    const fallback = path.join(publicRoot, "index.html");
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    createReadStream(fallback).pipe(response);
  }
}

const server = http.createServer(async (request, response) => {
  const pathname = routePath(request);
  if (pathname.startsWith("/api/")) {
    await handleApi(request, response, pathname);
    return;
  }
  await serveStatic(response, pathname);
});

process.on("SIGINT", () => {
  if (previewProcess) previewProcess.kill("SIGTERM");
  server.close(() => process.exit(0));
});

server.listen(port, host, () => {
  console.log(`Carbone Stellaire admin: http://${host}:${port}/`);
});
