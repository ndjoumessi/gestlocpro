import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { POLICE_LARGE, imposerLaPoliceLarge } from './scripts/police-large.mjs'
const port = 4197
const serveur = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 3500))
const navigateur = await chromium.launch()
for (const langue of ['fr', 'en']) {
  const contexte = await navigateur.newContext({ viewport: { width: 360, height: 800 }, locale: langue === 'fr' ? 'fr-FR' : 'en-US' })
  const page = await contexte.newPage()
  await page.addInitScript((l) => { localStorage.setItem('gestlocpro.locale', l) }, langue)
  await imposerLaPoliceLarge(page)
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const releve = await page.evaluate(() => {
    const doc = document.documentElement.scrollHeight
    const sections = [...document.querySelectorAll('main > *, main section')].map((e) => ({
      balise: e.tagName.toLowerCase(),
      titre: (e.querySelector('h1,h2,h3')?.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 40),
      h: Math.round(e.getBoundingClientRect().height),
    }))
    return { doc, sections }
  })
  console.log('===', langue, 'document', releve.doc)
  for (const s of releve.sections) console.log(`  ${String(s.h).padStart(5)}  ${s.balise}  ${s.titre}`)
  await contexte.close()
}
await navigateur.close()
serveur.kill('SIGKILL')
