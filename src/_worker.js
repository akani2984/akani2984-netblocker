let hashArray = null;
let initPromise = null;
//全局变量 用于储存初始化状态
let config = null;
//程序设置
let allowRules = null;
let blockRules = null;


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

function settingsPage() {
	function setTokenInputItem(labelName, name, value) {
		return `<div class="mdui-textfield"><label class="mdui-textfield-label">${labelName}</label><div style="display:flex; flex-warp: nowrap;"><input  name="${name}" class="mdui-textfield-input" type="text" id="tokenInputElement"  value="${value}"  style="width: calc(100% - 150px) !important;" readonly /><a style="width: 150px;" class="mdui-btn mdui-color-indigo" onclick="token()">Generate Token</a></div></div>`
	}

	function setTextarea(labelName, name, value) {
		return `<div class="mdui-textfield"><label class="mdui-textfield-label">${labelName}</label><textarea name="${name}" class="mdui-textfield-input" rows="4" >${value}</textarea></div>`
	}

	let html = '';
	html = html + `<form action="/${config.secret}/apply-settings" method="post">`
	html = html + setTokenInputItem("Token", 'secret', config.secret);
	html = html + setTextarea("URL Blocklists (Hosts blacklist and plain domian list supported)", 'listURLs', config.listURLs.join('\n'));
	html = html + setTextarea("User Block Rules (REXEXP)", 'userBlockRules', config.userBlockRules.join('\n'));
	html = html + setTextarea("User Allow Rules (REGEXP)", 'userAllowRules', config.userAllowRules.join('\n'));
	html = html + `<button type="submit" class="mdui-btn mdui-color-indigo">Confirm</button>`
	html = html + `<div><br>After confirmation, you will get a file named config.json. Upload it to this project you forked/imported to apply your settings.</div>`
	html = html + `
		<script>
			function token() {
				document.getElementById('tokenInputElement').value =  crypto.randomUUID().replaceAll('-', '');
			}
 		</script>
	`
	html = html + `</form>`
	return makeUI(html);
}

function makeUI(content) {
	let html = `<!doctype html>
					<html lang="zh-cn">
  						<head>
    						<meta charset="utf-8">
    						<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no">
    						<meta name="renderer" content="webkit">
				    		<!-- mdui CSS -->
    						<link rel="stylesheet" href="https://unpkg.com/mdui@1.0.2/dist/css/mdui.min.css">
    						<title>Blocker</title>
  						</head>
  						<body>
    						<div class="mdui-container" >
								${content}
							</div>
 							<!-- mdui JavaScript -->
    						<script src="https://unpkg.com/mdui@1.0.2/dist/js/mdui.min.js"></script>
 						</body>
						</html>
					`
	let response = new Response(html, {
		headers: { 'content-type': 'text/html;charset=UTF-8' },
	});

	return response;
}


async function init(request, env) {
	console.log('New isolate, init.');
	const url = new URL(request.url);
	url.pathname = '/config.json';
	const configRes = await env.ASSETS.fetch(url);
	url.pathname = '/data.bin';
	const binRes = await env.ASSETS.fetch(url);
	config = await configRes.json();
	const buffer = await binRes.arrayBuffer()
	hashArray = new BigUint64Array(buffer);
	const allowRulesTemp = []
	const blockRulesTemp = []
	for (const regexpStr of config.userAllowRules) {
		if (regexpStr.replaceAll(' ', '') === '') {
			continue;
		}
		const regexp = new RegExp(regexpStr, 'i');
		allowRulesTemp.push(regexp);
	}
	for (const regexpStr of config.userBlockRules) {
		if (regexpStr.replaceAll(' ', '') === '') {
			continue;
		}
		const regexp = new RegExp(regexpStr, 'i');
		blockRulesTemp.push(regexp);
	}
	allowRules = allowRulesTemp;
	blockRules = blockRulesTemp;
	if (!config && !config.secret) {
		config.secret = 'dns-query';
	}
}


function startInit(ctx, env, request) {
	if (initPromise === null) {
		initPromise = init(request, env);
		ctx.waitUntil(initPromise);
	}
}

/**
 * 把查询报文改成一个返回 0.0.0.0 的响应
 */
function buildZeroAnswer(query, ttl = 86400) {
	const response = new Uint8Array(query);

	const origFlags = (query[2] << 8) | query[3];
	const opcode = (origFlags >> 11) & 0x0f;
	const rd = (origFlags >> 8) & 1;

	const flags = 0x8000 | (opcode << 11) | (rd << 8) | 0x0080 | 0;
	response[2] = (flags >> 8) & 0xff;
	response[3] = flags & 0xff;

	response[6] = 0; response[7] = 1;   // QDCOUNT=1, ANCOUNT=1
	response[8] = 0; response[9] = 0;   // NSCOUNT=0
	response[10] = 0; response[11] = 0; // ARCOUNT=0

	// 找到 Question 结束位置
	let offset = 12;
	while (offset < response.length) {
		const len = response[offset];
		offset += 1 + len;
		if (len === 0) break;
	}
	offset += 4;

	// 压缩指针指向第 12 字节
	const namePtr = new Uint8Array([0xc0, 12]);

	// 手动拼 TTL 大端 4 字节，避免 DataView 出问题
	const ttlBuf = new Uint8Array([
		(ttl >>> 24) & 0xff,
		(ttl >>> 16) & 0xff,
		(ttl >>> 8) & 0xff,
		ttl & 0xff
	]);

	const answerRR = concatUint8Arrays(
		namePtr,
		new Uint8Array([0x00, 0x01]),   // TYPE A
		new Uint8Array([0x00, 0x01]),   // CLASS IN
		ttlBuf,
		new Uint8Array([0x00, 0x04]),   // RDLENGTH 4
		new Uint8Array([0x00, 0x00, 0x00, 0x00]) // 0.0.0.0
	);

	const out = new Uint8Array(offset + answerRR.length);
	out.set(response.subarray(0, offset), 0);
	out.set(answerRR, offset);
	return out;
}


function concatUint8Arrays(...arrays) {
	const total = arrays.reduce((s, a) => s + a.length, 0);
	const out = new Uint8Array(total);
	let pos = 0;
	for (const a of arrays) {
		out.set(a, pos);
		pos += a.length;
	}
	return out;
}

function dnsResponse(dnsBytes) {
	return new Response(dnsBytes, {
		status: 200,
		headers: {
			'Content-Type': 'application/dns-message',
			'Cache-Control': 'no-store',
		},
	});
}

// ─────────────────────────────────────────────
// 1. base64url 解码为 Uint8Array
// ─────────────────────────────────────────────
function base64urlToBytes(str) {
	// base64url → 标准 base64
	let s = str.replace(/-/g, '+').replace(/_/g, '/');
	// 补齐 padding
	while (s.length % 4) s += '=';

	const binary = atob(s);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

// ─────────────────────────────────────────────
// 2. 读取一个域名（处理压缩指针）
//    返回 [域名字符串, 下一个字段的偏移量]
// ─────────────────────────────────────────────
function readName(bytes, startOffset) {
	const labels = [];
	let offset = startOffset;
	let jumped = false;
	let returnOffset = startOffset;
	let hops = 0;
	const decoder = new TextDecoder('utf-8');

	while (true) {
		if (offset >= bytes.length) throw new Error('域名解析越界');
		if (++hops > 128) throw new Error('压缩指针疑似循环');

		const len = bytes[offset];

		// 0x00：域名结束
		if (len === 0) {
			offset += 1;
			if (!jumped) returnOffset = offset;
			break;
		}

		// 高两位为 11：压缩指针
		if ((len & 0xc0) === 0xc0) {
			if (offset + 1 >= bytes.length) throw new Error('指针越界');
			const pointer = ((len & 0x3f) << 8) | bytes[offset + 1];
			if (!jumped) returnOffset = offset + 2;
			offset = pointer;
			jumped = true;
			continue;
		}

		// 高两位非 0：非法 label
		if ((len & 0xc0) !== 0) throw new Error(`非法 label 长度 0x${len.toString(16)}`);

		offset += 1;
		if (offset + len > bytes.length) throw new Error('label 内容越界');

		const labelBytes = bytes.subarray(offset, offset + len);
		labels.push(decoder.decode(labelBytes));
		offset += len;
	}

	return [labels.join('.'), returnOffset];
}

// ─────────────────────────────────────────────
// 3. 解析 DNS 查询报文
// ─────────────────────────────────────────────
const QTYPE_NAMES = {
	1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR', 15: 'MX',
	16: 'TXT', 28: 'AAAA', 33: 'SRV', 43: 'DS', 46: 'RRSIG',
	47: 'NSEC', 48: 'DNSKEY', 65: 'HTTPS', 255: 'ANY'
};
const QCLASS_NAMES = { 1: 'IN', 3: 'CH', 4: 'HS', 255: 'ANY' };

function parseDnsQuery(bytes) {
	if (bytes.length < 12) throw new Error('报文长度不足 12 字节');

	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

	const header = {
		id: view.getUint16(0),
		flags: view.getUint16(2),
		qdcount: view.getUint16(4),
		ancount: view.getUint16(6),
		nscount: view.getUint16(8),
		arcount: view.getUint16(10),
	};

	// 解码 flags 的几个关键位
	const flagInfo = {
		qr: (header.flags >> 15) & 1,       // 0=查询 1=响应
		opcode: (header.flags >> 11) & 0x0f,
		aa: (header.flags >> 10) & 1,
		tc: (header.flags >> 9) & 1,
		rd: (header.flags >> 8) & 1,       // 期望递归
		ra: (header.flags >> 7) & 1,
		rcode: header.flags & 0x0f,
	};

	const questions = [];
	let offset = 12;

	for (let i = 0; i < header.qdcount; i++) {
		const [name, nextOffset] = readName(bytes, offset);
		offset = nextOffset;

		if (offset + 4 > bytes.length) throw new Error('Question 字段越界');
		const qtype = view.getUint16(offset); offset += 2;
		const qclass = view.getUint16(offset); offset += 2;

		questions.push({
			name,
			qtype,
			qtypeName: QTYPE_NAMES[qtype] || `TYPE${qtype}`,
			qclass,
			qclassName: QCLASS_NAMES[qclass] || `CLASS${qclass}`,
		});
	}

	return { header, flags: flagInfo, questions, consumedBytes: offset };
}

// ─────────────────────────────────────────────
// 4. 对外接口：从 DoH GET 的 dns 参数解析出域名
// ─────────────────────────────────────────────

async function onBlock(dnsContent) {
	return dnsResponse(buildZeroAnswer(dnsContent));
}

async function onAllow(dnsContent) {
	const dnsResponse = await fetch(`https://cloudflare-dns.com/dns-query`, {
		method: 'POST',
		body: dnsContent,
		headers: {
			'content-type': 'application/dns-message',
			'accept': 'application/dns-message'
		},
	});
	return dnsResponse;
}

function lookup(str) {
	const hash = fnv1a64(str);
	let lo = 0;
	let hi = hashArray.length - 1;
	while (lo <= hi) {
		const mid = Math.floor((lo + hi) / 2);
		const temp = hashArray[mid];
		if (temp === hash) { return true };
		if (hash > temp) {
			lo = mid + 1;
		} else {
			hi = mid - 1
		}
	}
	return false;
}

async function proccessDnsRequest(dnsContent) {
	const requestedDomain = parseDnsQuery(dnsContent).questions[0].name;
	for (const regexp of allowRules) {
		if (regexp.test(requestedDomain)) {
			console.log(`${requestedDomain} : Allowed.`);
			return onAllow(dnsContent);
		}
	}
	for (const regexp of blockRules) {
		if (regexp.test(requestedDomain)) {
			console.log(`${requestedDomain} : Blocked.`);
			return onBlock(dnsContent);
		}
	}
	if (lookup(requestedDomain)) {
		console.log(`${requestedDomain} : Blocked.`);
		return onBlock(dnsContent);
	}
	console.log(`${requestedDomain} : Allowed.`);
	return onAllow(dnsContent)
}

export default {
	async fetch(request, env, ctx) {
		startInit(ctx, env, request);
		await initPromise;
		const url = new URL(request.url);
		if (url.pathname === '/' + config.secret || url.pathname === '/' + config.secret + '/') {
			const search = url.search;
			const body = request.body;
			if (search) {
				const para = new URLSearchParams(search);
				const dnsRequest = para.get('dns');
				const dnsContent = base64urlToBytes(dnsRequest);
				return proccessDnsRequest(dnsContent);
			} else if (body) {
				const dnsContent = await request.clone().bytes();
				return proccessDnsRequest(dnsContent);
			} else {
				return settingsPage();
			}
		} else if (url.pathname === '/' + config.secret + '/apply-settings') {
			const form = await request.formData();
			const configTemp = {
				secret: form.get('secret') || 'dns-query',
				listURLs: form.get('listURLs').split('\r\n') || [],
				userBlockRules: form.get('userBlockRules').split('\r\n') || [],
				userAllowRules: form.get('userAllowRules').split('\r\n') || []
			};
			const configJSON = JSON.stringify(configTemp);
			return new Response(configJSON, {
				status: 200,
				headers: {
					"Content-Type": "application/octet-stream",
					"Content-Disposition": 'attachment; filename="config.json"',
				},
			});
		} else {
			return new Response('Permission denied.', { status: 403 });
		}
	},
};