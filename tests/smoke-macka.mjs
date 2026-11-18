// Smoke-test the real OSM Maçka PlayCanvas training page in a browser.
// Runs in GitHub Actions. No PlayCanvas account or API token needed.
import { chromium } from 'playwright';

const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_BIN || undefined,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--disable-gpu-sandbox']
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const url = msg.location()?.url || '';
    if (url.endsWith('/favicon.ico')) return;
    errors.push(msg.text() + (url ? ' @ ' + url : ''));
});
page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) {
        errors.push('HTTP ' + response.status() + ': ' + response.url());
    }
});

try {
    await page.goto('http://127.0.0.1:8765/maps/macka.html?play=1', {
        waitUntil: 'domcontentloaded', timeout: 30000
    });
    await page.waitForFunction(() => !!window.paintballMacka &&
        document.querySelector('#macka-paintball-hud') &&
        document.querySelector('#mp-red')?.textContent.trim() === '15' &&
        document.querySelector('#status')?.style.display === 'none',
        null, { timeout: 35000 });
    const init = await page.evaluate(() => ({
        map: !!window.paintballMacka,
        red: document.querySelector('#mp-red')?.textContent,
        mode: window.paintballMacka?.getMode(),
        mapBuildings: window.paintballMacka?.geo?.buildings?.length,
        controls: !!document.querySelector('#mp-fire')
    }));
    if (init.red !== '15' || init.mapBuildings < 1 || init.mode !== false || !init.controls) {
        throw new Error('Incorrect paintball initialization: ' + JSON.stringify(init));
    }
    await page.locator('#mp-fire').click({ timeout: 8000 });
    await page.waitForTimeout(300);
    const shotCount = await page.locator('#macka-paintball-hud').getAttribute('data-shots');
    if (shotCount !== '1') throw new Error('Paintball trigger did not fire: shots=' + shotCount);
    if (errors.length) throw new Error('Browser errors: ' + errors.join('\n'));
    console.log('Maçka OSM FPS smoke test passed:', init);
} finally {
    await browser.close();
}
