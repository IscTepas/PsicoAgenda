import { execSync } from "child_process";

const args = process.argv.slice(2);
const name = args.join(" ").trim();

if (!name) {
  console.error("Uso: node new-change.js <nombre-del-change>");
  process.exit(1);
}

const date = new Date().toISOString().split("T")[0];
const changeName = `${date}-${name}`;

console.log(`Creando change: ${changeName}`);
execSync(`openspec new change "${changeName}"`, { stdio: "inherit" });
