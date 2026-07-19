// Generates simple flat "M" monogram PNG icons for the PWA manifest using only
// Node's built-in zlib (no image library dependency). Good enough as placeholder
// app icons — replace with real artwork later.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

function crc32(buf) {
  let c
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c >>> 0
    }
    return t
  })())
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

// Rounded-square background with a centered "M" glyph, drawn on a pixel grid.
function makePng(size, { bg, fg, maskableSafe = false }) {
  const px = new Uint8Array(size * size * 4)
  const set = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a
  }
  const radius = maskableSafe ? 0 : Math.floor(size * 0.22)
  const inCorner = (x, y) => {
    const cx = Math.min(x, size - 1 - x)
    const cy = Math.min(y, size - 1 - y)
    if (cx >= radius || cy >= radius) return true
    const dx = radius - cx
    const dy = radius - cy
    return dx * dx + dy * dy <= radius * radius
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inCorner(x, y)) set(x, y, bg[0], bg[1], bg[2], 255)
    }
  }
  // Draw a simple chevron-like "M" monogram using thick diagonal strokes.
  const margin = Math.floor(size * (maskableSafe ? 0.32 : 0.26))
  const top = margin
  const bottom = size - margin
  const left = margin
  const right = size - margin
  const midX = size / 2
  const thickness = Math.max(2, Math.floor(size * 0.07))
  const drawLine = (x0, y0, x1, y1) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const x = x0 + (x1 - x0) * t
      const y = y0 + (y1 - y0) * t
      for (let ox = -thickness; ox <= thickness; ox++) {
        for (let oy = -thickness; oy <= thickness; oy++) {
          if (ox * ox + oy * oy <= thickness * thickness) {
            set(Math.round(x + ox), Math.round(y + oy), fg[0], fg[1], fg[2], 255)
          }
        }
      }
    }
  }
  drawLine(left, bottom, left, top)
  drawLine(left, top, midX, (top + bottom) / 2)
  drawLine(midX, (top + bottom) / 2, right, top)
  drawLine(right, top, right, bottom)

  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    px.copy ? null : null
    Buffer.from(px.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1)
  }
  const idat = deflateSync(raw)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const bg = [24, 24, 27] // zinc-900
const fg = [250, 250, 249] // warm white

const outDir = new URL('../public/icons/', import.meta.url)
writeFileSync(new URL('icon-192.png', outDir), makePng(192, { bg, fg }))
writeFileSync(new URL('icon-512.png', outDir), makePng(512, { bg, fg }))
writeFileSync(new URL('icon-maskable-512.png', outDir), makePng(512, { bg, fg, maskableSafe: true }))
writeFileSync(new URL('../apple-touch-icon.png', outDir), makePng(180, { bg, fg }))

console.log('Generated placeholder PNG icons in public/icons/')
