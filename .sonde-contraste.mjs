import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
const RACINE = '/Users/nelson/Documents/Projets/gestlocpro'
const PORT = 4191, BASE = `http://127.0.0.1:${PORT}`
const AUDIT = readFileSync(RACINE + '/scripts/contrast-audit.js', 'utf8')
const src = readFileSync(RACINE + '/src/App.tsx', 'utf8')
const chemins = [...src.matchAll(/<Route\s+path="([^"]+)"/g)].map(m => m[1])
const pub = chemins.filter(c => c.startsWith('/') && !c.includes(':') && c !== '*')
const int = chemins.filter(c => !c.startsWith('/') && !c.includes(':') && c !== '*').map(c => `/demo/${c}`)
const adresses = [...new Set([...pub.filter(c=>c!=='/demo'), '/demo', ...int, '/adresse-qui-n-existe-pas'])].filter(c=>c!=='/kitchen-sink')
async function servir() {
  const f = spawn('npx',['vite','preview','--port',String(PORT),'--host','127.0.0.1'],{cwd:RACINE,stdio:['ignore','ignore','inherit']})
  for (let i=0;i<240;i++){ try{ if((await fetch(BASE+'/')).ok) return f }catch{} await new Promise(r=>setTimeout(r,250)) }
  f.kill(); throw new Error('serveur')
}
await new Promise((res,rej)=>{const f=spawn('npx',['vite','build','--logLevel','error'],{cwd:RACINE});let e='';f.stderr.on('data',d=>e+=d);f.on('exit',c=>c===0?res():rej(new Error(e)))})
const serveur = await servir()
const tous = new Map()
const temoins = []
try {
  const nav = await chromium.launch()
  for (const langue of ['en-US','fr-FR']) {
    for (const theme of ['light','dark']) {
      const ctx = await nav.newContext({ viewport:{width:360,height:900}, locale:langue, colorScheme: theme })
      const page = await ctx.newPage()
      for (const a of adresses) {
        for (const w of [360, 1280]) {
          await page.setViewportSize({width:w,height:900})
          if (w === 360) await page.goto(BASE+a,{waitUntil:'domcontentloaded'})
          await page.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{})
          await page.waitForFunction(()=>document.querySelectorAll('[aria-busy="true"]').length===0,null,{timeout:5000}).catch(()=>{})
          if (a === '/' && w === 1280) temoins.push(`${langue} ${theme} → body ${await page.evaluate(()=>getComputedStyle(document.body).backgroundColor)}`)
          const r = await page.evaluate(AUDIT)
          for (const it of r.items) {
            const cle = `${it.ratio}|${it.text}|${it.color}|${it.bg}`
            if (!tous.has(cle)) tous.set(cle, { ...it, ou: `${a} ${w}px ${langue} ${theme}` })
          }
        }
      }
      await ctx.close()
    }
  }
  await nav.close()
} finally { serveur.kill() }
console.log('\nTÉMOIN — le thème se rend-il vraiment :'); temoins.forEach(t=>console.log('  '+t))
const l = [...tous.values()].sort((a,b)=>a.ratio-b.ratio)
console.log(`\nTOTAL formes distinctes sous le seuil : ${l.length}`)
for (const it of l) console.log(`  ${String(it.ratio).padStart(5)} / ${it.required}  ${it.fontSize}px w${it.weight}  "${it.text}"  ${it.color} sur ${it.bg}   [${it.ou}]`)
