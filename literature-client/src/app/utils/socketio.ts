import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';

let socket: Socket | null = null;

export const connectToSocket = (roomId: string, playerId: string) => {
  if (!socket) {
    socket = io(API_BASE_URL, {
      query: { room_id: roomId, player_id: playerId }
    });

    socket.on('connect', () => {
      console.log('Connected to Socket.IO');
    });

    socket.on('update_players', (data) => {
      console.log('Players in room:', data.players);
      // You can dispatch an action or update state here to reflect the new player list
    });

    socket.on('hand_updated', (data) => {
      console.log('Hand updated:', data.hand);
      // You can dispatch an action or update state here to reflect the new hand
    });

    socket.on('game_state', (data) => {
      console.log('Game state received:', data);
      // You can dispatch an action or update state here to reflect the game state
    });

    socket.on('turn_changed', (data) => {
      console.log('Turn changed:', data.current_turn);
      // You can dispatch an action or update state here to reflect the new turn
    });

    socket.on('card_transferred', (data) => {
      console.log('Card transferred:', data);
      // You can dispatch an action or update state here to reflect the card transfer
    });

    socket.on('error', (data) => {
      console.error('Socket error:', data.message);
      // You can dispatch an action or update state here to show the error message
    });
  }

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const askCard = (askingPlayerId: string, askedPlayerId: string, card: string, roomId: string) => {
  if (socket) {
    socket.emit('ask_card', { asking_player_id: askingPlayerId, asked_player_id: askedPlayerId, card, room_id: roomId });
  }
};