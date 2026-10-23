import assert from "node:assert/strict";
import test from "node:test";
import { connectorPath, layoutNodes } from "./layout";

test("measured rows and columns leave space for the largest node and remain stable", () => {
  const nodes = [
    { id: "start", position: { x: 0, y: 0 } },
    { id: "a", position: { x: 380, y: 0 } },
    { id: "b", position: { x: 760, y: 0 } },
    { id: "c", position: { x: 380, y: 320 } },
  ];
  const sizes = { start: { width: 400, height: 200 }, a: { width: 300, height: 510 }, b: { width: 300, height: 600 }, c: { width: 360, height: 250 } };
  const result = layoutNodes(nodes, sizes);
  assert.deepEqual(result.map(node => node.position), [
    { x: 0, y: 0 }, { x: 480, y: 0 }, { x: 920, y: 0 }, { x: 480, y: 664 },
  ]);
  assert.deepEqual(layoutNodes(nodes, sizes), result);
  assert.equal(layoutNodes(nodes, { ...sizes, b: { width: 300, height: 700 } })[3].position.y, 764);
  assert.deepEqual(nodes[3].position, { x: 380, y: 320 });
});

test("connections stay horizontal at equal heights and bend only for different heights", () => {
  assert.equal(connectorPath(300, 110, 380, 110), "M 300 110 H 380");
  assert.equal(connectorPath(300, 110, 380, 430), "M 300 110 H 340 V 430 H 380");
});
