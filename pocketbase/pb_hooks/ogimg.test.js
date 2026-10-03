// Run: node pocketbase/pb_hooks/ogimg.test.js   (decodes the generated PNG with zlib and checks it)
const assert = require("assert"), zlib = require("zlib"), fs = require("fs");
const { roomImage, W, H, PAL } = require("./ogimg.js");
const t0 = Date.now(), bytes = Buffer.from(roomImage("K7QX")), ms = Date.now() - t0;
assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
let p = 8; const chunks = {};
while (p < bytes.length) {
  const len = bytes.readUInt32BE(p), type = bytes.toString("ascii", p + 4, p + 8), body = bytes.subarray(p + 8, p + 8 + len);
  assert.equal(bytes.readUInt32BE(p + 8 + len), zlib.crc32 ? zlib.crc32(bytes.subarray(p + 4, p + 8 + len)) : bytes.readUInt32BE(p + 8 + len), "crc " + type);
  chunks[type] = Buffer.concat([chunks[type] || Buffer.alloc(0), body]); p += 12 + len;
}
assert.equal(chunks.IHDR.readUInt32BE(0), W); assert.equal(chunks.IHDR.readUInt32BE(4), H); assert.equal(chunks.IHDR[8], 8); assert.equal(chunks.IHDR[9], 3);
const raw = zlib.inflateSync(chunks.IDAT); assert.equal(raw.length, (W + 1) * H);
assert.ok(bytes.length < 60000, "small enough: " + bytes.length);
const px = (x, y) => raw[y * (W + 1) + 1 + x];
assert.equal(px(2, 2), 0); assert.ok(raw.includes(2), "yellow code pixels exist");
assert.notDeepEqual(roomImage("K7QX"), roomImage("ABCD"));
assert.equal(roomImage("abcd").length, roomImage("ABCD").length);
fs.writeFileSync(process.argv[2] || "/tmp/og-room.png", bytes);
console.log("ogimg.test.js OK", bytes.length + " bytes", ms + " ms");
