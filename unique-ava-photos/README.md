# Unique Ava photos

Real photos placed here replace the built-in renders on the live site.
No rebuild is needed.

1. Generate each image with the prompts in [`../unique-ava/GEMINI-PHOTO-PROMPTS.md`](../unique-ava/GEMINI-PHOTO-PROMPTS.md).
2. Save it here using the suggested file name (for example `t-white-tee.webp`). WebP or JPG at about 1600×2000 works well.
3. Add it to `manifest.json`:
   ```json
   {
     "garments": { "t-white-tee": "t-white-tee.webp" },
     "scenes":   { "tokyo-rain": "scene-tokyo-rain.webp" },
     "model": "model.webp",
     "hero": "hero.webp"
   }
   ```
4. Commit. Anything not listed keeps its built-in render.

> Garment photos look best on a plain light-gray (#F4F4F4) background or a transparent PNG,
> so they match the boutique cards.
