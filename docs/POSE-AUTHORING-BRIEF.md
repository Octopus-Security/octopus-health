# Brief for an agent writing a batch of poses

Work in the octopus-health repo. Other agents may be writing other pose files at
the same time.

1. **Read these in full first:** `docs/POSES.md` (the format and rules), the header
   comment of `public/stick-figure.js`, and the worked examples
   `public/poses/squat.json`, `push-up.json`, `cat-cow.json`, `jab-cross.json`, and
   `jumping-jack.json` for the front view. `cat-cow` is the model for quadruped
   positions, `jab-cross` for the fighting stance.
2. **Write only the `public/poses/<key>.json` files you were given.** Do not edit the
   engine, `pose-map.js`, the tests, the docs, the views or anyone else's pose file.
   Do not commit or push.
3. For each key:
   - Work the angles out from the reference positions in POSES.md
     (joint = parent + length × (sin a, cos a)).
   - Run `node scripts/poses.mjs <keys…>` and fix every error.
   - Render it and look at it. `<tag>` is your batch letter:
     ```sh
     S=${TMPDIR:-/tmp}
     node scripts/poses.mjs --sheet $S/<tag>.html <keys…>
     mkdir -p $S/ff<tag> && timeout 90 firefox --headless --no-remote --profile $S/ff<tag> \
       --window-size 1400,1800 --screenshot $S/<tag>.png file://$S/<tag>.html
     ```
     Open the PNG with the Read tool. Would someone who knows the exercise
     recognise it? Does the figure face right, with nothing hidden or misplaced?
     Fix it and render again until it does.
   - Highlight the working or stretched area, and give each frame a short label.
   - Stretches and mobility work move slowly (1200–3000 ms per frame,
     ease-in-out), but must still change by at least 10° somewhere.
4. Keep it economical: do several keys per validate/render cycle, and do not
   re-read files you have just written.
5. **Final report, kept short:** the files you wrote; the last line of
   `node scripts/poses.mjs <your keys>`; and any exercise the engine could not
   express well, naming the limitation. Do not paste file contents.
