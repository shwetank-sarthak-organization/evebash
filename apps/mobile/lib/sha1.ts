// Pure JS SHA-1 implementation operating directly on Uint8Array.
// Optimized for React Native without native dependencies.
// Based on RFC 3174.

export function sha1(bytes: Uint8Array): string {
  const words32: number[] = [];
  for (let i = 0; i < bytes.length; i += 4) {
    words32.push(
      (bytes[i] << 24) |
      ((bytes[i + 1] || 0) << 16) |
      ((bytes[i + 2] || 0) << 8) |
      (bytes[i + 3] || 0)
    );
  }

  const origLenBytes = bytes.length;
  const origLenBits = origLenBytes * 8;

  // Add the 1 bit (0x80)
  const byteIdx = bytes.length;
  const wordIdx = byteIdx >> 2;
  const shift = 24 - (byteIdx % 4) * 8;
  words32[wordIdx] |= 0x80 << shift;

  // Pad with 0s until length (in words) % 16 === 14
  while (words32.length % 16 !== 14) {
    words32.push(0);
  }

  // Append length in bits (64-bit big endian). We only support < 2^32 bits here for our chunk sizes.
  words32.push(0); 
  words32.push(origLenBits);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  for (let i = 0; i < words32.length; i += 16) {
    const w: number[] = new Array(80);
    for (let j = 0; j < 16; j++) {
      w[j] = words32[i + j];
    }
    for (let j = 16; j < 80; j++) {
      const val = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
      w[j] = (val << 1) | (val >>> 31);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let j = 0; j < 80; j++) {
      let f = 0;
      let k = 0;

      if (j < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (j < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (j < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const temp = ((a << 5) | (a >>> 27)) + f + e + k + w[j];
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = temp | 0; // force 32-bit int
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  const toHex = (n: number) => {
    let s = (n >>> 0).toString(16);
    while (s.length < 8) s = '0' + s;
    return s;
  };

  return toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4);
}

// Test vectors to run on module load in DEV
if (__DEV__) {
  const strToBytes = (s: string) => {
    const arr = new Uint8Array(s.length);
    for (let i=0; i<s.length; i++) arr[i] = s.charCodeAt(i);
    return arr;
  };
  
  const test1 = sha1(strToBytes(""));
  const test2 = sha1(strToBytes("abc"));
  const test3 = sha1(strToBytes("The quick brown fox jumps over the lazy dog"));
  
  if (test1 !== "da39a3ee5e6b4b0d3255bfef95601890afd80709") console.warn("SHA1 test 1 failed", test1);
  if (test2 !== "a9993e364706816aba3e25717850c26c9cd0d89d") console.warn("SHA1 test 2 failed", test2);
  if (test3 !== "2fd4e1c67a2d28fced849ee1bb76e7391b93eb12") console.warn("SHA1 test 3 failed", test3);
}
