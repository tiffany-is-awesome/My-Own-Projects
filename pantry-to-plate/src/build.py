# Assembles the single-file page from the source parts.
import re, pathlib
src = pathlib.Path(__file__).parent
css = (src/"base.css").read_text() + "\n" + (src/"extra.css").read_text()
body = (src/"body.html").read_text()
js = "\n".join((src/f).read_text() for f in ["engine.js","recipes.js","ai.js","app.js","cloud.js","status.js","fix.js","plate.js","boot.js"])
js = js.replace('if (typeof module !== "undefined") module.exports = Engine;', '').replace('if (typeof module !== "undefined") module.exports = { RECIPES };', '')
html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pantry to Plate</title>
<meta name="description" content="Tell us what you have. We'll help you turn it into something delicious.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
{css}
</style>
</head>
<body>
{body}
<script>
(function(){{
"use strict";
{js}
}})();
</script>
</body>
</html>
'''
(src.parent/"index.html").write_text(html)
print("built", len(html), "bytes")
