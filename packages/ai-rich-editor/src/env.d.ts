/// <reference types="@rslib/core/types" />

/** 样式副作用导入（SCSS 经 rslib 编译后内联进 JS） */
declare module '*.scss' {
  const content: Record<string, string>;
  export default content;
}
