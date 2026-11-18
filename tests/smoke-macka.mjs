// Smoke-test the real OSM Maçka PlayCanvas training page in a browser.
// Runs in GitHub Actions. No PlayCanvas account or API token needed.
import { chromium } from 'playwright';

const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--disable-gpu-sandbox']
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
});

try {
    await page.goto('http://127.0.0.1:8765/maps/macka.html?play=1', {
        waitUntil: 'domcontentloaded', timeout: 30000
    });
    await page.waitForFunction(() => !!window.paintballMacka &&
        document.querySelector('#macka-paintball-hud') &&
        document.querySelector('#mp-red')?.textContent.trim() === '15' &&
        document.querySelector('#status')?.style.display === 'none',
        { timeout: 35000 });
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
    if (errors.length) throw new Error('Browser errors: ' + errors.join('\n'));
    console.log('Maçka OSM FPS smoke test passed:', init);
} finally {
    await browser.close();
}
