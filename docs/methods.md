# TypeScript 编程方法论

> 这不是一份配置清单，而是一套**看待代码的方式**。
> 规则会过时，但背后的思想与方法论不会。下面每条都先讲"我们如何看待它"，再讲"因此怎么写"。
>
> **关于示例**：下面出现的代码都是**示意**，用来讲清判据，不是模板。不要照抄其中的标识符、签名或辅助函数；与规则冲突时以规则为准。要学的是"为什么这样写"，不是"原样长这样"。
>
> **规则的效力**：文中"必须/不要"是硬规则，"尽量/优先"是默认选择。偏离硬规则只有两种方式：文中写明的例外，或就地写 `// justify: <节号> <理由>` 并在评审/交付说明里列出。没有标注的偏离，一律算违规。
>
> **读者**：写代码的人，和替人写代码的 Agent。开工前读第零节和 [glossary.md](glossary.md)；提交前过第十二节。
>
> **项目位置**：本文是编码硬规则。Agent 阅读顺序见 [AGENTS.md](../AGENTS.md)，完整文档索引见 [introduction.md](introduction.md)。领域模型、API、配置不在本文；改这些先读对应规格。

> 示例里的 `Order`、`User`、`UserId` 是虚构的；本项目的领域名以 [glossary.md](glossary.md) 为准。

**目录**：零、开工前 · 总纲 · 一、控制流 · 二、无类 · 三、副作用 · 四、循环 · 五、命名 · 六、类型 · 七、函数 · 八、模块 · 九、异步与错误 · 十、注释 · 十一、测试 · 十二、自查与 Agent · 附录 A

---

## 零、开工前：先查术语表

**看法**：术语表不是附录，是领域契约。同一个词在通用语境和本项目里可能指两件事——本项目的 `Item` 是系统唯一公共实体（见 [glossary.md](glossary.md)），不是"任意一个对象"。

**因此**：

- 开始任何任务前，先读 [glossary.md](glossary.md)；代码、API、文档、UI 一律用它定义的词。
- 表里已有的术语，按表里的拼写和大小写使用（`ItemID`，不是 `ItemId`）。
- **领域术语不得被通用工具函数占用**：通用函数用泛型（`T`、`TValue`）或中性词（`entry`、`value`）；真正处理 `Item` 的函数才配叫 `findItem`。
- 新增领域概念：先更新 `glossary.md`，再写进代码；不要在代码里发明同义词。
- 发现代码/文档与术语表不一致：以术语表为准，并在评审或交付说明里指出。

---

## 总纲：我们如何看待代码？

1. **代码是一棵树，不是一条流水线。** 控制流是分叉与汇合的结构，不是"走到某处就跳出去"或者“如果为真就走这条路然后再回来”的脚本。
2. **行为应该被组合，而不是被封装进状态。** 我们用函数的组合表达逻辑，而不是用对象持有状态、再用方法操作它。
3. **上下文应该显式传递，而不是隐式携带。** 一个函数需要什么，就写在参数里；不依赖"我身处何处"。
4. **副作用无法消除，但要可控。** 干净的不是"没有副作用"，而是"副作用集中在少数明确的点上"，读的人知道它在哪里发生，改的人知道只改一处。
5. **能用类型消除的分支，不要用控制流表达。** 可选参数、宽泛的 `string`、可空字段，都会在函数内部长出本不必存在的 `if`。类型越精确，控制流越短。
6. **状态只允许有一个所有者。** 所有者之外，一切都是"收旧值、出新值"的纯函数。

后面所有约定，都是这上面六点的推论。

---

## 一、控制流：把代码当作树

**看法**：`if` 是树的**分叉**，`else` 是另一支。每个分支都应该是完整、自洽的一棵子树。提前 `return` 等于在树的中间"剪断"一支，让读者不得不在脑子里补全"否则会怎样"——这违背了树的可读性。

**先分清三种形态**：

- **分叉**：两边结果都有意义，必须写成 `if {} else {}`，让两条路都可见。
- **筛子**：只有"通过"的一边有动作，另一边是"不属于这里"（过滤、守卫、循环内继续扫描）——可以只写 `if {}`，不补 `else`。
- **早退**：`return` 跳过函数剩余部分，让读者去脑补"否则会怎样"——禁止。查找/扫描类函数的"筛出并产出"除外（见第四节）。

**因此**：

- 需要"否则"语义时，**显式写出 `else`**，不靠提前返回隐式表达。
- 不写 `if (xx) return` 再跟逻辑的卫语句。读者看到的应该是一棵完整的二分树，而非"跳出去就结束"的线性脚本。
- 分支必须用 `{}` 包裹，哪怕只有一行。树的每一支都是可见的块。
- **树有几层，代码就有几层**：`else if` 只用于同一父节点下的兄弟分支；跨层必须用嵌套块。用 `else if` 把子判断压平，等于抹掉信息。代价是这一条会和“把嵌套的 `if` 合并成 `else if`”的 lint 规则冲突——如果项目有这条规则，关掉它。
- 嵌套深到 `}` 对不上号时，**拆函数**（新函数名就是那一层的标签），而不是用 early return 或 `else if` 把树压平。4 级是提醒信号，不是硬门槛；判断标准是"这一层还能不能一眼看出来"。
- 三元只用于简单选值，不嵌套；`&&` / `||` 不用于控制流（条件执行、副作用），`??` 只用于默认值。

```ts
// ❌ 树被剪断：读者要脑补 else
function getStatus(order: Order | null) {
  if (order === null) return 'unknown'
  if (order.status !== 'paid') return 'pending'
  return 'paid'
}

// ✅ 树是完整的：两层判断，就写两层
function getStatus(order: Order | null) {
  if (order === null) {
    return 'unknown'
  } else {
    // 第二个 if 是"order 存在"这棵子树的下一层，
    // 写成 else if 会把两层压成一层。如果 lint 要求合并，关掉那条规则。
    if (order.status !== 'paid') {
      return 'pending'
    } else {
      return 'paid'
    }
  }
}
```

**为什么有时必须写 `else { if }`，而不是平级的 `else if`**

`else if` 表示**同一个判断的多个互斥取值**——它们是同一层的兄弟。`else { if }` 表示**上一层成立后才有资格问的子问题**——它们是父子。把子问题写成 `else if`，会在视觉上把它抬到和父问题同级，读者会以为三个条件是同一层的选项，丢掉"先有 order，才谈 status"这层信息。

```text
order 存在？
├─ 否 → 'unknown'
└─ 是 → status 不是 'paid'？
        ├─ 是 → 'pending'
        └─ 否 → 'paid'
```

```ts
// ✅ 平级：三个互斥取值，本来就是同一层
if (status === 'draft') { ... }
else if (status === 'published') { ... }
else { ... }
```

代价：有些 lint 规则会要求把嵌套的 `if` 合并成 `else if`——这类规则**不要启用**。层级深到 `}` 对不上号时，把子判断抽成命名函数（函数名就是那一层的标签），而不是用 `else if` 压平。

---

## 二、无类，无 this，组合优于封装

**看法**：`class` 把"状态"和"操作状态的方法"绑在一起，再用 `this` 隐式串起来。这带来三件事——隐式上下文、继承耦合、可变状态。我们用闭包、工厂、对象字面量、函数组合就能表达同样的东西，且每一步都是显式的。

**唯一例外**：继承 `Error` 定义错误类型。这是语言机制的必要用法（`this.name` 属于特批），不视为面向对象设计。

**因此**：

- **不写 `class`**（错误类型除外），**不写 `this`**。任何 `this` 都是设计信号：说明你在依赖隐式上下文。
- 需要"带状态的对象"→ 用**闭包工厂**：状态藏在闭包里，只通过返回的函数暴露操作。这个闭包就是该状态**唯一的所有者**；工厂外只能读，不能替它改。
- 需要"一组相关方法"→ 用**返回对象字面量的工厂**。
- 需要"串联处理"→ 用**函数组合**（`Pipe` / `Compose`）。
- 需要复用 → **组合**，不继承。
- **消费**第三方 class 是允许的（`new`、`instanceof` 库类型都可以）；这里禁的是"自己写 class"。
- 存量代码里的 class 是历史遗留：新代码不写；改动到哪个文件时再评估是否迁移，不做全仓重构。

```ts
// 用闭包代替类：状态在闭包里，操作是返回的函数
function CreateCounter() {
  let __count = 0
  return function increment() {
    __count += 1
    return __count
  }
}

// 用工厂代替"多方法对象"
function CreateUserApi(base_url: string) {
  // base_url 被闭包捕获但只读，按 5.4 不加 __
  return {
    getUser(id: UserId) { return fetch(`${base_url}/users/${id}`) },
    listUsers() { return fetch(`${base_url}/users`) },
  }
}

// 用组合表达管线
const normalizeOrder = Pipe(validateOrder, calcOrderTotal, formatReceipt)
```

**一句话**：能不建对象就不建对象；能组合就不继承；能显式传参就不靠 `this`。

---

## 三、副作用：集中，可控，而不是消除

**看法**：副作用不可能消除——I/O、网络、日志、时间、随机、状态变更，都是程序的本质。真正的问题不是"有副作用"，而是**副作用散落各处、互相干扰**：这个函数悄悄改了全局，那个函数也改，最终没人知道状态在什么时候变成了什么。

好的做法不是假装没有副作用，而是**让副作用集中到少数几个明确的点上**：

- 要么**用一个函数统一做**——所有"写"都从这里出去；
- 要么**在一个流程的固定阶段统一处理**——读代码的人知道"副作用发生在这个节点"。

这样，改的时候只改一处，读的时候只盯一处，调试的时候只有一个怀疑对象。

**因此**：

- **数据默认不可变**：修改 = 创建新对象/新数组，不原地改。可变状态越少，散落的副作用越少。
- **入参不可变**：函数不修改传入的东西。
- **把副作用整合到明确的点**：I/O、网络、日志、随机、时间，尽量收拢到少数几个函数或流程节点，而不是到处散落。
- **纯函数是默认形态**：能纯就纯，不能纯的，清楚它在哪个点上是脏的。
- 中间计算逻辑保持纯净，脏的事在明确的位置一次做完。

```ts
// ❌ 副作用散落：每个函数都各自写一点
function saveOrder(order: Order) {
  log('saving')            // 副作用 1
  db.write(order)          // 副作用 2
  metrics.inc('orders')    // 副作用 3
}

// ✅ 副作用集中：一个地方统一执行，其余是纯的
const buildSaveEffects = (order: Order) => [
  () => log('saving'),
  () => db.write(order),
  () => metrics.inc('orders'),
]

function runEffects(effects: Array<() => void>) {
  effects.forEach((run) => run())
}
```

### 3.1 单一所有者

**看法**：状态总得存在某处。问题不是"有没有状态"，而是"谁有权改它"。状态只允许有一个所有者——持有可变绑定的那个闭包、对象或入口。所有者之外，一切都是"收旧值、出新值"的纯函数。

**因此**：

- 谁持有 `let` / `Memo` / ref，谁就是所有者；写入口只能有一个。
- 跨函数边界的值不可变：更新 = 构造新值（`{ ...prev }`、`map.set`、`concat`），不改入参。
- 局部 `let` 只当累加器/游标，生命周期不超出函数体。
- 装配完成的对象 `Object.freeze`；不导出可变绑定。
- 模块级 `let` 是禁止的——它让状态隐式跨模块共享，没人说得清谁改的。

```ts
function CreateStateCell<State>(initial: State) {
  let __state = initial                 // 唯一所有者
  return {
    get: () => __state,
    update: (next: State) => { __state = next },
  }
}
```

**一句话**：副作用不是"关到边界"，而是"集中到可数的几个点"；状态不是"不能有"，而是"只能有一个主人"。

---

## 四、循环：结构化控制，不靠跳转

**看法**：`continue` 和 `break` 是控制流的"goto"——它们让读者在循环里寻找"哪里跳出去了"，破坏树形结构。

**因此**：

- **不用 `continue`**：把"跳过"改写成 `if` 包裹——条件成立才执行，本身就是树的一支。
- **不用 `break`**：把循环逻辑封进函数，用 `return` 退出。`return` 是树的一支的终点，`break` 是中途跳车。
- 循环内的 `if (xx) { return ... }` 不是"提前退出"，是**筛选并产出**：它的另一半是"继续扫描"，不是被剪掉的分支。只允许在"函数的目的就是查找/扫描，且循环结束即返回"时使用。
- 能用一个表达式说清"从集合里选什么"，就用 `map` / `filter` / `find` / `some` / `every`；`for...of` 留给有副作用的顺序执行。

```ts
// ❌ continue
for (const x of items) {
  if (!x.active) continue
  process(x)
}

// ✅ if 包裹（筛子）
for (const x of items) {
  if (x.active) {
    process(x)
  }
}

// ❌ break
let found: number | null = null
for (const current of list) {
  if (current === target_num) {
    found = current
    break
  }
}
if (found !== null) console.log('we found:', found)

// ✅ 使用 return（查找函数，循环是最后一段）
function findList(list: number[], target_num: number): null | number {
  for (const current of list) {
    if (current === target_num) {
      return current
    }
  }
  return null
}
const found = findList([2, 4, 5], 4)
if (found !== null) console.log('we found:', found)

// ✅ 更短：把"查找"交给 find，undefined 在边界归一成 null
function findNumber(list: number[], target_num: number): null | number {
  return list.find((current) => current === target_num) ?? null
}
```

`findList` / `target_num` 是**通用工具**里的名字，按 5.1 的例外允许；业务代码仍按业务语义命名。

---

## 五、命名即意图：名字是契约

**看法**：名字不是标签，是**读者对这段代码的第一份契约**。好的命名让读者不看实现就知道"它是什么、它能被怎么用"。

### 5.1 函数 vs 数据，命名要区分"角色"

- **函数**表达"动作/能力"：用 **camelCase**，`fetchUser`、`calcOrderTotal`。
- **数据**表达"值"：用 **snake_case**，`user_name`、`retry_count`、`order_items`。
- **通用工具函数**（放在 `utils/`，并且要么不引用任何领域类型，要么签名完全由泛型参数化）可以用描述性命名，包括 `findList`、`target_num` 这类带类型后缀的名字——它服务的是"任何集合"，不是某个业务概念。业务代码仍然禁止占位符和类型后缀。

名字一出现，读者就该知道这是"可以调用的"还是"可以读写的值"。

### 5.2 导出名带模块名，非导出名省略

**看法**：导出的名字离开模块路径也要能读懂；非导出的名字已经活在模块里，模块名是噪音。

**因此**：

- **导出的函数/变量**：名字里要有模块/领域名。泛化谓词/动作直接加前缀：`galleryInEvent`、`galleryCanSubmit`、`galleryInVotingPeriod`、`galleryCountVoteByPhoto`、`galleryMemberIsVoted`、`galleryMemberIsSubmitted`。
- **非导出的函数/变量**：省略模块名：`inEvent`、`canSubmit`、`inVotingPeriod`、`countVoteByPhoto`、`memberIsVoted`、`memberIsSubmitted`。
- 名字本身已经含领域名（`fetchUser`、`parseUserId`、`CreateUserApi`）就不重复加前缀；规则是"不能省掉领域名"，不是"必须多一个前缀"。
- 导出的数据值用 `__GALLERY_MAX_PHOTOS__` 这种形式：双下划线 + 模块名 + 变量名；非导出数据值不加模块名。
- 常量统一放 `constants.ts`，用命名导出；不要 `export default { ... }`（见 8.1）。
- 工厂同理：`CreateGalleryStore`，不要只写 `CreateStore`（除非它在 `utils/` 里是通用工具）。
- ❌ `voteCountByPhoto`、`memberHasVoted`、`memberHasSubmitted`：导出却省了 `gallery`；应改成 `galleryCountVoteByPhoto`、`galleryMemberIsVoted`、`galleryMemberIsSubmitted`。
- 本条约束导出的函数/变量；类型/接口按 5.6 的 PascalCase 规则，不受这条强制。

### 5.3 返回函数的函数 → PascalCase

**看法**：一个函数如果**产出的是可调用对象**（返回函数，或返回 `{ fn(){}, a(){} }` 这样的方法集合），它本质是**工厂/构造器**。用 PascalCase 让调用处一眼看出"这东西会给我一个能用的对象"。

```ts
function CreateCounter() { /* 返回函数 */ }
function CreateUserApi(base_url: string) { /* 返回多方法对象 */ }
function Pipe(...fns) { /* 返回函数 */ }
```

普通动作 `fetchUser()` 是 camelCase；产出能力的 `CreateCounter()` 是 PascalCase。**看名字就知道拿到的是"结果"还是"能力"。**

判断标准是**产物**，不是声明形式：用 `const` 声明的可调用物，仍按函数命名；返回函数、返回方法集合、返回"能力元组"（如 `[get, set]`）都算工厂。

### 5.4 作用域可见性写进名字

**看法**：变量的作用域是它最重要的属性之一，应该在名字上就暴露出来，而不是让读者去追踪闭包。

- **普通局部数据**：`var_name`。
- **被写入的跨作用域状态**：`__var_name`。双下划线是"注意，这个值会被改"的信号。
- **只读的闭包捕获**：保持普通命名，不加 `__`（`base_url` 就是 `base_url`）。
- **顶级导出**：`__MODULE_VAR_NAME__`。只用于导出的**数据值**；导出的函数/工厂按 5.1、5.3 命名，即便用 `const` 声明；模块名不能省（见 5.2）。

```ts
function CreateCounter() {
  let __count = 0          // 被返回的函数写入 → 加 __
  return function increment() {
    __count += 1
    return __count
  }
}

export const __GALLERY_MAX_PHOTOS__ = 30   // 导出的数据值（带模块名）
```

**原则**：名字应当回答"这是什么角色、在哪个范围、能不能改"，无需读者去上下文里翻找。

### 5.5 其他

- 布尔值带 `is` / `has` / `can` / `should` 前缀；状态/角色用 `is`（`is_voted`），拥有/包含用 `has`（`has_children`），读到名字就知道是判断。
- 命名必须表意，禁止 `data`、`temp`、`obj`、`flag` 这类"占位符"。
- 变量名不带类型信息（`user_list` → `users`），类型由 TS 表达。
- 类型/接口用 PascalCase；泛型用 `T` / `TValue` / `TResult`，不要用 `TItem` 这类撞领域术语的名字。
- 品牌符号（`declare const UserIdBrand: unique symbol`）是类型层的东西，用 PascalCase，不走 `__MODULE_VAR_NAME__` 那套。

### 5.6 命名决策表

| 东西 | 形态 | 命名 | 例 |
|---|---|---|---|
| 导出的数据值 | 不可调用 | `__MODULE_VAR_NAME__` | `__GALLERY_MAX_PHOTOS__` |
| 导出的函数，返回数据 | 动作 | `moduleAction` | `galleryInEvent` |
| 导出的工厂，返回可调用物/能力集合 | 能力 | `CreateModuleX` | `CreateGalleryStore` |
| 非导出函数/数据 | 函数/数据 | 省略模块名 | `inEvent` / `max_photos` |
| React 组件 | 框架约定 | PascalCase | `GalleryCard` |
| Hook | 框架约定 | `useX` | `useGalleryVotes` |
| 类型/接口 | 类型层 | PascalCase | `UserId` |
| 品牌符号 | 类型层 | PascalCase | `UserIdBrand` |
| 通用工具函数 | 无领域类型或全泛型、在 `utils/` | 描述性，可用类型后缀 | `findList`、`target_num` |
| 闭包内被写入的状态 | 所有者 | `__name` | `__count` |
| 只读捕获/局部数据 | 值 | snake_case | `base_url` |
| 布尔 | 判断 | `is` / `has` / `can` / `should` | `is_voted`、`has_children` |
| 内部哨兵 | 不导出 | `NONE` | `const NONE = Symbol('NONE')` |

### 5.7 `parse` / `check` / `is` / `isNot` / `as` / `to`

- `parseX`：把 raw 转成合法的 X，参考 `JSON.parse` 的“转换”含义；**返回值一定满足 `checkX` 的约束**（复用同一组 `isX` / `isNotX` 谓词），但 parse 内部不调用 `checkX`——它在转换过程中把约束落实。失败抛解析错误。
- `checkX`：**多项**运行时校验，失败抛领域错误；可返回收窄后的类型（如品牌）。用于两类地方：值不是 `parseX` 产出的（DB、其他模块、外部注入）；测试里验证 parse 的契约。内部用 `isX` / `isNotX` 判断，最后统一抛一次。
- `isX`：布尔守卫，不抛错。
- `isNotX`：`isX` 的否定，布尔，不抛错；和 `isX` 搭配用在 `checkX` 里。
- `parseX` 的输出保证能通过 `checkX`；单元测试用 `expect(() => checkX(parseX(raw))).not.toThrow()` 之类固定这个契约。
- `asX`：不校验的断言，只允许在测试/fixture/已校验的边界内。
- `toX`：域内转换，输入已经是领域类型；纯函数、总函数，不做校验、不接收 `unknown`（可选）。
- 名字必须诚实：转换的叫 `parse`，多项校验的叫 `check`，布尔判断的叫 `is` / `isNot`，不校验的断言叫 `as`。

`checkX` 里用 `isX` / `isNotX` 把失败原因收集起来，最后抛一次；不要在每个单项检查里各抛一次。

---

## 六、类型：把约束写进语言

**看法**：类型是**在编译期替读者和未来维护者把关的契约**。我们用它消除可能性，而不是绕过可能性。

**因此**：

- **不用 `any`**，用 `unknown` + 收窄。`any` 是关掉了契约。
- **不用 `!` 非空断言**，用显式判空——判空本身就是一棵树的分支。
- **不滥用断言**，优先类型守卫与可辨识联合。
- **导出 API 显式标注返回类型**，防止推断漂移。
- 用**联合字面量**代替 `enum`，零运行时、天然可序列化。
- 公共数据结构用 `readonly`，在类型层表达"不可变"。

### 6.1 空值：默认 `null`，内部用 `NONE`

**默认 `null`。** `null` 表达"没有这个值"；`undefined` 只留给语言强加的位置——可选属性、`Map.get`、数组越界、第三方返回值。跨出边界时归一：

```ts
const value = map.get(key) ?? null
```

**可选属性只表达"键可能缺席"**：`{ cover?: string }` 是"可能没有 cover 这个键"；"有 cover，但值为空"用 `{ cover: string | null }`。两者不要混。

**内部哨兵用符号**：需要区分"未设置"和"设为空"、且绝不参与序列化的内部状态，用：

```ts
const NONE = Symbol('NONE')
export type NONE = typeof NONE
export function isNone(value: unknown): value is NONE {
  return value === NONE
}
```

`NONE` 只在模块内部定义，不导出符号本身；对外只给类型和 `isNone()`。它不参与 JSON——一旦要跨网络/存盘，换成 `null` 或 `Result`。

### 6.2 品牌类型：让"长得一样"的值不可互换

**看法**：`UserId`、`OrderId`、`ProductId` 在运行时都是 `string`，编译器也认为是同一个类型。把订单 ID 传给"查用户"的函数，编译通过，运行时出错。这类"语义不同、结构相同"的值，应该用**品牌类型**把它们区分开。

```ts
declare const UserIdBrand: unique symbol
type UserId = string & { readonly [UserIdBrand]: 'UserId' }

function isUserId(raw: unknown): raw is UserId {
  return typeof raw === 'string' && raw.startsWith('u-')
}

// parse：用 isX 判断；失败抛解析错误；不调用 checkUserId
function parseUserId(raw: unknown): UserId {
  if (isUserId(raw)) {
    return raw
  } else {
    throw new ParseError(`user id 不是合法的字符串: ${String(raw)}`)
  }
}

// check：用同一组 isX 判断；失败统一抛一个领域错误
function checkUserId(value: unknown): UserId {
  if (isUserId(value)) {
    return value
  } else {
    throw new ValidationError(`invalid user id: ${String(value)}`)
  }
}

// 边界直接用 parse 的产物；测试里验证 parse 的输出一定通过 check
const user_id = parseUserId(raw)
expect(() => checkUserId(parseUserId(raw))).not.toThrow()
```

`parseX` 和 `checkX` 复用同一组 `isX` / `isNotX` 谓词；parse 不调用 check，但输出必须通过 check。`as` 只允许出现在测试/fixture 里，或已经过 `isX` 收窄后仍需断言的边界；不要用 `as` 代替 `isX` / `checkX`。

**原则**：品牌类型的价值是"把领域语义写进类型系统"，让错误在编译期暴露。不需要为所有原始类型都套品牌——**只在领域身份重要、容易被混淆的地方用**（id 是典型）。

### 6.3 让非法状态不可表示

**看法**：一堆可选字段看起来灵活，实际上把"哪些组合是合法的"交给了读者。用可辨识联合把非法组合从类型里去掉。

```ts
type LoadState<T> =
  | { status: 'loading' }
  | { status: 'ok'; data: T }
  | { status: 'error'; error: Error }

function unreachable(value: never): never {
  throw new Error(`unexpected value: ${String(value)}`)
}
```

新增分支时，`unreachable` 会让编译器提醒你漏了哪一支。可选属性只表达"键可能缺席"；"值可能没有"用 `null`；两者不要混。

### 6.4 边界解析：把 `unknown` 变成精确类型

**看法**：外部数据（JSON、env、HTTP、文件）在运行时是 `unknown`。`as` 只是让编译器闭嘴，不会让数据变对。

**因此**：

- 边界用 `parseX(raw)` 产出 X。parse 的返回值保证能通过 `checkX`；它用 `isX` / `isNotX` 在转换过程中落实约束，但不调用 `checkX`。
- `checkX` 用同一组 `isX` / `isNotX` 判断，最后统一抛一次；用于两类地方：值不是 parse 产出的（DB、其他模块、外部注入）；测试里验证 parse 的契约。
- 单元测试固定契约：`expect(() => checkX(parseX(raw))).not.toThrow()`；非法 raw 在 parse 阶段失败；check 对 parse 的产物失败，说明 parse 违约（bug）。
- 内部函数信任类型，不再重复判空——这也是消除早返回的来源。
- 不用 `as` 穿过边界；不用 `!`；不用 `any`。
- parse 失败抛解析错误，check 失败抛领域错误；都可以用 `{ cause }` 保留根因，或用 Result 表达预期失败；不要返回半成品。

### 6.5 `readonly` / `as const` / `satisfies`

- 公共数据结构用 `readonly`，在类型层表达"不可变"；装配完成后用 `Object.freeze` 兜住运行时（见 3.1）。
- `as const` 用于字面量表，让类型收窄到字面量。
- `satisfies` 用于"检查形状但不拓宽类型"：

```ts
const config = {
  retry: 3,
  timeout: 1000,
} satisfies RetryConfig
```

---

## 七、函数设计

- **位置参数不用 `?`**。`f(x?: T)` 让"没传"和"传了 `undefined`"不可区分，调用点也看不出有几种形态。
- **默认值是另一回事**：只有当"缺省"本身是一种真实、有名字的 API 模式时才允许——默认分页大小、默认排序方向、默认配置。默认值写成具名常量；如果只是为了少传一个参数，就必填，让调用方显式传（可以是 `null`）。
- **对象参数里的可选属性**用于 partial update、props、配置；参数本身仍然必传：

```ts
// ✅ 参数必传，缺的是对象里的键
updateItem(item_id, { partial_prop: xxx })

// ✅ 对象参数：depth 的 0 是真实默认，不是图方便
function renderOrder({ order, depth = 0 }: { order: Order; depth?: number }) { ... }

// ✅ React props 是对象，属性可可选
function Card({ title, cover }: { title: string; cover?: string }) { ... }
```

错误构造器的 `options?: ErrorOptions` 是唯一例外（1:1 转发语言内建签名）；对象解构默认值只有在属性确实有"默认模式"时才用。

- **参数过多用对象参数**；**不用布尔参数**（`render(true)` 是语义黑洞）。
- **不修改入参**。
- **用组合构建逻辑**：把复杂流程拆成若干纯函数，再用 `Pipe` 串起来，而不是写一个大函数里嵌套判断。
- **控制流遵循第一节**：函数内部是完整的树，不靠早返回打平。
- **单一职责**：一个函数做一件事。行数是信号不是门槛：线性、直白的 80 行可以留；40 行但关系纠缠、要来回跳读的，就该拆。判断标准是可读性、重要性、必要性。
- **导出函数/方法显式标注返回类型**（与第六节呼应）。

---

## 八、模块与边界

- 一个文件一个主要职责；大文件是拆分的信号。行数是信号，不是门槛；判断标准是读者要在文件里跳几次。
- 类型导入用 `import type`，让"类型"和"值"在导入层就分清。
- **模块顶层不跑副作用**：不在 import 时读配置、连数据库、注册全局 handler。
- **组合根**：配置读取、依赖创建、副作用装配只在入口（`main.ts` / 框架入口）做一次；其余模块只导出纯函数和工厂，依赖从参数进来。
- 不导出可变绑定；不搞模块级单例；配置只在入口读，不散落在各个模块。
- 内部引用直指源文件，对外才用 barrel（`index.ts`）收口。
- 避免循环依赖；发现循环先拆模块，不靠延迟 `import` 绕过。

### 8.1 常量：统一位置，命名导出

**看法**：常量是"编译期固定、可共享的值"；它应该能被单独引用、被 tree-shake、被搜索和重构。`export default { ... }` 会把所有常量绑成一个对象，所有引用共享它，按名导入、tree-shake、重构都变差。

**因此**：

- 导出的常量统一放 `constants.ts`（每个包/领域一个；项目只有一个域就一个文件，不要把所有包的常量堆进一个全局文件）。
- 用**命名导出**，不要 `export default { ... }`：

```ts
export const __GALLERY_VIEWPORT_MAX_WIDTH__ = 1440
export const __BASE_PG_RETRY_COUNT__ = 5
```

- 如果常量是在某个 module 里计算出来的，`constants.ts` 用 re-export 把它收口；调用方只从 `constants.ts` 取，不需要知道生产者在哪：

```ts
export { __MODULE_CALCULATED__ } from './module'
```

- 计算必须是纯的、便宜的；依赖运行期配置/时间/随机的值不是常量，走组合根。
- 被 re-export 的模块不要反向 `import './constants'`，否则形成循环；原始常量下沉到更底层（如 `base-constants.ts`）。

- 名字按 5.2：`__MODULE_VAR_NAME__`；`__FOO__` 这种没有模块名的，只适合演示语法或真正的全局常量，不是有明确归属的合格常量。
- 只在文件内用的常量留在本地，不必搬进 `constants.ts`；集中是为了共享，不是为了整齐。
- 对象/数组常量用 `as const`（必要时 `Object.freeze`），不要导出可变对象。
- 运行期配置不是常量：它由组合根读取/注入（见本节前文），不要塞进 `constants.ts`。

**一句话**：常量按名导出，不按对象打包；一个域一个 `constants.ts`，本地常量留在本地，计算出来的常量在 `constants.ts` 收口。

---

## 九、异步与错误：catch 必须负责，兜底统一，保留 cause

### 9.1 错误到了这一层，只有三种选择

**看法**：catch 不是"我接住了"的证明，而是"我决定对这条错误负责"的声明。接住却不处理，比不接住更糟——错误被藏起来，调用方以为一切正常。

**因此**，只有三种选择：

1. **包装后继续抛**：加上本层独有的信息（路径、id、阶段），`throw new Error(msg, { cause: err })`；或者在体系边界翻译成领域错误。包装必须带来新信息，且每个 catch 块最多一次。
2. **判别后在本层处理**：先确认"这是什么错误"，只对能处理的那一类做真实补救——重试、换源。处理不了的照旧抛。
3. **交给调用方**：不 catch，让异常继续冒泡；或者把它转成 `Result` 显式返回，逼调用方分支。

**禁止第四种：无条件吞掉。** `catch { return null }`、`catch { return [] }`、空 catch 都是——它让"出事了"和"没有"变成同一个结果。

**判据**：处理之后，失败是**被真正解决**了（重试成功、换到了可用的源），还是只是**被藏起来**了（调用方拿到一个和正常情况无法区分的值）？后者就是吞。

```ts
// ❌ 吞：缓存挂了，调用方以为只是没命中
async function readCache(key: string): Promise<string | null> {
  try {
    return await cache.get(key)
  } catch {
    return null
  }
}

// ✅ 处理：只对"暂时性失败"重试，其余包装后上抛
async function fetchWithRetry(url: string, remain: number): Promise<Response> {
  try {
    return await fetch(url)
  } catch (err: unknown) {
    if (err instanceof TimeoutError && remain > 0) {
      return await fetchWithRetry(url, remain - 1)
    } else {
      throw new Error(`fetch failed: ${url}`, { cause: err })
    }
  }
}

// ✅ 交给调用方：失败以 Result 显式返回，由调用方分支（定义见 9.4）
async function readCache(key: string): Promise<Result<string | null, CacheError>> {
  try {
    return { ok: true, data: await cache.get(key) }
  } catch (err: unknown) {
    return { ok: false, error: new CacheError(`cache read failed: ${key}`, { cause: err }) }
  }
}
```

**要"判别"，错误就必须可判别。** 靠 `err.message.includes('timeout')` 判断类型，等于靠文案猜类型——文案一改，逻辑就错。领域错误要带稳定的 `code`（联合字面量），或使用专用类 + 类型守卫；`code` 是契约的一部分，改动等同破坏 API。判别时穷尽已知情况，未知的用 `else` 兜底并原样上抛。

```ts
type AppErrorCode = 'CONFIG_INVALID' | 'STORAGE_UNAVAILABLE' | 'NETWORK_TIMEOUT'

class AppError extends Error {
  readonly code: AppErrorCode

  constructor(code: AppErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AppError'
    this.code = code
  }
}
```

### 9.2 必须有兜底

**看法**：即使各处都有处理，也总有漏网之鱼。程序必须有一个**最后一道防线**，统一处理未被捕获的错误，而不是让它们静默消失或炸穿进程。

**因此**：顶层（进程/框架/入口）必须有一个统一的兜底机制——Node 的 `process.on('unhandledRejection')` / `uncaughtException`、浏览器的 `window.onerror` / `unhandledrejection`、框架的 error boundary / 中间件统一 error handler。兜底逻辑负责记录、上报、给出可读的最终状态。它是整条链上**唯一**记录"未被处理错误"的地方——中间层不要 log 完再抛；已经在本层处理掉的错误可以就地记一次，但同一件事只记一次。

### 9.3 传递错误必须保留 cause

**看法**：错误的价值一半在"发生了什么"，另一半在"因为什么"。包装错误时丢掉原始错误，等于把根因扔了。

**因此**：任何在 catch 后抛出**新错误**（包括自定义错误）的地方，都要用 `{ cause }` 保留原始错误链：

```ts
try {
  await loadConfig(path)
} catch (err: unknown) {
  throw new Error(`failed to load config: ${path}`, { cause: err })
}
```

**自定义错误类也必须支持 cause**，否则它就无法接入这套错误链：

```ts
class ConfigError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)   // 透传 cause
    this.name = 'ConfigError'
  }
}

// 使用
try {
  await loadConfig(path)
} catch (err: unknown) {
  throw new ConfigError(`failed to load config: ${path}`, { cause: err })
}
```

**理由**：一条完整的 `cause` 链，从最外层错误能一路追到根因；丢掉的 `cause` 就是丢失的排查路径。

**兜底处打完整链**，而不是只打 `message`：

```ts
function collectCauseChain(err: unknown): unknown[] {
  if (err instanceof Error) {
    return [err, ...collectCauseChain(err.cause)]
  } else {
    return []
  }
}

// 入口：整条链上唯一的记录点
try {
  await start()
} catch (err: unknown) {
  console.error('fatal:', ...collectCauseChain(err))
  process.exitCode = 1
}
```

并发多错误用 `AggregateError`，每个子错误各自保留 cause。

### 9.4 其他异步与错误约定

- **悬浮 Promise 是 bug**：不 `await` 就 `void` 或 `.catch()`。
- **只抛 `Error` 子类**，不抛字符串/裸对象。
- `catch` 到的按 `unknown` 处理，收窄后再用。
- `catch` 里同样遵循树形 `if {} else {}`，不早返回。
- **独立异步任务用 `Promise.all`**：不要在循环里 `await`；需要全部结果（包括失败）时用 `Promise.allSettled`。
- **超时/取消用 `AbortSignal`**，不要把超时塞进业务判断。
- **流式处理用 `for await`**，不要把流先攒成数组再处理。

**Result 形态**：可预期的业务失败用 Result，异常只留给意外。

```ts
type Result<T, E = Error> =
  | { readonly ok: true, readonly data: T }
  | { readonly ok: false, readonly error: E }
```

- 校验不过、找不到、余额不足 → Result。
- 不变量破坏、编程错误、依赖挂了 → throw。
- 一个函数选定一种，内部不混用；throw ↔ Result 的转换只在边界做一次。

---

## 十、注释：好代码自解释，注释是例外

**看法**：注释是**代码没表达清楚的补救**，不是默认配置。一段需要大量注释才读得懂的代码，多半是该重构、该改名、该拆函数。好代码读起来就是注释。

**因此**：

- **不写解释"是什么"的注释**。如果代码本身说不清，先考虑改名、拆函数、简化逻辑，而不是补一段注释。
- **只在两种情况下写注释**：
  1. **特别困惑的地方**——反直觉的写法、违反常理的实现、非显而易见的约束，需要解释"为什么这么做"。
  2. **需要特别注意的地方**——危险的边界、性能陷阱、依赖的隐含前提、已知的坑。
- 公共 API 的 TSDoc 属于"需要特别注意"的范畴：函数签名本身说明不了"返回值的语义、会抛什么、有什么约束"，这些写清楚。
- 不写分节分隔注释、不写复述代码的注释、不留注释掉的代码、不给显而易见的东西加注释。
- 注释与代码同步。注释误导比没有注释更糟。
- 除非有正当的理由，否则不留死代码，`TODO` 带责任人与 issue。

**一句话**：先让代码自己说话；只有当代码确实说不清、或者必须提醒读者注意时，才写注释。**注释越少越好，但该有的必须有。**

---

## 十一、测试：行为变更必须有测试

**看法**：测试不是"证明代码能跑"，是**把行为固定成契约**。没有测试的行为变更，等于让下一个人靠猜。

**因此**：

- **纯函数必测**：输入输出就是契约。
- **边界解析必测**：非法输入、缺失字段、类型错误，至少各一条。
- **每个 bugfix 带回归测试**：先写能复现的用例，再修。
- **测试与源码同构**：`foo.ts` 对应 `foo.test.ts`；测试名描述行为，不描述实现。
- **确定性**：时间、随机、id、I/O 从参数注入；测试里给固定替身。
- **不 mock 纯函数**；mock 只放在网络/文件/时间等边界；不测实现细节。
- **测试代码遵守同样的类型和命名规则**；fixture 里允许 `as`。
- 提交前跑测试；不通过不提交。

**一句话**：测试是完成标准的一部分，不是可选项。

---

## 十二、评审自查与 Agent 工作协议

### 12.1 提交前自查

- [ ] **查过术语表吗？** 命名/类型与 `glossary.md` 一致吗？有没有把 `Item` 这类领域术语用在通用工具函数上？
- [ ] **树完整吗？** 有没有 early return 剪断分支、有没有该补的 `else`？
- [ ] **`else if` 和 `else { if }` 分清了吗？** 同级兄弟才用 `else if`，跨层用嵌套。
- [ ] **有类吗？有 this 吗？** 除了错误类型，新代码都应该没有。
- [ ] **状态有唯一所有者吗？** 有没有模块级 `let`、散落的写操作？
- [ ] **副作用集中在可数的几个点吗？**
- [ ] **循环里还有 continue / break 吗？**
- [ ] **命名对了吗？** 导出的函数/变量带模块名（`galleryInEvent` / `__GALLERY_MAX_PHOTOS__`），非导出省略；函数 camelCase；工厂 PascalCase；数据 snake_case；被写入的捕获 `__name`；通用工具才有类型后缀例外。
- [ ] **常量放对地方了吗？** 导出的常量在 `constants.ts`、用命名导出吗？计算出来的常量是否 re-export 收口？调用方是否只从 `constants.ts` 取？有没有 `export default { ... }` 或可变对象？
- [ ] **类型契约还在吗？** 无 `any`、无 `!`、导出有返回类型；边界数据由 `parse` 产出（输出保证通过 `check`），不是 `as` 出来的；该用品牌类型的地方用了吗？
- [ ] **check 内部是 `isX` / `isNotX` 吗？** 有没有在每个单项检查里各抛一次？`checkX` 应该收集/判断，最后统一抛一次。
- [ ] **空值统一吗？** 默认 `null`；`undefined` 只出现在语言强加处；`NONE` 只在内部、不参与 JSON。
- [ ] **可选参数/默认值合规吗？** 位置参数没有 `?`（错误构造器透传 `ErrorOptions` 除外）；默认值有真实的"默认模式"语义；对象参数属性可选。
- [ ] **catch 都负责了吗？** 要么包装并保留 `cause`，要么判别后真处理，要么根本没 catch；有没有 `catch { return null }` / `return []`？
- [ ] **错误可判别吗？** 有没有靠 `message` 字符串猜类型？
- [ ] **兜底在吗？** 顶层有统一兜底，且未处理的错误只在兜底记录一次。
- [ ] **新增/变更行为有测试吗？**
- [ ] **注释是否多余？** 能不能靠改名/拆函数让它消失？留下的注释是否都在解释"为什么"或"注意什么"？
- [ ] **diff 干净吗？** 只包含本次任务相关改动；偏离硬规则的地方有 `// justify` 吗？

### 12.2 Agent 工作协议

**开工前**：

1. 读 [glossary.md](glossary.md) 和本文；本次任务涉及的术语先确认。
2. 看目标文件及邻近代码的既有风格；本文没写的，跟随局部约定。

**动手时**：

- 最小 diff：只改与任务相关的代码；不顺手重排、不批量改格式、不加依赖。
- 新代码遵守本文；旧代码只在与本次改动直接相关时迁移，不做全仓重构。
- 需要偏离硬规则时，就地写 `// justify: <节号> <理由>`，并在交付说明里列出；没有标注的偏离算违规。
- 不写解释性/总结性注释，不主动新建文档；示例是示意，不是模板。

**收尾**：

- 跑项目规定的检查（类型检查、lint、测试）；贴结果，不通过不说"完成"。
- 静态检查通过不等于合规——以本文为准。
- 列出改动文件、公开 API 变化、偏离项、未解决项。

---

## 附录 A：改造速查表

| 看到 | 改成 | 依据 |
|---|---|---|
| `class Foo` | 闭包工厂 / 对象字面量工厂 | 第二节 |
| `this.` | 显式参数 / 闭包 | 第二节 |
| `if (x) return` 后接逻辑 | 完整 `if / else`，或抽函数 | 第一节 |
| `else if` 压平子层 | `else { if }` 嵌套，或抽命名函数 | 第一节 |
| 循环里 `break` / `continue` | `find` / 抽查找函数 / `if` 包裹 | 第四节 |
| `catch { return null }` / `return []` | 包装 + cause / 判别后处理 / Result | 9.1 |
| `catch (e) { log(e); throw e }` | 删掉 log，让兜底记一次 | 9.2 |
| `any` | `unknown` + `parse` + `check` | 第六节 |
| 外部数据上 `as Foo` | `parseFoo`（产出）/ `checkFoo`（验证） | 6.4 |
| `parseX` 调用 `checkX` 兜底 | parse 自己保证输出合法；check 用同一组 isX 验证 | 5.7 |
| 每个单项检查各自 throw | 改成 `isX` / `isNotX` 判断，由 `checkX` 最后抛一次 | 5.7 |
| `!` | 显式判空 | 第六节 |
| `enum` | 联合字面量 + `as const` | 第六节 |
| `x?: T` 位置参数 | 对象参数（属性可选）或 `T \| null` | 第七节 |
| 只为少传参数的默认值 | 必填，调用方显式传；默认值只在有真实默认模式时保留 | 第七节 |
| 模块级 `let` | 单一所有者闭包 / 显式传入 | 3.1 |
| `export const foo = 1` | `__GALLERY_FOO__`（导出数据值带模块名） | 5.2 / 5.4 |
| `export const createFoo = () => ...` | `CreateGalleryFoo`（返回可调用物） | 5.3 |
| 导出的 `inEvent` / `canSubmit` | `galleryInEvent` / `galleryCanSubmit` | 5.2 |
| 非导出的 `galleryInEvent` | `inEvent` | 5.2 |
| `export default { __FOO__ }` | `export const __MODULE_FOO__ = ...`（`constants.ts` 命名导出） | 5.2 / 8.1 |
| 调用方绕过 constants 直接 import 计算模块 | `constants.ts` 里 `export { __CALCULATED__ } from './module'`，调用方只从 constants.ts 取 | 8.1 |
| 手工品牌字段 | `unique symbol` 品牌 | 6.2 |
| `null` / `undefined` 混用 | 默认 `null`，边界归一 | 6.1 |
| 通用工具里用 `Item` | 泛型 `T` / `entry` / `value` | 第零节 |
| 悬浮 Promise | `await` / `void` / `.catch()` | 9.4 |

---

> 一句话总结这套方法论：**把代码当作一棵完整的树来写，用函数的组合而不是对象的状态来表达逻辑；让名字和类型把意图说清楚；让副作用集中在可数的几个点，让状态只有一个所有者；让每个 catch 都对错误负责、统一兜底、保留根因；让代码自己说话，只在必要处解释。**
