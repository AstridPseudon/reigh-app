import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

import { dialogEarlyReturnMessage } from "../../eslint-rules/dialogEarlyReturnRule.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const fixturesDir = path.join(repoRoot, "eslint-rules", "__fixtures__");
const invalidFixture = path.join(fixturesDir, "dialog-early-return.invalid.tsx");
const validFixture = path.join(fixturesDir, "dialog-early-return.valid.tsx");

const eslint = new ESLint({
  cwd: repoRoot,
  overrideConfigFile: path.join(repoRoot, "eslint.config.js"),
  ignore: false,
});

const [invalidResult] = await eslint.lintFiles([invalidFixture]);
const [validResult] = await eslint.lintFiles([validFixture]);

const invalidMessages = invalidResult.messages.filter(
  (message) => message.message === dialogEarlyReturnMessage,
);

assert.equal(
  invalidMessages.length,
  1,
  `Expected one dialog early-return lint error in ${path.basename(invalidFixture)}, got ${invalidMessages.length}.`,
);

assert.equal(
  validResult.messages.length,
  0,
  `Expected no lint errors in ${path.basename(validFixture)}, got ${validResult.messages.length}.`,
);

console.log("dialog early-return rule: invalid fixture fails, valid fixture passes");
