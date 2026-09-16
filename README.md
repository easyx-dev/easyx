# EasyX

EasyX 系列库的 pnpm monorepo：每个库独立安装、独立发版，共用一套文档站点与演示环境。

## 库

| 包 | 说明 |
|----|------|
| [`@easyx/editor`](packages/editor) | 零框架依赖的 Tiptap 富文本编辑器，内置工具栏、气泡菜单、媒体上传与高度控制 |
| [`@easyx/tiptap-table-plus`](packages/tiptap-table-plus) | Tiptap 表格增强套件：行列操作、单元格样式、70 色背景与中英文右键菜单 |

## 快速开始

```bash
pnpm install
pnpm dev
```

```ts
import { createEditor } from '@easyx/editor'

const editor = createEditor(document.getElementById('editor'), {
  placeholder: '请输入…',
  defaultTheme: 'light',
  image: {
    upload: async (file) => ({ id: '1', url: '...', name: file.name }),
  },
  onChange: (html) => console.log(html),
})

editor.setHTML('<p>Hello World</p>')
```

## 命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 构建全部库，同时启动文档站点开发服务器 |
| `pnpm build` | 构建全部库 + 文档站点 |
| `pnpm build:packages` | 仅构建 `packages/*` 下的全部库 |
| `pnpm build:site` | 仅构建文档站点 |
| `pnpm check` | Biome 代码检查并自动修复 |
| `pnpm format` | Biome 代码格式化 |
| `pnpm test` | 运行所有包测试 |
| `pnpm test:watch` | 测试监听模式 |

子包命令：

```bash
pnpm --filter @easyx/editor dev     # 单包监听构建
pnpm --filter @easyx/editor test    # 单独运行测试
pnpm --filter site dev              # 单独启动站点
```

## 项目结构

```
packages/            # 各库，一个库一个目录，包名 @easyx/<lib>
├── editor/          # @easyx/editor
└── tiptap-table-plus/  # @easyx/tiptap-table-plus
site/                # Astro + Starlight 文档站点（全系列共用）
```

## 技术栈

- **构建**：Rslib（库）+ Astro / Starlight（站点）
- **语言**：TypeScript（strict）
- **Lint/Format**：Biome
- **测试**：Rstest + `@rstest/adapter-rslib`
- **包管理**：pnpm（monorepo）

## 新增库

新增库遵循 [AGENTS.md](./AGENTS.md) 中「新增一个库」的约定：目录与包名、构建与依赖声明、测试、样式命名空间、文档与 Demo、发布登记六项。

## 发布

各库版本独立维护，不要求一致。

1. 升级需要发布的包的 `version`（可参考 `deploy` 命令自动检测变动与范围）
2. 推送 `main`
3. `release.yml` 遍历 `packages/*` 中所有非 private 包，比对本地版本与 npm 已发布版本，仅发布不一致的包，顺序由 `PUBLISH_ORDER` 决定

发布同时会触发文档站点（GitHub Pages）部署与 CI 检查。

### 前置条件

在 GitHub 仓库 Settings → Secrets and variables → Actions 中配置 `NPM_TOKEN`（npmjs 账户的 publish 权限 access token）。

首次发布请确认包已被 `npm owner add` 或已具备该 scope 的发布权限。
