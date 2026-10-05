import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('assets/lkj/original-resources/manifest.json', 'utf8'));
assert.equal(manifest.source, 'LKJ2000.exe');
assert.equal(manifest.resources.length, 49, 'LKJ2000 embedded PNG resource count changed');

for (const resource of manifest.resources) {
  await access(`assets/lkj/original-resources/${resource.name}`);
}

const interfaceSource = await readFile('scripts/archive-2d-cabview-real-route.js', 'utf8');
const sceneSource = await readFile('scripts/mstsRouteScene.js', 'utf8');
const styles = await readFile('styles/smooth-start.css', 'utf8');

assert.match(interfaceSource, /lkj-resource-01-63x55\.png/);
assert.match(interfaceSource, /lkj-resource-31-65x40\.png/);
assert.match(interfaceSource, /rear-lookout-active/);
assert.match(styles, /\.stage\.rear-lookout-active \.cab-layer\{display:none\}/);
assert.match(sceneSource, /longitudinalSlack/);
assert.match(sceneSource, /lateralSway/);
assert.doesNotMatch(sceneSource, /Math\.random\(\).*Sway/);

console.log('Interface assets valid: 49 original LKJ resources, pure 3D rear views, and deterministic damped start motion.');
