import { chromium } from 'playwright'
const dir = '/tmp/claude-0/-home-user-gestlocpro/b2e806e0-878e-50d8-82aa-eb5c7909d5bb/scratchpad'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const [route, nom] of [['releves','releves'],['etats-des-lieux','edl'],['cautions','cautions'],['acces','acces'],['decisions','decisions'],['prise-en-main','prise']]) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
  await p.goto(`http://localhost:5199/demo/${route}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(2200)
  const h = await p.evaluate(() => document.documentElement.scrollHeight)
  await p.screenshot({ path: `${dir}/v2-${nom}.png`, fullPage: h < 2400 })
  console.log(nom.padEnd(10), h + 'px', await p.evaluate(() => {
    const groupes = document.querySelectorAll('[role="group"]').length
    const kpis = document.querySelectorAll('[data-indicateur]').length
    const tirets = [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim() === '—').length
    return `· ${kpis} indicateurs · ${groupes} groupes de filtres · ${tirets} tirets`
  }))
  await p.close()
}
await b.close()
