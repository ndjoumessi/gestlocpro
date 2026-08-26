import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
const [, , source, sortie] = process.argv
const dataUrl = `data:image/jpeg;base64,${readFileSync(source).toString('base64')}`
const nav = await chromium.launch()
const page = await nav.newPage()
await page.goto('about:blank')
const b64 = await page.evaluate(async (dataUrl) => {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const ECH = 6 // 3024x4032 -> 504x672
  const c = document.createElement('canvas')
  c.width = Math.round(img.naturalWidth / ECH)
  c.height = Math.round(img.naturalHeight / ECH)
  const x = c.getContext('2d')
  x.drawImage(img, 0, 0, c.width, c.height)
  x.font = '11px monospace'
  x.lineWidth = 1
  for (let px = 0; px < img.naturalWidth; px += 400) {
    const v = px / ECH
    x.strokeStyle = 'rgba(255,0,0,.9)'
    x.beginPath(); x.moveTo(v, 0); x.lineTo(v, c.height); x.stroke()
    x.fillStyle = 'red'; x.fillText(String(px), v + 2, 12)
  }
  for (let py = 0; py < img.naturalHeight; py += 400) {
    const v = py / ECH
    x.strokeStyle = 'rgba(0,80,255,.9)'
    x.beginPath(); x.moveTo(0, v); x.lineTo(c.width, v); x.stroke()
    x.fillStyle = 'blue'; x.fillText(String(py), 2, v + 12)
  }
  const u = c.toDataURL('image/jpeg', 0.92)
  return u.slice(u.indexOf(',') + 1)
}, dataUrl)
await nav.close()
writeFileSync(sortie, Buffer.from(b64, 'base64'))
console.log(sortie)
