#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const requiredHeadings = [
  "Summary",
  "Why This Is Worth Merging",
  "User Behavior",
  "Contract And Scope",
  "Target Shape Evidence",
  "Documentation",
  "Validation",
  "Remaining Risk",
];

function usage() {
  return [
    "Usage: npm run check:pr-body -- <path-to-pr-body.md>",
    "",
    "Checks that a pull request body includes the repo-required PR readiness headings.",
  ].join("\n");
}

function readBody(filePath) {
  if (!filePath) {
    throw new Error(usage());
  }

  const absolutePath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`PR body file does not exist: ${absolutePath}`);
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function headingPattern(heading) {
  return new RegExp(`^#{2,3}\\s+${escapeRegExp(heading)}\\s*$`, "im");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMissingHeadings(body) {
  return requiredHeadings.filter((heading) => !headingPattern(heading).test(body));
}

function main() {
  const body = readBody(process.argv[2]);
  const missingHeadings = findMissingHeadings(body);

  if (missingHeadings.length > 0) {
    console.error("PR body is missing required section headings:");

    for (const heading of missingHeadings) {
      console.error(`- ${heading}`);
    }

    console.error("\nUse .github/pull_request_template.md as the required shape.");
    process.exit(1);
  }

  console.log("PR body includes the required readiness headings.");
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
