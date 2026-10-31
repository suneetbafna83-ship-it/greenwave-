// Vector art and 2D canvas drawing for Landmark Civic Circle Middle Finger Park
// Faithfully matches the user's reference hand line art:
// Extended central middle finger with nail and knuckle creases,
// folded index knuckle, folded thumb on the left, folded ring & pinky on the right,
// and palm/wrist base.

export function getCivicCircleCenter() {
  // Civic Circle Boulevard bounds: [0, 7, 7, 15] on 500x500 world (SPACING = 16.6667, HALF = 250)
  // raw(0) = -250, raw(7) = -133.333, raw(15) = 0
  const cx = (-250 + -133.333) / 2; // -191.667
  const cz = (-133.333 + 0) / 2;    // -66.667
  const radius = 43.5;              // inner park island radius
  return { cx, cz, radius };
}

/**
 * Draws the high-detail Middle Finger Park onto any 2D canvas.
 * @param {CanvasRenderingContext2D} ctx - Target 2D canvas context
 * @param {Function} mapPoint - Function converting {x, z} world coordinate to [px, py] canvas point
 * @param {number} customScale - Optional scale multiplier (defaults to 1.0)
 */
export function drawMiddleFingerPark2D(ctx, mapPoint, customScale = 1.0) {
  const { cx, cz, radius } = getCivicCircleCenter();
  const s = customScale;

  // Helper converting relative offset (dx, dz) to canvas [px, py]
  const pt = (dx, dz) => mapPoint({ x: cx + dx * s, z: cz + dz * s });

  ctx.save();

  // 1. Draw Circular Park Lawn Island Base
  const [islandPx, islandPy] = mapPoint({ x: cx, z: cz });
  const [islandEdgePx] = mapPoint({ x: cx + radius, z: cz });
  const canvasRadius = Math.abs(islandEdgePx - islandPx);

  ctx.beginPath();
  ctx.arc(islandPx, islandPy, canvasRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#064e3b"; // Lush deep park lawn green
  ctx.fill();
  ctx.strokeStyle = "#10b981"; // Emerald outer park promenade border
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // 2. Main Middle Finger Hand Silhouette Path (Continuous Outer Perimeter)
  ctx.beginPath();
  const [w0x, w0y] = pt(-14, 23); // Left wrist
  ctx.moveTo(w0x, w0y);

  // Outer thumb curve on left
  const [t1x, t1y] = pt(-19, 17);
  const [t2x, t2y] = pt(-23, 10);
  const [t3x, t3y] = pt(-20, 2);
  const [t4x, t4y] = pt(-14, 4);
  ctx.bezierCurveTo(t1x, t1y, t2x, t2y, t3x, t3y);
  ctx.quadraticCurveTo(t4x, t4y, ...pt(-12, 1));

  // Folded index finger knuckle top
  const [i1x, i1y] = pt(-11, -5);
  const [i2x, i2y] = pt(-5.5, -6);
  ctx.bezierCurveTo(i1x, i1y, i2x, i2y, ...pt(-4.2, 0));

  // Extended Middle Finger Left Edge soaring straight up
  const [m1x, m1y] = pt(-4.5, -24);
  ctx.lineTo(m1x, m1y);

  // Rounded Middle Fingertip Cap
  const [mt1x, mt1y] = pt(-4.5, -32);
  const [mt2x, mt2y] = pt(0, -34);
  const [mt3x, mt3y] = pt(4.5, -32);
  const [mt4x, mt4y] = pt(4.5, -24);
  ctx.bezierCurveTo(mt1x, mt1y, mt2x, mt2y, ...pt(0, -33.5));
  ctx.bezierCurveTo(mt3x, mt3y, mt4x, mt4y, ...pt(4.5, -24));

  // Extended Middle Finger Right Edge dropping back down
  ctx.lineTo(...pt(4.2, 0));

  // Folded Ring Finger knuckle top
  const [r1x, r1y] = pt(5.5, -5.5);
  const [r2x, r2y] = pt(11, -5);
  ctx.bezierCurveTo(r1x, r1y, r2x, r2y, ...pt(12.5, 1));

  // Folded Pinky Finger knuckle top & right outer hand edge
  const [p1x, p1y] = pt(14, -2.5);
  const [p2x, p2y] = pt(17.5, -1.5);
  ctx.bezierCurveTo(p1x, p1y, p2x, p2y, ...pt(18, 5));

  // Sweeping down right palm edge to wrist
  const [p3x, p3y] = pt(18.5, 14);
  const [p4x, p4y] = pt(15, 20);
  ctx.bezierCurveTo(p3x, p3y, p4x, p4y, ...pt(13, 23));

  // Bottom wrist curve connecting back to left wrist
  const [wb1x, wb1y] = pt(4, 25.5);
  const [wb2x, wb2y] = pt(-5, 25.5);
  ctx.bezierCurveTo(wb1x, wb1y, wb2x, wb2y, w0x, w0y);
  ctx.closePath();

  // Hand Fill: Vibrant arboretum foliage with subtle gradient
  ctx.fillStyle = "#34d399"; // Crisp mint emerald canopy
  ctx.fill();

  // Bold hand contour outline
  ctx.strokeStyle = "#022c22"; // Rich dark outline matching line art
  ctx.lineWidth = 2.4;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  // 3. Middle Finger Internal Details: Fingernail & Knuckle Creases
  // (A) Fingernail Arc near the top
  ctx.beginPath();
  const [fnL_x, fnL_y] = pt(-2.8, -25);
  const [fnC_x, fnC_y] = pt(0, -29);
  const [fnR_x, fnR_y] = pt(2.8, -25);
  ctx.moveTo(fnL_x, fnL_y);
  ctx.quadraticCurveTo(fnC_x, fnC_y, fnR_x, fnR_y);
  ctx.strokeStyle = "#022c22";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // (B) Distal Knuckle Crease (under nail)
  ctx.beginPath();
  const [kc1L_x, kc1L_y] = pt(-3.2, -18);
  const [kc1R_x, kc1R_y] = pt(3.2, -18);
  ctx.moveTo(kc1L_x, kc1L_y);
  ctx.quadraticCurveTo(...pt(0, -17), kc1R_x, kc1R_y);
  ctx.strokeStyle = "#022c22";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // (C) Middle Knuckle Creases (classic double crease in user's drawing)
  ctx.beginPath();
  ctx.moveTo(...pt(-3.5, -8.5));
  ctx.quadraticCurveTo(...pt(0, -7.5), ...pt(3.5, -8.5));
  ctx.moveTo(...pt(-3.2, -6.0));
  ctx.quadraticCurveTo(...pt(0, -5.0), ...pt(3.2, -6.0));
  ctx.stroke();

  // 4. Folded Knuckle & Thumb Crease Lines (Matching Reference Drawing)
  // Index knuckle crease
  ctx.beginPath();
  ctx.moveTo(...pt(-10, -2));
  ctx.quadraticCurveTo(...pt(-7.5, 0.5), ...pt(-5, -1));
  ctx.stroke();

  // Thumb inner crease
  ctx.beginPath();
  ctx.moveTo(...pt(-16, 8));
  ctx.quadraticCurveTo(...pt(-13, 11), ...pt(-11, 7));
  ctx.stroke();

  // Ring knuckle crease
  ctx.beginPath();
  ctx.moveTo(...pt(5, -1));
  ctx.quadraticCurveTo(...pt(7.5, 0.5), ...pt(10, -2));
  ctx.stroke();

  // Pinky knuckle crease
  ctx.beginPath();
  ctx.moveTo(...pt(12, 1));
  ctx.quadraticCurveTo(...pt(14, 2.5), ...pt(16, 1));
  ctx.stroke();

  // Wrist base creases
  ctx.beginPath();
  ctx.moveTo(...pt(-6, 21));
  ctx.quadraticCurveTo(...pt(0, 22), ...pt(6, 21));
  ctx.moveTo(...pt(-3, 18));
  ctx.quadraticCurveTo(...pt(0, 19), ...pt(3, 18));
  ctx.stroke();

  // 5. Delicate decorative tree foliage flecks inside the hand
  const flecks = [
    [-1, -22], [1, -14], [0, -2], [-8, 5], [8, 5], [-15, 12], [14, 10], [0, 12]
  ];
  ctx.fillStyle = "#059669";
  flecks.forEach(([fx, fz]) => {
    const [fpx, fpy] = pt(fx, fz);
    ctx.beginPath();
    ctx.arc(fpx, fpy, 1.4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}
