const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // niente 0/O/1/I per evitare ambiguita'

export function generateShareCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
