import { useMatch } from '../context/MatchContext';
import { RefreshCw, Award, Trophy } from 'lucide-react';

export default function ResultScreen() {
  const { matchState, resetMatch } = useMatch();

  const winner = matchState.round.winner; // 'blue' | 'red' | null
  const isBlueWinner = winner === 'blue';
  const winnerName = isBlueWinner ? matchState.blue.name : matchState.red.name;
  const winnerClub = isBlueWinner ? matchState.blue.club : matchState.red.club;
  const winnerFlag = isBlueWinner ? matchState.blue.flag : matchState.red.flag;

  const blueWins = matchState.blue.roundWins;
  const redWins = matchState.red.roundWins;

  const handleResetScoreboard = () => {
    const ok = window.confirm(
      'Skorboard tamamen sıfırlanacaktır. Tüm raund kazanımları, puan ve cezalar silinecektir. Devam etmek istediğinize emin misiniz?'
    );
    if (ok) {
      resetMatch();
      // Sıfırlamadan sonra tekrar skorboard ekranına dön
      const sp = new URLSearchParams(window.location.search);
      sp.set('role', 'scoreboard');
      window.history.pushState({}, '', `${window.location.pathname}?${sp.toString()}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const winClass = winner === 'blue' ? 'win-blue' : winner === 'red' ? 'win-red' : 'win-neutral';

  return (
    <div className={`result-screen ${winClass}`}>
      <div className="result-overlay">
        <div className="result-card">
          <header className="result-header">
            <div className="result-badge">
              <Trophy size={24} />
              <span>MÜSABAKA SONUCU</span>
            </div>
            <div className="result-match-info">
              <div className="result-court">
                {matchState.matchInfo.court || 'KORT 1'} • {matchState.matchInfo.matchNumber || 'M-101'}
              </div>
              <h1 className="result-title">{matchState.matchInfo.title || 'Taekwondo Şampiyonası Finali'}</h1>
              <div className="result-category">
                {matchState.matchInfo.division} • {matchState.matchInfo.gender} • {matchState.matchInfo.weightCategory}
              </div>
            </div>
          </header>

          <main className="result-body">
            {/* Round score status: Mavi 2 - Kırmızı 1 */}
            <div className="result-scoreboard">
              <div className="result-side result-side-blue">
                <div className="result-flag">{matchState.blue.flag || '🟦'}</div>
                <div className="result-name">{matchState.blue.name || 'MAVİ (CHUNG)'}</div>
                <div className="result-country">{matchState.blue.club || 'TUR'}</div>
                <div className="result-round-score">{blueWins}</div>
                <div className="result-round-label">RAUND</div>
              </div>

              <div className="result-vs">
                <span>–</span>
              </div>

              <div className="result-side result-side-red">
                <div className="result-flag">{matchState.red.flag || '🟥'}</div>
                <div className="result-name">{matchState.red.name || 'KIRMIZI (HONG)'}</div>
                <div className="result-country">{matchState.red.club || 'KOR'}</div>
                <div className="result-round-score">{redWins}</div>
                <div className="result-round-label">RAUND</div>
              </div>
            </div>

            {/* Winner announcement */}
            {winner && (
              <div className={`result-winner result-winner-${winner}`}>
                <Award size={32} />
                <div className="result-winner-info">
                  <div className="result-winner-flag">{winnerFlag}</div>
                  <div className="result-winner-name">{winnerName}</div>
                  <div className="result-winner-club">{winnerClub}</div>
                  <div className="result-winner-text">MAÇ GALİBİ</div>
                </div>
              </div>
            )}

            {/* Reset scoreboard button */}
            <div className="result-actions">
              <button className="btn-reset" onClick={handleResetScoreboard}>
                <RefreshCw size={20} />
                <span>Skorboardu Sıfırla / Yeni Maç</span>
              </button>
            </div>
          </main>
        </div>

        <footer className="result-footer">
          <span>Taekwondo Web Scoreboard</span>
        </footer>
      </div>
    </div>
  );
}
