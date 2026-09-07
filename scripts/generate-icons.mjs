import { PNG } from "pngjs";
import { writeFileSync, mkdirSync } from "fs";

mkdirSync("public/icons", { recursive: true });

const BG = [232, 98, 63]; // corallo brand
const FG = [255, 255, 255];

function drawIcon(size) {
  const png = new PNG({ width: size, height: size });
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.4;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      // sfondo con angoli arrotondati
      const corner = size * 0.18;
      let inside = true;
      if (x < corner && y < corner) {
        inside = Math.hypot(x - corner, y - corner) <= corner;
      } else if (x > size - corner && y < corner) {
        inside = Math.hypot(x - (size - corner), y - corner) <= corner;
      } else if (x < corner && y > size - corner) {
        inside = Math.hypot(x - corner, y - (size - corner)) <= corner;
      } else if (x > size - corner && y > size - corner) {
        inside = Math.hypot(x - (size - corner), y - (size - corner)) <= corner;
      }

      let [cr, cg, cb] = inside ? BG : [0, 0, 0];
      let alpha = inside ? 255 : 0;

      // disegna un grande punto interrogativo stilizzato
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      const thickness = size * 0.09;

      // arco superiore (anello incompleto)
      const ringR = r * 0.55;
      const angle = Math.atan2(dy, dx); // -PI..PI
      const onRing = Math.abs(dist - ringR) < thickness / 2;
      const ringVisible = angle > -2.55 && angle < 1.35; // lascia un'apertura in basso a sinistra

      // gambo verticale che scende dall'anello verso il basso
      const stemTop = cy - ringR * 0.1;
      const stemBottom = cy + r * 0.25;
      const onStem =
        Math.abs(dx - ringR * 0.55) < thickness / 2 &&
        dy > stemTop - cy &&
        dy < stemBottom - cy;

      // pallino del punto interrogativo
      const dotCx = cx + ringR * 0.55;
      const dotCy = cy + r * 0.55;
      const onDot = Math.hypot(x - dotCx, y - dotCy) < thickness * 0.6;

      if (inside && ((onRing && ringVisible) || onStem || onDot)) {
        cr = FG[0];
        cg = FG[1];
        cb = FG[2];
      }

      png.data[idx] = cr;
      png.data[idx + 1] = cg;
      png.data[idx + 2] = cb;
      png.data[idx + 3] = alpha;
    }
  }
  return png;
}

for (const size of [192, 512]) {
  const png = drawIcon(size);
  writeFileSync(`public/icons/icon-${size}.png`, PNG.sync.write(png));
}

// maskable icon (stesso design, sfondo pieno senza angoli arrotondati per il safe-zone)
function drawMaskable(size) {
  const png = new PNG({ width: size, height: size });
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.32;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      let [cr, cg, cb] = BG;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      const thickness = size * 0.07;
      const ringR = r * 0.55;
      const angle = Math.atan2(dy, dx);
      const onRing = Math.abs(dist - ringR) < thickness / 2;
      const ringVisible = angle > -2.55 && angle < 1.35;
      const stemTop = cy - ringR * 0.1;
      const stemBottom = cy + r * 0.25;
      const onStem =
        Math.abs(dx - ringR * 0.55) < thickness / 2 &&
        dy > stemTop - cy &&
        dy < stemBottom - cy;
      const dotCx = cx + ringR * 0.55;
      const dotCy = cy + r * 0.55;
      const onDot = Math.hypot(x - dotCx, y - dotCy) < thickness * 0.6;
      if ((onRing && ringVisible) || onStem || onDot) {
        cr = FG[0];
        cg = FG[1];
        cb = FG[2];
      }
      png.data[idx] = cr;
      png.data[idx + 1] = cg;
      png.data[idx + 2] = cb;
      png.data[idx + 3] = 255;
    }
  }
  return png;
}

writeFileSync(
  "public/icons/maskable-512.png",
  PNG.sync.write(drawMaskable(512))
);

console.log("Icone generate in public/icons/");
