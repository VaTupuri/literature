'use client'

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { getSocket, connectToSocket, disconnectSocket, askCard as askCardSocket } from '@/app/utils/socketio';
import { getPlayerHand, getRoomPlayers, getCurrentTurn, getPlayerTeam } from '@/app/utils/api';
import { Player } from '@/app/types';

const getCardImagePath = (card: string): string => {
  if (card === 'Joker') {
    return '/cards/red_joker.png';
  }
  const [value, , suit] = card.toLowerCase().split(' ');
  const processedValue = {
    'a': 'ace',
    'k': 'king',
    'q': 'queen',
    'j': 'jack'
  }[value] || value;
  return `/cards/${processedValue}_of_${suit}.png`;
};

const getSetForCard = (card: string): number => {
  if (card === 'Joker') return 8;
  const [value, , suit] = card.split(' ');
  if (value === '8') return 8;
  if (['2', '3', '4', '5', '6', '7'].includes(value)) {
    return { 'Spades': 0, 'Hearts': 1, 'Clubs': 2, 'Diamonds': 3 }[suit]!;
  }
  return { 'Spades': 4, 'Hearts': 5, 'Clubs': 6, 'Diamonds': 7 }[suit]!;
};

export default function Room({ params }: { params: { roomId: string } }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [hand, setHand] = useState<string[]>([]);
  const [currentTurn, setCurrentTurn] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const searchParams = useSearchParams();
  const playerId = searchParams.get('playerId');
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [playerTeam, setPlayerTeam] = useState<number | null>(null);
  const [cardToAsk, setCardToAsk] = useState<string>('');

  const [selectedSuit, setSelectedSuit] = useState<string>('');
  const [selectedValue, setSelectedValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (playerId) {
        try {
          const [playerHand, roomPlayers, currentTurnData, team] = await Promise.all([
            getPlayerHand(playerId),
            getRoomPlayers(params.roomId),
            getCurrentTurn(params.roomId),
            getPlayerTeam(playerId)
          ]);
          setHand(playerHand);
          setPlayers(roomPlayers);
          setGameStarted(currentTurnData.started);
          setCurrentTurn(currentTurnData.current_turn);
          setPlayerTeam(team);
        } catch (error) {
          console.error('Error fetching initial data:', error);
        }
      }
    };

    fetchInitialData();

    const socket = connectToSocket(params.roomId, playerId || '');
    
    socket.on('update_players', (data) => {
      setPlayers(data.players);
    });

    socket.on('hand_updated', (data) => {
      setHand(data.hand);
    });

    socket.on('game_started', (data) => {
      console.log('Game started! Current turn:', data.current_turn);
      setGameStarted(true);
      setCurrentTurn(data.current_turn);
    });

    socket.on('turn_changed', (data) => {
      setCurrentTurn(data.current_turn);
    });

    socket.on('game_state', (data) => {
      console.log('Game state received:', data);
      setGameStarted(data.started);
      setCurrentTurn(data.current_turn);
    });

    socket.on('card_transferred', (data) => {
      // Update the UI to reflect the card transfer
      if (data.from_player === playerId || data.to_player === playerId) {
        getPlayerHand(playerId!).then(setHand);
      }
    });

    socket.on('error', (data) => {
      setError(data.message);
    });

    return () => {
      disconnectSocket();
    };
  }, [playerId, params.roomId]);

  const getCurrentPlayerName = () => {
    console.log(players)
    console.log(currentTurn)
    const currentPlayer = players.find(player => String(player.id) === currentTurn);

    console.log(currentPlayer)
    return currentPlayer ? currentPlayer.name : 'Unknown';
  };

  const handlePlayerSelect = (playerId: string) => {
    setSelectedPlayer(playerId);
  };

  const handleCardSelect = (card: string) => {
    setSelectedCard(card);
  };

  const handleSuitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSuit(e.target.value);
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedValue(e.target.value);
  };

  const handleAskCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardToAsk(e.target.value);
  };

  const handleAskCard = () => {
    if (playerId && selectedPlayer && selectedSuit && selectedValue) {
      const cardToAsk = `${selectedValue} of ${selectedSuit}`;
      
      // Check if the player has the card they're asking for
      if (hand.includes(cardToAsk)) {
        setError("You cannot ask for a card you already have");
        return;
      }

      // Check if the player has a card in the set they're asking for
      const askedCardSet = getSetForCard(cardToAsk);
      const playerHasCardInSet = hand.some(card => getSetForCard(card) === askedCardSet);

      if (!playerHasCardInSet) {
        setError("You must have a card in the set you are asking for");
        return;
      }

      setError(null);
      askCardSocket(playerId, selectedPlayer, cardToAsk, params.roomId);
      setSelectedPlayer(null);
      setSelectedSuit('');
      setSelectedValue('');
    }
  };

  const isOpposingTeam = (player: Player) => {
    return player.team !== playerTeam;
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <main className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6">Room: {params.roomId}</h1>
        {gameStarted ? (
          <div className="mb-4">
            {currentTurn === playerId ? (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
                <strong className="font-bold">It's your turn!</strong>
              </div>
            ) : (
              <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded relative" role="alert">
                <strong className="font-bold">Current turn: </strong>
                <span className="block sm:inline">{getCurrentPlayerName()}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-4">
            <p className="text-gray-600">Waiting for more players to join...</p>
          </div>
        )}
        <h2 className="text-xl font-semibold mb-4">Players in the room:</h2>
        <ul className="list-disc pl-6 mb-6">
          {players.map((player) => (
            <li key={player.id} className={player.id === currentTurn ? "font-bold" : ""}>
              {player.name} {player.id === playerId ? "(You)" : ""}
            </li>
          ))}
        </ul>
        {error && (
          <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        {gameStarted && currentTurn === playerId && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Ask for a card:</h3>
            <div className="mb-4">
              <label className="block mb-2">Select a player:</label>
              <select
                value={selectedPlayer || ''}
                onChange={(e) => handlePlayerSelect(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">Select a player</option>
                {players.filter(isOpposingTeam).map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block mb-2">Select a card:</label>
              <div className="flex gap-2">
                <select
                  value={selectedValue}
                  onChange={handleValueChange}
                  className="w-1/2 p-2 border rounded"
                >
                  <option value="">Select value</option>
                  {['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedSuit}
                  onChange={handleSuitChange}
                  className="w-1/2 p-2 border rounded"
                >
                  <option value="">Select suit</option>
                  {['Hearts', 'Diamonds', 'Clubs', 'Spades'].map((suit) => (
                    <option key={suit} value={suit}>
                      {suit}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={handleAskCard}
              disabled={!selectedPlayer || !selectedSuit || !selectedValue}
              className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
            >
              Ask for Card
            </button>
          </div>
        )}
        <h2 className="text-xl font-semibold mb-4 mt-6">Your Hand:</h2>
        <div className="flex flex-wrap gap-2">
          {hand.map((card, index) => (
            <div
              key={index}
              className={`w-20 h-28 relative ${
                selectedCard === card ? 'border-2 border-blue-500' : ''
              }`}
              onClick={() => currentTurn === playerId && handleCardSelect(card)}
            >
              <Image
                src={getCardImagePath(card)}
                alt={card}
                layout="fill"
                objectFit="contain"
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}