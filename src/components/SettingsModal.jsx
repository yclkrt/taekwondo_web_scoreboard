import { useState } from 'react';
import { X, Settings, Volume2, Save, RotateCcw } from 'lucide-react';
import { soundManager } from '../utils/sound';

export default function SettingsModal({
  isOpen,
  onClose,
  matchState,
  onUpdateMatchInfo,
  onUpdateFighters,
  onUpdateSettings,
  onResetMatch,
}) {
  const [matchInfo, setMatchInfo] = useState(matchState?.matchInfo || {});
  const [blue, setBlue] = useState({
    name: matchState?.blue?.name || 'M. ÇELİK',
    club: matchState?.blue?.club || 'TUR',
    flag: matchState?.blue?.flag || '🇹🇷',
  });
  const [red, setRed] = useState({
    name: matchState?.red?.name || 'K. YILMAZ',
    club: matchState?.red?.club || 'KOR',
    flag: matchState?.red?.flag || '🇰🇷',
  });
  const [initialSeconds, setInitialSeconds] = useState(matchState?.timer?.initialSeconds || 120);
  const [restSeconds, setRestSeconds] = useState(matchState?.timer?.restSeconds || 60);
  const [systemMode, setSystemMode] = useState(matchState?.settings?.systemMode || 'best_of_3');
  const [consensusRequired, setConsensusRequired] = useState(matchState?.settings?.consensusRequired || 2);
  const [consensusWindowMs, setConsensusWindowMs] = useState(matchState?.settings?.consensusWindowMs || 1200);
  const [soundEnabled, setSoundEnabled] = useState(matchState?.settings?.soundEnabled ?? true);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    onUpdateMatchInfo(matchInfo);
    onUpdateFighters(blue, red);
    onUpdateSettings({
      systemMode,
      consensusRequired: Number(consensusRequired),
      consensusWindowMs: Number(consensusWindowMs),
      soundEnabled,
      initialSeconds: Number(initialSeconds),
      restSeconds: Number(restSeconds),
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <Settings className="text-cyan" size={24} />
            <h2>Müsabaka & Kural Ayarları</h2>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="settings-form">
          {/* General Match Info */}
          <section className="settings-section">
            <h3>Müsabaka Bilgileri</h3>
            <div className="form-grid-3">
              <div className="form-field">
                <label>Şampiyona / Başlık</label>
                <input
                  type="text"
                  value={matchInfo.title || ''}
                  onChange={(e) => setMatchInfo({ ...matchInfo, title: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Kort / Tatami</label>
                <input
                  type="text"
                  value={matchInfo.court || ''}
                  onChange={(e) => setMatchInfo({ ...matchInfo, court: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Sıklet & Kategori</label>
                <input
                  type="text"
                  value={matchInfo.weightCategory || ''}
                  onChange={(e) => setMatchInfo({ ...matchInfo, weightCategory: e.target.value })}
                />
              </div>
            </div>
          </section>

          {/* Fighters Info */}
          <section className="settings-section">
            <h3>Sporcular</h3>
            <div className="form-grid-2">
              {/* Blue Fighter */}
              <div className="fighter-edit-box blue-box">
                <h4>🟦 Mavi Köşe (CHUNG)</h4>
                <div className="form-field">
                  <label>Sporcu Adı</label>
                  <input
                    type="text"
                    value={blue.name}
                    onChange={(e) => setBlue({ ...blue, name: e.target.value })}
                  />
                </div>
                <div className="form-row-2">
                  <div className="form-field">
                    <label>Kulüp / Ülke</label>
                    <input
                      type="text"
                      value={blue.club}
                      onChange={(e) => setBlue({ ...blue, club: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label>Bayrak (Emoji)</label>
                    <input
                      type="text"
                      value={blue.flag}
                      onChange={(e) => setBlue({ ...blue, flag: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Red Fighter */}
              <div className="fighter-edit-box red-box">
                <h4>🟥 Kırmızı Köşe (HONG)</h4>
                <div className="form-field">
                  <label>Sporcu Adı</label>
                  <input
                    type="text"
                    value={red.name}
                    onChange={(e) => setRed({ ...red, name: e.target.value })}
                  />
                </div>
                <div className="form-row-2">
                  <div className="form-field">
                    <label>Kulüp / Ülke</label>
                    <input
                      type="text"
                      value={red.club}
                      onChange={(e) => setRed({ ...red, club: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label>Bayrak (Emoji)</label>
                    <input
                      type="text"
                      value={red.flag}
                      onChange={(e) => setRed({ ...red, flag: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Time & Round Settings */}
          <section className="settings-section">
            <h3>Zaman & Raund Kuralları</h3>
            <div className="form-grid-3">
              <div className="form-field">
                <label>Raund Süresi (Saniye)</label>
                <select
                  value={initialSeconds}
                  onChange={(e) => setInitialSeconds(Number(e.target.value))}
                >
                  <option value={45}>0:45 (Yıldızlar / Minikler)</option>
                  <option value={60}>1:00 (Hızlı Maç)</option>
                  <option value={90}>1:30 (Gençler)</option>
                  <option value={120}>2:00 (Resmi Büyükler - WT Standardı)</option>
                </select>
              </div>

              <div className="form-field">
                <label>Mola Süresi (Saniye)</label>
                <select
                  value={restSeconds}
                  onChange={(e) => setRestSeconds(Number(e.target.value))}
                >
                  <option value={30}>30 Saniye</option>
                  <option value={60}>1 Dakika (Resmi)</option>
                </select>
              </div>

              <div className="form-field">
                <label>Raund Sistemi</label>
                <select
                  value={systemMode}
                  onChange={(e) => setSystemMode(e.target.value)}
                >
                  <option value="best_of_3">Best of 3 (WT Güncel Kuralı)</option>
                  <option value="cumulative">Kümülatif Toplam (Geleneksel)</option>
                </select>
              </div>
            </div>
          </section>

          {/* Referee Consensus & Audio */}
          <section className="settings-section">
            <h3>Hakem Konsensüsü & Ses</h3>
            <div className="form-grid-3">
              <div className="form-field">
                <label>Hakem Puan Uzlaşısı</label>
                <select
                  value={consensusRequired}
                  onChange={(e) => setConsensusRequired(Number(e.target.value))}
                >
                  <option value={1}>1 Hakem (Doğrudan Puan / Antrenman)</option>
                  <option value={2}>2 Hakem (3 hakemden 2&apos;si - WT Kuralı)</option>
                </select>
              </div>

              <div className="form-field">
                <label>Uzlaşı Penceresi (ms)</label>
                <input
                  type="number"
                  min={800}
                  max={3000}
                  step={100}
                  value={consensusWindowMs}
                  onChange={(e) => setConsensusWindowMs(Number(e.target.value))}
                />
              </div>

              <div className="form-field">
                <label>Ses Efektleri</label>
                <div className="checkbox-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={(e) => setSoundEnabled(e.target.checked)}
                    />
                    <span>Sesler Aktif</span>
                  </label>

                  <button
                    type="button"
                    className="btn-small btn-secondary"
                    onClick={() => soundManager.playBuzzer()}
                  >
                    <Volume2 size={14} /> Korna Testi
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Modal Actions */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn-danger-outline"
              onClick={() => {
                if (window.confirm('Tüm skorları ve raund geçmişini sıfırlamak istiyor musunuz?')) {
                  onResetMatch();
                  onClose();
                }
              }}
            >
              <RotateCcw size={16} /> Maçı Sıfırla
            </button>

            <div className="action-buttons-right">
              <button type="button" className="btn-secondary" onClick={onClose}>
                İptal
              </button>
              <button type="submit" className="btn-primary">
                <Save size={16} /> Ayarları Kaydet
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

