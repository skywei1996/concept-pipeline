#!/usr/bin/env node
/**
 * 把一份 concept JSON 打成一个双击即开的单文件 HTML。
 *
 * 用法：
 *   node build.mjs <concept.json> [out.html]
 *
 * 产物内联三样东西：渲染器 IIFE（含 three.js）、样式、内容本身。
 * 因此没有任何相对路径依赖，file:// 直接打开即可，不需要本地服务。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const [conceptPath, outArg] = process.argv.slice(2);
if (!conceptPath) {
  console.error('用法: node build.mjs <concept.json> [out.html]');
  process.exit(2);
}

const absConcept = path.resolve(conceptPath);
if (!fs.existsSync(absConcept)) {
  console.error(`找不到内容文件：${absConcept}`);
  process.exit(2);
}

let concept;
try {
  concept = JSON.parse(fs.readFileSync(absConcept, 'utf8'));
} catch (err) {
  console.error(`内容不是合法 JSON：${err.message}`);
  process.exit(2);
}

if (!Array.isArray(concept.stations) || !concept.stations.length) {
  console.error('内容里没有 stations，拒绝打包。先跑 validate.mjs。');
  process.exit(2);
}

const bundle = fs.readFileSync(path.join(ROOT, 'assets', 'renderer.js'), 'utf8');
const tpl = fs.readFileSync(path.join(ROOT, 'assets', 'template.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'assets', 'styles.css'), 'utf8');

// 内联进 <script> 的内容必须避免提前闭合标签
const safe = (s) => String(s).replace(/<\//g, '<\\/');
const html = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const slug = String(concept.id || 'concept').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'concept';
const out = path.resolve(outArg || `概念-${slug}.html`);

const doc = tpl
  .replace('__TITLE__', () => html(concept.title || '概念产线'))
  .replace('__CSS__', () => css)
  .replace('__CONCEPT_JSON__', () => safe(JSON.stringify(concept)))
  .replace('__BUNDLE__', () => safe(bundle));

// 自检：占位符没换干净、或注入语句被写坏，直接失败，别产出打不开的文件
const problems = [];
const left = ['__TITLE__', '__CSS__', '__CONCEPT_JSON__', '__BUNDLE__'].filter((k) => doc.includes(k));
if (left.length) problems.push(`占位符未替换：${left.join(', ')}`);
const inject = doc.match(/<script>window\.__CONCEPT__ = ([\s\S]*?);\s*<\/script>/);
if (!inject) {
  problems.push('找不到概念注入语句');
} else {
  try {
    const probe = new Function(`return (${inject[1].replace(/<\\\//g, '</')});`);
    const obj = probe();
    if (!obj || !Array.isArray(obj.stations) || !obj.stations.length) {
      problems.push('注入的概念数据里没有 stations');
    }
  } catch (err) {
    problems.push(`注入的概念数据不是合法 JS：${err.message}`);
  }
}
if (problems.length) {
  console.error('打包失败：');
  for (const p of problems) console.error('  - ' + p);
  process.exit(2);
}

fs.writeFileSync(out, doc, 'utf8');

const mb = (fs.statSync(out).size / 1048576).toFixed(2);
console.log(out);
console.log(`${concept.stations.length} 站 · ${mb} MB · ${(concept.order || []).length || concept.stations.length} 个工位在动线上`);
