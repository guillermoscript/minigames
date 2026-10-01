// Run: node pocketbase/pb_hooks/lib.test.js   (pure-function tests only)
const assert = require("assert");
const { makeUsername, checkEmailDomain } = require("./lib.js");
const RE = /^[A-Za-z0-9_-]{3,16}$/;
const none = () => false;
let seq = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]; let i = 0; const rand = () => seq[i++ % seq.length];
assert.equal(makeUsername("Guillermo Marín", none), "Guillermo_Marin");
assert.equal(makeUsername("Ana", none), "Ana");
assert.equal(makeUsername("  José  Á. ", none), "Jose_A");
assert.equal(makeUsername("Wolfgang Amadeus Mozart", none), "Wolfgang_Amadeus");
assert.ok(RE.test(makeUsername("Wolfgang Amadeus Mozart", none)));
for (const bad of ["", null, undefined, "李雷", "A", "!!", "--"]) { const u = makeUsername(bad, none, rand); assert.ok(/^player\d{4}$/.test(u), bad + " -> " + u); }
const taken = new Set(["Ana"]);
const u = makeUsername("Ana", (c) => taken.has(c), rand); assert.ok(/^Ana\d\d$/.test(u) && RE.test(u), u);
const long = makeUsername("Wolfgang Amadeus", (c) => c === "Wolfgang_Amadeus", rand); assert.ok(RE.test(long) && long.length <= 16 && long !== "Wolfgang_Amadeus", long);
// everything with 2-digit suffix taken -> falls through to longer suffixes
const u2 = makeUsername("Ana", (c) => c === "Ana" || /^Ana\d\d$/.test(c), rand); assert.ok(/^Ana\d{4}$/.test(u2), u2);
assert.equal(checkEmailDomain("a@b.com", ""), true);
assert.equal(checkEmailDomain("a@B.com", "x.org, b.com"), true);
assert.equal(checkEmailDomain("a@c.com", "x.org,b.com"), false);
assert.equal(checkEmailDomain("", "b.com"), false);
console.log("lib.test.js OK");
