import { TILE } from './constants.js';

// Axis-separated tile collision shared by the player and ground enemies.
export function moveBody(body, dx, dy, level, opts = {}) {
  const oneWay = opts.oneWay !== false;
  const dropTimer = opts.dropTimer || 0;
  const result = { hitX: false, hitY: false, onGround: false };

  if (dx !== 0) {
    body.x += dx;
    const y0 = Math.floor(body.y / TILE);
    const y1 = Math.floor((body.y + body.h - 0.01) / TILE);
    if (dx > 0) {
      const tx = Math.floor((body.x + body.w - 0.01) / TILE);
      for (let ty = y0; ty <= y1; ty++) {
        if (level.isSolid(tx, ty)) {
          body.x = Math.min(body.x, tx * TILE - body.w);
          result.hitX = true;
        }
      }
    } else {
      const tx = Math.floor(body.x / TILE);
      for (let ty = y0; ty <= y1; ty++) {
        if (level.isSolid(tx, ty)) {
          body.x = Math.max(body.x, (tx + 1) * TILE);
          result.hitX = true;
        }
      }
    }
  }

  if (dy !== 0) {
    const prevBottom = body.y + body.h;
    body.y += dy;
    const x0 = Math.floor((body.x + 1) / TILE);
    const x1 = Math.floor((body.x + body.w - 1) / TILE);

    if (dy > 0) {
      const ty = Math.floor((body.y + body.h - 0.01) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        const solid = level.isSolid(tx, ty);
        const platform =
          oneWay &&
          level.isOneWay(tx, ty) &&
          dropTimer <= 0 &&
          prevBottom <= ty * TILE + 1.5;
        if (solid || platform) {
          body.y = Math.min(body.y, ty * TILE - body.h);
          result.onGround = true;
        }
      }
    } else {
      const ty = Math.floor(body.y / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        if (level.isSolid(tx, ty)) {
          body.y = Math.max(body.y, (ty + 1) * TILE);
          result.hitY = true;
        }
      }
    }
  }

  return result;
}

// Returns the first spike tile overlapping the body, if any.
export function hazardAt(body, level) {
  const x0 = Math.floor((body.x + 3) / TILE);
  const x1 = Math.floor((body.x + body.w - 3) / TILE);
  const y0 = Math.floor((body.y + 3) / TILE);
  const y1 = Math.floor((body.y + body.h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (level.isHazard(tx, ty)) {
        const bandTop = ty * TILE + 20;
        if (body.y + body.h > bandTop && body.y < ty * TILE + TILE) {
          return { tx, ty, x: (tx + 0.5) * TILE };
        }
      }
    }
  }
  return null;
}

export function touchingTile(body, level, check) {
  const x0 = Math.floor((body.x + 2) / TILE);
  const x1 = Math.floor((body.x + body.w - 2) / TILE);
  const y0 = Math.floor((body.y + 1) / TILE);
  const y1 = Math.floor((body.y + body.h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (check(tx, ty)) return { tx, ty };
    }
  }
  return null;
}
