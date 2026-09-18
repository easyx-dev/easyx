/**
 * 演示的连接面板：选择提供方、填写密钥与模型，保存后即时生效
 *
 * 纯演示侧 UI，不依赖库内组件；密钥只写 localStorage，面板内明确警示。
 */
import { useState } from 'react';
import {
  applyPreset,
  DEFAULT_CONNECTION,
  type DemoConnection,
  probeConnection,
  resolveConnection,
} from './connection';
import {
  CORS_LABELS,
  DEMO_PRESET_KEY,
  DEMO_PRESETS,
  findPreset,
} from './presets';

interface ConnectPanelProps {
  /** 当前生效的连接（打开面板时复制为草稿） */
  connection: DemoConnection;
  onClear: () => void;
  onClose: () => void;
  onSave: (connection: DemoConnection) => void;
}

type ProbeState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string };

export function ConnectPanel({
  connection,
  onSave,
  onClear,
  onClose,
}: ConnectPanelProps) {
  const [draft, setDraft] = useState<DemoConnection>(connection);
  const [probe, setProbe] = useState<ProbeState>({ status: 'idle' });

  const preset = findPreset(draft.preset);
  const isDemo = draft.preset === DEMO_PRESET_KEY;
  const resolved = resolveConnection(draft);
  const ready = resolved !== undefined;

  const update = (patch: Partial<DemoConnection>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setProbe({ status: 'idle' });
  };

  const handlePresetChange = (presetKey: string) => {
    setDraft((prev) => applyPreset(prev, presetKey));
    // 换提供方即作废上一次探测结论，否则旧结果会留在界面上误导
    setProbe({ status: 'idle' });
  };

  const handleTest = async () => {
    if (!resolved) return;
    setProbe({ status: 'testing' });
    try {
      setProbe({ status: 'ok', message: await probeConnection(resolved) });
    } catch (error) {
      setProbe({
        status: 'error',
        message: error instanceof Error ? error.message : '连接失败',
      });
    }
  };

  const handleClear = () => {
    setDraft(DEFAULT_CONNECTION);
    setProbe({ status: 'idle' });
    onClear();
  };

  return (
    <div className="demo-connect-panel">
      <div className="demo-connect-grid">
        <label className="demo-connect-field">
          <span className="demo-connect-label">提供方</span>
          <select
            className="demo-connect-select"
            onChange={(event) => handlePresetChange(event.target.value)}
            value={draft.preset}
          >
            {DEMO_PRESETS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <span className="demo-connect-badge" data-level={preset.cors}>
          浏览器直连：{CORS_LABELS[preset.cors]}
        </span>

        {!isDemo && (
          <>
            <label className="demo-connect-field">
              <span className="demo-connect-label">Base URL</span>
              <input
                className="demo-connect-input"
                onChange={(event) => update({ baseUrl: event.target.value })}
                placeholder="https://…/v1"
                spellCheck={false}
                value={draft.baseUrl}
              />
            </label>

            <label className="demo-connect-field">
              <span className="demo-connect-label">API Key</span>
              <input
                autoComplete="off"
                className="demo-connect-input"
                onChange={(event) => update({ apiKey: event.target.value })}
                placeholder="sk-…"
                spellCheck={false}
                type="password"
                value={draft.apiKey}
              />
            </label>

            <label className="demo-connect-field">
              <span className="demo-connect-label">模型</span>
              <input
                className="demo-connect-input"
                onChange={(event) => update({ model: event.target.value })}
                placeholder="gpt-4o-mini"
                spellCheck={false}
                value={draft.model}
              />
            </label>
          </>
        )}
      </div>

      {preset.note && <p className="demo-connect-note">{preset.note}</p>}
      {!isDemo && (
        <p className="demo-connect-warn">
          密钥仅保存在本机浏览器（localStorage），浏览器直连失败多为提供方未开放
          CORS，请改用 OpenRouter 或填写你自己的代理地址。
        </p>
      )}

      <div className="demo-connect-actions">
        {!isDemo && (
          <button
            disabled={!ready || probe.status === 'testing'}
            onClick={handleTest}
            type="button"
          >
            {probe.status === 'testing' ? '测试中…' : '测试连接'}
          </button>
        )}
        <button onClick={onClose} type="button">
          关闭
        </button>
        <button onClick={handleClear} type="button">
          清除连接
        </button>
        <button
          className="demo-connect-primary"
          disabled={!isDemo && !ready}
          onClick={() => onSave(draft)}
          type="button"
        >
          保存并应用
        </button>
      </div>

      {probe.status === 'ok' && (
        <p className="demo-connect-status" data-status="ok">
          {probe.message}
        </p>
      )}
      {probe.status === 'error' && (
        <p className="demo-connect-status" data-status="error">
          连接失败：{probe.message}
        </p>
      )}
    </div>
  );
}
