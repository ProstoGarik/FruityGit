import React, { useEffect, useState } from 'react';
import './Settings.css';

const normalizeServerPath = (value) => {
  const v = String(value || '').trim();
  if (!v) return '';
  // Ensure it has a protocol so fetch() works predictably.
  if (!/^https?:\/\//i.test(v)) return `http://${v}`;
  return v;
};

export default function SettingsWindow({ initialServerPath, onClose, onSave, onRunDiagnostics }) {
  const [serverAddress, setServerAddress] = useState(initialServerPath || 'http://localhost:3000');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [diagReport, setDiagReport] = useState('');
  const [diagError, setDiagError] = useState('');
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

  useEffect(() => {
    setServerAddress(initialServerPath || 'http://localhost:3000');
  }, [initialServerPath]);

  const handleSave = async () => {
    setError('');
    const next = normalizeServerPath(serverAddress);
    if (!next) {
      setError('Требуется адрес сервера.');
      return;
    }

    try {
      // Validate basic URL shape.
      // eslint-disable-next-line no-new
      new URL(next);
    } catch {
      setError('Некорректный адрес сервера. Пример: http://192.168.1.218:3000');
      return;
    }

    try {
      setIsSaving(true);
      await onSave(next);
      onClose();
    } catch (e) {
      setError(e?.message || 'Не удалось сохранить настройки');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunDiagnostics = async () => {
    if (isRunningDiagnostics) return;
    setDiagError('');
    setDiagReport('');
    setIsRunningDiagnostics(true);
    try {
      const report = await (onRunDiagnostics
        ? onRunDiagnostics()
        : Promise.resolve('Обработчик диагностики не настроен.'));
      setDiagReport(String(report || ''));
    } catch (e) {
      setDiagError(e?.message || 'Диагностика завершилась с ошибкой');
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  return (
    <div className="settings-modal-overlay">
      <div className="settings-window">
        <div className="settings-header">
          <h2>Настройки</h2>
          <button className="close-button" onClick={onClose} disabled={isSaving}>
            ×
          </button>
        </div>

        <div className="settings-content">
          <div className="input-group">
            <label>Адрес сервера</label>
            <input
              type="text"
              className="settings-input"
              value={serverAddress}
              onChange={(e) => setServerAddress(e.target.value)}
              disabled={isSaving}
              placeholder="http://localhost:3000"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="settings-actions">
            <button className="cancel-button" onClick={onClose} disabled={isSaving} type="button">
              Отмена
            </button>
            <button className="create-button" onClick={handleSave} disabled={isSaving} type="button">
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>

          <div style={{ height: 18 }} />

          <div className="diagnostics-section">
            <button
              className="create-button"
              onClick={handleRunDiagnostics}
              disabled={isSaving || isRunningDiagnostics}
              type="button"
              title="Запустить комплексную проверку подключения и git-процесса"
            >
              {isRunningDiagnostics ? 'Выполняется...' : 'Запустить диагностику'}
            </button>

            {diagError && <div className="error-message">{diagError}</div>}

            {diagReport && (
              <pre className="diagnostics-report">
                {diagReport}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

