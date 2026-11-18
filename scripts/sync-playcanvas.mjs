import { readFile } from 'node:fs/promises';

const PROJECT_ID = '1650317';
const SCRIPT_NAME = 'paintballNations.js';
const API_BASE = 'https://playcanvas.com/api';
const token = process.env.PLAYCANVAS_TOKEN?.trim();
if (!token) {
  throw new Error('GitHub: PLAYCANVAS_TOKEN secret ayarlanmalı.');
}

async function api(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: { Authorization: 'Bearer ' + token, ...options.headers }
  });
  if (!response.ok) {
    // Never print the token, headers or potentially sensitive response body.
    throw new Error('PlayCanvas API HTTP ' + response.status + ': ' + (options.method || 'GET') + ' ' + path.split('?')[0]);
  }
  return response.json();
}

async function getMainBranchId() {
  // Resolve the main branch using the official PlayCanvas REST API.
  // Never assume that the project ID, scene ID or checkpoint hash is a branch ID.
  let skip;
  for (let i = 0; i < 100; i++) {
    const params = skip ? '?skip=' + encodeURIComponent(skip) : '';
    const page = await api('/projects/' + PROJECT_ID + '/branches' + params);
    if (!Array.isArray(page.result)) throw new Error('Unexpected branches API response');
    const main = page.result.find(branch => branch.name === 'main' && branch.closed !== true);
    if (main?.id) return main.id;
    if (!page.pagination?.hasMore || !page.result.length) break;
    skip = page.result.at(-1).id;
  }
  throw new Error('PlayCanvas main branch bulunamadı; işlem yapılmadı.');
}

const branchId = await getMainBranchId();

async function listAssets() {
  const result = [];
  let skip = 0;
  const limit = 100;
  while (true) {
    const qs = new URLSearchParams({ branchId, skip: String(skip), limit: String(limit) });
    const page = await api('/projects/' + PROJECT_ID + '/assets?' + qs);
    if (!Array.isArray(page.result)) throw new Error('Unexpected assets API response');
    result.push(...page.result);
    skip += page.result.length;
    const total = page.pagination?.total;
    if (!page.result.length || (Number.isFinite(total) && skip >= total) || page.result.length < limit) break;
    if (skip > 100000) throw new Error('Asset pagination safety limit exceeded');
  }
  return result;
}

function fileForm(contents, create) {
  const form = new FormData();
  if (create) {
    form.set('projectId', PROJECT_ID);
    form.set('branchId', branchId);
    form.set('name', SCRIPT_NAME);
    form.set('preload', 'true');
  }
  form.set('file', new Blob([contents], { type: 'application/javascript' }), SCRIPT_NAME);
  return form;
}

const code = await readFile(new URL('../playcanvas/paintballNations.js', import.meta.url));
const assets = await listAssets();
const sameName = assets.filter(asset => asset.name === SCRIPT_NAME);
if (sameName.length > 1) {
  throw new Error('Birden fazla paintballNations.js bulundu. Yanlış dosyayı değiştirmemek için durduruldu.');
}
if (sameName.length === 1 && sameName[0].type !== 'script') {
  throw new Error('Aynı adlı varlık script değil. Üzerine yazılmadı.');
}

if (sameName.length === 1) {
  const assetId = sameName[0].id;
  await api('/assets/' + assetId, { method: 'PUT', body: fileForm(code, false) });
  console.log('PlayCanvas script güncellendi: asset ' + assetId);
} else {
  const created = await api('/assets', { method: 'POST', body: fileForm(code, true) });
  console.log('PlayCanvas script oluşturuldu: asset ' + created.id);
}
console.log('Not: İlk kurulumda scripti PlayCanvas Editor içindeki bir Entityye bir kez bağlamak gerekir.');
