/**
 * 文档解析能力的开放类型
 *
 * 解析由宿主经顶层 `tools.parseDocument` 注入，因此本包不绑定任何解析实现：
 * 既可用包内默认解析器（`./parsers` 入口的浏览器端 mammoth / unpdf），
 * 也可由宿主接自己的服务端解析接口。接口一律异步。
 */

/** 可解析的文档类型 */
export type AiRichDocumentKind = 'docx' | 'pdf';

/**
 * 解析产物（宿主只需给出内容，`name` / `kind` 缺省由包内按文件补全）
 *
 * - docx：给结构化 `html`（标题/段落/列表/表格）
 * - pdf：给按页拼接的纯文本 `text`
 */
export interface AiRichParsedDocument {
  /** 文件名；缺省时取 File.name */
  name?: string;
  /** 文档类型；缺省时按文件扩展名推断 */
  kind?: AiRichDocumentKind;
  /** 结构化 HTML（docx 主产物） */
  html?: string;
  /** 纯文本（pdf 主产物） */
  text?: string;
  /** 页数（pdf） */
  pageCount?: number;
  /** 解析过程中的非致命提示（扫描件无文本层、图片已忽略等） */
  warnings?: string[];
}

/**
 * 文档解析函数：宿主注入的异步能力
 *
 * 返回值包含对应类型的主产物即可（docx → `html`，pdf → `text`）；
 * 远程实现可直接把 File POST 给服务端解析接口。
 */
export type AiRichDocumentParser = (
  file: File,
) => Promise<AiRichParsedDocument>;
