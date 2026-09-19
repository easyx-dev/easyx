/**
 * AI 富文本片段样式作用域化（零依赖纯函数，同构安全）
 * 生成的 HTML 片段顶层常带 <style> 全局选择器（如 .hero），直接注入宿主正文 DOM 会污染全局样式。
 * 本模块通过「唯一作用域前缀 + 选择器前缀改写」把 <style> 内选择器罩进片段根：片段被渲染进 <div class="{prefix}"> 时，
 * 改写后的 `.prefix .hero` 只匹配该片段内部；内联 style 天然隔离，无需处理。
 * 在「应用到编辑器」/ autoApply 时刻调用 scopedRichContent，使产物自带 scope 前缀，宿主可直接当 HTML 引入。
 *
 * 作用域化发生在输出期：AI 与代码面板编辑的是不含前缀的「源片段」，
 * 故另提供 unscopeRichContent 做逆向还原（剥外层容器 + 去选择器前缀），
 * 使补丁匹配、上下文发送都落在干净的源片段上。
 */

/** 片段根容器的作用域 class 前缀；scopeId 存在时生成稳定前缀（easyx-rich-content-<scopeId>），否则默认 easyx-rich-content-<随机> */
export function generateScopePrefix(scopeId?: string): string {
  if (scopeId) {
    return `easyx-rich-content-${scopeId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  }
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `easyx-rich-content-${rand}`;
}

/** 按顶层逗号切分选择器列表（忽略括号内与字符串/注释内的逗号） */
function splitSelectors(sel: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let inComment = false;
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i];
    const next = sel[i + 1];
    if (inComment) {
      current += ch;
      if (ch === '*' && next === '/') {
        current += next;
        i++;
        inComment = false;
      }
      continue;
    }
    if (inString) {
      current += ch;
      if (ch === stringChar && sel[i - 1] !== '\\') inString = false;
      continue;
    }
    if (ch === '/' && next === '*') {
      inComment = true;
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** 取 at-rule 类型名（如 @media → media、@-webkit-keyframes → -webkit-keyframes） */
function atRuleType(head: string): string {
  const m = /^@\s*([a-zA-Z-]+)/.exec(head.trim());
  return m ? m[1].toLowerCase() : '';
}

/**
 * 读取自 openIndex（指向 '{'）到配对 '}' 的块体原始内容。
 * 跳过字符串与注释内的花括号，避免误判嵌套深度。
 */
function readBlockBody(
  css: string,
  openIndex: number,
): { body: string; end: number } {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let inComment = false;
  const start = openIndex + 1;
  for (let i = openIndex; i < css.length; i++) {
    const ch = css[i];
    const next = css[i + 1];
    if (inComment) {
      if (ch === '*' && next === '/') {
        i++;
        inComment = false;
      }
      continue;
    }
    if (inString) {
      if (ch === stringChar && css[i - 1] !== '\\') inString = false;
      continue;
    }
    if (ch === '/' && next === '*') {
      i++;
      inComment = true;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return { body: css.slice(start, i), end: i };
    }
  }
  return { body: css.slice(start), end: css.length - 1 };
}

/** 正则转义（前缀只含安全字符，仍做防御） */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 选择器是否已带 `.{prefix}` 作用域（幂等守卫，避免重复前缀化） */
function hasScopePrefix(selector: string, prefix: string): boolean {
  return new RegExp(`^\\.${escapeRegExp(prefix)}(?![-_a-zA-Z0-9])`).test(
    selector,
  );
}

/**
 * 遍历 CSS 规则，对非 at-rule 的选择器逐个应用 mapper（零依赖 tokenizer）。
 * 兼容 @media/@supports/@layer/@container/@scope 内部递归；@keyframes/@font-face/@page 原样保留。
 * 说明：CSS 原生嵌套（规则体嵌套规则）较少见，此实现不做嵌套规则改写，README 已注明局限。
 */
function mapCssSelectors(
  css: string,
  map: (selector: string) => string,
): string {
  let out = '';
  let buf = '';
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let i = 0;
  const n = css.length;

  const flush = () => {
    if (buf) {
      out += buf;
      buf = '';
    }
  };

  while (i < n) {
    const ch = css[i];
    const next = css[i + 1];
    if (inComment) {
      out += ch;
      if (ch === '*' && next === '/') {
        out += next;
        i += 2;
        inComment = false;
      } else {
        i++;
      }
      continue;
    }
    if (inString) {
      out += ch;
      if (ch === stringChar && css[i - 1] !== '\\') inString = false;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      out += '/*';
      i += 2;
      inComment = true;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      out += ch;
      i++;
      continue;
    }
    if (ch === '{') {
      const isAt = buf.trim().startsWith('@');
      const head = buf.trimEnd();
      buf = '';
      const { body, end } = readBlockBody(css, i);
      if (!isAt) {
        out += splitSelectors(head).map(map).join(', ');
      } else {
        out += head;
      }
      out += '{';
      if (isAt) {
        const type = atRuleType(head);
        if (
          type === 'media' ||
          type === 'supports' ||
          type === 'layer' ||
          type === 'container' ||
          type === 'scope'
        ) {
          out += mapCssSelectors(body, map);
        } else {
          out += body;
        }
      } else {
        out += body;
      }
      out += '}';
      i = end + 1;
      continue;
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

/** 给 CSS 内的规则选择器加 `.prefix ` 前缀（已带前缀的选择器原样保留，保证幂等） */
export function prefixCss(css: string, prefix: string): string {
  return mapCssSelectors(css, (selector) =>
    hasScopePrefix(selector, prefix) ? selector : `.${prefix} ${selector}`,
  );
}

/** 去掉选择器上的 `.{prefix} ` 前缀（prefixCss 的逆向） */
export function unprefixCss(css: string, prefix: string): string {
  const re = new RegExp(`^\\.${escapeRegExp(prefix)}[ \\t]+`);
  return mapCssSelectors(css, (selector) => selector.replace(re, ''));
}

/** 把 HTML 内所有 <style> 块的选择器加上 `.prefix ` 前缀（保留 style 标签属性；无 style 时原样返回） */
export function scopeCssOfHtml(html: string, prefix: string): string {
  return html.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_m, open: string, cssBody: string, close: string) =>
      `${open}${prefixCss(cssBody, prefix)}${close}`,
  );
}

/** 把 HTML 内所有 <style> 块的选择器前缀去掉（scopeCssOfHtml 的逆向） */
export function unscopeCssOfHtml(html: string, prefix: string): string {
  return html.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_m, open: string, cssBody: string, close: string) =>
      `${open}${unprefixCss(cssBody, prefix)}${close}`,
  );
}

/**
 * 作用域化整段片段：返回包装后的 HTML（<div class="{prefix}">…</div>）。
 * 调用方应传入一次生成并沿用的固定 prefix（如编辑器实例创建时 generateScopePrefix 生成），
 * 避免每次应用都换随机前缀导致同一内容前缀漂移或重复包裹；缺省时会临时生成一个。
 */
export function scopedRichContent(
  html: string,
  prefix = generateScopePrefix(),
): string {
  return `<div class="${prefix}">${scopeCssOfHtml(html, prefix)}</div>`;
}

/** 作用域容器 class 的形态（前缀随机，但形态固定；用于识别历史遗留的旧前缀包装） */
const SCOPE_CLASS_PATTERN = /^easyx-rich-content-[A-Za-z0-9_-]+$/;

/** 读出最外层作用域容器；不是作用域包装时返回 null */
function readScopeWrapper(
  html: string,
): { prefix: string; inner: string } | null {
  const match = /^<div class="([^"]+)">([\s\S]*)<\/div>$/.exec(html);
  if (!match) return null;
  const [, className, inner] = match;
  if (!SCOPE_CLASS_PATTERN.test(className)) return null;
  return { prefix: className, inner };
}

/**
 * 作用域化的逆向：剥掉最外层作用域容器并去掉选择器前缀，还原为「源片段」。
 *
 * 容器按「形态」识别而非只认当前实例前缀：宿主持久化过产物、页面重载后实例前缀会变，
 * 若只认新前缀就剥不掉旧包装，AI 每轮编辑都会再套一层。
 * 非作用域包装（用户手工改过结构）原样保留，仅按传入前缀做选择器去前缀。
 */
export function unscopeRichContent(html: string, prefix: string): string {
  const wrapper = readScopeWrapper(html);
  if (!wrapper) return unscopeCssOfHtml(html, prefix);
  return unscopeCssOfHtml(wrapper.inner, wrapper.prefix);
}
