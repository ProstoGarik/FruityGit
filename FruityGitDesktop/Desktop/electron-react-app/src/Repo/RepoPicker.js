import React, { useMemo, useState } from 'react';
import './RepoPicker.css';

export default function RepoPicker({ repos, selectedFullName, onSelect, onClose, onUpdate, isLoading }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Array.isArray(repos) ? repos : [];
    if (!q) return list;
    return list.filter(r => {
      const full = String(r?.fullName || '').toLowerCase();
      const owner = String(r?.owner || '').toLowerCase();
      const name = String(r?.name || '').toLowerCase();
      return full.includes(q) || owner.includes(q) || name.includes(q);
    });
  }, [repos, query]);

  return (
    <div className="repo-picker-overlay" role="dialog" aria-modal="true" aria-label="Выбор репозитория">
      <div className="repo-picker-window">
        <div className="repo-picker-header">
          <h2>Выбор репозитория</h2>
          <button className="close-button" onClick={onClose} type="button" aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="repo-picker-content">
          <div className="repo-picker-controls">
            <div className="repo-picker-search">
              <label>Поиск</label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Введите название или автора…"
                autoFocus
              />
            </div>

            <div className="repo-picker-meta">
              {isLoading ? 'Загрузка…' : `Найдено: ${filtered.length}`}
            </div>

            <div className="repo-picker-refresh">
              <button
                className="repo-action-button small"
                type="button"
                onClick={onUpdate}
                disabled={isLoading || !onUpdate}
                title="Обновить список репозиториев"
              >
                {isLoading ? 'Обновление…' : 'Обновить'}
              </button>
            </div>
          </div>

          <div className="repo-picker-list" role="list">
            <div className="repo-picker-list-header">
              <div>Название</div>
              <div>Автор</div>
            </div>

            {filtered.length > 0 ? (
              filtered.map(r => {
                const fullName = r?.fullName || '';
                const isSelected = selectedFullName && String(selectedFullName) === String(fullName);
                return (
                  <button
                    key={fullName}
                    className={`repo-picker-row ${isSelected ? 'selected' : ''}`}
                    type="button"
                    onClick={() => onSelect(fullName)}
                    title={fullName}
                  >
                    <div className="repo-picker-name">
                      <div className="repo-picker-full">{fullName}</div>
                      {r?.description ? <div className="repo-picker-desc">{r.description}</div> : null}
                    </div>
                    <div className="repo-picker-owner">{r?.owner || '—'}</div>
                  </button>
                );
              })
            ) : (
              <div className="repo-picker-empty">
                {isLoading ? 'Загрузка списка репозиториев…' : 'Репозитории не найдены'}
              </div>
            )}
          </div>

          <div className="repo-picker-actions">
            <button className="cancel-button" onClick={onClose} type="button">
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

