/**
 * URL 协议白名单测试
 *
 * 关键约定：默认协议不可移除（危险协议永远拦下），宿主只能追加。
 */
import { describe, expect, it } from '@rstest/core';
import {
  DEFAULT_URL_SCHEMES,
  listAllowedSchemes,
  normalizeUrlSchemes,
  sanitizeUrl,
} from '../src/utils/url';

describe('sanitizeUrl', () => {
  it('放行默认协议与相对形式', () => {
    expect(sanitizeUrl('https://a.test/x.png')).toBe('https://a.test/x.png');
    expect(sanitizeUrl('http://a.test/x')).toBe('http://a.test/x');
    expect(sanitizeUrl('mailto:a@b.test')).toBe('mailto:a@b.test');
    expect(sanitizeUrl('tel:10086')).toBe('tel:10086');
    expect(sanitizeUrl('blob:https://a.test/1f2e')).toBe(
      'blob:https://a.test/1f2e',
    );
    expect(sanitizeUrl('/uploads/a.png')).toBe('/uploads/a.png');
    expect(sanitizeUrl('#anchor')).toBe('#anchor');
    expect(sanitizeUrl('./a.png')).toBe('./a.png');
    expect(sanitizeUrl('../a.png')).toBe('../a.png');
  });

  it('拦下危险协议与裸主机名', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeUrl('data:text/html,<script>')).toBeUndefined();
    expect(sanitizeUrl('vbscript:msgbox')).toBeUndefined();
    expect(sanitizeUrl('example.com/a.png')).toBeUndefined();
    expect(sanitizeUrl('')).toBeUndefined();
    expect(sanitizeUrl(null)).toBeUndefined();
  });

  it('大小写与首尾空白不敏感', () => {
    expect(sanitizeUrl('  HTTPS://A.test/x  ')).toBe('HTTPS://A.test/x');
    expect(sanitizeUrl('JavaScript:alert(1)')).toBeUndefined();
  });

  it('宿主追加的协议放行', () => {
    const options = { extraSchemes: ['ipfs:', 'app'] };
    expect(sanitizeUrl('ipfs://Qm123', options)).toBe('ipfs://Qm123');
    // 不带冒号也接受
    expect(sanitizeUrl('app://open/1', options)).toBe('app://open/1');
    // 追加不解除默认拦截
    expect(sanitizeUrl('javascript:alert(1)', options)).toBeUndefined();
    expect(sanitizeUrl('data:text/html,x', options)).toBeUndefined();
  });

  it('危险协议写进追加清单也放行不了', () => {
    const options = {
      extraSchemes: ['javascript', 'data:', 'vbscript:', 'file:', 'JAVASCRIPT'],
    };
    expect(sanitizeUrl('javascript:alert(1)', options)).toBeUndefined();
    expect(sanitizeUrl('data:text/html,x', options)).toBeUndefined();
    expect(sanitizeUrl('vbscript:msgbox', options)).toBeUndefined();
    expect(sanitizeUrl('file:///etc/passwd', options)).toBeUndefined();
    // 合法追加项不受影响
    expect(
      sanitizeUrl('ipfs://Qm1', { extraSchemes: ['ipfs:', 'javascript:'] }),
    ).toBe('ipfs://Qm1');
  });
});

describe('normalizeUrlSchemes', () => {
  it('补冒号、转小写、去重、剔除默认项与非法值', () => {
    expect(
      normalizeUrlSchemes([
        'ipfs',
        'IPFS:',
        ' https: ',
        'app:',
        'app',
        '',
        '   ',
        '*',
      ]),
    ).toEqual(['ipfs:', 'app:']);
  });

  it('危险协议一律剔除', () => {
    expect(
      normalizeUrlSchemes([
        'javascript:',
        'javascript',
        'data:',
        'vbscript:',
        'file:',
        'about:',
        'jar:',
        'view-source:',
        'ipfs:',
      ]),
    ).toEqual(['ipfs:']);
  });

  it('空输入返回空数组', () => {
    expect(normalizeUrlSchemes()).toEqual([]);
    expect(normalizeUrlSchemes([])).toEqual([]);
  });
});

describe('listAllowedSchemes', () => {
  it('默认清单 + 追加，顺序稳定', () => {
    expect(listAllowedSchemes()).toEqual([...DEFAULT_URL_SCHEMES]);
    expect(listAllowedSchemes({ extraSchemes: ['ipfs:'] })).toEqual([
      ...DEFAULT_URL_SCHEMES,
      'ipfs:',
    ]);
  });
});
