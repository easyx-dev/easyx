---
title: Table Plus API 参考
description: TablePlus 配置项、命令、运行时 API、翻译字段与类型定义
---

## TablePlusOptions

```ts
TablePlus.configure(options)
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `theme` | `'light' \| 'dark'` | `'light'` | 选区覆盖层与上下文菜单配色 |
| `locale` | `'zh-CN' \| 'en-US'` | `'zh-CN'` | 内置语言包 |
| `translations` | `Partial<TablePlusTranslations>` | — | 局部翻译覆盖，与语言包浅合并 |
| `contextMenu` | `(items: MenuList) => MenuList` | — | 自定义上下文菜单项 |

## 命令

命令均通过 `editor.chain()` 调用。行列增删、合并拆分、表头切换等标准命令由 `@tiptap/extension-table` 提供，以下为本套件扩展的命令。

### tablePlus

| 命令 | 参数 | 说明 |
|------|------|------|
| `clearSelectedCells()` | — | 清除选中单元格的内容与样式 |
| `clearRowColumnContent(orientation)` | `'row' \| 'column'` | 清除当前行 / 列内容，保留样式 |
| `setTablePlusTheme(theme)` | `'light' \| 'dark'` | 运行时切换主题 |

### tableCellStyle

| 命令 | 参数 | 说明 |
|------|------|------|
| `setCellTextColor(color)` | `string` | 设置文字颜色 |
| `unsetCellTextColor()` | — | 移除文字颜色 |
| `setCellTextAlign(align)` | `string \| null` | 设置水平对齐 |
| `setCellVerticalAlign(align)` | `'top' \| 'middle' \| 'bottom' \| null` | 设置垂直对齐 |

### nodeBackground

| 命令 | 参数 | 说明 |
|------|------|------|
| `setNodeBackgroundColor(color)` | `string` | 设置块级节点背景色 |
| `unsetNodeBackgroundColor()` | — | 移除背景色 |

```ts
editor.chain().focus().setCellTextColor('#7c3aed').run();
editor.chain().focus().setNodeBackgroundColor('#f4f4f5').run();
```

## 运行时 API

| 函数 | 签名 | 说明 |
|------|------|------|
| `getTablePlusTranslations` | `(editor: Editor \| null) => TablePlusTranslations` | 当前生效的翻译对象 |
| `getTablePlusTheme` | `(editor: Editor \| null) => 'light' \| 'dark'` | 当前主题 |
| `getTablePlusLocale` | `(editor: Editor \| null) => 'zh-CN' \| 'en-US'` | 当前语言区域 |

## 国际化

内置 `zh-CN` / `en-US` 语言包，可通过 `locale` 切换、`translations` 局部覆盖。

```ts
import { enUS, zhCN, getBuiltinTranslations } from '@easyx/tiptap-table-plus';

const t = getBuiltinTranslations('en-US');
```

### TablePlusTranslations

| 字段 | 中文 | 英文 |
|------|------|------|
| `insertRowAbove` | 上方插入行 | Insert Row Above |
| `insertRowBelow` | 下方插入行 | Insert Row Below |
| `insertColumnLeft` | 左侧插入列 | Insert Column Left |
| `insertColumnRight` | 右侧插入列 | Insert Column Right |
| `mergeCells` | 合并单元格 | Merge Cells |
| `splitCell` | 拆分单元格 | Split Cell |
| `textColor` | 文字颜色 | Text Color |
| `backgroundColor` | 背景色 | Background Color |
| `horizontalAlign` | 水平对齐 | Horizontal Align |
| `verticalAlign` | 垂直对齐 | Vertical Align |
| `alignLeft` | 左对齐 | Align Left |
| `alignCenter` | 居中 | Align Center |
| `alignRight` | 右对齐 | Align Right |
| `alignJustify` | 两端对齐 | Align Justify |
| `alignTop` | 顶端对齐 | Align Top |
| `alignMiddle` | 居中（垂直） | Align Middle |
| `alignBottom` | 底端对齐 | Align Bottom |
| `clearContent` | 清除内容 | Clear Content |
| `toggleHeaderRow` | 切换标题行 | Toggle Header Row |
| `toggleHeaderColumn` | 切换标题列 | Toggle Header Column |
| `deleteRow` | 删除行 | Delete Row |
| `deleteColumn` | 删除列 | Delete Column |
| `defaultColor` | 默认颜色 | Default |
| `tableActions` | 表格操作 | Table Actions |
| `addColumn` | 添加列 | Add Column |
| `addRow` | 添加行 | Add Row |
| `customColor` | 自定义颜色 | Custom Color |

## 自定义上下文菜单

`contextMenu` 接收默认菜单项列表，返回修改后的列表，可增删改。

```ts
import { TablePlus, type MenuList } from '@easyx/tiptap-table-plus';

TablePlus.configure({
  contextMenu(items: MenuList) {
    const filtered = items.filter(
      (item) => !('variant' in item && item.variant === 'destructive'),
    );
    filtered.push(
      { type: 'separator' },
      { label: '自定义操作', iconHtml: '<svg>…</svg>', onClick: () => {} },
    );
    return filtered;
  },
});
```

### 类型

```ts
type SubMenuItem = {
  label: string;
  iconHtml: string;
  onClick: () => void;
};

type MenuItem = {
  label: string;
  iconHtml: string;
  disabled?: boolean;
  variant?: 'default' | 'destructive';
  onClick?: () => void;
  /** 子级为 'color' 时点击色块触发的操作 */
  action?: 'textColor' | 'backgroundColor';
  /** 'color' 打开 70 色色板，SubMenuItem[] 打开级联菜单 */
  sub?: 'color' | SubMenuItem[];
};

type MenuSeparator = { type: 'separator' };
type MenuList = (MenuItem | MenuSeparator)[];
```

## CSS 变量

| 变量 | 默认值（亮 / 暗） | 说明 |
|------|------------------|------|
| `--easyx-tiptap-table-plus-accent` | `#7c3aed` / `#a78bfa` | 品牌色（选区边框、手柄、高亮） |
| `--easyx-tiptap-table-plus-border` | `#d4d4d8` / `#3f3f46` | 边框与分隔线 |
| `--easyx-tiptap-table-plus-bg` | `#fff` / `#1e1e2e` | 菜单与弹出层背景 |
| `--easyx-tiptap-table-plus-bg-hover` | `#f4f4f5` / `#2d2d3f` | 悬停背景 |
| `--easyx-tiptap-table-plus-text` | `#1a1a2e` / `#e4e4e7` | 主文字色 |
| `--easyx-tiptap-table-plus-radius` | `2px` | 圆角 |

## 导出

| 导出 | 说明 |
|------|------|
| `TablePlus` | 主扩展，需配合 `@tiptap/extension-table` |
| `getTablePlusTranslations` / `getTablePlusTheme` / `getTablePlusLocale` | 读取运行时状态 |
| `zhCN` / `enUS` / `getBuiltinTranslations` | 内置语言包 |
| `TablePlusOptions` / `TablePlusTranslations` / `TablePlusTheme` / `TablePlusLocale` / `TablePlusStorage` | 类型 |
| `MenuItem` / `MenuList` / `MenuSeparator` / `SubMenuItem` | 上下文菜单类型 |
