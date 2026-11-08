import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useMatch } from '../context/MatchContext';
import { soundManager } from '../utils/sound';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  ChevronRight,
  ChevronLeft,
  QrCode,
  Settings,
  Award,
  Maximize,
  Minimize,
  Video,
  Activity,
  Plus,
  Minus,
  Wifi,
} from 'lucide-react';
import ConnectionModal from './ConnectionModal';
import SettingsModal from './SettingsModal';
import MatchHistoryModal from './MatchHistoryModal';

export default function Scoreboard({ roomId = 'TKD-1', realtime }) {
  const {
    matchState,
    judgeIndicators,
    toggleTimer,
    resetTimer,
    nextRound,
    prevRound,
    resetMatch,
    addPoint,
    subtractPoint,
    addGamjeom,
    subtractGamjeom,
    toggleVideoQuota,
    toggleKyeshi,
    updateMatchInfo,
    updateFighters,
    updateSettings,
    getRemainingSeconds,
  } = useMatch();

  // Modals
  const [isConnectionOpen, setIsConnectionOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [recentConsensusNotice, setRecentConsensusNotice] = useState(null);

  // Sync state with server whenever matchState updates
  useEffect(() => {
    realtime.syncState(matchState);
  }, [matchState, realtime]);

  // Handle incoming judge actions and consensus notices
  useEffect(() => {
    const latest = judgeIndicators[judgeIndicators.length - 1];
    if (latest && Date.now() - latest.timestamp < 1500) {
      setRecentConsensusNotice(latest);
      const timer = setTimeout(() => setRecentConsensusNotice(null), 1800);
      return () => clearTimeout(timer);
    }
  }, [judgeIndicators]);

  // Fullscreen listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Keyboard shortcuts (Space = Timer, B = Buzzer, F = Fullscreen)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        toggleTimer();
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        soundManager.playBuzzer();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleTimer]);

  // Saniyeyi MM:SS veya (1 dakikanin altinda) SS.cc olarak bicimler.
  // Centisaniye, kalan surenin ondalik kisimindan hesaplanir -> gercekte akici geri sayim.
  const formatTimer = useCallback((totalSeconds = 0, showCentiseconds = false) => {
    const total = Math.max(0, totalSeconds);
    if (showCentiseconds && total < 60) {
      const secs = Math.floor(total);
      const centis = Math.floor((total % 1) * 100);
      return `${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
    }
    const mins = Math.floor(total / 60);
    const secs = Math.floor(total % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  // Extract recent clicks for Blue and Red corner judges (J1, J2, J3)
  const getJudgeStatus = useCallback(
    (slot, target) => {
      const now = Date.now();
      const click = judgeIndicators.find(
        (j) => j.slot === slot && j.target === target && now - j.timestamp < 1200
      );
      return click ? click.points : null;
    },
    [judgeIndicators]
  );

  const timerSeconds = matchState.timer.seconds;
  const isTimerRunning = matchState.timer.isRunning;
  const isKyeshi = matchState.timer.isKyeshi;
  const kyeshiBlue = matchState.timer.kyeshiBlue;
  const kyeshiRed = matchState.timer.kyeshiRed;
  const kyeshiSecondsBlue = matchState.timer.kyeshiSecondsBlue;
  const kyeshiSecondsRed = matchState.timer.kyeshiSecondsRed;
  const isRest = matchState.timer.isRest;
  const winner = matchState.round.winner;

  // Akici timer gorunumu: requestAnimationFrame ile centisaniyelik seri akis.
  // matchState (veya sunucuya senkron durum) her kare guncellenmez, sadece
  // gorunen sure degistiginde yeniden render yapilir.
  const [displaySeconds, setDisplaySeconds] = useState(timerSeconds);
  const lastRenderedTimerText = useRef('');

  useEffect(() => {
    let rafId;
    const loop = () => {
      const remaining = getRemainingSeconds();
      const showCentiseconds = remaining < 60;
      const text = formatTimer(remaining, showCentiseconds);
      if (text !== lastRenderedTimerText.current) {
        lastRenderedTimerText.current = text;
        setDisplaySeconds(remaining);
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [getRemainingSeconds, formatTimer]);

  // Timer digit styling
  const timerClass = useMemo(() => {
    if (isKyeshi) return 'timer-kyeshi';
    if (displaySeconds <= 0) return 'timer-expired';
    if (displaySeconds <= 10) return 'timer-danger';
    if (displaySeconds <= 30) return 'timer-warning';
    return isTimerRunning ? 'timer-running' : 'timer-idle';
  }, [displaySeconds, isTimerRunning, isKyeshi]);

  const activeJudgesCount = realtime.activeJudges.filter((j) => j.online).length;

  return (
    <div className="scoreboard-container">
      {/* ========================================================
          TOP TOURNAMENT BAR
         ======================================================== */}
      <header className="scoreboard-topbar">
        <div className="topbar-left">
          <div className="court-badge">{matchState.matchInfo.court || 'KORT 1'}</div>
          <div className="match-title-group">
            <h1>{matchState.matchInfo.title || 'Taekwondo Şampiyonası'}</h1>
            <span className="match-meta">
              {matchState.matchInfo.division} • {matchState.matchInfo.gender} • {matchState.matchInfo.weightCategory} • No: {matchState.matchInfo.matchNumber}
            </span>
          </div>
        </div>

        {/* Center Round Banner */}
        <div className="topbar-center">
          {winner ? (
            <div className={`round-status-banner winner-banner ${winner}`}>
              🏆 MAÇ GALİBİ: {winner === 'blue' ? matchState.blue.name : matchState.red.name}!
            </div>
          ) : isRest ? (
            <div className="round-status-banner rest-banner">MOLA (REST)</div>
          ) : (
            <div className="round-status-banner normal-banner">
              RAUND {matchState.round.current} / {matchState.round.maxRounds}
            </div>
          )}
        </div>

        {/* Right Action Icons */}
        <div className="topbar-right">
          {/* Active Judges Badge */}
          <button
            className="btn-judge-indicator"
            onClick={() => setIsConnectionOpen(true)}
            title="Hakemleri ve QR Kodları Yönet"
          >
            <span className={`judge-led ${activeJudgesCount > 0 ? 'online' : 'offline'}`} />
            <span>{activeJudgesCount} Hakem Bağlı</span>
          </button>

          {/* LAN IP chip – shows the address judges/phones must use on the same Wi-Fi */}
          {realtime.serverIp && realtime.serverIp !== 'localhost' && realtime.serverIp !== '127.0.0.1' && (
            <span className="topbar-lan-chip">
              <Wifi size={14} />
              <span>{realtime.serverIp}:{realtime.serverPort}</span>
            </span>
          )}

          {/* QR Code Modal Button */}
          <button
            className="topbar-btn btn-qr"
            onClick={() => setIsConnectionOpen(true)}
            title="Telefon Bağlantı QR Kodu"
          >
            <QrCode size={18} />
            <span>QR Bağlantı</span>
          </button>

          {/* History Button */}
          <button
            className="topbar-btn"
            onClick={() => setIsHistoryOpen(true)}
            title="Müsabaka Geçmişi"
          >
            <Award size={18} />
          </button>

          {/* Buzzer Button */}
          <button
            className="topbar-btn"
            onClick={() => soundManager.playBuzzer()}
            title="Korna (Buzzer)"
          >
            <Volume2 size={18} />
          </button>

          {/* Settings Button */}
          <button
            className="topbar-btn"
            onClick={() => setIsSettingsOpen(true)}
            title="Ayarlar"
          >
            <Settings size={18} />
          </button>

          {/* Fullscreen Button */}
          <button
            className="topbar-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran'}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </header>

      {/* ========================================================
          MAIN ARENA MAT VIEW (BLUE | TIMER | RED)
         ======================================================== */}
      <main className="scoreboard-arena">
        {/* ---------------- BLUE (CHUNG) SIDE ---------------- */}
        <section className={`fighter-panel panel-blue ${matchState.round.roundWinner === 'blue' ? 'winner-glow' : ''}`}>
          {/* Fighter Header */}
          <div className="fighter-header">
            <span className="fighter-flag">{matchState.blue.flag || '🇹🇷'}</span>
            <div className="fighter-title">
              <h2 className="fighter-name">{matchState.blue.name || 'CHUNG'}</h2>
              <span className="fighter-club">{matchState.blue.club || 'TUR'}</span>
            </div>
            <div className="corner-tag blue">MAVİ (CHUNG)</div>
          </div>

          {/* Giant Score Display */}
          <div className="score-area">
            <div className="giant-score-number text-blue-glow">
              {matchState.blue.score}
            </div>

            {/* Quick point adjustment buttons (Masa Masası) */}
            <div className="quick-point-adjusters">
              <button onClick={() => addPoint('blue', 1, 'Yumruk')}>+1</button>
              <button onClick={() => addPoint('blue', 2, 'Gövde')}>+2</button>
              <button onClick={() => addPoint('blue', 3, 'Baş')}>+3</button>
              <button onClick={() => addPoint('blue', 4, 'Döner Gövde')}>+4</button>
              <button onClick={() => addPoint('blue', 5, 'Döner Baş')}>+5</button>
              <button className="btn-sub" onClick={() => subtractPoint('blue', 1)} title="-1 Puan Düzelt">
                <Minus size={14} />
              </button>
            </div>
          </div>

          {/* Bottom Indicators (Round Wins, Gam-jeom, VR, Judges) */}
          <div className="fighter-meta-bar">
            {/* Round Wins (Best of 3) */}
            <div className="meta-card round-wins-card">
              <span className="meta-label">RAUND</span>
              <div className="round-dots">
                {[1, 2].map((i) => (
                  <span
                    key={i}
                    className={`round-dot ${matchState.blue.roundWins >= i ? 'won' : ''}`}
                    title={`Raund ${i} Galibiyeti`}
                  />
                ))}
              </div>
            </div>

            {/* Gam-jeom (Penalties) */}
            <div className="meta-card gamjeom-card">
              <div className="meta-label-row">
                <span className="meta-label">GAM-JEOM</span>
                <span className="gamjeom-number">{matchState.blue.gamjeom} / 5</span>
              </div>
              <div className="gamjeom-bars">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`gamjeom-bar ${matchState.blue.gamjeom >= i ? 'active' : ''}`}
                  />
                ))}
              </div>
              <div className="gamjeom-btn-row">
                <button
                  className="btn-gamjeom-inline add"
                  onClick={() => addGamjeom('blue')}
                  title="Ceza Ver (+1 Rakibe)"
                >
                  <Plus size={14} /> Ceza
                </button>
                <button
                  className="btn-gamjeom-inline sub"
                  onClick={() => subtractGamjeom('blue')}
                  title="Cezayı İptal Et"
                >
                  <Minus size={14} />
                </button>
              </div>
            </div>

            {/* Video Replay Card */}
            <div
              className={`meta-card vr-card ${matchState.blue.videoQuota > 0 ? 'available' : 'used'}`}
              onClick={() => toggleVideoQuota('blue')}
              title="Video İtiraz Kartı (Tıkla değiştir)"
            >
              <Video size={20} />
              <span>VR {matchState.blue.videoQuota > 0 ? 'KARTI' : 'YOK'}</span>
            </div>

            {/* Live Corner Judge Indicators (J1, J2, J3) */}
            <div className="meta-card judges-card">
              <span className="meta-label">KÖŞE HAKEMLERİ</span>
              <div className="judges-dots-row">
                {[1, 2, 3].map((slot) => {
                  const points = getJudgeStatus(slot, 'blue');
                  return (
                    <div
                      key={slot}
                      className={`judge-light-badge blue ${points ? 'active' : ''}`}
                    >
                      <span className="j-title">J{slot}</span>
                      <span className="j-pts">{points ? `+${points}` : '—'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- CENTER TIMER & MATCH CONTROLS ---------------- */}
        <section className="center-timer-panel">
          {/* Recent Judge Consensus Banner Overlay */}
          {recentConsensusNotice && (
            <div className={`judge-consensus-popup target-${recentConsensusNotice.target}`}>
              <span className="popup-j-tag">J{recentConsensusNotice.slot}</span>
              <span className="popup-text">
                {recentConsensusNotice.target === 'blue' ? 'MAVİ' : 'KIRMIZI'} +
                {recentConsensusNotice.points} ({recentConsensusNotice.pointType})
              </span>
            </div>
          )}

          {/* Kyeshi Medical Badge */}
          {isKyeshi && (
            <>
              {kyeshiBlue && (
                <div className="kyeshi-alert-badge kyeshi-blue">
                  <Activity size={18} className="animate-spin" />
                  <span>DOKTOR / KYESHI - MAVİ ({formatTimer(kyeshiSecondsBlue, true)})</span>
                </div>
              )}
              {kyeshiRed && (
                <div className="kyeshi-alert-badge kyeshi-red">
                  <Activity size={18} className="animate-spin" />
                  <span>DOKTOR / KYESHI - KIRMIZI ({formatTimer(kyeshiSecondsRed, true)})</span>
                </div>
              )}
            </>
          )}

          {/* Massive Digital LED Timer */}
          <div className={`arena-timer-display ${timerClass}`}>
            <span className="timer-text">{formatTimer(displaySeconds, displaySeconds < 60)}</span>
          </div>

          {/* Primary Arena Control Buttons */}
          <div className="arena-control-buttons">
            <button
              className={`btn-arena-start ${isTimerRunning ? 'btn-pause' : 'btn-start'}`}
              onClick={toggleTimer}
            >
              {isTimerRunning ? <Pause size={28} /> : <Play size={28} />}
              <span>{isTimerRunning ? 'DURDUR (SPACE)' : 'BAŞLAT (SPACE)'}</span>
            </button>

            <button
              className="btn-arena-sub"
              onClick={resetTimer}
              title="Süreyi Sıfırla"
            >
              <RotateCcw size={18} />
              <span>Sıfırla</span>
            </button>

            <button
              className={`btn-arena-sub ${kyeshiBlue ? 'btn-kyeshi-active' : ''}`}
              onClick={() => toggleKyeshi('blue')}
              title="Doktor / Kyeshi (Mavi Köşe)"
            >
              <Activity size={18} />
              <span>Kyeshi Mavi</span>
            </button>

            <button
              className={`btn-arena-sub ${kyeshiRed ? 'btn-kyeshi-active' : ''}`}
              onClick={() => toggleKyeshi('red')}
              title="Doktor / Kyeshi (Kırmızı Köşe)"
            >
              <Activity size={18} />
              <span>Kyeshi Kırmızı</span>
            </button>
          </div>

          {/* Round Navigation Bar */}
          <div className="round-nav-bar">
            <button
              className="btn-round-nav"
              onClick={prevRound}
              disabled={matchState.round.current <= 1}
              title="Önceki Raund"
            >
              <ChevronLeft size={16} /> Önceki Raund
            </button>

            <button
              className="btn-round-nav btn-next-round"
              onClick={nextRound}
              title="Sonraki Raund"
            >
              Sonraki Raund <ChevronRight size={16} />
            </button>
          </div>
        </section>

        {/* ---------------- RED (HONG) SIDE ---------------- */}
        <section className={`fighter-panel panel-red ${matchState.round.roundWinner === 'red' ? 'winner-glow' : ''}`}>
          {/* Fighter Header */}
          <div className="fighter-header">
            <div className="corner-tag red">KIRMIZI (HONG)</div>
            <div className="fighter-title">
              <h2 className="fighter-name">{matchState.red.name || 'HONG'}</h2>
              <span className="fighter-club">{matchState.red.club || 'KOR'}</span>
            </div>
            <span className="fighter-flag">{matchState.red.flag || '🇰🇷'}</span>
          </div>

          {/* Giant Score Display */}
          <div className="score-area">
            <div className="giant-score-number text-red-glow">
              {matchState.red.score}
            </div>

            {/* Quick point adjustment buttons */}
            <div className="quick-point-adjusters">
              <button onClick={() => addPoint('red', 1, 'Yumruk')}>+1</button>
              <button onClick={() => addPoint('red', 2, 'Gövde')}>+2</button>
              <button onClick={() => addPoint('red', 3, 'Baş')}>+3</button>
              <button onClick={() => addPoint('red', 4, 'Döner Gövde')}>+4</button>
              <button onClick={() => addPoint('red', 5, 'Döner Baş')}>+5</button>
              <button className="btn-sub" onClick={() => subtractPoint('red', 1)} title="-1 Puan Düzelt">
                <Minus size={14} />
              </button>
            </div>
          </div>

          {/* Bottom Indicators (Round Wins, Gam-jeom, VR, Judges) */}
          <div className="fighter-meta-bar">
            {/* Live Corner Judge Indicators (J1, J2, J3) */}
            <div className="meta-card judges-card">
              <span className="meta-label">KÖŞE HAKEMLERİ</span>
              <div className="judges-dots-row">
                {[1, 2, 3].map((slot) => {
                  const points = getJudgeStatus(slot, 'red');
                  return (
                    <div
                      key={slot}
                      className={`judge-light-badge red ${points ? 'active' : ''}`}
                    >
                      <span className="j-title">J{slot}</span>
                      <span className="j-pts">{points ? `+${points}` : '—'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Video Replay Card */}
            <div
              className={`meta-card vr-card ${matchState.red.videoQuota > 0 ? 'available' : 'used'}`}
              onClick={() => toggleVideoQuota('red')}
              title="Video İtiraz Kartı (Tıkla değiştir)"
            >
              <Video size={20} />
              <span>VR {matchState.red.videoQuota > 0 ? 'KARTI' : 'YOK'}</span>
            </div>

            {/* Gam-jeom (Penalties) */}
            <div className="meta-card gamjeom-card">
              <div className="meta-label-row">
                <span className="meta-label">GAM-JEOM</span>
                <span className="gamjeom-number">{matchState.red.gamjeom} / 5</span>
              </div>
              <div className="gamjeom-bars">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`gamjeom-bar ${matchState.red.gamjeom >= i ? 'active' : ''}`}
                  />
                ))}
              </div>
              <div className="gamjeom-btn-row">
                <button
                  className="btn-gamjeom-inline add"
                  onClick={() => addGamjeom('red')}
                  title="Ceza Ver (+1 Rakibe)"
                >
                  <Plus size={14} /> Ceza
                </button>
                <button
                  className="btn-gamjeom-inline sub"
                  onClick={() => subtractGamjeom('red')}
                  title="Cezayı İptal Et"
                >
                  <Minus size={14} />
                </button>
              </div>
            </div>

            {/* Round Wins (Best of 3) */}
            <div className="meta-card round-wins-card">
              <span className="meta-label">RAUND</span>
              <div className="round-dots">
                {[1, 2].map((i) => (
                  <span
                    key={i}
                    className={`round-dot ${matchState.red.roundWins >= i ? 'won' : ''}`}
                    title={`Raund ${i} Galibiyeti`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================
          MODALS
         ======================================================== */}
      <ConnectionModal
        isOpen={isConnectionOpen}
        onClose={() => setIsConnectionOpen(false)}
        roomId={roomId}
        serverIp={realtime.serverIp}
        serverPort={realtime.serverPort}
        activeJudges={realtime.activeJudges}
        consensusRequired={matchState.settings.consensusRequired}
        onUpdateConsensus={(val) => updateSettings({ consensusRequired: val })}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        matchState={matchState}
        onUpdateMatchInfo={updateMatchInfo}
        onUpdateFighters={updateFighters}
        onUpdateSettings={updateSettings}
        onResetMatch={resetMatch}
      />

      <MatchHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        matchState={matchState}
      />
    </div>
  );
}

