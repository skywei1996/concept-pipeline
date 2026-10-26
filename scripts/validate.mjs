#!/usr/bin/env node
/**
 * 校验一份 concept JSON：字段合法性 + 原理完备性。
 *
 * 「看起来像产线、但什么都没解释」是这类内容最大的失败模式，
 * 所以除了字段检查，还硬性检查三件事：
 *   1. 中介检查——换了实体却没有 why 站（反例站豁免）
 *   2. 反例检查——全篇没有 contrast 站
 *   3. 量级检查——至少 2 站的 example.meta 含数字
 *
 * 用法：
 *   node validate.mjs <concept.json>
 * 退出码 0 = 可用；1 = 有硬错误。
 */
import fs from 'node:fs';

const FORMS = ['box', 'slab', 'cylinder', 'vessel', 'frame', 'stack', 'cluster', 'field', 'bars', 'membrane'];
const ROLES = ['topic', 'principle', 'contrast'];
const TYPES = ['step', 'why', 'contrast'];
const STAGES = ['desk', 'datacenter', 'nature', 'body'];

const file = process.argv[2];
if (!file) {
  console.error('用法: node validate.mjs <concept.json>');
  process.exit(2);
}

let doc;
try {
  doc = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`读不了 / 不是合法 JSON：${err.message}`);
  process.exit(1);
}

const err = [];
const warn = [];

if (!doc.title) err.push('缺 title');
if (!Array.isArray(doc.stations) || doc.stations.length < 3) {
  console.error('stations 少于 3 个，无法成为一条产线。');
  process.exit(1);
}
if (doc.stations.length > 8) err.push(`stations ${doc.stations.length} 个，超过 8 个会挤压（取主干 6 站，其余写进 note）`);
if (doc.stage && !STAGES.includes(doc.stage)) warn.push(`stage=${doc.stage} 不在预设里，会退化成 desk 的外观`);

const ids = new Set();

// 旧格式（全部没有 role/type）仍然能渲染，只是没有原理层：报一条，不刷屏
const legacy = doc.stations.every((s) => s.role === undefined && s.type === undefined);
if (legacy) {
  warn.push('这是旧格式（没有 role / type）：能渲染，但没有原理层。建议补全 entity / role / type 后再发布。');
}

for (const s of doc.stations) {
  const tag = s.id || '(无 id)';
  if (!s.id) err.push('有站缺 id');
  if (ids.has(s.id)) err.push(`id 重复：${s.id}`);
  ids.add(s.id);

  if (!legacy) {
    if (!ROLES.includes(s.role)) err.push(`${tag}: role 非法（${s.role}），只能是 ${ROLES.join('/')}`);
    if (!TYPES.includes(s.type)) err.push(`${tag}: type 非法（${s.type}），只能是 ${TYPES.join('/')}`);
  }

  if (s.part === 'custom') {
    if (!s.custom || !FORMS.includes(s.custom.form)) {
      err.push(`${tag}: custom.form 非法（${s.custom && s.custom.form}），只能是 ${FORMS.join('/')}`);
    } else {
      const sz = s.custom.size || [];
      if (sz.length !== 3 || sz.some((v) => typeof v !== 'number')) err.push(`${tag}: custom.size 必须是 3 个数字`);
      for (const k of ['color', 'accent']) {
        if (!/^#[0-9a-f]{6}$/i.test(String(s.custom[k] || ''))) err.push(`${tag}: custom.${k} 不是 6 位色值`);
      }
    }
  } else if (!s.part) {
    err.push(`${tag}: 缺 part`);
  }

  if (!s.name) err.push(`${tag}: 缺 name`);
  if (!s.short) err.push(`${tag}: 缺 short`);
  if (!Array.isArray(s.bullets) || s.bullets.length < 2) err.push(`${tag}: bullets 少于 2 条`);
  if (!Array.isArray(s.tech) || !s.tech.length) err.push(`${tag}: tech 为空`);
  if (!s.example || !s.example.in || !s.example.out) err.push(`${tag}: 缺 example.in/out`);
  if (!Array.isArray(s.grid) || s.grid.length !== 2) err.push(`${tag}: 缺 grid [列, 行]`);
  if (/若干|大量|一些|等等$/.test(String((s.example || {}).out || ''))) {
    err.push(`${tag}: example.out 太模糊，要给具体值`);
  }

  if (!s.insight) warn.push(`${tag}: 缺 insight（这一站的「为什么」）`);
  else if (s.insight.length < 30) warn.push(`${tag}: insight 偏短（${s.insight.length} 字），机制可能没讲透`);
  else if (s.insight.length > 110) warn.push(`${tag}: insight 偏长（${s.insight.length} 字），建议压到 90 字内`);
}

for (const id of doc.order || []) {
  if (!ids.has(id)) err.push(`order 引用了不存在的 id：${id}`);
}
if (doc.order && doc.order.length !== ids.size) err.push('order 长度与 stations 不一致');

// ---- 原理完备性 ----
const contrasts = doc.stations.filter((s) => s.type === 'contrast');
if (!legacy && !contrasts.length) err.push('[完备性] 没有反例站：只讲了「是这样」，没讲「为什么不是别的」');

const whys = doc.stations.filter((s) => s.type === 'why');
if (!legacy && !whys.length) err.push('[完备性] 没有 why 站：只有流程，没有机制');

const withNumber = doc.stations.filter((s) => /\d/.test((s.example && s.example.meta) || ''));
if (!legacy && withNumber.length < 2) err.push('[完备性] 量级锚点不足：至少 2 站的 example.meta 要含数字或比值');

for (let i = 1; i < doc.stations.length; i++) {
  const a = doc.stations[i - 1];
  const b = doc.stations[i];
  if (a.entity === b.entity) continue;
  if (a.type === 'contrast' || b.type === 'contrast') continue; // 反例站豁免
  // 只要中间有原理实体在场，机制就有人承载，不必强制 why
  if (a.role !== 'topic' || b.role !== 'topic') continue;
  warn.push(`[中介] ${a.id} → ${b.id} 是两个话题实体直接相连，中间缺机制解释，容易变成「然后奇迹发生」`);
}

const principles = new Set(doc.stations.filter((s) => s.role === 'principle').map((s) => s.entity || s.id));
if (principles.size > 5) warn.push(`[克制] 原理实体 ${principles.size} 个，超过 5 个容易变成课件`);

const counts = TYPES.map((t) => `${t}=${doc.stations.filter((s) => s.type === t).length}`).join(' · ');
console.log(`${doc.title || '(无标题)'} ｜ ${doc.stations.length} 站 ｜ ${counts}`);
console.log(`原理实体 ${principles.size} 个：${[...principles].join(', ') || '（无）'}`);
console.log(err.length ? `\n硬错误 ${err.length}：\n- ${err.join('\n- ')}` : '\n硬错误 0');
if (warn.length) console.log(`\n提示 ${warn.length}：\n- ${warn.join('\n- ')}`);

process.exit(err.length ? 1 : 0);
