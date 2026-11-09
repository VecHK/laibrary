# TypeScript 编程方法论

> 这不是一份配置清单，而是一套**看待代码的方式**。
> 规则会过时，但背后的思想与方法论不会。下面每条都先讲"我们如何看待它"，再讲"因此怎么写"。
>
> **关于示例**：下面出现的代码都是**示意**，用来讲清判据，不是模板。不要照抄其中的标识符、签名或辅助函数；与规则冲突时以规则为准。要学的是"为什么这样写"，不是"原样长这样"。

---

## 总纲：我们如何看待代码？

1. **代码是一棵树，不是一条流水线。** 控制流是分叉与汇合的结构，不是"走到某处就跳出去"或者“如果为真就走这条路然后再回来”的脚本。
2. **行为应该被组合，而不是被封装进状态。** 我们用函数的组合表达逻辑，而不是用对象持有状态、再用方法操作它。
3. **上下文应该显式传递，而不是隐式携带。** 一个函数需要什么，就写在参数里；不依赖"我身处何处"。
4. **副作用无法消除，但要可控。** 干净的不是"没有副作用"，而是"副作用集中在少数明确的点上"，读的人知道它在哪里发生，改的人知道只改一处。

后面所有约定，都是这上面四点的推论。

---

## 一、控制流：把代码当作树

**看法**：`if` 是树的**分叉**，`else` 是另一支。每个分支都应该是完整、自洽的一棵子树。提前 `return` 等于在树的中间"剪断"一支，让读者不得不在脑子里补全"否则会怎样"——这违背了树的可读性。

**因此**：

- 需要"否则"语义时，**显式写出 `else`**，不靠提前返回隐式表达。
- 不写 `if (xx) return` 再跟逻辑的卫语句。读者看到的应该是一棵完整的二分树，而非"跳出去就结束"的线性脚本。
- 分支必须用 `{}` 包裹，哪怕只有一行。树的每一支都是可见的块。
- 嵌套太深时，**拆函数**降低层级，而不是用 early return 把树压平。压平只是把复杂度藏进了阅读顺序里。如果超过4级的嵌套，你就得考虑拆开。

```ts
// ❌ 树被剪断：读者要脑补 else
function getStatus(order?: Order) {
  if (!order) return 'unknown'
  if (order.status !== 'paid') return 'pending'
  return 'paid'
}

// ✅ 树是完整的
function getStatus(order?: Order) {
  if (!order) {
    return 'unknown'
  } else {
    if (order.status !== 'paid') {
      return 'pending'
    } else {
      return 'paid'
    }
  }
}
```

---

## 二、无类，无 this，组合优于封装

**看法**：`class` 把"状态"和"操作状态的方法"绑在一起，再用 `this` 隐式串起来。这带来三件事——隐式上下文、继承耦合、可变状态。我们用闭包、工厂、对象字面量、函数组合就能表达同样的东西，且每一步都是显式的。

**唯一例外**：继承 `Error` 定义错误类型。这是语言机制的必要用法（`this.name` 属于特批），不视为面向对象设计。

**因此**：

- **不写 `class`**（错误类型除外），**不写 `this`**。任何 `this` 都是设计信号：说明你在依赖隐式上下文。
- 需要"带状态的对象"→ 用**闭包工厂**：状态藏在闭包里，只通过返回的函数暴露操作。
- 需要"一组相关方法"→ 用**返回对象字面量的工厂**。
- 需要"串联处理"→ 用**函数组合**（`Pipe` / `Compose`）。
- 需要复用 → **组合**，不继承。

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
  return {
    getUser(id: UserId) { return fetch(`${base_url}/users/${id}`); },
    listUsers() { return fetch(`${base_url}/users`); },
  }
}

// 用组合表达管线
const normalizeOrder = Pipe(validateOrder, calcTotal, formatReceipt)
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

**一句话**：副作用不是"关到边界"，而是"集中到可数的几个点"。读代码的人应该能数出脏的地方有几处。

---

## 四、循环：结构化控制，不靠跳转

**看法**：`continue` 和 `break` 是控制流的"goto"——它们让读者在循环里寻找"哪里跳出去了"，破坏树形结构。

**因此**：

- **不用 `continue`**：把"跳过"改写成 `if` 包裹——条件成立才执行，本身就是树的一支。
- **不用 `break`**：把循环逻辑封进函数，用 `return` 退出。`return` 是树的一支的终点，`break` 是中途跳车。
- 循环内的 `if (xx) { return ... }` 是"用 return 替代 break"的**唯一特批**，因为它表达的仍是一棵完整的判断树。

```ts
// ❌ continue
for (const x of items) {
  if (!x.active) continue
  process(x)
}

// ✅ if 包裹
for (const x of items) {
  if (x.active) {
    process(x)
  }
}

// ❌ break
let finded = null
for (const current of list) {
  if (current === target_num) {
    finded = current
    break
  }
}
if (finded !== null) console.log('we finded:', finded)

// ✅ 使用 return
function findList(list: number[], target_num: number): null | number {
  for (const current of list) {
    if (current === target_num) {
      return current
    }
  }
  return null
}
const finded = findList([2,4,5], 4)
if (finded !== null) console.log('we finded:', finded)

```

---

## 五、命名即意图：名字是契约

**看法**：名字不是标签，是**读者对这段代码的第一份契约**。好的命名让读者不看实现就知道"它是什么、它能被怎么用"。

### 5.1 函数 vs 数据，命名要区分"角色"

- **函数**表达"动作/能力"：用 **camelCase**，`fetchUser`、`calcTotal`。
- **数据**表达"值"：用 **snake_case**，`user_name`、`retry_count`、`order_items`。

名字一出现，读者就该知道这是"可以调用的"还是"可以读写的值"。

### 5.2 返回函数的函数 → PascalCase

**看法**：一个函数如果**产出的是可调用对象**（返回函数，或返回 `{ fn(){}, a(){} }` 这样的方法集合），它本质是**工厂/构造器**。用 PascalCase 让调用处一眼看出"这东西会给我一个能用的对象"。

```ts
function CreateCounter() { /* 返回函数 */ }
function CreateUserApi(base_url: string) { /* 返回多方法对象 */ }
function Pipe(...fns) { /* 返回函数 */ }
```

普通动作 `fetchUser()` 是 camelCase；产出能力的 `CreateCounter()` 是 PascalCase。**看名字就知道拿到的是"结果"还是"能力"。**

### 5.3 作用域可见性写进名字

**看法**：变量的作用域是它最重要的属性之一，应该在名字上就暴露出来，而不是让读者去追踪闭包。

- **普通局部数据**：`var_name`。
- **跨作用域共享**（被内部函数读写、闭包捕获）：`__var_name`。双下划线是"注意，这个值被多处读写"的信号。
- **顶级导出**：`__VAR_NAME__`。前后双下划线 + 全大写，一眼是"全局常量"。

```ts
function CreateCounter() {
  let __count = 0          // 被返回的函数捕获 → 跨作用域
  return function increment() {
    __count += 1
    return __count
  }
}

export const __VIEWPORT_WIDTH__ = 1280   // 顶级导出常量
```

**原则**：名字应当回答"这是什么角色、在哪个范围、能不能改"，无需读者去上下文里翻找。

### 5.4 其他

- 布尔值带 `is_` / `has_` / `can_` / `should_` 前缀，读到名字就知道是判断。
- 命名必须表意，禁止 `data`、`temp`、`obj`、`flag` 这类"占位符"。
- 变量名不带类型信息（`user_list` → `users`），类型由 TS 表达。

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

### 6.1 品牌类型：让"长得一样"的值不可互换

**看法**：`UserId`、`OrderId`、`ProductId` 在运行时都是 `string`，编译器也认为是同一个类型。把订单 ID 传给"查用户"的函数，编译通过，运行时出错。这类"语义不同、结构相同"的值，应该用**品牌类型**把它们区分开。

**因此**：当一个原始类型（通常是 `string` 或 `number`）代表**有特定身份或约束的领域值**（各种 id、token、金额单位、邮箱、URL）时，用品牌类型：

```ts
type UserId = string & { readonly __brand: 'UserId' }
type OrderId = string & { readonly __brand: 'OrderId' }

function fetchUser(id: UserId) { /* ... */ }
function fetchOrder(id: OrderId) { /* ... */ }

const order_id = 'o-123' as OrderId;
fetchUser(order_id);  // ❌ 编译报错，语义被守住了
```

需要构造这种值时，用一个显式的转换函数（负责校验）产出品牌类型，而不是到处 `as`：

```ts
function asUserId(raw: string): UserId {
  if (raw.startsWith('u-')) {
    return raw as UserId
  } else {
    throw new Error(`invalid user id: ${raw}`)
  }
}
```

**原则**：品牌类型的价值是"把领域语义写进类型系统"，让错误在编译期暴露。不需要为所有原始类型都套品牌——**只在领域身份重要、容易被混淆的地方用**（id 是典型）。

---

## 七、函数设计

- **单一职责**：一个函数做一件事，超过 50 行考虑拆。
- **参数过多用对象参数**；**不用布尔参数**（`render(true)` 是语义黑洞）。
- **不修改入参**。
- **用组合构建逻辑**：把复杂流程拆成若干纯函数，再用 `Pipe` 串起来，而不是写一个大函数里嵌套判断。
- **控制流遵循第一节**：函数内部是完整的树，不靠早返回打平。

---

## 八、模块与边界

- 一个文件一个主要职责，大文件是拆分的信号。
- 类型导入用 `import type`，让"类型"和"值"在导入层就分清。
- **模块顶层不跑副作用**，导出函数让人显式调用——这呼应"副作用集中到可数的点"。
- 内部引用直指源文件，对外才用 barrel（`index.ts`）收口。

---

## 九、异步与错误：catch 必须负责，兜底统一，保留 cause

### 9.1 错误到了这一层，只有三种选择

**看法**：catch 不是"我接住了"的证明，而是"我决定对这条错误负责"的声明。接住却不处理，比不接住更糟——错误被藏起来，调用方以为一切正常。

**因此**，只有三种选择：

1. **包装后继续抛**：加上本层独有的信息（路径、id、阶段），`throw new Error(msg, { cause: err })`；或者在体系边界翻译成领域错误。包装必须带来新信息，且每个 catch 块最多一次。
2. **判别后在本层处理**：先确认"这是什么错误"，只对能处理的那一类做真实补救——重试、换源。处理不了的照旧抛。
3. **交给调用方**：不 catch，让异常继续冒泡；或者在边界把它转成 `Result` 显式返回，逼调用方分支。

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
  await loadConfig(path);
} catch (err: unknown) {
  // 包装时保留 cause
  throw new Error(`failed to load config: ${path}`, { cause: err });
}
```

**自定义错误类也必须支持 cause**，否则它就无法接入这套错误链：

```ts
class ConfigError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);   // 透传 cause
    this.name = 'ConfigError';
  }
}

// 使用
try {
  await loadConfig(path);
} catch (err: unknown) {
  throw new ConfigError(`failed to load config: ${path}`, { cause: err });
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
- 注释与代码同步。注释误导比没有注释更糟。
- 除非有正当的理由，否则不留死代码，`TODO` 带责任人与 issue。

**一句话**：先让代码自己说话；只有当代码确实说不清、或者必须提醒读者注意时，才写注释。**注释越少越好，但该有的必须有。**

---

## 十一、评审自查：用方法论检验

提交前问自己：

- [ ] **树完整吗？** 有没有 early return 剪断分支、有没有偷偷省略 else？
- [ ] **有类吗？有 this 吗？** 除了错误类型，都应该没有。
- [ ] **副作用集中在可数的几个点吗？** 有没有散落各处的写操作、隐式状态变更？
- [ ] **循环里还有 continue / break 吗？**
- [ ] **命名对了吗？** 函数 camelCase；返回函数/方法集的工厂 PascalCase；数据变量 snake_case；跨作用域 `__var_name`；顶级导出 `__VAR_NAME__`。
- [ ] **类型契约还在吗？** 无 `any`、无 `!`、导出有返回类型；该用品牌类型的地方（id 等）用了吗？
- [ ] **catch 都负责了吗？** 要么包装并保留 `cause`，要么判别后真处理，要么根本没 catch；有没有 `catch { return null }` / `return []`？
- [ ] **错误可判别吗？** 有没有靠 `message` 字符串猜类型？
- [ ] **兜底在吗？** 顶层有统一兜底，且未处理的错误只在兜底记录一次。
- [ ] **注释是否多余？** 能不能靠改名/拆函数让它消失？留下的注释是否都在解释"为什么"或"注意什么"？

---

> 一句话总结这套方法论：**把代码当作一棵完整的树来写，用函数的组合而不是对象的状态来表达逻辑；让名字和类型把意图说清楚；让副作用集中在可数的几个点；让每个 catch 都对错误负责、统一兜底、保留根因；让代码自己说话，只在必要处解释。**
