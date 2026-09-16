/**
 * Markdown 渲染层：marked 词法结果 → React 元素
 *
 * 走「token → React 元素」而非「HTML 字符串 → dangerouslySetInnerHTML」，
 * 因此全程没有注入点；markdown 里的裸 HTML 直接丢弃（AI 产物本就是 HTML 片段，
 * 不需要在对话气泡里再执行一层 HTML），链接协议另有白名单校验。
 *
 * 流式场景下每次增量都会重跑 lexer：未闭合的围栏代码块在 marked 里同样产出
 * `code` token（已实测），正好渲染成「半成品卡片」，与实时同步的预期一致。
 */
import { marked, type Token, type Tokens } from 'marked';
import type { ReactNode } from 'react';

/** 代码块渲染回调：由调用方决定样式与是否特殊处理（如 html 片段卡片） */
export type CodeBlockRenderer = (props: {
  lang: string;
  code: string;
}) => ReactNode;

interface RenderContext {
  renderCode: CodeBlockRenderer;
  /** 紧凑模式（紧凑列表内）：块级 text 不额外包 <p> */
  tight: boolean;
}

/** 允许出现在链接/图片地址上的协议与相对形式 */
const SAFE_SCHEME = /^(?:https?:|mailto:|tel:)/i;

/** 链接与图片地址白名单：拦截 javascript: / data: 等危险协议 */
function sanitizeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const value = url.trim();
  // 相对路径、锚点、协议白名单放行
  if (
    value.startsWith('/') ||
    value.startsWith('#') ||
    value.startsWith('./') ||
    value.startsWith('../') ||
    SAFE_SCHEME.test(value)
  ) {
    return value;
  }
  return undefined;
}

/** 段落内容：递归渲染行内 token */
function renderInline(
  tokens: Token[] | undefined,
  ctx: RenderContext,
  key: string,
): ReactNode[] {
  return (tokens ?? []).map((token, index) =>
    renderInlineToken(token, ctx, `${key}-${index}`),
  );
}

function renderInlineToken(
  token: Token,
  ctx: RenderContext,
  key: string,
): ReactNode {
  switch (token.type) {
    case 'strong':
      return (
        <strong key={key}>
          {renderInline((token as Tokens.Strong).tokens, ctx, key)}
        </strong>
      );
    case 'em':
      return (
        <em key={key}>{renderInline((token as Tokens.Em).tokens, ctx, key)}</em>
      );
    case 'del':
      return (
        <del key={key}>
          {renderInline((token as Tokens.Del).tokens, ctx, key)}
        </del>
      );
    case 'codespan':
      return (
        <code className="easyx-ai-rich-editor__code-inline" key={key}>
          {(token as Tokens.Codespan).text}
        </code>
      );
    case 'br':
      return <br key={key} />;
    case 'link': {
      const link = token as Tokens.Link;
      const href = sanitizeUrl(link.href);
      if (!href) {
        // 协议不可信时只渲染文字，不给出可点击入口
        return <span key={key}>{renderInline(link.tokens, ctx, key)}</span>;
      }
      return (
        <a href={href} key={key} rel="noreferrer" target="_blank">
          {renderInline(link.tokens, ctx, key)}
        </a>
      );
    }
    case 'image': {
      const image = token as Tokens.Image;
      const src = sanitizeUrl(image.href);
      if (!src) return null;
      return <img alt={image.text} key={key} src={src} />;
    }
    case 'escape':
      return <span key={key}>{(token as Tokens.Escape).text}</span>;
    case 'html':
      // 裸 HTML 一律丢弃，避免绕过 React 的转义
      return null;
    default:
      return <span key={key}>{(token as Tokens.Text).text}</span>;
  }
}

/** 块级 token：递归渲染 */
function renderBlockToken(
  token: Token,
  ctx: RenderContext,
  key: string,
): ReactNode {
  switch (token.type) {
    case 'space':
      return null;

    case 'heading': {
      const heading = token as Tokens.Heading;
      const depth = Math.min(6, Math.max(1, heading.depth));
      return (
        <div
          className={`easyx-ai-rich-editor__md-heading easyx-ai-rich-editor__md-heading--${depth}`}
          key={key}
        >
          {renderInline(heading.tokens, ctx, key)}
        </div>
      );
    }

    case 'paragraph':
      return (
        <p key={key}>
          {renderInline((token as Tokens.Paragraph).tokens, ctx, key)}
        </p>
      );

    case 'text': {
      const text = token as Tokens.Text;
      if (ctx.tight)
        return <span key={key}>{renderInline(text.tokens, ctx, key)}</span>;
      return <p key={key}>{renderInline(text.tokens, ctx, key)}</p>;
    }

    case 'code': {
      const code = token as Tokens.Code;
      return (
        <div key={key}>
          {ctx.renderCode({
            code: code.text.replace(/\n$/, ''),
            lang: code.lang ?? '',
          })}
        </div>
      );
    }

    case 'blockquote':
      return (
        <blockquote key={key}>
          {renderBlocks((token as Tokens.Blockquote).tokens, ctx, key)}
        </blockquote>
      );

    case 'list': {
      const list = token as Tokens.List;
      const items = list.items.map((item, index) =>
        renderListItem(item, ctx, `${key}-${index}`),
      );
      return list.ordered ? (
        <ol key={key} start={Number(list.start) || 1}>
          {items}
        </ol>
      ) : (
        <ul key={key}>{items}</ul>
      );
    }

    case 'table': {
      const table = token as Tokens.Table;
      const aligns = table.align;
      return (
        <div className="easyx-ai-rich-editor__md-table-wrap" key={key}>
          <table className="easyx-ai-rich-editor__md-table">
            <thead>
              <tr>
                {table.header.map((cell, index) => (
                  <th
                    // 表头顺序即列序，无稳定 id
                    key={`${key}-h-${index}`}
                    style={{ textAlign: aligns[index] ?? undefined }}
                  >
                    {renderInline(cell.tokens, ctx, `${key}-h-${index}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={`${key}-r-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${key}-r-${rowIndex}-${cellIndex}`}
                      style={{
                        textAlign: aligns[cellIndex] ?? undefined,
                      }}
                    >
                      {renderInline(
                        cell.tokens,
                        ctx,
                        `${key}-r-${rowIndex}-${cellIndex}`,
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'hr':
      return <hr className="easyx-ai-rich-editor__md-hr" key={key} />;

    case 'html':
      // 裸 HTML 一律丢弃
      return null;

    default:
      return null;
  }
}

/** 列表项：紧凑列表（tight）内的块级内容不再包 <p> */
function renderListItem(
  item: Tokens.ListItem,
  ctx: RenderContext,
  key: string,
): ReactNode {
  if (item.task) {
    return (
      <li className="easyx-ai-rich-editor__md-task" key={key}>
        <input
          checked={Boolean(item.checked)}
          disabled
          readOnly
          type="checkbox"
        />
        <span>{renderBlocks(item.tokens, { ...ctx, tight: true }, key)}</span>
      </li>
    );
  }
  return (
    <li key={key}>
      {renderBlocks(item.tokens, { ...ctx, tight: !item.loose }, key)}
    </li>
  );
}

/** 渲染一组块级 token */
function renderBlocks(
  tokens: Token[] | undefined,
  ctx: RenderContext,
  key: string,
): ReactNode[] {
  return (tokens ?? []).map((token, index) =>
    renderBlockToken(token, ctx, `${key}-${index}`),
  );
}

/**
 * 解析 markdown 并渲染为 React 节点
 * @param content 原始 markdown（可能是流式生成中的半成品）
 * @param renderCode 代码块渲染回调
 */
export function renderMarkdown(
  content: string,
  renderCode: CodeBlockRenderer,
): ReactNode {
  const tokens = marked.lexer(content);
  return renderBlocks(tokens, { renderCode, tight: false }, 'md');
}
