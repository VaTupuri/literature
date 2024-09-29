import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';

let socket: Socket | null = null;

export const connectToSocket = (roomId: string, playerId: string) => {
  if (!socket) {
    console.log("Connecting with playerId:", playerId)
    socket = io(API_BASE_URL, {
      query: { room_id: roomId, player_id: playerId },
      transports: ['websocket']
    });

    socket.on('connect', () => {
      console.log('Connected to Socket.IO');
    });

    socket.on('update_players', (data) => {
      console.log('Players in room:', data.players);
      // You can dispatch an action or update state here to reflect the new player list
    });

    // socket.on('hand_updated', (data) => {
    //   console.log('Hand updated event received:', data);
    //   if (String(data.player_id) === playerId) {
    //     console.log('Hand updated for this player:', data.hand);
    //     // onHandUpdated(data.hand);
    //   }
    // });

    socket.on('game_state', (data) => {
      console.log('Game state received:', data);
      // You can dispatch an action or update state here to reflect the game state
    });

    // socket.on('turn_changed', (data) => {
    //   console.log('Turn changed:', data.current_turn);
    //   // You can dispatch an action or update state here to reflect the new turn
    // });

    socket.on('card_transferred', (data) => {
      console.log('Card transferred:', data);
      // The hand will be updated via the 'hand_updated' event
      // The toast notification will be handled in the component
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
    console.log("askingPlayerId", askingPlayerId)
    console.log("askedPlayerId", askedPlayerId)
    console.log("card", card)
    console.log("roomId", roomId)
    socket.emit('ask_card', { asking_player_id: askingPlayerId, asked_player_id: askedPlayerId, card, room_id: roomId });
  }
};

export const declareSet = (declaringPlayerId: string, roomId: string, setDeclaration: Record<string, string[]>) => {
  if (socket) {
    socket.emit('declare_set', { declaring_player_id: declaringPlayerId, room_id: roomId, set_declaration: setDeclaration });
  }
};