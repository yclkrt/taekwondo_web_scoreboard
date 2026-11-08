import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  ChevronRight,
  ChevronLeft,
  Maximize,
  Wifi,
  Activity,
  AlertTriangle,
  Video,
} from 'lucide-react';

export default function MobileController({
  roomId = 'TKD-1',
  realtime,
  matchState,
}) {
  // Prevent phone screen lock/sleep
  useEffect(() => {
    let wakeLock = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch {
        // Ignore
      }
    };
    requestWakeLock();

    return () => {
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);

  const triggerHaptic = (ms = 40) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  };

  const sendCommand = (action, payload = {}) => {
    triggerHaptic(40);
    realtime.sendRemoteCommand({
      action,
      ...payload,
    });
  };

  // Saniyeyi MM:SS veya (1 dakikanin altinda) SS.cc olarak bicimler.
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const isTimerRunning = matchState?.timer?.isRunning || false;
  const currentRound = matchState?.round?.current || 1;
  const isKyeshi = matchState?.timer?.isKyeshi || false;

  // Akici timer gorunumu: requestAnimationFrame ile centisaniyelik seri akis.
  // Sunucudan saniyelik state_sync alindiginda ara degerleri yerel olarak interpolasyon yapar.
  const [displaySeconds, setDisplaySeconds] = useState(matchState?.timer?.seconds ?? 120);
  const lastRenderedTimerText = useRef('');
  const stateReceivedRef = useRef(null);
  const secondsAtStateRef = useRef(0);

  // State guncellendi referans noktasini sifirla
  useEffect(() => {
    const timer = matchState?.timer;
    if (timer) {
      stateReceivedRef.current = Date.now();
      secondsAtStateRef.current = timer.seconds;
    }
  }, [matchState]);

  // RAF dongusu – sadece gorunen metin degistiginde render yapar
  useEffect(() => {
    let rafId;
    const loop = () => {
      const timer = matchState?.timer;
      if (!timer) return;

      let remaining;
      if (!timer.isRunning) {
        remaining = timer.seconds;
      } else {
        const elapsed = (Date.now() - stateReceivedRef.current) / 1000;
        remaining = Math.max(0, secondsAtStateRef.current - elapsed);
      }

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
  }, [matchState, formatTimer]);

  return (
    <div className="mobile-controller-container">
      {/* Top Header */}
      <header className="controller-header">
        <div className="header-brand">
          <span className="badge-role">MASA KUMANDASI</span>
          <span className="court-label">{matchState?.matchInfo?.court || 'Kort 1'}</span>
        </div>

        <div className="header-tools">
          <button className="icon-btn" onClick={toggleFullscreen} title="Tam Ekran">
            <Maximize size={18} />
          </button>
          <div className={`connection-badge ${realtime?.isConnected ? 'connected' : 'disconnected'}`}>
            <Wifi size={16} />
          </div>
        </div>
      </header>

      {/* Timer & Main Controls Bar */}
      <section className="controller-timer-card">
        <div className="timer-info-row">
          <span className="round-badge">
            RAUND {currentRound} / {matchState?.round?.maxRounds || 3}
          </span>
          {isKyeshi && <span className="kyeshi-badge">DOKTOR (KYESHI)</span>}
        </div>

        <div className={`giant-timer-display ${isTimerRunning ? 'running' : 'paused'}`}>
          {formatTimer(displaySeconds, displaySeconds < 60)}
        </div>

        {/* Master Timer Buttons */}
        <div className="timer-actions-grid">
          <button
            className={`btn-master-timer ${isTimerRunning ? 'btn-pause' : 'btn-start'}`}
            onClick={() => sendCommand('timer_toggle')}
          >
            {isTimerRunning ? <Pause size={28} /> : <Play size={28} />}
            <span>{isTimerRunning ? 'DURDUR (KAL-YEO)' : 'BAŞLAT (SHI-JAK)'}</span>
          </button>

          <button
            className="btn-buzzer"
            onClick={() => {
              triggerHaptic(80);
              sendCommand('buzzer');
            }}
          >
            <Volume2 size={24} />
            <span>KORNA</span>
          </button>

          <button
            className="btn-timer-reset"
            onClick={() => sendCommand('timer_reset')}
          >
            <RotateCcw size={20} />
            <span>SIFIRLA</span>
          </button>
        </div>
      </section>

      {/* Fighters Dual Column Panel */}
      <main className="controller-fighters-grid">
        {/* BLUE / CHUNG CONTROLS */}
        <div className="controller-fighter-card blue-side">
          <div className="fighter-card-header">
            <h3>MAVİ (CHUNG)</h3>
            <span className="fighter-sub">{matchState?.blue?.name || 'M. ÇELİK'}</span>
            <div className="giant-score blue">{matchState?.blue?.score ?? 0}</div>
            <div className="round-wins-pills">
              <span>Raund Galibiyeti: <strong>{matchState?.blue?.roundWins ?? 0}</strong></span>
            </div>
          </div>

          {/* Point Buttons */}
          <div className="point-buttons-group">
            <button className="btn-pt blue" onClick={() => sendCommand('point_add', { target: 'blue', points: 1, label: 'Yumruk' })}>
              +1 Yumruk
            </button>
            <button className="btn-pt blue" onClick={() => sendCommand('point_add', { target: 'blue', points: 2, label: 'Gövde' })}>
              +2 Gövde
            </button>
            <button className="btn-pt blue" onClick={() => sendCommand('point_add', { target: 'blue', points: 3, label: 'Baş' })}>
              +3 Baş
            </button>
            <button className="btn-pt blue" onClick={() => sendCommand('point_add', { target: 'blue', points: 4, label: 'Döner Gövde' })}>
              +4 Döner G.
            </button>
            <button className="btn-pt blue" onClick={() => sendCommand('point_add', { target: 'blue', points: 5, label: 'Döner Baş' })}>
              +5 Döner B.
            </button>
            <button className="btn-pt-sub" onClick={() => sendCommand('point_sub', { target: 'blue', points: 1 })}>
              -1 Düzelt
            </button>
          </div>

          {/* Gamjeom & Video Replay */}
          <div className="penalties-group">
            <div className="gamjeom-counter">
              <span>Gam-jeom: <strong>{matchState?.blue?.gamjeom ?? 0}</strong>/5</span>
            </div>
            <div className="gamjeom-buttons">
              <button className="btn-gamjeom-add" onClick={() => sendCommand('gamjeom_add', { target: 'blue' })}>
                <AlertTriangle size={16} />
                + CEZA (GAM-JEOM)
              </button>
              <button className="btn-gamjeom-sub" onClick={() => sendCommand('gamjeom_sub', { target: 'blue' })}>
                - Ceza İptal
              </button>
            </div>
            <button className="btn-video-card" onClick={() => sendCommand('video_quota', { target: 'blue' })}>
              <Video size={16} />
              VR Kartı ({matchState?.blue?.videoQuota > 0 ? 'Mevcut' : 'Kullanıldı'})
            </button>
          </div>
        </div>

        {/* RED / HONG CONTROLS */}
        <div className="controller-fighter-card red-side">
          <div className="fighter-card-header">
            <h3>KIRMIZI (HONG)</h3>
            <span className="fighter-sub">{matchState?.red?.name || 'K. YILMAZ'}</span>
            <div className="giant-score red">{matchState?.red?.score ?? 0}</div>
            <div className="round-wins-pills">
              <span>Raund Galibiyeti: <strong>{matchState?.red?.roundWins ?? 0}</strong></span>
            </div>
          </div>

          {/* Point Buttons */}
          <div className="point-buttons-group">
            <button className="btn-pt red" onClick={() => sendCommand('point_add', { target: 'red', points: 1, label: 'Yumruk' })}>
              +1 Yumruk
            </button>
            <button className="btn-pt red" onClick={() => sendCommand('point_add', { target: 'red', points: 2, label: 'Gövde' })}>
              +2 Gövde
            </button>
            <button className="btn-pt red" onClick={() => sendCommand('point_add', { target: 'red', points: 3, label: 'Baş' })}>
              +3 Baş
            </button>
            <button className="btn-pt red" onClick={() => sendCommand('point_add', { target: 'red', points: 4, label: 'Döner Gövde' })}>
              +4 Döner G.
            </button>
            <button className="btn-pt red" onClick={() => sendCommand('point_add', { target: 'red', points: 5, label: 'Döner Baş' })}>
              +5 Döner B.
            </button>
            <button className="btn-pt-sub" onClick={() => sendCommand('point_sub', { target: 'red', points: 1 })}>
              -1 Düzelt
            </button>
          </div>

          {/* Gamjeom & Video Replay */}
          <div className="penalties-group">
            <div className="gamjeom-counter">
              <span>Gam-jeom: <strong>{matchState?.red?.gamjeom ?? 0}</strong>/5</span>
            </div>
            <div className="gamjeom-buttons">
              <button className="btn-gamjeom-add" onClick={() => sendCommand('gamjeom_add', { target: 'red' })}>
                <AlertTriangle size={16} />
                + CEZA (GAM-JEOM)
              </button>
              <button className="btn-gamjeom-sub" onClick={() => sendCommand('gamjeom_sub', { target: 'red' })}>
                - Ceza İptal
              </button>
            </div>
            <button className="btn-video-card" onClick={() => sendCommand('video_quota', { target: 'red' })}>
              <Video size={16} />
              VR Kartı ({matchState?.red?.videoQuota > 0 ? 'Mevcut' : 'Kullanıldı'})
            </button>
          </div>
        </div>
      </main>

      {/* Bottom Global Match Flow Controls */}
      <footer className="controller-bottom-bar">
        <button className="btn-nav" onClick={() => sendCommand('prev_round')}>
          <ChevronLeft size={18} /> Önceki Raund
        </button>

        <button className="btn-nav btn-kyeshi" onClick={() => sendCommand('kyeshi', { target: 'blue' })}>
          <Activity size={18} /> Doktor (Kyeshi Mavi)
        </button>

        <button className="btn-nav btn-kyeshi" onClick={() => sendCommand('kyeshi', { target: 'red' })}>
          <Activity size={18} /> Doktor (Kyeshi Kırmızı)
        </button>

        <button className="btn-nav btn-next-round" onClick={() => sendCommand('next_round')}>
          Sonraki Raund <ChevronRight size={18} />
        </button>

        <button
          className="btn-nav btn-danger"
          onClick={() => {
            if (window.confirm('Maçı sıfırlamak istediğinize emin misiniz?')) {
              sendCommand('reset_match');
            }
          }}
        >
          Maçı Sıfırla
        </button>
      </footer>
    </div>
  );
}

