import * as Phaser from "phaser";

import type {
  MemoryWalkCallbacks,
  MemoryWalkController,
  MemoryWalkMemory,
} from "./types";

const WORLD_WIDTH = 3600;
const WORLD_HEIGHT = 720;
const START_X = 150;
const END_X = 3420;
const FINAL_MEMORY_X = 3158;
const WALK_SPEED = 176;
const INTERACT_DISTANCE = 138;

type TiledProperty = {
  name: string;
  type: string;
  value: string;
};

type TiledObject = {
  id: number;
  name: string;
  properties?: TiledProperty[];
  type: string;
  x: number;
  y: number;
};

type TiledMap = {
  layers: Array<{
    name: string;
    objects?: TiledObject[];
    type: string;
  }>;
};

type Board = {
  container: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Rectangle;
  id: string;
  x: number;
};

type CreateMemoryWalkOptions = {
  callbacks: MemoryWalkCallbacks;
  memories: MemoryWalkMemory[];
  parent: HTMLElement;
  reducedMotion: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getProperty(object: TiledObject, propertyName: string) {
  return object.properties?.find((property) => property.name === propertyName)
    ?.value;
}

function pathY(x: number) {
  return 584 + Math.sin(x / 420) * 8 + (x / WORLD_WIDTH) * 5;
}

class MemoryPathScene extends Phaser.Scene {
  private callbacks: MemoryWalkCallbacks;
  private memories: MemoryWalkMemory[];
  private reducedMotion: boolean;
  private boards: Board[] = [];
  private lanternGlows: Phaser.GameObjects.Arc[] = [];
  private player!: Phaser.GameObjects.Sprite;
  private nightWash!: Phaser.GameObjects.Rectangle;
  private starVeil!: Phaser.GameObjects.Container;
  private targetX = START_X;
  private heldDirection: -1 | 0 | 1 = 0;
  private maxProgress = 0;
  private lastProgressSent = -1;
  private nearestMemoryId: string | null = null;
  private isWalking = false;
  private isPaused = false;
  private walkFrameElapsed = 0;
  private walkFrame = 0;

  constructor(options: Omit<CreateMemoryWalkOptions, "parent">) {
    super({ key: "memory-path" });
    this.callbacks = options.callbacks;
    this.memories = options.memories;
    this.reducedMotion = options.reducedMotion;
  }

  preload() {
    this.load.image(
      "park-panorama",
      "/assets/memory-walk/park-panorama.webp",
    );
    this.load.image("shade-side-idle", "/assets/shade/side-idle.png");
    this.load.image("shade-right-1", "/assets/shade/right-1.png");
    this.load.image("shade-right-2", "/assets/shade/right-2.png");
    this.load.json(
      "memory-path-map",
      "/assets/memory-walk/memory-path.tmj",
    );
  }

  create() {
    this.cameras.main.setBackgroundColor("#130f1c");
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.add
      .image(WORLD_WIDTH / 2, 360, "park-panorama")
      .setDisplaySize(WORLD_WIDTH, 1200)
      .setDepth(0);

    this.drawAtmosphere();
    this.drawLandmarks();
    this.createBoards();
    this.createFireflies();

    this.player = this.add
      .sprite(START_X, pathY(START_X), "shade-side-idle")
      .setOrigin(0.5, 1)
      .setScale(0.82)
      .setDepth(55);

    const camera = this.cameras.main;
    camera.startFollow(
      this.player,
      true,
      this.reducedMotion ? 1 : 0.075,
      this.reducedMotion ? 1 : 0.12,
      -80,
      42,
    );
    this.updateCameraZoom(this.scale.width, this.scale.height);

    this.scale.on("resize", (gameSize: Phaser.Structs.Size) => {
      this.updateCameraZoom(gameSize.width, gameSize.height);
      this.nightWash.setDisplaySize(
        gameSize.width / camera.zoom + 8,
        gameSize.height / camera.zoom + 8,
      );
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.isPaused) {
        return;
      }

      this.heldDirection = 0;
      this.targetX = clamp(pointer.worldX, START_X, END_X);
    });

    this.callbacks.onReady();
    this.callbacks.onProgressChange(0);
  }

  update(_time: number, delta: number) {
    if (this.isPaused) {
      this.setWalking(false);
      return;
    }

    if (this.heldDirection !== 0) {
      this.targetX = clamp(
        this.player.x + this.heldDirection * WALK_SPEED * (delta / 1000),
        START_X,
        END_X,
      );
    }

    const distance = this.targetX - this.player.x;
    const walking = Math.abs(distance) > 1;

    if (walking) {
      const direction = Math.sign(distance) as -1 | 1;
      const step = Math.min(Math.abs(distance), WALK_SPEED * (delta / 1000));
      this.player.x += direction * step;
      this.player.y = pathY(this.player.x);
      this.player.setFlipX(direction < 0);
      this.animateWalk(delta);
    } else {
      this.player.setTexture("shade-side-idle");
    }

    this.setWalking(walking);
    this.updateProgress();
    this.updateNearestMemory();
  }

  move(direction: -1 | 0 | 1) {
    this.heldDirection = direction;
    if (direction !== 0) {
      this.targetX = direction > 0 ? END_X : START_X;
    } else {
      this.targetX = this.player?.x ?? this.targetX;
    }
  }

  interact() {
    if (this.nearestMemoryId) {
      this.callbacks.onOpenMemory(this.nearestMemoryId);
    }
  }

  walkToMemory(memoryId: string) {
    const board = this.boards.find((candidate) => candidate.id === memoryId);
    if (!board) {
      return;
    }

    this.heldDirection = 0;
    this.targetX = clamp(board.x - 72, START_X, END_X);
  }

  setPaused(paused: boolean) {
    this.isPaused = paused;
    if (paused) {
      this.heldDirection = 0;
      this.targetX = this.player?.x ?? this.targetX;
    }
  }

  setReducedMotion(reducedMotion: boolean) {
    this.reducedMotion = reducedMotion;
    if (this.player) {
      this.cameras.main.setLerp(
        reducedMotion ? 1 : 0.075,
        reducedMotion ? 1 : 0.12,
      );
    }
  }

  private updateCameraZoom(width: number, height: number) {
    const zoom = clamp(height / WORLD_HEIGHT, 0.72, 1);
    this.cameras.main.setZoom(zoom);
    this.cameras.main.setViewport(0, 0, width, height);
  }

  private animateWalk(delta: number) {
    if (this.reducedMotion) {
      this.player.setTexture("shade-right-1");
      return;
    }

    this.walkFrameElapsed += delta;
    if (this.walkFrameElapsed < 165) {
      return;
    }

    this.walkFrameElapsed = 0;
    this.walkFrame = (this.walkFrame + 1) % 2;
    this.player.setTexture(
      this.walkFrame === 0 ? "shade-right-1" : "shade-right-2",
    );
  }

  private setWalking(walking: boolean) {
    if (this.isWalking === walking) {
      return;
    }

    this.isWalking = walking;
    this.callbacks.onWalkingChange(walking);
  }

  private updateProgress() {
    const currentProgress = clamp(
      (this.player.x - START_X) / (FINAL_MEMORY_X - START_X),
      0,
      1,
    );
    this.maxProgress = Math.max(this.maxProgress, currentProgress);

    const dusk = clamp((this.maxProgress - 0.22) / 0.78, 0, 1);
    this.nightWash.setAlpha(dusk * 0.24);
    this.starVeil.setAlpha(clamp((this.maxProgress - 0.48) / 0.45, 0, 1));
    this.lanternGlows.forEach((glow, index) => {
      const activation = clamp(
        (this.maxProgress - (0.34 + index * 0.045)) / 0.24,
        0,
        1,
      );
      glow.setAlpha(activation * (index % 2 === 0 ? 0.34 : 0.24));
    });

    if (Math.abs(this.maxProgress - this.lastProgressSent) >= 0.004) {
      this.lastProgressSent = this.maxProgress;
      this.callbacks.onProgressChange(this.maxProgress);
    }
  }

  private updateNearestMemory() {
    let nearest: Board | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;

    this.boards.forEach((board) => {
      const distance = Math.abs(board.x - this.player.x);
      const isNear = distance < INTERACT_DISTANCE;
      board.glow.setAlpha(isNear ? 0.88 : 0.2 + this.maxProgress * 0.12);
      board.container.setScale(isNear && !this.reducedMotion ? 1.04 : 1);

      if (distance < nearestDistance) {
        nearest = board;
        nearestDistance = distance;
      }
    });

    const nextNearestId =
      nearest && nearestDistance < INTERACT_DISTANCE ? nearest.id : null;

    if (this.nearestMemoryId !== nextNearestId) {
      this.nearestMemoryId = nextNearestId;
      this.callbacks.onNearestMemoryChange(nextNearestId);
    }
  }

  private createBoards() {
    const map = this.cache.json.get("memory-path-map") as TiledMap;
    const objectLayer = map.layers.find(
      (layer) => layer.type === "objectgroup" && layer.name === "Memory Stops",
    );
    const memoryObjects = objectLayer?.objects ?? [];

    memoryObjects.forEach((object, index) => {
      const memoryId = getProperty(object, "memoryId");
      const memory = this.memories.find((item) => item.id === memoryId);
      if (!memory || !memoryId) {
        return;
      }

      const x = object.x;
      const y = pathY(x) + 2;
      const glow = this.add
        .rectangle(x, y - 89, 132, 156, 0xffd47a, 0.2)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(28);
      const container = this.add.container(x, y).setDepth(32);
      const graphics = this.add.graphics();

      graphics.fillStyle(0x2a1527, 0.42);
      graphics.fillRect(-43, -126, 92, 112);
      graphics.fillStyle(0x5b2f2b, 1);
      graphics.fillRect(-39, -130, 78, 104);
      graphics.fillStyle(0x9b5940, 1);
      graphics.fillRect(-32, -122, 64, 88);
      graphics.fillStyle(0x3d2030, 1);
      graphics.fillRect(-26, -116, 52, 76);
      graphics.fillStyle(0xffefd1, 1);
      graphics.fillRect(-19, -91, 38, 42);
      graphics.fillStyle(0x6b3a2d, 1);
      graphics.fillRect(-30, -26, 13, 35);
      graphics.fillRect(17, -26, 13, 35);
      graphics.fillStyle(0xffd166, 1);
      graphics.fillRect(-23, -111, 7, 7);

      const number = this.add
        .text(0, -70, `${index + 1}`, {
          color: "#2b1b2f",
          fontFamily: "monospace",
          fontSize: "20px",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      const heart = this.add
        .text(0, -106, "♥", {
          color: "#ffd166",
          fontFamily: "serif",
          fontSize: "15px",
        })
        .setOrigin(0.5);

      container.add([graphics, number, heart]);
      this.boards.push({ container, glow, id: memoryId, x });
    });
  }

  private drawAtmosphere() {
    this.nightWash = this.add
      .rectangle(0, 0, this.scale.width + 8, this.scale.height + 8, 0x0d1639, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setDepth(80);

    this.starVeil = this.add.container(0, 0).setScrollFactor(0).setDepth(81).setAlpha(0);
    const colors = [0xffe3a0, 0xd8ddff, 0xb7a3ff];
    for (let index = 0; index < 46; index += 1) {
      const x = 34 + ((index * 193) % 1180);
      const y = 28 + ((index * 83) % 280);
      const size = index % 7 === 0 ? 3 : 2;
      const star = this.add.rectangle(
        x,
        y,
        size,
        size,
        colors[index % colors.length],
        0.34 + (index % 4) * 0.12,
      );
      this.starVeil.add(star);

      if (!this.reducedMotion && index % 4 === 0) {
        this.tweens.add({
          targets: star,
          alpha: 0.18,
          duration: 900 + (index % 5) * 220,
          yoyo: true,
          repeat: -1,
          delay: index * 37,
        });
      }
    }
  }

  private drawLandmarks() {
    this.drawSwing(300, pathY(300));
    this.drawPicnic(800, pathY(800));
    this.drawGarden(1330, pathY(1330));
    this.drawBench(1880, pathY(1880));
    this.drawLanternGrove(2420, pathY(2420));
    this.drawOverlook(3060, pathY(3060));

    for (let x = 110; x < WORLD_WIDTH; x += 118) {
      const plant = this.add.graphics({ x, y: pathY(x) + 2 });
      const nightSide = x / WORLD_WIDTH;
      plant.fillStyle(nightSide > 0.58 ? 0x1a3a39 : 0x5b4933, 0.94);
      plant.fillRect(-2, -22 - (x % 13), 4, 25 + (x % 13));
      plant.fillRect(-9, -15, 8, 4);
      plant.fillRect(2, -10, 9, 4);
      plant.fillStyle(x % 3 === 0 ? 0xf5b46c : 0x8c7bd8, 0.92);
      plant.fillRect(-5, -29 - (x % 13), 7, 7);
      plant.setDepth(60);
    }
  }

  private drawSwing(x: number, y: number) {
    const art = this.add.graphics({ x, y }).setDepth(18);
    art.lineStyle(9, 0x4b2842, 1);
    art.beginPath();
    art.moveTo(-98, 4);
    art.lineTo(-62, -180);
    art.lineTo(62, -180);
    art.lineTo(98, 4);
    art.strokePath();
    art.lineStyle(3, 0xf2bc79, 0.7);
    art.lineBetween(-38, -172, -30, -44);
    art.lineBetween(38, -172, 30, -44);
    art.fillStyle(0x67392f, 1);
    art.fillRect(-46, -47, 92, 13);
  }

  private drawPicnic(x: number, y: number) {
    const art = this.add.graphics({ x, y }).setDepth(24);
    art.fillStyle(0x281d2e, 0.25);
    art.fillEllipse(0, -4, 150, 28);
    art.fillStyle(0xb95166, 1);
    art.fillRect(-66, -30, 132, 48);
    art.fillStyle(0xffd991, 0.9);
    for (let stripe = -60; stripe <= 54; stripe += 24) {
      art.fillRect(stripe, -30, 10, 48);
    }
    art.fillStyle(0xb16c3f, 1);
    art.fillCircle(-20, -38, 12);
    art.fillCircle(8, -42, 10);
  }

  private drawGarden(x: number, y: number) {
    const art = this.add.graphics({ x, y }).setDepth(26);
    const colors = [0xf4a1a8, 0xffd166, 0x9f85d8, 0x74c6aa];
    for (let index = 0; index < 32; index += 1) {
      const flowerX = -120 + ((index * 43) % 240);
      const flowerY = -12 - ((index * 29) % 72);
      art.fillStyle(0x34563f, 0.9);
      art.fillRect(flowerX, flowerY, 3, Math.abs(flowerY));
      art.fillStyle(colors[index % colors.length], 1);
      art.fillRect(flowerX - 3, flowerY - 5, 8, 8);
    }
  }

  private drawBench(x: number, y: number) {
    const art = this.add.graphics({ x, y }).setDepth(24);
    art.fillStyle(0x332037, 0.34);
    art.fillRect(-88, -5, 176, 16);
    art.fillStyle(0x6b3b35, 1);
    art.fillRect(-78, -72, 156, 18);
    art.fillRect(-78, -47, 156, 17);
    art.fillRect(-72, -25, 144, 13);
    art.fillStyle(0x3d2933, 1);
    art.fillRect(-63, -13, 12, 40);
    art.fillRect(51, -13, 12, 40);
  }

  private drawLanternGrove(x: number, y: number) {
    for (let index = 0; index < 5; index += 1) {
      const lampX = x - 150 + index * 74;
      const lampHeight = 104 + (index % 2) * 24;
      const art = this.add.graphics({ x: lampX, y }).setDepth(22);
      art.fillStyle(0x26223a, 1);
      art.fillRect(-4, -lampHeight, 8, lampHeight + 10);
      art.fillRect(-13, -lampHeight, 26, 6);
      art.fillStyle(0xffdc89, 1);
      art.fillRect(-9, -lampHeight - 23, 18, 23);
      const glow = this.add
        .circle(lampX, y - lampHeight - 12, 46, 0xffd166, 0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(21);
      this.lanternGlows.push(glow);
    }
  }

  private drawOverlook(x: number, y: number) {
    const art = this.add.graphics({ x, y }).setDepth(24);
    art.fillStyle(0x2d1d38, 0.42);
    art.fillEllipse(0, 2, 244, 30);
    art.fillStyle(0x4f3150, 1);
    art.fillRect(-110, -8, 220, 12);
    art.fillStyle(0x283557, 1);
    art.fillRect(-78, -30, 156, 30);
    art.lineStyle(6, 0x35253f, 1);
    art.lineBetween(64, -22, 101, -106);
    art.lineBetween(78, -62, 122, -52);
    art.fillStyle(0xd3c9ff, 1);
    art.fillCircle(125, -52, 9);
  }

  private createFireflies() {
    for (let index = 0; index < 34; index += 1) {
      const x = 1840 + ((index * 137) % 1640);
      const y = 310 + ((index * 71) % 236);
      const firefly = this.add
        .rectangle(x, y, index % 5 === 0 ? 5 : 3, index % 5 === 0 ? 5 : 3, 0xffe18a, 0.18)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(44);
      if (!this.reducedMotion) {
        this.tweens.add({
          targets: firefly,
          alpha: 0.9,
          x: x + 10 - (index % 3) * 10,
          y: y - 12 - (index % 4) * 4,
          duration: 1500 + (index % 6) * 280,
          yoyo: true,
          repeat: -1,
          delay: index * 83,
          ease: "Sine.easeInOut",
        });
      }
    }
  }
}

export function createMemoryWalkGame(
  options: CreateMemoryWalkOptions,
): MemoryWalkController {
  const scene = new MemoryPathScene({
    callbacks: options.callbacks,
    memories: options.memories,
    reducedMotion: options.reducedMotion,
  });

  const game = new Phaser.Game({
    backgroundColor: "#130f1c",
    canvasStyle: "display:block;width:100%;height:100%;",
    parent: options.parent,
    pixelArt: true,
    render: {
      antialias: false,
      powerPreference: "high-performance",
      roundPixels: true,
    },
    scale: {
      height: options.parent.clientHeight,
      mode: Phaser.Scale.RESIZE,
      width: options.parent.clientWidth,
    },
    scene,
    transparent: false,
    type: Phaser.AUTO,
  });

  return {
    destroy() {
      game.destroy(true);
    },
    interact() {
      scene.interact();
    },
    move(direction) {
      scene.move(direction);
    },
    setPaused(paused) {
      scene.setPaused(paused);
    },
    setReducedMotion(reducedMotion) {
      scene.setReducedMotion(reducedMotion);
    },
    walkToMemory(memoryId) {
      scene.walkToMemory(memoryId);
    },
  };
}
