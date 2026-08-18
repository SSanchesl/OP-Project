// Porta em Node.js do algoritmo TEA/XXTEA customizado usado pelo cliente
// (classe `TEA` em main.min.js) para o handshake "verify" do socket.io.
// Mesma lógica exata do cliente: strToLongs/longsToStr, delta 0x9E3779B9,
// chave = string ASCII cortada em 16 bytes.

function utf8Encode(str) {
  return Buffer.from(str, "utf8").toString("binary");
}

function utf8Decode(byteStr) {
  return Buffer.from(byteStr, "binary").toString("utf8");
}

function strToLongs(s) {
  const l = new Array(Math.ceil(s.length / 4));
  for (let i = 0; i < l.length; i++) {
    l[i] =
      (s.charCodeAt(i * 4) || 0) +
      (s.charCodeAt(i * 4 + 1) || 0) * 256 +
      (s.charCodeAt(i * 4 + 2) || 0) * 65536 +
      (s.charCodeAt(i * 4 + 3) || 0) * 16777216;
  }
  return l;
}

function longsToStr(l) {
  const a = new Array(l.length);
  for (let i = 0; i < l.length; i++) {
    a[i] = String.fromCharCode(
      l[i] & 0xff,
      (l[i] >>> 8) & 0xff,
      (l[i] >>> 16) & 0xff,
      (l[i] >>> 24) & 0xff
    );
  }
  return a.join("");
}

function encrypt(msg, key) {
  let n = strToLongs(utf8Encode(msg));
  if (n.length <= 1) n[1] = 0;
  const r = strToLongs(utf8Encode(key).slice(0, 16));
  const i = n.length;
  let s = n[i - 1];
  let l = n[0];
  const u = 2654435769;
  let p = Math.floor(6 + 52 / i);
  let c = 0;
  while (p-- > 0) {
    c += u;
    const o = (c >>> 2) & 3;
    for (let g = 0; g < i; g++) {
      l = n[(g + 1) % i];
      const a = ((s >>> 5) ^ (l << 2)) + ((l >>> 3) ^ (s << 4)) ^ ((c ^ l) + (r[3 & (g ^ o)] ^ s));
      s = n[g] += a;
    }
  }
  return Buffer.from(longsToStr(n), "binary").toString("base64");
}

function decrypt(enc, key) {
  const o = strToLongs(Buffer.from(enc, "base64").toString("binary"));
  const r = strToLongs(utf8Encode(key).slice(0, 16));
  const i = o.length;
  let s = o[i - 1];
  let l = o[0];
  const u = 2654435769;
  const p = Math.floor(6 + 52 / i);
  let c = p * u;
  while (c !== 0) {
    const a2 = (c >>> 2) & 3;
    for (let g = i - 1; g >= 0; g--) {
      s = o[g > 0 ? g - 1 : i - 1];
      const n2 = ((s >>> 5) ^ (l << 2)) + ((l >>> 3) ^ (s << 4)) ^ ((c ^ l) + (r[3 & (g ^ a2)] ^ s));
      l = o[g] -= n2;
    }
    c -= u;
  }
  const d = longsToStr(o).replace(/\0+$/, "");
  return utf8Decode(d);
}

module.exports = { encrypt, decrypt };
