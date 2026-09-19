# @easyx/tiptap-table-plus

Tiptap 表格增强套件：在原生 `Table` 之上补充单元格样式、选区覆盖层、节点背景色与中英文上下文菜单，不依赖任何 UI 框架。

[![npm version](https://img.shields.io/npm/v/@easyx/tiptap-table-plus.svg)](https://www.npmjs.com/package/@easyx/tiptap-table-plus)
[![license](https://img.shields.io/npm/l/@easyx/tiptap-table-plus.svg)](https://github.com/easyx-dev/easyx/blob/main/LICENSE)

[文档](https://easyx-dev.github.io/easyx/table-plus/) · [演示](https://easyx-dev.github.io/easyx/table-plus/demo/) · [API 参考](https://easyx-dev.github.io/easyx/table-plus/api-reference/)

## 特性

- **选区覆盖层**：表格选区常显边框与加行 / 加列手柄
- **单元格样式**：文字颜色与水平 / 垂直对齐，均为可序列化属性
- **上下文菜单**：行列操作、合并拆分、表头切换与颜色，可增删改
- **70 色色板**：10 色相 × 7 级明度，方向键可导航
- **块级背景色**：任意块级节点可设背景色
- **国际化**：内置 `zh-CN` / `en-US`，支持局部翻译覆盖

## 安装

```bash
pnpm add @easyx/tiptap-table-plus
```

样式以独立 CSS 文件随包提供，并由包入口自动引入，通常无需额外处理。若宿主打包器忽略依赖内的 CSS 导入，再手动引入：

```ts
import '@easyx/tiptap-table-plus/styles/table.css';
```

## 快速上手

`TablePlus` 需配合 `@tiptap/extension-table` 使用，推荐开启 `resizable` 支持列宽拖拽：

```ts
import { Editor } from '@tiptap/core';
import { TableKit } from '@tiptap/extension-table';
import { TablePlus } from '@easyx/tiptap-table-plus';

const editor = new Editor({
  extensions: [
    TableKit.configure({ table: { resizable: true } }),
    TablePlus.configure({ locale: 'zh-CN', theme: 'light' }),
  ],
});
```

新增命令通过 `editor.chain()` 调用：

```ts
editor.chain().focus().clearSelectedCells().run();
editor.chain().focus().setCellTextColor('#7c3aed').run();
```

配置项、全部命令与翻译字段见 [API 参考](https://easyx-dev.github.io/easyx/table-plus/api-reference/)。

## 许可

[MIT](https://github.com/easyx-dev/easyx/blob/main/LICENSE)
