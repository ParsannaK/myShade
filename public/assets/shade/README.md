Shadé character frames generated from `public/assets/shadeSprite.png`.

Current game frames:

- `front.png`: idle/front-facing frame
- `back.png`: back-facing frame
- `right-1.png`: side walk frame 1
- `right-2.png`: side walk frame 2
- `side-idle.png`: extra side idle reference

The original Gemini sheet has baked-in checkerboard background and irregular
spacing, so these frames were cropped and background-cleaned by script instead
of using CSS grid slicing directly.

For a cleaner future sprite sheet, export transparent PNG frames in an even
grid, ideally one character per cell with the same cell size. A simple layout:

- Row 1: front walk frames
- Row 2: back walk frames
- Row 3: right walk frames
- Row 4: left walk frames

Keep every frame aligned to the same foot position. That makes the walk cycle
feel grounded instead of bobbing or sliding.
