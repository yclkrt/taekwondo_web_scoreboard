import { useState, useEffect, useCallback } from 'react';
import { soundManager } from '../utils/sound';
import { Shield, Zap, Maximize, CheckCircle, Wifi, RefreshCw } from 'lucide-react';

export default function MobileJudge({
  roomId = 'TKD-1',
  slot = 1,
  realtime,
  matchState,
}) {
  const [judgeName, setJudgeName] = useState(() => {
    return localStorage.getItem(`tkd_judge_name_${slot}`) || `Hakem ${slot}`;
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [lastActionSent, setLastActionSent] = useState(null);
  const [activeFlashes, setActiveFlashes] = useState({});

  // Screen WakeLock to prevent phone sleep during the match
  useEffect(() => {
    let wakeLock = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch {
        // WakeLock not supported or denied
      }
    };
    requestWakeLock();

    return () => {
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);

  const handleNameSave = (e) => {
    e.preventDefault();
    localStorage.setItem(`tkd_judge_name_${slot}`, judgeName);
    setIsEditingName(false);
  };

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(40);
    }
  };

  // Score button click handler
  const handleScoreClick = useCallback(
    (target, pointType, points, label) => {
      triggerHaptic();
      soundManager.playPoint(points);

      // Flash button UI
      const flashKey = `${target}-${pointType}`;
      setActiveFlashes((prev) => ({ ...prev, [flashKey]: true }));
      setTimeout(() => {
        setActiveFlashes((prev) => ({ ...prev, [flashKey]: false }));
      }, 400);

      // Notify user
      const targetName = target === 'blue' ? (matchState?.blue?.name || 'Mavi (Chung)') : (matchState?.red?.name || 'Kırmızı (Hong)');
      setLastActionSent({
        text: `${targetName} +${points} (${label})`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        target,
      });

      // Send to server / scoreboard
      realtime.sendJudgeAction({
        slot,
        judgeName,
        target,
        pointType,
        points,
      });
    },
    [slot, judgeName, matchState, realtime]
  );

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const formatTimer = (seconds = 0) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isTimerRunning = matchState?.timer?.isRunning || false;
  const timerSeconds = matchState?.timer?.seconds ?? 120;
  const currentRound = matchState?.round?.current || 1;

  return (
    <div className="mobile-judge-container">
      {/* Top Status Bar */}
      <header className="judge-header">
        <div className="judge-identity">
          <div className="judge-badge-pill">
            <span className="slot-pill">J{slot}</span>
            {isEditingName ? (
              <form onSubmit={handleNameSave} className="name-form">
                <input
                  type="text"
                  value={judgeName}
                  onChange={(e) => setJudgeName(e.target.value)}
                  autoFocus
                  onBlur={() => setIsEditingName(false)}
                />
              </form>
            ) : (
              <span className="judge-name" onClick={() => setIsEditingName(true)}>
                {judgeName} ✏️
              </span>
            )}
          </div>
        </div>

        {/* Live Match Timer pill */}
        <div className={`judge-match-status ${isTimerRunning ? 'status-active' : 'status-paused'}`}>
          <span className="status-dot-blink" />
          <span className="round-label">R{currentRound}</span>
          <span className="time-digits">{formatTimer(timerSeconds)}</span>
        </div>

        <div className="header-actions">
          <button className="icon-btn" onClick={toggleFullscreen} title="Tam Ekran">
            <Maximize size={18} />
          </button>
          <div className={`connection-badge ${realtime?.isConnected ? 'connected' : 'disconnected'}`}>
            <Wifi size={16} />
          </div>
        </div>
      </header>

      {/* Last Action Notification Banner */}
      {lastActionSent && (
        <div className={`judge-banner banner-${lastActionSent.target}`}>
          <CheckCircle size={16} />
          <span>
            {lastActionSent.text} <small>({lastActionSent.time})</small>
          </span>
        </div>
      )}

      {/* Main Touch Scoring Matrix (Blue on Left, Red on Right) */}
      <main className="judge-matrix">
        {/* BLUE / CHUNG SIDE */}
        <section className="matrix-column column-blue">
          <div className="column-header">
            <h2>MAVİ (CHUNG)</h2>
            <span className="fighter-subtitle">{matchState?.blue?.name || 'Sporcu 1'}</span>
            <div className="score-badge blue">{matchState?.blue?.score ?? 0}</div>
          </div>

          <div className="buttons-stack">
            <button
              className={`judge-btn btn-blue ${activeFlashes['blue-punch'] ? 'flash' : ''}`}
              onClick={() => handleScoreClick('blue', 'punch', 1, 'Yumruk')}
            >
              <div className="btn-points">+1</div>
              <div className="btn-desc">👊 YUMRUK</div>
            </button>

            <button
              className={`judge-btn btn-blue ${activeFlashes['blue-body'] ? 'flash' : ''}`}
              onClick={() => handleScoreClick('blue', 'body', 2, 'Gövde')}
            >
              <div className="btn-points">+2</div>
              <div className="btn-desc">🥋 GÖVDE</div>
            </button>

            <button
              className={`judge-btn btn-blue ${activeFlashes['blue-head'] ? 'flash' : ''}`}
              onClick={() => handleScoreClick('blue', 'head', 3, 'Baş')}
            >
              <div className="btn-points">+3</div>
              <div className="btn-desc">🎯 BAŞ</div>
            </button>

            <button
              className={`judge-btn btn-blue ${activeFlashes['blue-turnBody'] ? 'flash' : ''}`}
              onClick={() => handleScoreClick('blue', 'turnBody', 4, 'Döner Gövde')}
            >
              <div className="btn-points">+4</div>
              <div className="btn-desc">🌪️ DÖNER GÖVDE</div>
            </button>

            <button
              className={`judge-btn btn-blue ${activeFlashes['blue-turnHead'] ? 'flash' : ''}`}
              onClick={() => handleScoreClick('blue', 'turnHead', 5, 'Döner Baş')}
            >
              <div className="btn-points">+5</div>
              <div className="btn-desc">⚡ DÖNER BAŞ</div>
            </button>
          </div>
        </section>

        {/* RED / HONG SIDE */}
        <section className="matrix-column column-red">
          <div className="column-header">
            <h2>KIRMIZI (HONG)</h2>
            <span className="fighter-subtitle">{matchState?.red?.name || 'Sporcu 2'}</span>
            <div className="score-badge red">{matchState?.red?.score ?? 0}</div>
          </div>

          <div className="buttons-stack">
            <button
              className={`judge-btn btn-red ${activeFlashes['red-punch'] ? 'flash' : ''}`}
              onClick={() => handleScoreClick('red', 'punch', 1, 'Yumruk')}
            >
              <div className="btn-points">+1</div>
              <div className="btn-desc">👊 YUMRUK</div>
            </button>

            <button
              className={`judge-btn btn-red ${activeFlashes['red-body'] ? 'flash' : ''}`}
              onClick={() => handleScoreClick('red', 'body', 2, 'Gövde')}
            >
              <div className="btn-points">+2</div>
              <div className="btn-desc">🥋 GÖVDE</div>
            </button>

            <button
              className={`judge-btn btn-red ${activeFlashes['red-head'] ? 'flash' : ''}`}
              onClick={() => handleScoreClick('red', 'head', 3, 'Baş')}
            >
              <div className="btn-points">+3</div>
              <div className="btn-desc">🎯 BAŞ</div>
            </button>

            <button
              className={`judge-btn btn-red ${activeFlashes['red-turnBody'] ? 'flash' : ''}`}
              onClick={() => handleScoreClick('red', 'turnBody', 4, 'Döner Gövde')}
            >
              <div className="btn-points">+4</div>
              <div className="btn-desc">🌪️ DÖNER GÖVDE</div>
            </button>

            <button
              className={`judge-btn btn-red ${activeFlashes['red-turnHead'] ? 'flash' : ''}`}
              onClick={() => handleScoreClick('red', 'turnHead', 5, 'Döner Baş')}
            >
              <div className="btn-points">+5</div>
              <div className="btn-desc">⚡ DÖNER BAŞ</div>
            </button>
          </div>
        </section>
      </main>

      <footer className="judge-footer">
        <span>Oda: {roomId}</span>
        <span>•</span>
        <span>WT Elektronik Hakem Padi</span>
      </footer>
    </div>
  );
}

