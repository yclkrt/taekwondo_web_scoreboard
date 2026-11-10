import { useState, useEffect } from 'react';
import { MatchProvider, useMatch } from './context/MatchContext';
import { useRealtime } from './hooks/useRealtime';
import Scoreboard from './components/Scoreboard';
import ResultScreen from './components/ResultScreen';
import MobileController from './components/MobileController';
import MobileJudge from './components/MobileJudge';
import './App.css';

// Inner component connected to MatchContext
function AppContent({ role, slot, roomId, realtime }) {
  const { matchState, setMatchState, handleJudgeAction, applyRemoteCommand } = useMatch();

  // Scoreboard registers listeners for incoming judge actions and remote commands
  useEffect(() => {
    if (role === 'scoreboard') {
      realtime.onJudgeAction((data) => {
        handleJudgeAction(data);
      });

      realtime.onRemoteCommand((cmd) => {
        applyRemoteCommand(cmd);
      });
    } else {
      // Remote devices (Operator or Judge) listen for state updates from scoreboard
      realtime.onStateUpdate((updatedState) => {
        setMatchState(updatedState);
      });
    }
  }, [role, realtime, handleJudgeAction, applyRemoteCommand, setMatchState]);

  // Route according to role
  if (role === 'judge') {
    return (
      <MobileJudge
        roomId={roomId}
        slot={slot}
        realtime={realtime}
        matchState={matchState}
      />
    );
  }

  if (role === 'operator') {
    return (
      <MobileController
        roomId={roomId}
        realtime={realtime}
        matchState={matchState}
      />
    );
  }

  // Result / winner screen (blue or red toned background)
  if (role === 'result') {
    return <ResultScreen />;
  }

  // Default: Arena Scoreboard
  return <Scoreboard roomId={roomId} realtime={realtime} />;
}

export default function App() {
  // Parse URL query parameters
  const [params, setParams] = useState(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const sp = new URLSearchParams(search);
    return {
      role: sp.get('role') || 'scoreboard',
      slot: sp.get('slot') ? Number(sp.get('slot')) : 1,
      room: sp.get('room') || 'TKD-1',
    };
  });

  // Listen to popstate / url changes
  useEffect(() => {
    const handlePopState = () => {
      const sp = new URLSearchParams(window.location.search);
      setParams({
        role: sp.get('role') || 'scoreboard',
        slot: sp.get('slot') ? Number(sp.get('slot')) : 1,
        room: sp.get('room') || 'TKD-1',
      });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Initialize unified realtime hook
  const realtime = useRealtime({
    roomId: params.room,
    role: params.role,
    slot: params.slot,
  });

  return (
    <MatchProvider realtime={realtime}>
      <AppContent
        role={params.role}
        slot={params.slot}
        roomId={params.room}
        realtime={realtime}
      />
    </MatchProvider>
  );
}
