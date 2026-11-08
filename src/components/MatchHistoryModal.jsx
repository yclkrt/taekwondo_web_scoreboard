import { X, Award, Clock } from 'lucide-react';

export default function MatchHistoryModal({ isOpen, onClose, matchState }) {
  if (!isOpen) return null;

  const history = matchState?.blue?.history || [];
  const logs = matchState?.logs || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content history-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Award className="text-cyan" size={24} />
            <h2>Müsabaka Geçmişi & Raund İstatistikleri</h2>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="history-modal-body">
          {/* Round-by-Round Summary */}
          <section className="history-section">
            <h3>Raund Skorları (Best of 3)</h3>
            {history.length === 0 ? (
              <p className="empty-text">Henüz tamamlanan raund bulunmuyor.</p>
            ) : (
              <div className="rounds-table-wrap">
                <table className="rounds-table">
                  <thead>
                    <tr>
                      <th>Raund</th>
                      <th className="th-blue">🟦 {matchState.blue.name} (Chung)</th>
                      <th className="th-red">🟥 {matchState.red.name} (Hong)</th>
                      <th>Raund Galibi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, i) => (
                      <tr key={i}>
                        <td><strong>Raund {h.round}</strong></td>
                        <td className="td-blue">
                          <strong>{h.blueScore} Puan</strong> (Ceza: {h.blueGamjeom})
                        </td>
                        <td className="td-red">
                          <strong>{h.redScore} Puan</strong> (Ceza: {h.redGamjeom})
                        </td>
                        <td>
                          <span className={`winner-pill ${h.winner}`}>
                            {h.winner === 'blue' && `🟦 ${matchState.blue.name}`}
                            {h.winner === 'red' && `🟥 ${matchState.red.name}`}
                            {!h.winner && 'Berabere'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Real-time Match Logs */}
          <section className="history-section">
            <div className="logs-title-row">
              <Clock size={18} className="text-cyan" />
              <h3>Puan & Ceza Kayıtları (Log)</h3>
            </div>

            {logs.length === 0 ? (
              <p className="empty-text">Henüz kaydedilen bir puan veya ceza yok.</p>
            ) : (
              <div className="logs-list">
                {logs.map((log) => (
                  <div key={log.id} className={`log-item log-${log.side}`}>
                    <span className="log-time">
                      {Math.floor(log.time / 60)}:{String(log.time % 60).padStart(2, '0')}
                    </span>
                    <span className="log-text">{log.text}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

