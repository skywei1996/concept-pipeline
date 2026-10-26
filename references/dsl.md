# concept DSL

一份 concept 就是一条产线。渲染器只认这份 JSON，模型永远不写 3D 代码。

## 顶层

| 字段 | 必填 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | 是 | 英文小写短横线 | 同时决定产物文件名 |
| `title` | 是 | ≤ 12 字 | 带一个具体限定词，不要「XX 的秘密」这种空话 |
| `subtitle` | 是 | ≤ 20 字 | 一句话说清「从什么到什么」 |
| `question` | 是 | 一句人话 | 用户原本会怎么问 |
| `answer` | 是 | ≤ 20 字 | 一句话结论，可以反直觉 |
| `stage` | 是 | `desk` / `datacenter` / `nature` / `body` | 见 stages.json |
| `note` | 是 | 一句话 | 数值免责声明，默认「数值为示意」 |
| `stations` | 是 | 3~8 个 | 超过 8 个装不下 |
| `order` | 是 | station id 数组 | 动线顺序，U 形自动排 |
| `answerTemplate` | 否 | 一段 | 收尾长句，可用 `{q}` `{n}` 占位 |

## station

| 字段 | 必填 | 约束 |
| --- | --- | --- |
| `id` | 是 | 英文小写短横线，唯一 |
| `entity` | **是** | 实体 id，来自 entities.json / principles.json |
| `role` | **是** | `topic` / `principle` / `contrast` |
| `type` | **是** | `step` / `why` / `contrast` |
| `part` | 是 | 库零件 id，或 `custom` |
| `custom` | part=custom 时必填 | 见下 |
| `name` | 是 | ≤ 12 字，带限定词：「供电 · 10 MW」 |
| `grid` | 是 | `[列, 行]`，U 形排布由 order 决定，一般不用手算 |
| `inputLabel` / `outputLabel` | 是 | ≤ 8 字，这一步的进和出 |
| `short` | 是 | ≤ 30 字，这一站在做什么 |
| `insight` | 是 | 30~90 字，讲「为什么是这样」，**必须有反直觉点** |
| `bullets` | 是 | 3 条，每条 ≤ 30 字，必须是事实或数量级 |
| `example` | 是 | `{in, out, meta}` 具体值，禁止「若干」「大量」 |
| `tech` | 是 | 2~3 条工程视角：跑在什么硬件、用什么算法、什么量级 |

### custom 配方

```json
{
  "form": "cluster",
  "detail": "none",
  "size": [1.3, 1.05, 1.3],
  "color": "#cfe3f5",
  "accent": "#5b8fc9"
}
```

- `form`：`box`（机身）/ `slab`（薄板）/ `cylinder`（圆柱）/ `vessel`（容器）/ `frame`（支架）/ `stack`（叠层）/ `cluster`（粒子群）/ `field`（场线）/ `bars`（分布）/ `membrane`（膜）
- `detail`：`none` / `lens` / `screen` / `pipe` / `handle` / `vents` / `groove`
- `size`：[宽, 高, 深]，米，0.4~2.4 / 0.25~2.2 / 0.3~2.0
- `color` / `accent`：6 位十六进制，马卡龙浅色；accent 比 color 深

**选形铁律**：看不见的东西不要硬给实体外形。分子用 `cluster`，场用 `field`，差异用 `bars`，界面用 `membrane`。把「空气分子」画成 `box` 比不画更糟——观众会以为分子是方的。

## 三种 type 的写法差别

| type | 这一站要回答 | 写法 |
| --- | --- | --- |
| `step` | 接下来发生什么 | 描述动作与结果，`insight` 给一个反直觉的补充 |
| `why` | 为什么必须这样 | `insight` 必须讲机制（因为有 X，所以不可能 Y），`bullets` 给量级 |
| `contrast` | 不这样会怎样 | 假设一个反事实，用同一个实体换条件；`role` 必须是 `contrast` |

## 完整的站（照这个写）

```json
{
  "id": "rayleigh",
  "entity": "rayleigh-scattering",
  "role": "principle",
  "type": "why",
  "part": "custom",
  "custom": { "form": "field", "detail": "none", "size": [2.0, 1.1, 1.6], "color": "#bcd4ea", "accent": "#2b6cb0" },
  "name": "散射 · 1/λ⁴",
  "grid": [1, 0],
  "inputLabel": "各波长的白光",
  "outputLabel": "短波被散得更狠",
  "short": "分子远小于波长，短波被散射的强度高得多",
  "insight": "不是空气「吸收」了蓝光——恰恰相反，是蓝光被弹开得最厉害，才从四面八方进了你眼睛。",
  "bullets": [
    "散射强度 ∝ 1/λ⁴",
    "450 nm 比 650 nm 强约 5.5 倍",
    "空气分子 0.3 nm，比波长小三个数量级"
  ],
  "example": { "in": "白光 400~700 nm", "out": "蓝光散射强度约为红光的 4.4 倍", "meta": "正午头顶，示意" },
  "tech": [
    "分子尺寸 ≪ 波长时进入瑞利区，感生偶极辐射的强度按四次方衰减",
    "这是天空蓝和日落红同一个原因的两端",
    "云是白的，因为水滴远大于波长，进入米氏散射，不再挑波长"
  ]
}
```

## 文案红线

1. `insight` 里出现「然后」「接着」这种流程词，说明这一站还是 step，不要冒充 why。
2. `bullets` 只放能验证的事实或数字，不放形容词。
3. 未经查证的精确数值，一律写进 `example.meta` 并标「示意」，不许写进 `bullets` 冒充事实。
4. 同一个 `entity` 在多站出现时，`part` 和 `custom` 必须一致——否则观众会以为换了东西。
