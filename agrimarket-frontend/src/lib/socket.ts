'use client';

import * as React from 'react';
import { io, type Socket } from 'socket.io-client';
import { tokenStore, type Realm } from './api';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

const sockets: Partial<Record<Realm, Socket>> = {};

/**
 * One socket per realm. The server joins it to a private user room and a role
 * room from the token, which is how notifications, chat messages and the admin
 * activity feed arrive without polling.
 */
export function getSocket(realm: Realm = 'user'): Socket | null {
  if (typeof window === 'undefined') return null;
  const token = tokenStore.get(realm);
  if (!token) return null;

  const existing = sockets[realm];
  if (existing) return existing;

  const socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });
  sockets[realm] = socket;
  return socket;
}

export function disconnectSocket(realm: Realm = 'user') {
  sockets[realm]?.disconnect();
  delete sockets[realm];
}

/** Subscribe to a server event for the lifetime of the component. */
export function useSocketEvent<T = unknown>(event: string, handler: (payload: T) => void, realm: Realm = 'user') {
  const handlerRef = React.useRef(handler);
  handlerRef.current = handler;

  React.useEffect(() => {
    const socket = getSocket(realm);
    if (!socket) return;
    const listener = (payload: T) => handlerRef.current(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [event, realm]);
}
