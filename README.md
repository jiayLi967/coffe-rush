# Coffee Rush

A sleepy office worker is waiting with his mouth open. Coffee pours from the machine in the top-right corner. You get a handful of odd office objects (a keyboard, a banana peel, a desk fan, a sponge, a mug) and only a little time to arrange them so the coffee reaches his mouth.

The coffee is not an animation. It is about a thousand tiny drops, and each drop follows a few simple rules. Streams, splashes, drips, puddles and overflowing mugs come from those rules. None of them is drawn by hand.

**▶ Play:** `https://<your-github-username>.github.io/coffee-rush/`

![teaser](media/teaser.gif)

## How to play

- Drag an object from the drawer into the office. Hover over the drawer to see what each object does.
- Turn an object by dragging the small ○ above it, scrolling the mouse wheel over it, or pressing Q / E. Drop it back into the drawer to remove it.
- The clock starts when you grab your first object. The machine pours 8 seconds later, or you can tap it to pour right away.
- Fill his cup before the clock runs out. ↻ retries and keeps your layout; ✕ clears the room.

| Object | What it does |
|---|---|
| Keyboard | A long ramp, but the sticky keys slow the coffee down |
| Banana peel | Has no friction, so it flings coffee off like a ski jump |
| Desk fan | Blows coffee in the direction it faces. Tilt it up to throw coffee across the room |
| Sponge | Soaks up coffee from any direction, then drips it straight down |
| Mug | Fills up first, then overflows |

There are 3 levels, and each one gives you only 3–4 objects:

- **Monday:** an open office.
- **Wednesday:** a lamp, a filing cabinet and a shelf, with no keyboard.
- **Friday:** a tall cabinet in the middle of the room and a wall cupboard beside his head, so a straight shot can't reach his mouth.

## The rules in plain language

**Each coffee drop knows only about the drops right around it.**

1. **Gravity.** Every drop falls.
2. **Personal space.** If the drops around me are too crowded, I push them away. The closer they are, the harder I push.
3. **Stickiness.** If they are a little too far away, I pull them slightly closer.
4. **Objects.** If I hit an object, I can't go through it, so I slide along its surface. Some objects are slippery and some are sticky.

That's all.

**What emerges:** rules 2 and 3 together make the drops act like a liquid. A falling stream breaks up into droplets, a fan turns the stream into a long arc or a spray, and a mug fills up and then spills over its rim. The player builds the path, but the liquid finds its own way along it, so every attempt flows a little differently.

## Techniques

- **Particle fluid:** Clavet-style "double density relaxation" (personal space plus near-pressure), using a spatial hash so each drop only checks its neighbours.
- **Collisions** against rotated line segments (capsules), with friction.
- **Metaball rendering:** soft blobs are drawn, then thresholded, so the drops merge into one liquid with an ink outline.
- **Hand-drawn line style:** every stroke is jittered with a seed that changes a few times per second, so the lines gently "boil".
- Plain JavaScript and Canvas 2D, with no libraries.

## Files

- `index.html`: the page
- `game.js`: the whole game (fluid, objects, levels, drawing, input)
- `media/teaser.gif`, `media/teaser.mp4`: the teaser

## Hosting on GitHub Pages

1. Create a public repository called `coffee-rush` and upload these files, keeping the folder structure.
2. Go to **Settings → Pages**, choose **Deploy from a branch**, set the branch to `main` and the folder to `/ (root)`, then click **Save**.
3. After about a minute the game is live at `https://<your-username>.github.io/coffee-rush/`.
