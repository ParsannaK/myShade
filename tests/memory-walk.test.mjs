import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const expectedMemoryIds = [
  "senior-sunset",
  "first-adventure",
  "favorite-laugh",
  "quiet-day",
  "big-dreams",
  "fifty-months",
];

const propSprites = [
  "board",
  "swing",
  "garden",
  "bench",
  "lamppost",
  "stargazing",
  "flower-tuft",
];

test("maps every React memory to one Tiled scene stop", async () => {
  const map = JSON.parse(
    await readFile(
      new URL(
        "../public/assets/memory-walk/memory-path.tmj",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const memoryLayer = map.layers.find((layer) => layer.name === "Memory Stops");
  const ids = memoryLayer.objects.map(
    (object) =>
      object.properties.find((property) => property.name === "memoryId").value,
  );

  assert.deepEqual(ids, expectedMemoryIds);
  assert.equal(new Set(ids).size, ids.length);
});

test("keeps the React-Phaser bridge keyboard and touch accessible", async () => {
  const [component, scene, packageJson] = await Promise.all([
    readFile(
      new URL("../app/memory-walk/MemoryWalk.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/memory-walk/createMemoryWalkGame.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(packageJson, /"phaser"/);
  assert.match(component, /onOpenMemory/);
  assert.match(component, /onProgressChange/);
  assert.match(component, /arrowleft/);
  assert.match(component, /onPointerDown/);
  assert.match(scene, /maxProgress = Math\.max/);
  assert.match(scene, /Phaser\.AUTO/);
  assert.match(scene, /createAmbientParticles/);
  assert.match(scene, /ambientTweens/);
  propSprites.forEach((sprite) => {
    assert.match(scene, new RegExp(`/props/${sprite}\\.webp`));
  });
});

test("ships the cinematic scene under the ten megabyte asset budget", async () => {
  const [panorama, socialCard, ...props] = await Promise.all([
    stat(
      new URL(
        "../public/assets/memory-walk/park-panorama.webp",
        import.meta.url,
      ),
    ),
    stat(new URL("../public/og.png", import.meta.url)),
    ...propSprites.map((sprite) =>
      stat(
        new URL(
          `../public/assets/memory-walk/props/${sprite}.webp`,
          import.meta.url,
        ),
      ),
    ),
  ]);

  assert.ok(panorama.size < 10 * 1024 * 1024);
  assert.ok(
    props.reduce((total, prop) => total + prop.size, 0) < 4 * 1024 * 1024,
  );
  assert.ok(socialCard.size > 0);
});
