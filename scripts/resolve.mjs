#!/usr/bin/env node
/**
 * 实体 → 零件。三级命中，永远给得出答案。
 *
 *   ① 词表命中（id / 名称 / 别名，精确）      → 用条目里写好的配方
 *   ② 词表模糊命中（子串）                    → 同上，但标记 fuzzy，需复核
 *   ③ 词表没有 → 按 kind 矩阵生成中性配方      → 标记 unknown，建议回写词表
 *
 * 用法：
 *   node resolve.mjs 咖啡因 腺苷受体 空气分子
 *   node resolve.mjs --json 咖啡因 腺苷受体
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REF = path.resolve(HERE, '../references');

const load = (f, key) => {
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(REF, f), 'utf8'));
    return Array.isArray(doc) ? doc : (doc[key] || []);
  } catch {
    return [];
  }
};

const pool = [
  ...load('entities.json', 'entities').map((e) => ({ ...e, pool: 'topic' })),
  ...load('principles.json', 'entities').map((e) => ({ ...e, pool: 'principle' }))
];

/** kind → 中性配方。和 mapping.md 里的矩阵保持一致 */
export const KIND_DEFAULT = {
  device: { form: 'box', detail: 'vents', size: [1.3, 1.1, 0.95], color: '#dfe3ea', accent: '#8e97a6' },
  material: { form: 'stack', detail: 'groove', size: [1.0, 0.6, 1.0], color: '#e6dccd', accent: '#8a7360' },
  vessel: { form: 'vessel', detail: 'handle', size: [0.95, 1.0, 0.9], color: '#e9dfc9', accent: '#a8927a' },
  organism: { form: 'cluster', detail: 'none', size: [1.2, 1.0, 1.2], color: '#f0d6d2', accent: '#c4746c' },
  particle: { form: 'cluster', detail: 'none', size: [1.1, 0.9, 1.1], color: '#d6e4f2', accent: '#5b8fc9' },
  signal: { form: 'field', detail: 'none', size: [1.8, 1.1, 1.4], color: '#dbe7f5', accent: '#2b6cb0' },
  structure: { form: 'frame', detail: 'none', size: [1.6, 1.2, 1.2], color: '#e2e6ec', accent: '#9aa3ae' },
  data: { form: 'bars', detail: 'none', size: [1.6, 1.0, 0.9], color: '#dfe6ee', accent: '#6f8ab0' },
  agent: { form: 'cylinder', detail: 'none', size: [0.6, 1.4, 0.6], color: '#e8e2d6', accent: '#9a8b76' }
};

const KIND_HINTS = [
  { re: /分子|原子|电子|光子|离子|粒子|蛋白|酶|受体|通道|激酶/i, kind: 'particle' },
  { re: /细胞|菌|病毒|组织|器官|神经|叶绿体|线粒体|种子|胚胎/i, kind: 'organism' },
  { re: /机器|装置|机|仪|泵|炉|器(?=设)|设备|服务器|卡|芯片|引擎|电机|压缩机|塔|船|车/i, kind: 'device' },
  { re: /杯|瓶|罐|槽|釜|锅|管|筒|池|箱|容器|水箱/i, kind: 'vessel' },
  { re: /波|场|光|声|电磁|辐射|力|流|信号|电流|电压/i, kind: 'signal' },
  { re: /厂|站|台|架|架?构|房|线|轨道|桥|仓库|车间|银行|市场/i, kind: 'structure' },
  { re: /数据|队|表|账|库存|订单|请求|概率|分布|统计|指标|价格/i, kind: 'data' },
  { re: /人|员|师|手|司机|骑手|医生|客服|用户|公司|团队|机构|政府/i, kind: 'agent' },
  { re: /豆|粉|料|油|水|液|气|矿|煤|木|纸|布|粮|糖|盐|沙|土/i, kind: 'material' }
];

function guessKind(name) {
  for (const h of KIND_HINTS) if (h.re.test(name)) return h.kind;
  return 'device';
}

/** 过程名不是实体：问「光合作用」时要拆成叶绿素、光子、CO₂，而不是给过程编一个形状 */
const PROCESS_RE = /(作用|过程|原理|机制|效应|反应|循环|流程|现象|为什么|怎么|如何|是什么)/;

function resolveOne(q) {
  const raw = String(q).trim();
  const lower = raw.toLowerCase();

  if (PROCESS_RE.test(raw) && raw.length <= 12) {
    return {
      query: raw,
      level: 'process',
      id: null,
      name: raw,
      part: null,
      needReview: true,
      note: '这是一个过程，不是实体。把它拆成参与其中的东西（实体）和起作用的中介（原理实体），再逐个解析。'
    };
  }

  const names = (e) => [e.id, e.name, ...(e.aliases || [])].filter(Boolean).map((v) => String(v).toLowerCase());

  let hit = pool.find((e) => names(e).includes(lower));
  if (hit) return { query: raw, level: 'lexicon', ...hit };

  hit = pool.find((e) => names(e).some((n) => raw.includes(n) || n.includes(lower)));
  if (hit) return { query: raw, level: 'fuzzy', note: '子串命中，确认是否同一实体', ...hit };

  const kind = guessKind(raw);
  return {
    query: raw,
    level: 'unknown',
    id: null,
    name: raw,
    kind,
    part: 'custom',
    custom: KIND_DEFAULT[kind],
    needReview: true,
    note: `词表里没有「${raw}」，按 kind=${kind} 生成了中性配方；确认后建议回写词表`
  };
}

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const queries = args.filter((a) => !a.startsWith('--'));

if (!queries.length) {
  console.error('用法: node resolve.mjs [--json] <实体名> [实体名...]');
  process.exit(2);
}

const results = queries.map(resolveOne);

if (asJson) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

for (const r of results) {
  if (r.level === 'process') {
    console.log(`[过程] ${r.query}`);
    console.log(`         ${r.note}`);
    continue;
  }
  const part = r.part === 'custom' ? `custom:${r.custom.form}${r.custom.detail !== 'none' ? '+' + r.custom.detail : ''}` : r.part;
  const tag = r.level === 'lexicon' ? '词表' : r.level === 'fuzzy' ? '模糊' : '兜底';
  console.log(`[${tag}] ${r.query}  →  ${part}   (role=${r.pool === 'principle' ? 'principle' : 'topic'}${r.kind ? ', kind=' + r.kind : ''})`);
  if (r.note) console.log(`         ${r.note}`);
}

const unknown = results.filter((r) => r.level === 'unknown');
if (unknown.length) {
  console.log(`\n${unknown.length} 个实体未进词表：${unknown.map((u) => u.name).join('、')}`);
  console.log('确认它们的形状后，追加到 references/entities.json 或 principles.json，下次就能一级命中。');
}
