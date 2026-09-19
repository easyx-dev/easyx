/**
 * 计算样式摘要测试：只挑关键属性、过滤噪音值
 */
import { describe, expect, it } from '@rstest/core';
import {
  type ComputedStyleReader,
  SUMMARY_STYLE_PROPS,
  summarizeComputedStyle,
} from '../src/utils/computed-style';

/** 用固定取值表构造访问器 */
function reader(values: Record<string, string>): ComputedStyleReader {
  return { getPropertyValue: (property) => values[property] ?? '' };
}

describe('summarizeComputedStyle', () => {
  it('按固定顺序输出关键属性', () => {
    expect(
      summarizeComputedStyle(
        reader({
          display: 'block',
          color: 'rgb(1, 2, 3)',
          'font-size': '16px',
          'font-weight': '700',
          padding: '10px 20px',
          'border-radius': '8px',
        }),
      ),
    ).toBe(
      'display: block; color: rgb(1, 2, 3); font-size: 16px; font-weight: 700; padding: 10px 20px; border-radius: 8px',
    );
  });

  it('过滤空值与噪音值（none/normal/0px/全透明）', () => {
    expect(
      summarizeComputedStyle(
        reader({
          display: 'block',
          color: '#333',
          'background-color': 'rgba(0, 0, 0, 0)',
          'font-weight': 'normal',
          margin: '0px',
          border: 'none',
          'border-radius': '0px',
        }),
      ),
    ).toBe('display: block; color: #333');
  });

  it('没有可用值时返回空串', () => {
    expect(summarizeComputedStyle(reader({}))).toBe('');
  });

  it('摘要属性列表非空且不含重复', () => {
    expect(SUMMARY_STYLE_PROPS.length).toBeGreaterThan(0);
    expect(new Set(SUMMARY_STYLE_PROPS).size).toBe(SUMMARY_STYLE_PROPS.length);
  });
});
