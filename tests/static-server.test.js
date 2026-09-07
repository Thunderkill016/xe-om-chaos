import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createStaticServer } from "../scripts/serve.mjs";

test("static server serves .mjs modules as JavaScript", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "xeom-static-"));
  const moduleSource = "export const engine = 'playcanvas';\n";
  await writeFile(path.join(root, "engine.mjs"), moduleSource);

  const server = createStaticServer(root);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const response = await fetch(
    `http://127.0.0.1:${address.port}/engine.mjs`,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/javascript");
  assert.equal(await response.text(), moduleSource);
});
