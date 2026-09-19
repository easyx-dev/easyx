/// <reference types="@rslib/core/types" />

/** 样式副作用导入（SCSS 经 rslib 编译后内联进 JS） */
declare module '*.scss' {
  const content: Record<string, string>;
  export default content;
}

/**
 * mammoth 预构建浏览器包（`mammoth/mammoth.browser.min.js`）
 *
 * 选它而非包主入口：该 UMD 产物自带 Buffer/jszip/xmldom，宿主无需再补 Node polyfill。
 * 包内只用到转换与图片占位两处能力，故按需声明。
 */
declare module 'mammoth/mammoth.browser.min.js' {
  interface MammothBrowser {
    convertToHtml(
      input: { arrayBuffer: ArrayBuffer },
      options?: Record<string, unknown>,
    ): Promise<{ value: string; messages: unknown[] }>;
    images: {
      /** 自定义图片转换：返回 src 即嵌入地址 */
      imgElement(convert: (image: unknown) => { src: string }): unknown;
    };
  }
  const mammoth: MammothBrowser;
  export default mammoth;
}
