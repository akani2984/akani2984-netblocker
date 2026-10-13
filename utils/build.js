import fs from 'node:fs';
import * as nodePath from 'node:path';
import { Buffer } from "node:buffer";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = nodePath.dirname(__filename);
const projectPath = nodePath.join(__dirname, '..');

const configJSON = fs.readFileSync(nodePath.join(projectPath, 'config.json'));
const config = JSON.parse(configJSON);

function isURL(str) {
	if (typeof str !== 'string') return false;
	try {
		new URL(str);
		return true;
	} catch {
		return false;
	}
}

function fnv1a64(str) {
    const FNV_OFFSET = 0xcbf29ce484222325n;
    const FNV_PRIME = 0x100000001b3n;
    const MASK = 0xFFFFFFFFFFFFFFFFn;
    const bytes = new TextEncoder().encode(str);
    let h = FNV_OFFSET;
    for (let i = 0; i < bytes.length; i++) {
        h ^= BigInt(bytes[i]);
        h = (h * FNV_PRIME) & MASK;
    }
    return h;
}


async function makeURLListSet() {
	let set = new Set();
	for (const listURL of config.listURLs) {
		if (isURL(listURL)) {
            console.log(`Starting to fetch ${listURL}`);
			const response = await fetch(listURL);
            console.log(`Starting to proccess ${listURL}`);
			const filterText = await response.text();
			const filterArray = filterText.split('\n');
			for (let line of filterArray) {
				line = line.trim();
				if (!line.startsWith('#')) {
					line = line.split(' ').filter(Boolean);
					if (line[1]) {
						for (let i = 1; i < line.length; i++) {
							set.add(line[i]);
						}
					} else {
						set.add(line[0]);
					}
				}
			}
		}
	}
	return set;
}

function urlListSetToHash(set) {
    console.log(`Starting to hash rules.`)
	const hashArrayTemp = new BigUint64Array(set.size);
	let i = 0;
	set.forEach((rule) => {
		hashArrayTemp[i] = fnv1a64(rule);
		i++
	})
	return hashArrayTemp.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

async function makeFilterData() {
    const a = urlListSetToHash(await makeURLListSet());
    fs.writeFileSync(nodePath.join(projectPath, 'dist', 'data.bin'), Buffer.from(a.buffer, a.byteOffset, a.byteLength));
    console.log('data.bin prepared.');
}

function makeDistDir() {
    try {
        fs.mkdirSync(nodePath.join(projectPath, 'dist'))
    } catch {}
}

makeDistDir()
await makeFilterData();

fs.cpSync(nodePath.join(projectPath, 'src', '_worker.js'), nodePath.join(projectPath, 'dist', '_worker.js'), {force: true});
fs.cpSync(nodePath.join(projectPath, 'config.json'), nodePath.join(projectPath, 'dist' ,'config.json'), {force: true});
console.log('Project built.');