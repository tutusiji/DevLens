# 全站组件 HeroUI 化 + 去除渐变风格改造设计文档

> 版本：v1.0
> 状态：待开发
> 目标：全站 UI 组件统一使用 HeroUI（@heroui/react 3.2.3），去除手写渐变风格，定制化组件保留自写。

---

## 0. 改造原则（用户明确要求）

1. **去掉渐变风格**：所有手写 `linear-gradient` / `bg-gradient-to-*` / `text-gradient-*` 按钮和背景渐变移除，改用 HeroUI 标准样式或纯色。
2. **尽量全 HeroUI**：能用的组件一律用 HeroUI 组件（Card/Input/Table/Segmented→Tabs/Sheet→Drawer 等）。
3. **定制化组件例外**：图表（recharts 封装 charts.tsx）、代码图谱（derivation-chain.tsx 的连线渐变）、雷达图、Logo 渐变等**定制化视觉组件**不强行 HeroUI 化，但其中非必要的渐变也尽量弱化（保留图表内部的 SVG 渐变可接受，因为是数据可视化必需）。

## 1. 现状盘点

### 1.1 已 HeroUI 化（保留）
- `components/ui/button.tsx`（映射 HeroUI Button，但 6 个 variant 都有手写渐变覆盖）
- `components/ui/badge.tsx`、`components/ui/progress.tsx`

### 1.2 自写组件（需迁移）
| 组件 | 引用数 | HeroUI 替代 |
|------|--------|------------|
| `components/ui/card.tsx` | 16 | `Card`（@heroui/react/card） |
| `components/ui/input.tsx` | 7 | `Input`（@heroui/react/input） |
| `components/ui/table.tsx` | 11 | `Table`（@heroui/react/table，注意 API 差异大） |
| `components/ui/segmented.tsx` | 6 | `Tabs`（@heroui/react/tabs）或 Radio Group |
| `components/ui/sheet.tsx` | 3 | `Drawer`（@heroui/react/drawer）或 Modal |

### 1.3 渐变使用点（需去除）
- `components/ui/button.tsx`：6 个 variant 的 backgroundImage 渐变（蓝/琥珀/红/绿）
- `components/widgets.tsx`：多个 `bg-gradient-to-*`、`text-gradient-*`（StatCard/ScoreRing/ProgressBar 等）
- `components/app-shell.tsx`：Logo 渐变、分隔线渐变
- `components/charts.tsx`：SVG gauge-gradient（**保留**，数据可视化）
- `components/derivation-chain.tsx`：连线渐变（**保留**，可视化连线）

---

## 2. 组件迁移方案

### 2.1 Button 去渐变（改造 button.tsx）
保留 HeroUI Button 封装和 variant API（前端 40+ 处调用不变），**只改样式覆盖**：

```typescript
const variantConfig: Record<OldVariant, VariantConfig> = {
  default: { herouiVariant: 'primary' },                    // 去掉渐变，用 HeroUI primary 标准色
  accent:  { herouiVariant: 'primary', extraClass: 'bg-amber-500 text-white' },  // 琥珀纯色（保留强调语义）
  outline: { herouiVariant: 'outline', extraClass: 'glass-light' },
  ghost:   { herouiVariant: 'ghost' },
  secondary: { herouiVariant: 'secondary', extraClass: 'glass-light' },
  destructive: { herouiVariant: 'danger' },                  // 去掉红色渐变，用 HeroUI danger
  success: { herouiVariant: 'primary', extraClass: 'bg-emerald-500 text-white' }, // 绿色纯色
};
```
- 删除所有 `--button-bg/--button-fg/backgroundImage` 内联覆盖
- shadow 类保留或简化（`shadow-md` 级）

### 2.2 Card（自写 → HeroUI）
`components/ui/card.tsx` 改写为包装 `@heroui/react/card`：
- 保持现有导出名：Card/CardHeader/CardTitle/CardDescription/CardContent/CardFooter
- 内部映射 HeroUI Card：`<Card>` + `<CardHeader>` + `<CardBody>`（CardContent→CardBody）+ `<CardFooter>`
- 样式对齐现有用法（px/py 间距、border 等由 HeroUI 默认提供，必要时 className 透传）

### 2.3 Input（自写 → HeroUI）
`components/ui/input.tsx` 改写为包装 `@heroui/react/input`：
- 保持 `Input` 导出 + `React.InputHTMLAttributes` API 兼容（value/onChange/placeholder/disabled/className）
- HeroUI Input 是受控组件：`value`/`onValueChange`，映射 onChange 兼容
- className 透传；variant 保持默认（bordered/filled）

### 2.4 Table（自写 → HeroUI）
`components/ui/table.tsx` 是**去框化表格**（Table/TableHeader/TableBody/TableRow/TableHead/TableCell），HeroUI Table 是 ARIA 表格（列定义式），API 完全不同。
**决策：保留自写 table.tsx 结构**（它是"去框化"定制设计，页面中用得最多、改动风险最大），但把 `<table>` 元素类名对齐 HeroUI 风格变量。理由：HeroUI Table 需要 Columns 定义重构所有 11 处调用，风险高收益低；表格的"去框化"本身就是定制化需求。
→ 标记为**定制化组件例外**，不做迁移。仅确认样式 token 与 HeroUI 主题一致。

### 2.5 Segmented（自写 → HeroUI Tabs）
`components/ui/segmented.tsx` 是分段选择器。HeroUI 无 Segmented，用 `Tabs`（@heroui/react/tabs）替代：
- 但 6 处调用都是 `value/onChange/options` 三段式 API → 改写 segmented.tsx 内部为 HeroUI Tabs 包装，**保持外部 API 不变**（value/onChange/options）
- 样式：HeroUI Tabs 的 `variant="underlined"` 或自定义 pill 样式
- 若 Tabs API 不匹配（受控 value/onChange），退化为自写样式但**去渐变**、用主题 token

### 2.6 Sheet（自写 → HeroUI Drawer/Modal）
`components/ui/sheet.tsx`（3 处：Skill 编辑/洞察详情等侧边抽屉）：
- HeroUI 有 `Drawer`（侧滑）组件
- 改写 sheet.tsx 包装 Drawer，保持 `Sheet/SheetContent/SheetHeader/SheetTitle/SheetTrigger/SheetClose` API
- 若 Drawer API 差异过大，用 Modal 替代或保留自写（去渐变即可）

### 2.7 widgets.tsx 去渐变
- `StatCard`：`bg-gradient-to-br from-primary/20 to-secondary/15` → `bg-secondary/10` 或纯色 bg
- `text-gradient-primary/success/warning/accent` → 纯色 `text-primary` 等
- `ProgressBar`：`bg-gradient-to-r from-primary to-secondary` → `bg-primary`
- ScoreRing 指示条：`bg-gradient-to-r from-success to-...` → `bg-success` 等纯色
- 保留图表 SVG 渐变（gauge-gradient）与 derivation-chain 连线渐变

### 2.8 app-shell.tsx 去渐变
- Logo 背景 `bg-gradient-to-br from-primary to-secondary` → `bg-primary`
- 分隔线 `bg-gradient-to-r from-transparent via-border/30 to-transparent` → 保留（这是纯 CSS 分隔线，非按钮风格，可保留或改 `bg-border/30`）

---

## 3. 验收标准

### 视觉
- [ ] 全站无手写渐变按钮（grep linear-gradient 仅剩 charts.tsx/derivation-chain.tsx 的 SVG 渐变）
- [ ] 按钮：primary 蓝色纯色、danger 红色纯色、success 绿色纯色、accent 琥珀纯色，hover 态正常
- [ ] Card/Input 用 HeroUI 渲染，样式与 HeroUI 主题一致
- [ ] Segmented 外观保持分段选择器形态
- [ ] Sheet 抽屉正常滑出
- [ ] 暗色模式下组件正常

### 功能回归
- [ ] `pnpm build` 通过
- [ ] 15 个页面全部 200 + 关键页面浏览器实测（skills/env/capability-standards/onboard/projects 详情）
- [ ] Button onClick 全部工作（onPress 映射无回归）
- [ ] Input 输入/清空正常
- [ ] Segmented 切换正常
- [ ] Sheet 打开/关闭正常
- [ ] Table 渲染正常（自写保留）

---

## 4. 开发顺序

1. `button.tsx`：去渐变（改 variantConfig，删内联 style 覆盖）
2. `card.tsx`：重写为 HeroUI Card 包装（保持导出 API）
3. `input.tsx`：重写为 HeroUI Input 包装（保持 API）
4. `segmented.tsx`：尝试 HeroUI Tabs 包装；不行则自写去渐变
5. `sheet.tsx`：尝试 HeroUI Drawer 包装；不行则自写去渐变
6. `widgets.tsx` + `app-shell.tsx`：去渐变（纯色替换）
7. `pnpm build` + 逐页验证

## 5. 风险与注意

- **Button onPress 映射**：保持 `onPress={onClick as never}` 现有写法，勿改
- **Card 子组件 API**：页面中 `CardContent className="p-4"` 等用法要兼容（透传 className）
- **Input 受控**：HeroUI Input 的 value 更新是 `onValueChange`，onChange 兼容层要写好
- **Segmented 受控**：value/onChange 同步
- **不要动 charts.tsx / derivation-chain.tsx 的 SVG 渐变**（数据可视化必需）
- **Table 保留自写**（定制化去框化设计，迁移 HeroUI Table 风险大）
- 每步改完跑一次 build，避免积压错误
