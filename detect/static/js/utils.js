export const $ = (s, r = document) => r.querySelector(s);

export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export const esc = s => String(s).replace(/[&<>\"]/g, c => ({
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'\"': '&quot;'
}[c]));

export const fmt = n => n < 1024
	? n + ' o'
	: (n / 1024).toFixed(1).replace('.', ',') + ' Ko';

export const when = t => new Date(t).toLocaleString('fr-FR', {
	dateStyle: 'short',
	timeStyle: 'short'
});

export const toB64 = u => {
	let s = '';
	u.forEach(b => s += String.fromCharCode(b));
	return btoa(s);
};

export const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export function crc32(u) {
	let c, crc = -1;

	for (const b of u) {
		c = (crc ^ b) & 255;

		for (let k = 0; k < 8; k++) {
			c = c & 1
				? 0xEDB88320 ^ (c >>> 1)
				: c >>> 1;
		}

		crc = (crc >>> 8) ^ c;
	}

	return (crc ^ -1) >>> 0;
}

export function toast(m, bad) {
	const t = document.createElement('div');
	t.className = 'toast' + (bad ? ' bad' : '');
	t.textContent = m;
	$('#toasts').append(t);
	setTimeout(() => t.remove(), 4200);
}

export function busy(b, label) {
	if (label) {
		b.dataset.t = b.textContent;
		b.textContent = label;
		b.disabled = true;
	} else {
		b.textContent = b.dataset.t || b.textContent;
		b.disabled = false;
	}
}
