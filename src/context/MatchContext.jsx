import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { soundManager } from '../utils/sound';

const MatchContext = createContext(null);

const DEFAULT_STATE = {
  matchInfo: {
    title: 'Taekwondo Şampiyonası Finali',
    court: 'Kort 1',
    matchNumber: 'M-101',
    weightCategory: '-68 KG',
    gender: 'Erkek',
    division: 'Büyükler',
  },
  blue: {
    name: 'M. ÇELİK',
    club: 'TUR',
    flag: '🇹🇷',
    score: 0,
    roundWins: 0,
    gamjeom: 0,
    videoQuota: 1,
    videoRequested: false,
    history: [],
  },
  red: {
    name: 'K. YILMAZ',
    club: 'KOR',
    flag: '🇰🇷',
    score: 0,
    roundWins: 0,
    gamjeom: 0,
    videoQuota: 1,
    videoRequested: false,
    history: [],
  },
  timer: {
    seconds: 120, // 2:00
    initialSeconds: 120,
    restSeconds: 60,
    isRunning: false,
    isRest: false,
    isKyeshi: false,
    kyeshiBlue: false,
    kyeshiRed: false,
    kyeshiSecondsBlue: 60,
    kyeshiSecondsRed: 60,
    kyeshiDuration: 60,
    kyeshiFighter: null,
  },
  round: {
    current: 1,
    maxRounds: 3,
    isGoldenRound: false,
    winner: null,
    roundWinner: null,
  },
  settings: {
    systemMode: 'best_of_3', // 'best_of_3' (modern WT) or 'cumulative'
    consensusRequired: 2, // 1 (direct) or 2 (out of 3 judges)
    consensusWindowMs: 1200, // 1.2 sec window for corner judges
    soundEnabled: true,
    vibrationEnabled: true,
    pointValues: {
      punch: 1,
      body: 2,
      head: 3,
      turnBody: 4,
      turnHead: 5,
    },
  },
  logs: [],
};

// Validate and merge saved state with DEFAULT_STATE to handle schema changes
function mergeWithDefaults(saved) {
  if (!saved || typeof saved !== 'object') return DEFAULT_STATE;
  try {
    return {
      matchInfo: { ...DEFAULT_STATE.matchInfo, ...(saved.matchInfo || {}) },
      blue: {
        ...DEFAULT_STATE.blue,
        ...(saved.blue || {}),
        score: 0,
        gamjeom: 0,
        roundWins: 0,
        videoQuota: DEFAULT_STATE.blue.videoQuota,
        videoRequested: false,
        history: saved.blue?.history || [],
      },
      red: {
        ...DEFAULT_STATE.red,
        ...(saved.red || {}),
        score: 0,
        gamjeom: 0,
        roundWins: 0,
        videoQuota: DEFAULT_STATE.red.videoQuota,
        videoRequested: false,
        history: saved.red?.history || [],
      },
      timer: { ...DEFAULT_STATE.timer, ...(saved.timer || {}), isRunning: false },
      round: { ...DEFAULT_STATE.round, current: 1, roundWinner: null, winner: null },
      settings: { ...DEFAULT_STATE.settings, ...(saved.settings || {}) },
      logs: saved.logs || [],
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function MatchProvider({ children, realtime }) {
  const [matchState, setMatchState] = useState(() => {
    try {
      const saved = localStorage.getItem('tkd_match_state');
      if (!saved) return DEFAULT_STATE;
      const parsed = JSON.parse(saved);
      return mergeWithDefaults(parsed);
    } catch {
      return DEFAULT_STATE;
    }
  });

  // Recent judge clicks for visual indicator & consensus matching
  const [judgeIndicators, setJudgeIndicators] = useState([]);
  const consensusBufferRef = useRef([]);

  // Hassas (alt-saniyelik) sayaç referansları – görüntüde akıcı süre akışı için
  const timerStartRef = useRef(null);
  const secondsAtStartRef = useRef(0);
  const kyeshiStartRef = useRef(null);
  const kyeshiBlueAtStartRef = useRef(60);
  const kyeshiRedAtStartRef = useRef(60);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('tkd_match_state', JSON.stringify(matchState));
    } catch {
      // Ignore storage errors
    }
  }, [matchState]);

  // Sync sound settings with soundManager
  useEffect(() => {
    soundManager.setEnabled(matchState.settings.soundEnabled);
  }, [matchState.settings.soundEnabled]);

  // Next round / End round
  const nextRound = useCallback(() => {
    soundManager.playBuzzer();
    timerStartRef.current = Date.now();
    setMatchState((prev) => {
      secondsAtStartRef.current = prev.timer.initialSeconds;
      const isBestOf3 = prev.settings.systemMode === 'best_of_3';
      let roundWinner = null;

      if (prev.blue.score > prev.red.score) {
        roundWinner = 'blue';
      } else if (prev.red.score > prev.blue.score) {
        roundWinner = 'red';
      } else {
        // Tie breaker: less gam-jeom wins
        if (prev.blue.gamjeom < prev.red.gamjeom) roundWinner = 'blue';
        else if (prev.red.gamjeom < prev.blue.gamjeom) roundWinner = 'red';
      }

      const blueRoundWins = roundWinner === 'blue' ? prev.blue.roundWins + 1 : prev.blue.roundWins;
      const redRoundWins = roundWinner === 'red' ? prev.red.roundWins + 1 : prev.red.roundWins;

      const roundHistoryEntry = {
        round: prev.round.current,
        blueScore: prev.blue.score,
        redScore: prev.red.score,
        blueGamjeom: prev.blue.gamjeom,
        redGamjeom: prev.red.gamjeom,
        winner: roundWinner,
      };

      // Check overall match winner in Best of 3
      let matchWinner = null;
      if (isBestOf3) {
        if (blueRoundWins >= 2) matchWinner = 'blue';
        else if (redRoundWins >= 2) matchWinner = 'red';
      }

      const nextRoundNum = prev.round.current + 1;

      return {
        ...prev,
        blue: {
          ...prev.blue,
          score: isBestOf3 ? 0 : prev.blue.score, // in Best of 3 score resets each round
          gamjeom: isBestOf3 ? 0 : prev.blue.gamjeom,
          roundWins: blueRoundWins,
          history: [...prev.blue.history, roundHistoryEntry],
        },
        red: {
          ...prev.red,
          score: isBestOf3 ? 0 : prev.red.score,
          gamjeom: isBestOf3 ? 0 : prev.red.gamjeom,
          roundWins: redRoundWins,
          history: [...prev.red.history, roundHistoryEntry],
        },
        timer: {
          ...prev.timer,
          seconds: prev.timer.initialSeconds,
          isRunning: false, // hakem manuel başlatmalı
          isRest: false,
        },
        round: {
          ...prev.round,
          current: nextRoundNum,
          roundWinner: null,
          winner: matchWinner,
        },
      };
    });
  }, []);

  // Timer interval engine
  useEffect(() => {
    if (!matchState.timer.isRunning) return;

    const interval = setInterval(() => {
      setMatchState((prev) => {
        if (!prev.timer.isRunning) return prev;

        const { timer } = prev;

        // --- KYESHI SAYACLARI (Medical timeout) ---
        // Herhangi bir köşe kyeshi'de ise normal maç süresi durur, sadece kyeshi süresi akar
        if (timer.isKyeshi && (timer.kyeshiBlue || timer.kyeshiRed)) {
          let next = { ...timer };

          if (timer.kyeshiBlue && timer.kyeshiSecondsBlue > 0) {
            next.kyeshiSecondsBlue = timer.kyeshiSecondsBlue - 1;
            if (next.kyeshiSecondsBlue === 0) {
              next.kyeshiBlue = false;
              next.kyeshiSecondsBlue = next.kyeshiDuration;
            }
          }
          if (timer.kyeshiRed && timer.kyeshiSecondsRed > 0) {
            next.kyeshiSecondsRed = timer.kyeshiSecondsRed - 1;
            if (next.kyeshiSecondsRed === 0) {
              next.kyeshiRed = false;
              next.kyeshiSecondsRed = next.kyeshiDuration;
            }
          }

          // İki kyeshi de bittiyse kyeshi modunu kapat
          if (!next.kyeshiBlue && !next.kyeshiRed) {
            next.isKyeshi = false;
            next.kyeshiFighter = null;
          }

          return { ...prev, timer: next };
        }

        // --- NORMAL MAÇ SÜRESİ ---
        const nextSeconds = timer.seconds - 1;

        // 10 second countdown sound
        if (nextSeconds <= 10 && nextSeconds > 0 && !timer.isRest) {
          soundManager.playTick();
        }

        // Time up
        if (nextSeconds <= 0) {
          soundManager.playBuzzer();

          // Determine round winner (round-wins tracking)
          let roundWinner = null;
          if (prev.blue.score > prev.red.score) {
            roundWinner = 'blue';
          } else if (prev.red.score > prev.blue.score) {
            roundWinner = 'red';
          } else {
            // Tie breaker: less gam-jeom wins
            if (prev.blue.gamjeom < prev.red.gamjeom) roundWinner = 'blue';
            else if (prev.red.gamjeom < prev.blue.gamjeom) roundWinner = 'red';
          }

          const blueRoundWins = roundWinner === 'blue' ? prev.blue.roundWins + 1 : prev.blue.roundWins;
          const redRoundWins = roundWinner === 'red' ? prev.red.roundWins + 1 : prev.red.roundWins;

          // If rest period ended -> prepare next round but WAIT for referee to start manually
          // roundWins zaten round biterken artırılmıştı, burada tekrar artırmamalıyız
          if (timer.isRest) {
            const isBestOf3 = prev.settings.systemMode === 'best_of_3';
            let matchWinner = null;
            if (isBestOf3) {
              if (prev.blue.roundWins >= 2) matchWinner = 'blue';
              else if (prev.red.roundWins >= 2) matchWinner = 'red';
            }

            // Reset scores for next round (Best of 3)
            const nextBlueScore = isBestOf3 ? 0 : prev.blue.score;
            const nextRedScore = isBestOf3 ? 0 : prev.red.score;
            const nextBlueGamjeom = isBestOf3 ? 0 : prev.blue.gamjeom;
            const nextRedGamjeom = isBestOf3 ? 0 : prev.red.gamjeom;

            return {
              ...prev,
              blue: {
                ...prev.blue,
                score: nextBlueScore,
                gamjeom: nextBlueGamjeom,
                roundWins: prev.blue.roundWins, // tekrar artırmama
              },
              red: {
                ...prev.red,
                score: nextRedScore,
                gamjeom: nextRedGamjeom,
                roundWins: prev.red.roundWins, // tekrar artırmama
              },
              timer: {
                ...timer,
                seconds: timer.initialSeconds,
                isRunning: false, // beklemede - hakem başlatmalı
                isRest: false,
              },
              round: {
                ...prev.round,
                current: prev.round.current + 1,
                roundWinner: null,
                winner: matchWinner,
              },
            };
          }

          // Round time ended -> increment winner's round count and check if match is over
          timerStartRef.current = Date.now();
          secondsAtStartRef.current = timer.restSeconds;

          const isBestOf3 = prev.settings.systemMode === 'best_of_3';
          let matchWinner = null;

          // Best of 3: bir taraf 2 round kazanırsa maç biter, mola verilmez
          if (isBestOf3) {
            if (blueRoundWins >= 2) matchWinner = 'blue';
            else if (redRoundWins >= 2) matchWinner = 'red';
          }

          return {
            ...prev,
            blue: {
              ...prev.blue,
              roundWins: blueRoundWins,
            },
            red: {
              ...prev.red,
              roundWins: redRoundWins,
            },
            timer: {
              ...timer,
              seconds: matchWinner ? 0 : timer.restSeconds, // maç biterse süre 0, devam ediyorsa mola
              isRunning: matchWinner ? false : true, // maç biterse timer durur
              isRest: matchWinner ? false : true, // maç biterse mola yok
            },
            round: {
              ...prev.round,
              roundWinner: roundWinner,
              winner: matchWinner,
            },
          };
        }

        return {
          ...prev,
          timer: {
            ...timer,
            seconds: nextSeconds,
          },
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [matchState.timer.isRunning]);

  // Gerçek kalan süreyi milisaniye hassasiyetinde dondurur.
  // Durdurulmus ikunde son degeri dondurur (gorunen deger donar).
  const getRemainingSeconds = useCallback(() => {
    const t = matchState.timer;

    // --- KYESHI SAYACI ---
    if (t.isKyeshi && (t.kyeshiBlue || t.kyeshiRed)) {
      if (t.kyeshiBlue) {
        if (!t.isRunning) return t.kyeshiSecondsBlue;
        const elapsed = (Date.now() - kyeshiStartRef.current) / 1000;
        return Math.max(0, kyeshiBlueAtStartRef.current - elapsed);
      }
      if (t.kyeshiRed) {
        if (!t.isRunning) return t.kyeshiSecondsRed;
        const elapsed = (Date.now() - kyeshiStartRef.current) / 1000;
        return Math.max(0, kyeshiRedAtStartRef.current - elapsed);
      }
    }

    // --- NORMAL / MOLA SÜRESİ ---
    if (!t.isRunning) return t.seconds;
    const elapsed = (Date.now() - timerStartRef.current) / 1000;
    return Math.max(0, secondsAtStartRef.current - elapsed);
  }, [matchState.timer]);

  // Timer controls
  const startTimer = useCallback(() => {
    soundManager.playStart();
    setMatchState((prev) => {
      const t = prev.timer;
      const now = Date.now();
      timerStartRef.current = now;
      secondsAtStartRef.current = t.seconds;
      kyeshiStartRef.current = now;
      kyeshiBlueAtStartRef.current = t.kyeshiSecondsBlue;
      kyeshiRedAtStartRef.current = t.kyeshiSecondsRed;
      return { ...prev, timer: { ...t, isRunning: true } };
    });
  }, []);

  const pauseTimer = useCallback(() => {
    soundManager.playPause();
    setMatchState((prev) => {
      const t = prev.timer;
      const now = Date.now();
      let nextTimer = { ...t, isRunning: false };
      if (t.isRunning) {
        // Durdurulurken kesikli saniye degeri yerine kesirli kalan suresi kaydet
        const elapsed = (now - timerStartRef.current) / 1000;
        const remaining = Math.max(0, secondsAtStartRef.current - elapsed);
        secondsAtStartRef.current = remaining;
        timerStartRef.current = now;
        nextTimer.seconds = remaining;
        if (t.isKyeshi) {
          const ke = (now - kyeshiStartRef.current) / 1000;
          kyeshiStartRef.current = now;
          if (t.kyeshiBlue) {
            const kRem = Math.max(0, kyeshiBlueAtStartRef.current - ke);
            kyeshiBlueAtStartRef.current = kRem;
            nextTimer.kyeshiSecondsBlue = kRem;
          }
          if (t.kyeshiRed) {
            const kRem = Math.max(0, kyeshiRedAtStartRef.current - ke);
            kyeshiRedAtStartRef.current = kRem;
            nextTimer.kyeshiSecondsRed = kRem;
          }
        }
      }
      return { ...prev, timer: nextTimer };
    });
  }, []);

  const toggleTimer = useCallback(() => {
    if (matchState.timer.isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  }, [matchState.timer.isRunning, pauseTimer, startTimer]);

  const resetTimer = useCallback(() => {
    timerStartRef.current = null;
    secondsAtStartRef.current = 0;
    kyeshiStartRef.current = null;
    kyeshiBlueAtStartRef.current = 60;
    kyeshiRedAtStartRef.current = 60;
    setMatchState((prev) => ({
      ...prev,
      timer: {
        ...prev.timer,
        seconds: prev.timer.initialSeconds,
        isRunning: false,
        isRest: false,
        isKyeshi: false,
      },
    }));
  }, []);

  const setTimerSeconds = useCallback((sec) => {
    setMatchState((prev) => {
      const t = prev.timer;
      const now = Date.now();
      if (t.isRunning) {
        timerStartRef.current = now;
        secondsAtStartRef.current = Math.max(0, sec);
        if (t.isKyeshi) {
          kyeshiStartRef.current = now;
          kyeshiBlueAtStartRef.current = t.kyeshiSecondsBlue;
          kyeshiRedAtStartRef.current = t.kyeshiSecondsRed;
        }
      }
      return {
        ...prev,
        timer: { ...t, seconds: Math.max(0, sec) },
      };
    });
  }, []);

  // Medical / Kyeshi timeout (her köşe için bağımsız)
  const toggleKyeshi = useCallback((fighter = 'blue') => {
    setMatchState((prev) => {
      const isBlue = fighter === 'blue';
      const isAlreadyActive = isBlue ? prev.timer.kyeshiBlue : prev.timer.kyeshiRed;

      // Aynı köşe için zaten kyeshi aktifse → kapat
      if (isAlreadyActive) {
        return {
          ...prev,
          timer: {
            ...prev.timer,
            [isBlue ? 'kyeshiBlue' : 'kyeshiRed']: false,
            [isBlue ? 'kyeshiSecondsBlue' : 'kyeshiSecondsRed']: prev.timer.kyeshiDuration,
            isKyeshi: prev.timer.kyeshiBlue || prev.timer.kyeshiRed ? false : prev.timer.isKyeshi,
            kyeshiFighter: (!prev.timer.kyeshiBlue && !prev.timer.kyeshiRed) ? null : prev.timer.kyeshiFighter,
          },
        };
      }

      // Kyeshi aç: normal maç süresini durdur, kyeshi süresine geç
      return {
        ...prev,
        timer: {
          ...prev.timer,
          isKyeshi: true,
          [isBlue ? 'kyeshiBlue' : 'kyeshiRed']: true,
          [isBlue ? 'kyeshiSecondsBlue' : 'kyeshiSecondsRed']: prev.timer.kyeshiDuration,
          kyeshiFighter: fighter,
        },
      };
    });
  }, []);

  // Point scoring
  const addPoint = useCallback((fighter, points, label = 'Vuruş', judgeSlot = null) => {
    soundManager.playPoint(points);
    setMatchState((prev) => {
      const currentScore = prev[fighter].score;
      const newScore = Math.max(0, currentScore + points);

      const logEntry = {
        id: Date.now() + Math.random(),
        time: prev.timer.seconds,
        text: `${prev[fighter].name} (+${points} ${label})${judgeSlot ? ` - Hakem ${judgeSlot}` : ''}`,
        side: fighter,
      };

      return {
        ...prev,
        [fighter]: {
          ...prev[fighter],
          score: newScore,
        },
        logs: [logEntry, ...prev.logs.slice(0, 19)],
      };
    });
  }, []);

  const subtractPoint = useCallback((fighter, points = 1) => {
    setMatchState((prev) => ({
      ...prev,
      [fighter]: {
        ...prev[fighter],
        score: Math.max(0, prev[fighter].score - points),
      },
    }));
  }, []);

  // Gam-jeom (penalty): +1 point to opponent
  const addGamjeom = useCallback((fighter) => {
    soundManager.playGamjeom();
    const opponent = fighter === 'blue' ? 'red' : 'blue';

    setMatchState((prev) => {
      const nextGamjeom = prev[fighter].gamjeom + 1;
      const opponentNextScore = prev[opponent].score + 1;

      const logEntry = {
        id: Date.now() + Math.random(),
        time: prev.timer.seconds,
        text: `GAM-JEOM: ${prev[fighter].name} (Ceza -> ${prev[opponent].name} +1)`,
        side: fighter,
      };

      // In WT Best of 3, 5 Gam-jeom in a round results in round loss (PUN)
      let roundWinner = prev.round.roundWinner;
      if (prev.settings.systemMode === 'best_of_3' && nextGamjeom >= 5) {
        roundWinner = opponent;
        soundManager.playBuzzer();
      }

      return {
        ...prev,
        [fighter]: {
          ...prev[fighter],
          gamjeom: nextGamjeom,
        },
        [opponent]: {
          ...prev[opponent],
          score: opponentNextScore,
        },
        round: {
          ...prev.round,
          roundWinner: roundWinner || prev.round.roundWinner,
        },
        logs: [logEntry, ...prev.logs.slice(0, 19)],
      };
    });
  }, []);

  const subtractGamjeom = useCallback((fighter) => {
    const opponent = fighter === 'blue' ? 'red' : 'blue';
    setMatchState((prev) => ({
      ...prev,
      [fighter]: {
        ...prev[fighter],
        gamjeom: Math.max(0, prev[fighter].gamjeom - 1),
      },
      [opponent]: {
        ...prev[opponent],
        score: Math.max(0, prev[opponent].score - 1),
      },
    }));
  }, []);

  // Video Replay Challenge card
  const toggleVideoQuota = useCallback((fighter) => {
    setMatchState((prev) => {
      const currentQuota = prev[fighter].videoQuota;
      return {
        ...prev,
        [fighter]: {
          ...prev[fighter],
          videoQuota: currentQuota > 0 ? 0 : 1,
          videoRequested: currentQuota > 0,
        },
      };
    });
  }, []);

  // Previous round
  const prevRound = useCallback(() => {
    setMatchState((prev) => ({
      ...prev,
      round: {
        ...prev.round,
        current: Math.max(1, prev.round.current - 1),
      },
    }));
  }, []);

  // Reset entire match to default state and clear localStorage
  const resetMatch = useCallback(() => {
    // Clear persisted state so a page reload starts fresh
    try {
      localStorage.removeItem('tkd_match_state');
    } catch {
      // Ignore storage errors
    }
    setMatchState(DEFAULT_STATE);
  }, []);

  // Update match information (names, category, court)
  const updateMatchInfo = useCallback((newInfo) => {
    setMatchState((prev) => ({
      ...prev,
      matchInfo: { ...prev.matchInfo, ...newInfo },
    }));
  }, []);

  // Update fighters information
  const updateFighters = useCallback((blueData, redData) => {
    setMatchState((prev) => ({
      ...prev,
      blue: { ...prev.blue, ...blueData },
      red: { ...prev.red, ...redData },
    }));
  }, []);

  // Update rules / settings
  const updateSettings = useCallback((newSettings) => {
    setMatchState((prev) => {
      const t = prev.timer;
      const now = Date.now();
      const nextSeconds =
        newSettings.initialSeconds !== undefined ? newSettings.initialSeconds : prev.timer.seconds;
      if (t.isRunning && newSettings.initialSeconds !== undefined) {
        timerStartRef.current = now;
        secondsAtStartRef.current = nextSeconds;
      }
      return {
        ...prev,
        settings: { ...prev.settings, ...newSettings },
        timer: {
          ...t,
          initialSeconds: newSettings.initialSeconds !== undefined ? newSettings.initialSeconds : t.initialSeconds,
          restSeconds: newSettings.restSeconds !== undefined ? newSettings.restSeconds : t.restSeconds,
          kyeshiDuration: newSettings.kyeshiDuration !== undefined ? newSettings.kyeshiDuration : t.kyeshiDuration,
          // Mevcut kalan süreyi de yeni başlangıç süresine eşitle (anında yansısın)
          seconds: nextSeconds,
        },
      };
    });
  }, []);

  // Process incoming judge action (Consensus matching)
  const handleJudgeAction = useCallback(
    (actionData) => {
      const { slot, target, pointType, points, judgeName } = actionData;
      const now = Date.now();

      // Add visual flash indicator for judge indicator UI
      const indicatorId = `${slot}-${target}-${now}`;
      setJudgeIndicators((prev) => [
        ...prev.filter((item) => now - item.timestamp < 1500),
        { id: indicatorId, slot, target, pointType, points, judgeName, timestamp: now },
      ]);

      // If direct mode (consensusRequired === 1)
      if (matchState.settings.consensusRequired <= 1) {
        addPoint(target, points, pointType, slot);
        return;
      }

      // Consensus matching (e.g. 2 of 3 judges)
      const windowMs = matchState.settings.consensusWindowMs || 1200;
      // Clean buffer
      consensusBufferRef.current = consensusBufferRef.current.filter((item) => now - item.timestamp <= windowMs);

      // Check if another judge has clicked the exact same target and pointType within window
      const matchingIndex = consensusBufferRef.current.findIndex(
        (item) => item.slot !== slot && item.target === target && item.pointType === pointType
      );

      if (matchingIndex !== -1) {
        // Found consensus! Remove matching entry from buffer and award point!
        consensusBufferRef.current.splice(matchingIndex, 1);
        addPoint(target, points, `${pointType} (Hakem Uzlaşısı)`, slot);
      } else {
        // Store in buffer waiting for next judge click
        consensusBufferRef.current.push({
          slot,
          target,
          pointType,
          points,
          timestamp: now,
        });
      }
    },
    [matchState.settings.consensusRequired, matchState.settings.consensusWindowMs, addPoint]
  );

  // Apply remote command sent from operator/judge mobile
  const applyRemoteCommand = useCallback(
    (cmd) => {
      switch (cmd.action) {
        case 'timer_start':
          startTimer();
          break;
        case 'timer_pause':
          pauseTimer();
          break;
        case 'timer_toggle':
          toggleTimer();
          break;
        case 'timer_reset':
          resetTimer();
          break;
        case 'buzzer':
          soundManager.playBuzzer();
          break;
        case 'point_add':
          addPoint(cmd.target, cmd.points, cmd.label || 'Vuruş');
          break;
        case 'point_sub':
          subtractPoint(cmd.target, cmd.points);
          break;
        case 'gamjeom_add':
          addGamjeom(cmd.target);
          break;
        case 'gamjeom_sub':
          subtractGamjeom(cmd.target);
          break;
        case 'video_quota':
          toggleVideoQuota(cmd.target);
          break;
        case 'next_round':
          nextRound();
          break;
        case 'prev_round':
          prevRound();
          break;
        case 'reset_match':
          resetMatch();
          break;
        case 'kyeshi':
          toggleKyeshi(cmd.target);
          break;
        default:
          break;
      }
    },
    [
      startTimer,
      pauseTimer,
      toggleTimer,
      resetTimer,
      addPoint,
      subtractPoint,
      addGamjeom,
      subtractGamjeom,
      toggleVideoQuota,
      nextRound,
      prevRound,
      resetMatch,
      toggleKyeshi,
    ]
  );

  return (
    <MatchContext.Provider
      value={{
        matchState,
        setMatchState,
        judgeIndicators,
        startTimer,
        pauseTimer,
        toggleTimer,
        resetTimer,
        setTimerSeconds,
        getRemainingSeconds,
        toggleKyeshi,
        addPoint,
        subtractPoint,
        addGamjeom,
        subtractGamjeom,
        toggleVideoQuota,
        nextRound,
        prevRound,
        resetMatch,
        updateMatchInfo,
        updateFighters,
        updateSettings,
        handleJudgeAction,
        applyRemoteCommand,
      }}
    >
      {children}
    </MatchContext.Provider>
  );
}

export function useMatch() {
  const ctx = useContext(MatchContext);
  if (!ctx) {
    throw new Error('useMatch must be used within MatchProvider');
  }
  return ctx;
}

