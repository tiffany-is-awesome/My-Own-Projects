# Assembles the single-file page from the source parts.
import re, pathlib
src = pathlib.Path(__file__).parent
css = (src/"base.css").read_text() + "\n" + (src/"extra.css").read_text()
body = (src/"body.html").read_text()
js = "\n".join((src/f).read_text() for f in ["engine.js","recipes.js","ai.js","app.js","cloud.js","status.js","fix.js","plate.js","dishart.js","aiphoto.js","tour.js","features.js","boot.js"])
js = js.replace('if (typeof module !== "undefined") module.exports = Engine;', '').replace('if (typeof module !== "undefined") module.exports = { RECIPES };', '')
html = f'''<!DOCTYPE html>
<html lang="en" data-theme="green">
<head>
<meta charset="utf-8">
<script>try{{if(localStorage.getItem("p2p.theme")==="light")document.documentElement.dataset.theme="light"}}catch(e){{}}</script>
<meta name="theme-color" content="#1D2B20">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pantry to Plate</title>
<meta name="description" content="Tell us what you have. We'll help you turn it into something delicious.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
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
(src/"index.html").write_text(html)
print("built", len(html), "bytes")

# Final step: split long strings into short "..." + "..." pieces (same text at runtime) so no viewer
# can wrap a string across two lines and mistake the wrap for a line break inside it.
import subprocess, re as _re
_h = open("index.html", encoding="utf8").read()
_m = max(_re.finditer(r"<script>([\s\S]*?)</script>", _h), key=lambda m: len(m.group(1)))  # the app script, not the tiny theme one
open("/tmp/_bundle.js", "w", encoding="utf8").write(_m.group(1))
subprocess.run(["node", "wrapstrings.js", "/tmp/_bundle.js", "/tmp/_bundle.wrapped.js"], check=True)
_w = open("/tmp/_bundle.wrapped.js", encoding="utf8").read()
open("index.html", "w", encoding="utf8").write(_h[:_m.start(1)] + _w + _h[_m.end(1):])
