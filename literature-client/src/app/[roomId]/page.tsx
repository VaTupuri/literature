'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { getSocket, connectToSocket, disconnectSocket, askCard as askCardSocket, declareSet } from '@/app/utils/socketio'
import { getPlayerHand, getRoomPlayers, getCurrentTurn, getPlayerTeam } from '@/app/utils/api'
import { Player } from '@/app/types'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { ClipboardCopy } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';

const getCardImagePath = (card: string): string => {
  if (card === 'Joker') {
    return '/cards/red_joker.png'
  }
  const [value, , suit] = card.toLowerCase().split(' ')
  const processedValue = {
    'a': 'ace',
    'k': 'king',
    'q': 'queen',
    'j': 'jack'
  }[value] || value
  return `/cards/${processedValue}_of_${suit}.png`
}

const getSetForCard = (card: string): number => {
  if (card === 'Joker') return 8
  const [value, , suit] = card.split(' ')
  if (value === '8') return 8
  if (['2', '3', '4', '5', '6', '7'].includes(value)) {
    return { 'Spades': 0, 'Hearts': 1, 'Clubs': 2, 'Diamonds': 3 }[suit]!
  }
  return { 'Spades': 4, 'Hearts': 5, 'Clubs': 6, 'Diamonds': 7 }[suit]!
}

const DraggableCard = ({ card, onStop }: { card: string; onStop: (e: MouseEvent, data: DraggableData) => void }) => {
  return (
    <Draggable onStop={onStop}>
      <div className="cursor-move">
        <Image
          src={getCardImagePath(card)}
          alt={card}
          width={60}
          height={84}
          className="rounded-lg shadow-md"
        />
      </div>
    </Draggable>
  )
}

export default function Component({ params }: { params: { roomId: string } }) {
  const [players, setPlayers] = useState<Player[]>([])
  const [hand, setHand] = useState<string[]>([])
  const [currentTurn, setCurrentTurn] = useState<string | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const searchParams = useSearchParams()
  const playerId = searchParams.get('playerId')
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [playerTeam, setPlayerTeam] = useState<number | null>(null)
  const [selectedSuit, setSelectedSuit] = useState<string>('')
  const [selectedValue, setSelectedValue] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [declaringSet, setDeclaringSet] = useState(false)
  const [setDeclaration, setSetDeclaration] = useState<Record<string, string[]>>({})
  const [teams, setTeams] = useState<Record<number, Player[]>>({})
  const { toast } = useToast()
  const [isSetModalOpen, setIsSetModalOpen] = useState(false)
  const [selectedSet, setSelectedSet] = useState<number | null>(null)
  const [draggedCards, setDraggedCards] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const fetchInitialData = async () => {
      if (playerId) {
        try {
          const [playerHand, roomPlayers, currentTurnData, team] = await Promise.all([
            getPlayerHand(playerId),
            getRoomPlayers(params.roomId),
            getCurrentTurn(params.roomId),
            getPlayerTeam(playerId)
          ])
          setHand(playerHand)
          setPlayers(roomPlayers)
          setGameStarted(currentTurnData.started)
          setCurrentTurn(currentTurnData.current_turn)
          setPlayerTeam(team)

          // Only set teams if the game hasn't started yet
        //   if (!currentTurnData.started) {
            initializeTeams(roomPlayers)
        //   }
        } catch (error) {
          console.error('Error fetching initial data:', error)
        }
      }
    }

    fetchInitialData()

    const socket = connectToSocket(params.roomId, playerId!)
    
    socket.on('update_players', (data) => {
      setPlayers(data.players)
      // Do not update teams here
    })

    socket.on('hand_updated', (data) => {
      console.log('Hand updated event received:', data);
      console.log('Player ID:', playerId);

      if (String(data.player_id) === playerId) {
        console.log('Updating hand for this player:', data.hand);
        setHand(data.hand);
      }
    });

    socket.on('game_started', (data) => {
      console.log('Game started! Current turn:', data.current_turn)
      setGameStarted(true)
      setCurrentTurn(data.current_turn)
      // Initialize teams when the game starts
      initializeTeams(data.players)
    })

    socket.on('turn_changed', (data) => {
      setCurrentTurn(data.current_turn)
    })

    socket.on('game_state', (data) => {
      console.log('Game state received:', data)
      setGameStarted(data.started)
      setCurrentTurn(data.current_turn)
    })

    socket.on('card_transferred', (data) => {
      if (data.from_player === playerId) {
        // Remove the card from your hand
        setHand(prevHand => prevHand.filter(card => card !== data.card))
        // Show toast notification for losing a card
        toast({
          title: "Card Stolen!",
          description: `Your ${data.card} was taken by another player.`,
          variant: "destructive",
        })
      } else if (data.to_player === playerId) {
        // Add the card to your hand
        setHand(prevHand => [...prevHand, data.card])
        // Show toast notification for successfully stealing a card
        toast({
          title: "Card Stolen Successfully!",
          description: `You successfully stole the ${data.card}.`,
          variant: "default",
        })
      }
    })

    socket.on('error', (data) => {
      setError(data.message)
    })

    socket.on('set_declared', (data) => {
      setScores(data.scores)
    })

    return () => {
      disconnectSocket()
    }
  }, [playerId, params.roomId, toast])

  // Function to initialize teams
  const initializeTeams = (players: Player[]) => {
    const groupedTeams = players.reduce((acc, player) => {
      if (!acc[player.team]) {
        acc[player.team] = []
      }
      acc[player.team].push(player)
      return acc
    }, {} as Record<number, Player[]>)
    setTeams(groupedTeams)
  }

  const getCurrentPlayerName = () => {
    const currentPlayer = players.find(player => String(player.id) === currentTurn)
    return currentPlayer ? currentPlayer.name : 'Unknown'
  }

  const handlePlayerSelect = (playerId: string) => {
    setSelectedPlayer(playerId)
  }

  const handleCardSelect = (card: string) => {
    setSelectedCard(card)
  }

  const handleAskCard = () => {
    if (playerId && selectedPlayer && selectedSuit && selectedValue) {
      const cardToAsk = `${selectedValue} of ${selectedSuit}`
      
      if (hand.includes(cardToAsk)) {
        setError("You cannot ask for a card you already have")
        return
      }

      const askedCardSet = getSetForCard(cardToAsk)
      const playerHasCardInSet = hand.some(card => getSetForCard(card) === askedCardSet)

      if (!playerHasCardInSet) {
        setError("You must have a card in the set you are asking for")
        return
      }

      setError(null)
      askCardSocket(playerId, selectedPlayer, cardToAsk, params.roomId)
    //   console.log('Asked card:', cardToAsk)
    //   setSelectedPlayer(null)
    //   setSelectedSuit('')
    //   setSelectedValue('')
    }
  }

  const isOpposingTeam = (player: Player) => {
    return player.team !== playerTeam
  }

  const handleDeclareSet = () => {
    setIsSetModalOpen(true)
  }

  const handleSetSelection = (setNumber: number) => {
    setSelectedSet(setNumber)
    setDraggedCards({})
  }

  const moveCard = (card: string, toPlayerId: string) => {
    setDraggedCards(prev => {
      const newDraggedCards = { ...prev }
      if (!newDraggedCards[toPlayerId]) {
        newDraggedCards[toPlayerId] = []
      }
      newDraggedCards[toPlayerId].push(card)
      return newDraggedCards
    })

    setHand(prev => prev.filter(c => c !== card))
  }

  const submitSetDeclaration = () => {
    if (playerId && selectedSet !== null) {
      declareSet(playerId, params.roomId, draggedCards)
      setIsSetModalOpen(false)
      setSelectedSet(null)
      setDraggedCards({})
    }
  }

  const copyRoomId = () => {
    navigator.clipboard.writeText(params.roomId)
    toast({
      title: "Room ID Copied",
      description: "The room ID has been copied to your clipboard.",
    })
  }

  const handleDragStop = (e: MouseEvent, data: DraggableData, card: string) => {
    // Handle the drag stop logic here
    // You can use the final position (data.x, data.y) to determine where the card was dropped
    console.log(`Card ${card} dropped at x: ${data.x}, y: ${data.y}`)
    // Implement your logic to move the card to a player or set
  }

  return (
      <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 p-8">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-6">
          {!gameStarted && (
              <div className="flex items-center justify-center mb-6">
                <h1 className="text-xl font-medium mr-2">Room ID: {params.roomId}</h1>
                <Button variant="outline" size="icon" onClick={copyRoomId}>
                  <ClipboardCopy className="h-4 w-4" />
                </Button>
              </div>
            )}
            {gameStarted ? (
              <Alert className="mb-6">
                <AlertTitle>Current Turn</AlertTitle>
                <AlertDescription>
                  {currentTurn === playerId ? (
                    <span className="font-bold text-green-600">It's your turn!</span>
                  ) : (
                    <span>{getCurrentPlayerName()}</span>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="mb-6">
                <AlertTitle>Waiting for players</AlertTitle>
                <AlertDescription>More players need to join before the game can start.</AlertDescription>
              </Alert>
            )}

    <div className="grid grid-cols-2 gap-6 mb-6">
              {Object.entries(teams).map(([teamNumber, teamPlayers]) => (
                <Card key={teamNumber}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-xl font-semibold">Team {teamNumber}</h3>
                      <span className="text-2xl font-bold">{scores[teamNumber] || 0}</span>
                    </div>
                    <div className="space-y-2">
                      {teamPlayers.map((player) => (
                        <div key={player.id} className="flex items-center justify-between">
                          <span className={`${player.id === currentTurn ? "font-bold" : ""} ${player.id === playerId ? "text-blue-600 font-bold" : ""}`}>
                            {player.name} {player.id === playerId && "(You)"}
                          </span>
                          {player.id === currentTurn && <Badge>Current Turn</Badge>}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-6 mb-6">
              
              {gameStarted && currentTurn === playerId && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-xl font-semibold mb-4">Ask for a card</h3>
                    <div className="space-y-4">
                      <Select onValueChange={handlePlayerSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a player" />
                        </SelectTrigger>
                        <SelectContent>
                          {players.filter(isOpposingTeam).map((player) => (
                            <SelectItem key={player.id} value={player.id}>{player.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select onValueChange={setSelectedValue}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select value" />
                        </SelectTrigger>
                        <SelectContent>
                          {['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'].map((value) => (
                            <SelectItem key={value} value={value}>{value}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select onValueChange={setSelectedSuit}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select suit" />
                        </SelectTrigger>
                        <SelectContent>
                          {['Hearts', 'Diamonds', 'Clubs', 'Spades'].map((suit) => (
                            <SelectItem key={suit} value={suit}>{suit}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button onClick={handleAskCard} disabled={!selectedPlayer || !selectedSuit || !selectedValue}>
                          Ask for Card
                        </Button>
                        <Button onClick={handleDeclareSet} variant="secondary">
                          Declare Set
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <Dialog open={isSetModalOpen} onOpenChange={setIsSetModalOpen}>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Declare a Set</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <RadioGroup onValueChange={(value) => handleSetSelection(parseInt(value))}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="0" id="set-0" />
                      <Label htmlFor="set-0">2-7 of Spades</Label>
                    </div>
                    {/* Add more set options here */}
                  </RadioGroup>

                  {selectedSet !== null && (
                    <div className="grid grid-cols-2 gap-4">
                      {players.filter(player => player.team === playerTeam).map(player => (
                        <PlayerDropZone key={player.id} playerId={String(player.id)} name={player.name} cards={draggedCards[player.id] || []} onDrop={moveCard} />
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between mt-4">
                    <h3 className="text-lg font-semibold">Your Hand</h3>
                    <Button onClick={submitSetDeclaration} disabled={Object.values(draggedCards).flat().length !== 6}>
                      Submit Declaration
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {hand.map((card, index) => (
                      <DraggableCard key={`${card}-${index}`} card={card} onStop={(e, data) => handleDragStop(e, data, card)} />
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

          <h2 className="text-2xl font-semibold mb-4">Your Hand</h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {hand.map((card, index) => (
              <div
                key={index}
                className={`relative ${selectedCard === card ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => currentTurn === playerId && handleCardSelect(card)}
              >
                <Image
                  src={getCardImagePath(card)}
                  alt={card}
                  width={80}
                  height={112}
                  className="rounded-lg shadow-md transition-transform hover:scale-105"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}