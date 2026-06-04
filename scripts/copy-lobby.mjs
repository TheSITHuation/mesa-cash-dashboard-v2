/**
 * Copia poker-lobby/dist -> dist/lobby
 */
import fs from "fs";
import path from "path";

const src = path.resolve("poker-lobby/dist");
const dst = path.resolve("dist/lobby");

function copyDir(srcDir, dstDir) {
  if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
  for (const item of fs.readdirSync(srcDir)) {
    const s = path.join(srcDir, item);
    const d = path.join(dstDir, item);
    const st = fs.statSync(s);
    if (st.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (!fs.existsSync(src)) {
  console.error("[copy-lobby] No existe", src, "-> primero ejecuta: npm --prefix poker-lobby run build");
  process.exit(2);
}
copyDir(src, dst);
console.log("[copy-lobby] Copiado", src, "->", dst);
