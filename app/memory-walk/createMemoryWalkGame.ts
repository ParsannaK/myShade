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
  glow: Phaser.GameObjects.Image;
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
    this.load.image("memory-board", "/assets/memory-walk/props/board.webp");
    this.load.image("prop-swing", "/assets/memory-walk/props/swing.webp");
    this.load.image("prop-picnic", "/assets/memory-walk/props/picnic.webp");
    this.load.image("prop-garden", "/assets/memory-walk/props/garden.webp");
    this.load.image("prop-bench", "/assets/memory-walk/props/bench.webp");
    this.load.image("prop-lamppost", "/assets/memory-walk/props/lamppost.webp");
    this.load.image(
      "prop-stargazing",
      "/assets/memory-walk/props/stargazing.webp",
    );
    this.load.image(
      "prop-flower-tuft",
      "/assets/memory-walk/props/flower-tuft.webp",
    );
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
      board.glow.setAlpha(isNear ? 0.2 : 0.035 + this.maxProgress * 0.015);
      board.container.setScale(isNear && !this.reducedMotion ? 1.025 : 1);

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
        .image(x, y + 6, "memory-board")
        .setOrigin(0.5, 1)
        .setDisplaySize(144, 216)
        .setTintFill(0xffd47a)
        .setAlpha(0.035)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(28);
      const container = this.add.container(x, y).setDepth(32);
      const boardSprite = this.add
        .image(0, 6, "memory-board")
        .setOrigin(0.5, 1)
        .setDisplaySize(132, 198);

      this.add
        .ellipse(x, y + 1, 94, 14, 0x160d1b, 0.3)
        .setDepth(27);

      const number = this.add
        .text(0, -105, `${index + 1}`, {
          color: "#3a2031",
          fontFamily: "monospace",
          fontSize: "19px",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setShadow(0, 1, "rgba(84, 44, 35, 0.22)", 0, false, true);

      container.add([boardSprite, number]);
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

    for (let x = 130; x < WORLD_WIDTH; x += 178) {
      const width = 42 + ((x / 178) % 3) * 7;
      const plant = this.addGroundedProp(
        "prop-flower-tuft",
        x,
        pathY(x) + 5,
        width,
        60,
        0.16,
      );
      plant.setFlipX(Math.floor(x / 178) % 2 === 0);
      if (x > 2300) {
        plant.setTint(0x8292bd);
      } else if (x > 1250) {
        plant.setTint(0xc29cb6);
      }
    }
  }

  private drawSwing(x: number, y: number) {
    this.addGroundedProp("prop-swing", x, y + 3, 276, 18, 0.28);
  }

  private drawPicnic(x: number, y: number) {
    this.addGroundedProp("prop-picnic", x, y + 9, 214, 24, 0.24);
  }

  private drawGarden(x: number, y: number) {
    this.addGroundedProp("prop-garden", x, y + 5, 314, 26, 0.2);
  }

  private drawBench(x: number, y: number) {
    this.addGroundedProp("prop-bench", x, y + 4, 230, 24, 0.27);
  }

  private drawLanternGrove(x: number, y: number) {
    for (let index = 0; index < 5; index += 1) {
      const lampX = x - 150 + index * 74;
      const lampWidth = 82 + (index % 2) * 8;
      const lamp = this.addGroundedProp(
        "prop-lamppost",
        lampX,
        y + 4,
        lampWidth,
        22,
        0.16,
      );
      if (index % 2 === 1) {
        lamp.setFlipX(true);
      }
      const glow = this.add
        .circle(
          lampX + (index % 2 === 1 ? -13 : 13),
          y - lamp.displayHeight * 0.73,
          50,
          0xffd166,
          0,
        )
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(21);
      this.lanternGlows.push(glow);
    }
  }

  private drawOverlook(x: number, y: number) {
    this.addGroundedProp("prop-stargazing", x, y + 5, 252, 24, 0.24);
  }

  private addGroundedProp(
    texture: string,
    x: number,
    y: number,
    width: number,
    depth: number,
    shadowAlpha: number,
  ) {
    const shadow = this.add
      .ellipse(x, y + 1, width * 0.68, Math.max(10, width * 0.055), 0x130c19, shadowAlpha)
      .setDepth(depth - 1);
    shadow.setScale(1, 0.72);

    const image = this.add
      .image(x, y, texture)
      .setOrigin(0.5, 1)
      .setDepth(depth);
    image.setDisplaySize(width, width * (image.height / image.width));
    return image;
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
