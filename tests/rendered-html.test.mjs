import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the birthday experience shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>For Shadé<\/title>/i);
  assert.match(html, /Let(?:'|&#x27;)s enter our little world/);
  assert.match(html, /For Shadé/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("keeps birthday content and assets wired in", async () => {
  const [page, memoryContent, layout, packageJson, stylesheet, letter] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/memory-walk/memoryContent.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/birthdayLetter.ts", import.meta.url), "utf8"),
    access(new URL("../public/assets/senior-sunset-swing.png", import.meta.url)),
    access(new URL("../public/assets/shadeSannaStargazing.png", import.meta.url)),
    access(new URL("../public/assets/shade/front.png", import.meta.url)),
    access(new URL("../public/assets/shade/right-1.png", import.meta.url)),
    ...Array.from({ length: 6 }, (_, index) =>
      access(
        new URL(
          `../public/assets/memory-walk/memory${index + 1}.jpeg`,
          import.meta.url,
        ),
      ),
    ),
    access(new URL("../public/photos/README.md", import.meta.url)),
    access(new URL("../public/audio/README.md", import.meta.url)),
    access(new URL("../public/audio/myHoneybeeCover.m4a", import.meta.url)),
    access(
      new URL("../public/assets/To my one and only.md", import.meta.url),
    ),
  ]);

  assert.match(page, /PASSCODES/);
  assert.match(page, /birthdayLetter/);
  assert.match(page, /To my dearest Shadé/);
  assert.match(page, /memoryEpilogue/);
  assert.match(page, /const tracks: Track\[\]/);
  assert.match(page, /\/audio\/myHoneybeeCover\.m4a/);
  assert.match(page, /\/audio\/honeybeeOriginal\.mp3/);
  assert.match(page, /onEnded=\{playNextTrack\}/);
  assert.match(page, /\(current \+ 1\) % tracks\.length/);
  assert.match(page, /https:\/\/formspree\.io\/f\/xaqrnlor/);
  assert.match(page, /async function submitWish/);
  assert.match(page, /method: "POST"/);
  assert.match(page, /Your wish became a little star/);
  assert.match(page, /className="wish-section"/);
  assert.match(page, /I love you, my Shadé/);
  assert.match(page, /A little park built from<\/span>/);
  assert.match(page, /tap or click each little light/i);
  assert.match(page, /foundFireflies\.length === 0/);
  assert.match(letter, /you became home to me/);
  assert.match(letter, /Your hurt is real, Shadé, and I believe it/);
  assert.match(letter, /With all my heart,\\nSanna/);
  assert.match(memoryContent, /The First Time We Showed Up/);
  assert.match(memoryContent, /The Life We Kept Choosing/);
  assert.match(memoryContent, /These memories are not proof/);
  assert.match(memoryContent, /date: "April 2022"/);
  assert.match(memoryContent, /date: "November 2025"/);
  assert.match(stylesheet, /\.heartfall \.cookie::after/);
  assert.match(stylesheet, /@keyframes messageFall/);
  assert.match(stylesheet, /\.memory-coda[\s\S]*background: #171221/);
  assert.match(stylesheet, /\.wish-section[\s\S]*background: #171221/);
  assert.match(stylesheet, /\.wish-card[\s\S]*grid-template-columns/);
  assert.match(stylesheet, /@keyframes wishSentTwinkle/);
  assert.match(stylesheet, /color: rgba\(255, 232, 198, 0\.5\)/);
  assert.match(stylesheet, /\.letter-modal p\.letter-opening/);
  assert.match(stylesheet, /\.letter-modal p\.letter-signature/);
  assert.match(
    stylesheet,
    /\.memory-modal > \.close-button[\s\S]*position: fixed[\s\S]*safe-area-inset-top/,
  );
  assert.match(layout, /private little universe/i);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
