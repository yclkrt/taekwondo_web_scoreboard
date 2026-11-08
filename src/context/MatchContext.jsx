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
      blue: { ...DEFAULT_STATE.blue, ...(saved.blue || {}), history: saved.blue?.history || [] },
      red: { ...DEFAULT_STATE.red, ...(saved.red || {}), history: saved.red?.history || [] },
      timer: { ...DEFAULT_STATE.timer, ...(saved.timer || {}), isRunning: false },
      round: { ...DEFAULT_STATE.round, ...(saved.round || {}) },
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

  // Timer interval engine
  useEffect(() => {
    if (!matchState.timer.isRunning) return;

    const interval = setInterval(() => {
      setMatchState((prev) => {
        if (!prev.timer.isRunning) return prev;

        const nextSeconds = prev.timer.seconds - 1;

        // 10 second countdown sound
        if (nextSeconds <= 10 && nextSeconds > 0 && !prev.timer.isRest) {
          soundManager.playTick();
        }

        // Time up
        if (nextSeconds <= 0) {
          soundManager.playBuzzer();

          // If rest period ended, start next round
          if (prev.timer.isRest) {
            return {
              ...prev,
              timer: {
                ...prev.timer,
                seconds: prev.timer.initialSeconds,
                isRunning: false,
                isRest: false,
              },
            };
          }

          // Round time ended
          return {
            ...prev,
            timer: {
              ...prev.timer,
              seconds: 0,
              isRunning: false,
            },
          };
        }

        return {
          ...prev,
          timer: {
            ...prev.timer,
            seconds: nextSeconds,
          },
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [matchState.timer.isRunning]);

  // Timer controls
  const startTimer = useCallback(() => {
    soundManager.playStart();
    setMatchState((prev) => ({
      ...prev,
      timer: { ...prev.timer, isRunning: true },
    }));
  }, []);

  const pauseTimer = useCallback(() => {
    soundManager.playPause();
    setMatchState((prev) => ({
      ...prev,
      timer: { ...prev.timer, isRunning: false },
    }));
  }, []);

  const toggleTimer = useCallback(() => {
    setMatchState((prev) => {
      const nextRunning = !prev.timer.isRunning;
      if (nextRunning) {
        soundManager.playStart();
      } else {
        soundManager.playPause();
      }
      return {
        ...prev,
        timer: { ...prev.timer, isRunning: nextRunning },
      };
    });
  }, []);

  const resetTimer = useCallback(() => {
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
    setMatchState((prev) => ({
      ...prev,
      timer: { ...prev.timer, seconds: Math.max(0, sec) },
    }));
  }, []);

  // Medical / Kyeshi timeout (1 minute)
  const toggleKyeshi = useCallback((fighter = 'blue') => {
    setMatchState((prev) => {
      const isAlready = prev.timer.isKyeshi && prev.timer.kyeshiFighter === fighter;
      if (isAlready) {
        return {
          ...prev,
          timer: {
            ...prev.timer,
            isKyeshi: false,
            kyeshiFighter: null,
          },
        };
      }
      return {
        ...prev,
        timer: {
          ...prev.timer,
          seconds: 60, // 1 min injury time
          isRunning: true,
          isKyeshi: true,
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

  // Next round / End round
  const nextRound = useCallback(() => {
    soundManager.playBuzzer();
    setMatchState((prev) => {
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
          isRunning: false,
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
    setMatchState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings },
      timer: {
        ...prev.timer,
        initialSeconds: newSettings.initialSeconds !== undefined ? newSettings.initialSeconds : prev.timer.initialSeconds,
        restSeconds: newSettings.restSeconds !== undefined ? newSettings.restSeconds : prev.timer.restSeconds,
        // Mevcut kalan süreyi de yeni başlangıç süresine eşitle (anında yansısın)
        seconds: newSettings.initialSeconds !== undefined ? newSettings.initialSeconds : prev.timer.seconds,
      },
    }));
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

