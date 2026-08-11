/// Build vaqtida STEAM_API_KEY env var-dan olingan key-ni
/// binary ichiga obfuskatsiya qilib embed qiladi.
/// Foydalanuvchidan key so'ramaymiz — shu yerda yashiringan.

const SEED: [u8; 32] = [
    0x1c, 0x4e, 0x8a, 0x2d, 0x91, 0x63, 0xf7, 0x0b,
    0x5a, 0xd2, 0x39, 0x76, 0xbe, 0x14, 0xc8, 0x5f,
    0xa3, 0x67, 0xe1, 0x0d, 0x92, 0x4b, 0x7c, 0x38,
    0xd6, 0x29, 0xf4, 0x83, 0x1a, 0x6e, 0xc5, 0x50,
];

const SALT: [u8; 16] = [
    0x79, 0x6f, 0x6c, 0x6e, 0x6f, 0x6d, 0x61, 0x5f,
    0x73, 0x74, 0x65, 0x61, 0x6d, 0x5f, 0x6b, 0x79,
];

const fn derive_key() -> [u8; 32] {
    let mut key = [0u8; 32];
    let mut i = 0;
    while i < 32 {
        let s = SALT[i % 16];
        let mut t = SEED[i] ^ s;
        let mut r = 0;
        while r < 100 {
            t = t.wrapping_add(SEED[(i + r) % 32]);
            t ^= t >> 3;
            t = t.wrapping_mul(0x9e);
            t ^= s;
            r += 1;
        }
        key[i] = t;
        i += 1;
    }
    key
}

const fn obfuscate(api_key: &str) -> ([u8; 64], usize) {
    let key = derive_key();
    let bytes = api_key.as_bytes();
    let len = if bytes.len() < 64 { bytes.len() } else { 64 };
    let mut out = [0u8; 64];
    let mut i = 0;
    while i < len {
        out[i] = bytes[i] ^ key[i % 32] ^ (i as u8).wrapping_mul(7);
        i += 1;
    }
    (out, len)
}

/// Build vaqtida embed qilingan API key-ni qaytaradi.
/// Agar build `STEAM_API_KEY` env var bilan qilinmagan bo'lsa — `None`.
pub fn decode() -> Option<String> {
    const OBFUSCATED: ([u8; 64], usize) = match option_env!("STEAM_API_KEY") {
        Some(key) => obfuscate(key),
        None => ([0u8; 64], 0),
    };

    let (obfuscated, len) = OBFUSCATED;
    if len == 0 {
        return None;
    }

    let key = derive_key();
    let mut decoded = Vec::with_capacity(len);
    for (i, byte) in obfuscated.iter().enumerate().take(len) {
        decoded.push(byte ^ key[i % 32] ^ (i as u8).wrapping_mul(7));
    }

    Some(String::from_utf8_lossy(&decoded).to_string())
}
