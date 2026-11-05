import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync, symlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LOCAL_DATABASE_PATH } from "@/lib/local-db/database";
import { assertExperimentEnvironment, experimentStepSchema } from "./environment";

test("experiments require an isolated database and accept only the three requested stages", () => {
  const keys = ["CONTENT_STUDIO_DB_PATH", "CONTENT_STUDIO_EXPERIMENT", "CONTENT_STUDIO_DISABLE_COLLECTION"];
  const previous = keys.map(key => process.env[key]);
  const directory = mkdtempSync(join(tmpdir(), "node-experiment-guard-"));
  try {
    const snapshot = join(directory, "snapshot.sqlite");
    writeFileSync(snapshot, "");
    process.env.CONTENT_STUDIO_DB_PATH = snapshot;
    process.env.CONTENT_STUDIO_DISABLE_COLLECTION = "1";
    delete process.env.CONTENT_STUDIO_EXPERIMENT;
    assert.throws(assertExperimentEnvironment, /별도 DB/);
    process.env.CONTENT_STUDIO_EXPERIMENT = "1";
    assert.doesNotThrow(assertExperimentEnvironment);
    process.env.CONTENT_STUDIO_DISABLE_COLLECTION = "0";
    assert.throws(assertExperimentEnvironment, /별도 DB/);
    process.env.CONTENT_STUDIO_DISABLE_COLLECTION = "1";
    if (existsSync(LOCAL_DATABASE_PATH)) {
      process.env.CONTENT_STUDIO_DB_PATH = LOCAL_DATABASE_PATH;
      assert.throws(assertExperimentEnvironment, /운영 DB/);
      const link = join(directory, "production-link.sqlite");
      symlinkSync(LOCAL_DATABASE_PATH, link);
      process.env.CONTENT_STUDIO_DB_PATH = link;
      assert.throws(assertExperimentEnvironment, /운영 DB/);
    }
    for (const step of ["analysis", "hook", "visual"]) assert.equal(experimentStepSchema.parse(step), step);
    for (const step of ["production", "polish"]) assert.equal(experimentStepSchema.safeParse(step).success, false);
  } finally {
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
    rmSync(directory, { recursive: true, force: true });
  }
});
