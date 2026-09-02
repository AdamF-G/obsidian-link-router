import { readFileSync } from "node:fs";
import process from "node:process";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const manifest = readJson("manifest.json");
const packageJson = readJson("package.json");
const versions = readJson("versions.json");

const failures = [];
const requireCondition = (condition, message) => {
  if (!condition) failures.push(message);
};

requireCondition(/^[a-z-]+$/.test(manifest.id), "manifest id must contain only lowercase letters and hyphens");
requireCondition(!manifest.id.includes("obsidian"), "manifest id cannot contain obsidian");
requireCondition(/^\d+\.\d+\.\d+$/.test(manifest.version), "manifest version must use x.y.z format");
requireCondition(packageJson.version === manifest.version, "package.json and manifest.json versions must match");
requireCondition(versions[manifest.version] === manifest.minAppVersion, "versions.json must map the release to minAppVersion");
requireCondition(manifest.description.length <= 250, "manifest description must be at most 250 characters");
requireCondition(manifest.description.endsWith("."), "manifest description must end with a period");

for (const path of ["README.md", "LICENSE", "manifest.json", "styles.css"]) {
  requireCondition(readFileSync(path).length > 0, `${path} must exist and not be empty`);
}

if (failures.length > 0) {
  throw new Error(`Release verification failed:\n- ${failures.join("\n- ")}`);
}

process.stdout.write(`Release metadata verified for Link Router ${manifest.version}.\n`);
