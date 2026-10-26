# 实体 → 零件：决策树

## 第一步，先判角色（role）

| role | 判据 | 视觉 |
| --- | --- | --- |
| `topic` | 出现在用户问题里，或话题默认在场 | 不透明，正常材质 |
| `principle` | **删掉它，因果链断裂** | 半透明 + 淡蓝自发光 |
| `contrast` | 换掉它，结论会反转 | 灰化，opacity 0.42 |

判 `principle` 只用一条：把这一站拿掉，上一步和下一步还能不能直接连上？
能连上，它就不该占一个工位——**原理实体不是越多越好，是最小充分集**。

上限：全篇 `principle` 不超过 5 个，每站最多新引入 1 个。

## 第二步，三级命中选零件

```
① 查词表（entities.json / principles.json）
     命中 → 用条目里写好的 part + custom
     ↓ 没中
② 判 kind，套矩阵 → 生成中性配方
     ↓ 判不出
③ 降级 console（中性控制台），并在 note 里说明「此处无对应实体」
```

命令行直接跑：

```bash
node scripts/resolve.mjs 咖啡因 腺苷受体 空气分子
node scripts/resolve.mjs --json 发酵罐
```

`--json` 输出可以直接贴进 concept 的 station。

## kind 矩阵

| kind | form | detail | 适用 | 例 |
| --- | --- | --- | --- | --- |
| `device` | `box` | `vents` / `pipe` / `screen` | 有机器感的实体 | 咖啡机、压缩机、服务器 |
| `material` | `stack` | `groove` / `none` | 成堆成片成卷 | 咖啡豆、面粉、水泥 |
| `vessel` | `vessel` | `handle` | 装东西的 | 烧杯、锅、油箱 |
| `organism` | `cluster` | `none` | 生命体 | 细胞、线虫、神经元 |
| `particle` | `cluster` | `none` | 分子、电子、光子 | 咖啡因分子、氧分子 |
| `signal` | `field` | `none` | 波、场、能量流 | 电场、声波、光照 |
| `structure` | `frame` | `none` | 架子、房子、台子 | 货架、车间、站台 |
| `data` | `bars` | `none` | 分布、概率、量级差 | logits、浓度差、延迟 |
| `agent` | `cylinder` | `none` | 人、角色、组织 | 骑手、客服、柜员 |

## 三种"看不见"的实体怎么处理

这是最容易画错的一类。原则：**用形式表达关系，不要伪造外形**。

| 想表达 | 用 | 不要用 |
| --- | --- | --- |
| 一堆分子在乱动 | `cluster` | `box`（会读成一个方块） |
| 某种东西弥漫在空间里 | `field` | `globe` / `vessel` |
| A 比 B 强多少 | `bars` | 文字标签 / 两个大小不同的球 |
| 有东西只能从这里过 | `membrane` | 一堵实心墙 |
| 中间隔了一层 | `membrane` | 两块并排的板 |

## 尺度

实体条目带 `scale`：`micro`（μm~mm）/ `small`（cm）/ `human`（m）/ `large`（10 m+）/ `macro`（km+）。

同一篇里尺度必须自洽。如果话题跨了三个数量级（细胞 → 器官 → 人），
选一个主尺度，其余用 `bullets` 里的数字交代，不要在同一场景里硬混。

## 词表怎么长

`resolve.mjs` 报 `unknown` 的实体，就是词表该补的：

1. 先看 `note` 推荐的 form 画出来对不对；
2. 对，就追加到 `entities.json`（话题实体）或 `principles.json`（原理实体）；
3. `id` 一旦被某份 concept 引用，就不要再改。

原理实体的复用率远高于话题实体——补 10 个原理实体（光子、分子、浓度、势能、受体、场、界面……）
能覆盖的面，比补 100 个话题实体更广。
