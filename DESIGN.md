---
name: Simple Nav Page
description: A configurable personal navigation portal with a quiet admin console.
colors:
  primary-green: "#63C174"
  primary-green-deep: "#3F9D52"
  primary-green-soft: "#63C17438"
  ink: "#FFFFFF"
  ink-muted: "#FFFFFFCC"
  glass-surface: "#090E148C"
  glass-border: "#FFFFFF29"
  admin-bg: "#111821"
  admin-panel: "#050A1294"
  admin-control: "#FFFFFF14"
  admin-danger: "#F87171"
  admin-warning: "#FFD38A"
  admin-success: "#B4F5C7"
typography:
  display:
    fontFamily: "Noto Sans SC, Microsoft YaHei, sans-serif"
    fontSize: "clamp(1.8rem, 5vw, 3.2rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "0.02em"
  headline:
    fontFamily: "Noto Sans SC, Microsoft YaHei, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Noto Sans SC, Microsoft YaHei, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "Noto Sans SC, Microsoft YaHei, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Noto Sans SC, Microsoft YaHei, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 500
    lineHeight: 1.35
rounded:
  sm: "8px"
  md: "10px"
  card: "8px"
  section: "16px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary-green}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "9px 14px"
  button-ghost:
    backgroundColor: "{colors.admin-control}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "9px 14px"
  nav-card:
    backgroundColor: "{colors.glass-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "11px"
  input:
    backgroundColor: "{colors.admin-control}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 11px"
---

# Design System: Simple Nav Page

## 1. Overview

**Creative North Star: "Quiet Control With Playful Atmosphere"**

Simple Nav Page 是一个个人导航门户，不是营销落地页。前台允许有动态背景、樱花/雪花/下雨、Live2D 和可爱标签页文案，但这些元素必须退到导航任务之后。用户第一眼应该能找到搜索框、分类和卡片，而不是先被装饰吸走注意力。

后台是配置工作台。它应保持密集但清楚，使用稳定的分页、分组、表单、按钮和反馈状态。后台不追求炫酷，追求可理解、可编辑、可保存。

**Key Characteristics:**
- 深色底色承载背景图和视频，绿色作为唯一主动作色。
- 前台是高密度卡片网格，后台是分页表单和编辑器。
- 个性元素可存在，但必须可配置、可关闭、可降级。
- 视觉系统优先复用现有 CSS token，再逐步收敛玻璃、发光和任意 z-index。

## 2. Colors

当前色彩系统是深色背景加绿色主色。绿色承担主操作、选中态、分区提示和导航状态，不应扩散成全页面装饰色。

### Implementation Tokens

共享 CSS token 位于 `assets/css/tokens.css`。前台 `style.css` 和后台 `assets/css/admin.css` 都应优先引用这里的语义变量，再在本文件内做页面级映射。

核心命名：
- `--nav-color-primary`：唯一主色，用于主操作、选中态和关键状态。
- `--nav-color-admin-bg` / `--nav-color-front-bg`：后台和前台基础背景。
- `--nav-color-surface*`：面板、控件和弱层级背景。
- `--nav-color-border*`：边框层级。
- `--nav-color-success` / `--nav-color-warning` / `--nav-color-danger`：状态色。
- `--nav-radius-*`：圆角尺度。
- `--nav-shadow-*`：阴影尺度。

### Primary
- **Navigation Green** (`#63C174`): 前台搜索按钮、分类选中态、分区标题、卡片 hover 边框和后台主按钮。
- **Pressed Green** (`#3F9D52`): 搜索按钮 active 状态和主操作按下状态。
- **Soft Green Wash** (`#63C17438`): 选中、hover、弱强调背景。只用于状态，不用于大面积装饰。

### Neutral
- **Ink White** (`#FFFFFF`): 前台和后台主要文字。
- **Muted Ink** (`#FFFFFFCC`): 卡片描述、辅助说明和弱化信息。低于这个透明度时必须检查对比度。
- **Calm Surface** (`#090E148C`): 前台 section、搜索框和卡片的半透明承载层。
- **Quiet Border** (`#FFFFFF29`): 前台卡片、搜索框和分区边框。
- **Admin Night** (`#111821`): 后台页面基础背景。
- **Admin Panel** (`#050A1294`): 后台面板背景。

### Named Rules

**The One Accent Rule.** 绿色是唯一主色。新增页面和小工具不要随意加入紫蓝霓虹、粉色主按钮或彩虹状态色。

**The Quiet Admin Rule.** 后台颜色只表达状态和层级，不做装饰性渐变。

## 3. Typography

**Display Font:** Noto Sans SC, Microsoft YaHei, sans-serif  
**Body Font:** Noto Sans SC, Microsoft YaHei, sans-serif  
**Label/Mono Font:** Consolas, Courier New, monospace for JSON and HTML editors

**Character:** 字体系统应保持单一、清楚、中文可读。前台标题可以更有个性，后台标签和数据不使用展示字体。

### Hierarchy
- **Display** (700, `clamp(1.8rem, 5vw, 3.2rem)`, 1.15): 只用于前台站点标题。
- **Headline** (700, `2rem`, 1.2): 用于后台页面主标题，移动端降到约 `1.55rem`。
- **Title** (700, `1rem`, 1.35): 用于面板标题、分区标题和重要控件组。
- **Body** (400, `1rem`, 1.5): 用于说明文字和表单输入。
- **Label** (500, `0.9rem`, 1.35): 用于表单字段、按钮、标签页。后台不使用大字距 uppercase。

### Named Rules

**The Tool Text Rule.** 后台所有表单标签、按钮和状态文案使用正常大小，不使用发光字、渐变字或大标题样式。

## 4. Elevation

当前系统使用半透明面板、边框和阴影混合表达层级。前台应使用安静的半透明承载层，不再把重玻璃和强发光作为默认视觉。后台已有 `0 20px 55px rgba(0,0,0,0.25)` 面板阴影，仍只用于主面板层级。

### Shadow Vocabulary
- **Foreground Surface Shadow** (`0 14px 38px rgba(0, 0, 0, 0.28)`): 仅用于前台搜索框等关键浮层。
- **Admin Panel Shadow** (`0 20px 55px rgba(0,0,0,0.25)`): 用于后台主面板，不用于每一个小控件。
- **Tooltip Shadow** (`0 4px 20px rgba(0,0,0,0.6)`): 用于移动端卡片长按提示。

### Named Rules

**The No Nested Glass Rule.** 不要在玻璃面板里继续嵌套一层重玻璃卡片。需要分组时优先用边框、间距和标题。

## 5. Components

### Buttons
- **Shape:** 后台按钮使用 8px 圆角，前台搜索提交按钮使用圆形，分类 tab 使用 pill。
- **Primary:** 绿色表示保存、添加、搜索等主动作。
- **Hover / Focus:** hover 可以改变背景和边框；必须补 `:focus-visible`，焦点态应比 hover 更明确。
- **Danger:** 删除分类、删除小工具等危险操作使用红色边框和确认流程，不使用绿色。

### Chips
- **Style:** 前台搜索分类和搜索引擎按钮是 chip/tab 形态。
- **State:** 选中态使用绿色边框和弱绿色背景；未选中态保持低对比半透明背景。

### Cards / Containers
- **Corner Style:** 前台导航卡片 8px，前台分区 16px；后台面板和站点编辑卡片统一 8px。
- **Background:** 前台卡片使用半透明深色，后台卡片使用更安静的深色面板。
- **Shadow Strategy:** 卡片默认不加强阴影，hover 只做轻微位移和边框变化。
- **Internal Padding:** 前台卡片约 11px，后台面板约 18px，手机端收紧到 14px。

### Inputs / Fields
- **Style:** 后台输入框、选择框、文本域使用 8px 圆角、半透明背景、浅色边框。
- **Focus:** 必须增加明确的 focus ring 或边框色变化。
- **Error / Disabled:** 当前系统还不完整，后续需要补错误、禁用、加载和保存中的状态。

### Navigation
- **Frontend:** 搜索分类在桌面居中换行，手机端横向滚动。卡片网格从桌面 8 列逐步降到手机 3 列。
- **Admin:** 后台使用顶部操作区加分页标签。手机端分页横向滚动，分类站点编辑区折为单列。

### Signature Component

**Configurable Tool Page.** 小工具由 Worker 以 `/tools/<slug>/` 发布，后台编辑 HTML，前台可把工具作为导航卡片。新增工具页面应优先采用同一字体、深色背景、绿色主动作和清楚的移动端布局。

## 6. Do's and Don'ts

### Do:
- **Do** 保持绿色作为唯一主色，用于主操作、选中态和状态提示。
- **Do** 给所有按钮、输入框、tab、卡片补明确的 `:focus-visible`。
- **Do** 为页面特效、Live2D、背景视频和标题浮动提供 `prefers-reduced-motion` 降级。
- **Do** 在后台继续使用分页和分组，避免把所有配置堆到一个长页面。
- **Do** 给 favicon、一言、背景接口、Worker/KV、Live2D CDN 保留失败兜底。

### Don't:
- **Don't** 使用渐变文字作为默认标题风格继续扩散到后台或小工具。
- **Don't** 把玻璃拟态当作所有容器的默认样式。
- **Don't** 使用会影响滚动和输入的鼠标拖尾、文字喷射或高频 DOM 粒子特效。
- **Don't** 使用任意 `z-index: 9999` 继续扩散，应建立固定层级。
- **Don't** 在手机端显示 Live2D 或其他重型装饰，除非用户显式开启。
