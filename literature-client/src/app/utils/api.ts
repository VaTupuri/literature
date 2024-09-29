import axios from 'axios';
import { Player } from '@/app/types';


export const API_BASE_URL = 'http://127.0.0.1:5000'; // Replace with your actual API base URL

export const createRoom = async (playerName: string) => {
  const response = await fetch(`${API_BASE_URL}/create_room`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: playerName }),
  });

  if (!response.ok) {
    throw new Error('Failed to create room');
  }

  return response.json();
};

export const joinRoom = async (roomId: string, username: string): Promise<{ player_id: string, room_id: string }> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/join_room/${roomId}`, { name: username });
    return { player_id: response.data.player_id, room_id: response.data.room_id };
  } catch (error) {
    console.error('Error joining room:', error);
    throw error;
  }
};

export const getPlayerHand = async (playerId: string): Promise<string[]> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/get_player_hand/${playerId}`);
    return response.data.hand;
  } catch (error) {
    console.error('Error getting player hand:', error);
    throw error;
  }
};

export const getRoomPlayers = async (roomId: string): Promise<Player[]> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/get_room_players/${roomId}`);
    return response.data.players;
  } catch (error) {
    console.error('Error getting room players:', error);
    throw error;
  }
};

export const getCurrentTurn = async (roomId: string): Promise<{ current_turn: string | null, started: boolean, scores: Record<string, number> }> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/get_current_turn/${roomId}`);
    return {
      current_turn: response.data.current_turn || null,
      started: response.data.started,
      scores: response.data.scores || {}
    };
  } catch (error) {
    console.error('Error getting current turn:', error);
    throw error;
  }
};

export const getPlayerTeam = async (playerId: string): Promise<number> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/get_player_team/${playerId}`);
    return response.data.team;
  } catch (error) {
    console.error('Error getting player team:', error);
    throw error;
  }
};