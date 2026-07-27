#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const {execFileSync} = require("child_process");

function loadAnnotator() {
    try {
        return require("ng-annotate-patched/src/ng-annotate-main");
    } catch (error) {
        const npmRoot = execFileSync("npm", ["root", "-g"], {encoding: "utf8"}).trim();
        return require(path.join(npmRoot, "ng-annotate-patched/src/ng-annotate-main"));
    }
}

const [input, output] = process.argv.slice(2);
if (!input || !output) {
    console.error(`Usage: ${path.basename(process.argv[1])} <input.js> <output.js>`);
    process.exit(2);
}

const source = fs.readFileSync(input, "utf8");
const result = loadAnnotator()(source, {add: true, remove: true, inFile: input});
if (result.errors) {
    console.error(result.errors.join("\n"));
    process.exit(1);
}
fs.writeFileSync(output, result.src, "utf8");
