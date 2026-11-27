// Build step: split long "..." strings into short pieces joined with +, so no source line has a long string a viewer could wrap.
// The runtime text is identical. Usage: node wrapstrings.js in.js out.js
const fs = require("fs"), acorn = require(process.env.ACORN || "/tmp/node_modules/acorn");
const MAX = 90;
function wrap(src) {
  const toks = [...acorn.tokenizer(src, { ecmaVersion: "latest" })];
  let out = "", last = 0, n = 0;
  // column of position p in the OUTPUT so far (earlier insertions may already have started a new line)
  const curCol = p => { const pending = out + src.slice(last, p); return pending.length - pending.lastIndexOf("\n") - 1; };
  toks.forEach((t, i) => {
    if (t.type.label !== "string") return;
    const prev = toks[i - 1], next = toks[i + 1];
    const lineStart0 = src.lastIndexOf("\n", t.start) + 1, col = t.start - lineStart0 + (last > lineStart0 ? out.length - out.lastIndexOf("\n") - 1 - (t.start - lineStart0) + (t.start - last) : 0) * 0;
    const len = t.end - t.start, endCol = curCol(t.start) + len;
    if (len <= 40 && !(endCol > 120 && len > 6)) return;
    // a string that starts far along a line goes on a line of its own (only after tokens that keep the expression open, so no semicolon is ever implied)
    const own = curCol(t.start) > 30 && prev && [",", "[", "(", "?", ":", "+/-", "=", "||", "&&", "??", "=>", "{", "==/!=/===/!==", "_=", "</>/<=/>="].includes(prev.type.label) ? "\n" + ((src.slice(lineStart0, t.start).match(/^\s*/) || [""])[0]) + "  " : "";
    if (t.end - t.start <= MAX) { if (own) { out += src.slice(last, t.start) + own + src.slice(t.start, t.end); last = t.end; n++; } return; }
    if (next && next.type.label === ":" && prev && (prev.type.label === "{" || prev.type.label === ",")) return; // object key
    if (prev && (prev.type.label === "import" || prev.value === "from")) return;
    const words = t.value.split(/(?<=[ /_-])/); const parts = []; let cur = "";
    for (const w of words) { if (cur && JSON.stringify(cur + w).length > MAX - 4) { parts.push(cur); cur = ""; } cur += w; }
    if (cur) parts.push(cur);
    if (parts.length < 2) return;
    const lineStart = src.lastIndexOf("\n", t.start) + 1, indent = (src.slice(lineStart, t.start).match(/^\s*/) || [""])[0] + "  ";
    out += src.slice(last, t.start) + own + "(" + parts.map(p => JSON.stringify(p)).join(" +\n" + indent) + ")";
    last = t.end; n++;
  });
  return { code: out + src.slice(last), n };
}
if (require.main === module) { const r = wrap(fs.readFileSync(process.argv[2], "utf8")); fs.writeFileSync(process.argv[3], r.code); console.error("split", r.n, "long strings"); }
module.exports = wrap;
