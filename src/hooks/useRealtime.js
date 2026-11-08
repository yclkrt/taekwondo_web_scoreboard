import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

export function useRealtime({ roomId = 'TKD-1', role = 'scoreboard', slot = null, name = '' } = {}) {
  const socketRef = useRef(null);
  const broadcastRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeJudges, setActiveJudges] = useState([]);
  const [serverIp, setServerIp] = useState('');
  const [serverPort, setServerPort] = useState(5173);

  // Event callbacks registered by consumers
  const listenersRef = useRef({
    onStateUpdate: null,
    onJudgeAction: null,
    onRemoteCommand: null,
  });

  // Fetch local network info from API
  useEffect(() => {
    fetch('/api/network-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.localIp) {
          setServerIp(data.localIp);
          if (data.port) setServerPort(data.port);
        } else {
          setServerIp(window.location.hostname || '127.0.0.1');
          setServerPort(window.location.port || 5173);
        }
      })
      .catch(() => {
        setServerIp(window.location.hostname || '127.0.0.1');
        setServerPort(window.location.port || 5173);
      });
  }, []);

  // Initialize Socket.IO and BroadcastChannel
  useEffect(() => {
    // 1. Setup BroadcastChannel fallback (works across tabs in same browser)
    try {
      const channel = new BroadcastChannel(`tkd_channel_${roomId}`);
      broadcastRef.current = channel;

      channel.onmessage = (event) => {
        const { type, payload } = event.data || {};
        if (type === 'state_update' && listenersRef.current.onStateUpdate) {
          listenersRef.current.onStateUpdate(payload);
        } else if (type === 'judge_action' && listenersRef.current.onJudgeAction) {
          listenersRef.current.onJudgeAction(payload);
        } else if (type === 'remote_command' && listenersRef.current.onRemoteCommand) {
          listenersRef.current.onRemoteCommand(payload);
        }
      };
    } catch {
      // BroadcastChannel not supported in some older environments
    }

    // 2. Setup Socket.io connection
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_room', {
        roomId,
        role,
        slot,
        name,
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('state_update', (state) => {
      if (listenersRef.current.onStateUpdate) {
        listenersRef.current.onStateUpdate(state);
      }
    });

    socket.on('judge_action', (data) => {
      if (listenersRef.current.onJudgeAction) {
        listenersRef.current.onJudgeAction(data);
      }
    });

    socket.on('remote_command', (data) => {
      if (listenersRef.current.onRemoteCommand) {
        listenersRef.current.onRemoteCommand(data);
      }
    });

    socket.on('judges_update', (judges) => {
      setActiveJudges(judges || []);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (broadcastRef.current) {
        broadcastRef.current.close();
        broadcastRef.current = null;
      }
    };
  }, [roomId, role, slot, name]);

  // Methods to register listeners
  const onStateUpdate = useCallback((cb) => {
    listenersRef.current.onStateUpdate = cb;
  }, []);

  const onJudgeAction = useCallback((cb) => {
    listenersRef.current.onJudgeAction = cb;
  }, []);

  const onRemoteCommand = useCallback((cb) => {
    listenersRef.current.onRemoteCommand = cb;
  }, []);

  // Send state update (Scoreboard to remotes/judges)
  const syncState = useCallback(
    (state) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit('state_sync', { roomId, state });
      }
      if (broadcastRef.current) {
        try {
          broadcastRef.current.postMessage({ type: 'state_update', payload: state });
        } catch {
          // Channel may be closed; ignore broadcast errors
        }
      }
    },
    [roomId, isConnected]
  );

  // Send judge scoring action
  const sendJudgeAction = useCallback(
    (actionData) => {
      const payload = {
        roomId,
        slot,
        judgeName: name || `Hakem ${slot || ''}`,
        ...actionData,
      };

      if (socketRef.current && isConnected) {
        socketRef.current.emit('judge_action', payload);
      }
      if (broadcastRef.current) {
        try {
          broadcastRef.current.postMessage({ type: 'judge_action', payload });
        } catch {
          // Channel may be closed; ignore broadcast errors
        }
      }
    },
    [roomId, slot, name, isConnected]
  );

  // Send remote command (timer, gamjeom, score override, buzzer)
  const sendRemoteCommand = useCallback(
    (cmd) => {
      const payload = {
        roomId,
        senderRole: role,
        ...cmd,
      };

      if (socketRef.current && isConnected) {
        socketRef.current.emit('remote_command', payload);
      }
      if (broadcastRef.current) {
        try {
          broadcastRef.current.postMessage({ type: 'remote_command', payload });
        } catch {
          // Channel may be closed; ignore broadcast errors
        }
      }
    },
    [roomId, role, isConnected]
  );

  return {
    isConnected,
    activeJudges,
    serverIp,
    serverPort,
    onStateUpdate,
    onJudgeAction,
    onRemoteCommand,
    syncState,
    sendJudgeAction,
    sendRemoteCommand,
  };
}

