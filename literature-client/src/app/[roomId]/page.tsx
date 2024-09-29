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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import Confetti from 'react-confetti'

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
  const [winningTeam, setWinningTeam] = useState<number | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)

  const setDescriptions = [
    '2-7 of Spades',
    '2-7 of Hearts',
    '2-7 of Clubs',
    '2-7 of Diamonds',
    '9-A of Spades',
    '9-A of Hearts',
    '9-A of Clubs',
    '9-A of Diamonds',
    'All 8s and Jokers'
  ]

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
          setScores(currentTurnData.scores || {})  // Initialize scores from the game state

          console.log("initializing teams")
          initializeTeams(roomPlayers)
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
      console.log('Turn changed to in page:', data.current_turn)
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
      if (data.is_valid) {
        if (playerTeam === data.declaring_team) {
          toast({
            title: "Set Declared Successfully!",
            description: "Your team got a set!",
            variant: "default",
          })
        }
      } else {
        if (playerTeam === data.declaring_team) {
          toast({
            title: "Set Misdeclared!",
            description: "Your team misdeclared the set and the other team got a point.",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Opponent Misdeclared!",
            description: "The other team misdeclared the set and you got a point!",
            variant: "default",
          })
        }
      }

      if (data.winning_team !== undefined) {
        setWinningTeam(data.winning_team)
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 10000) // Stop confetti after 10 seconds
      }
    })

    return () => {
      disconnectSocket()
    }
  }, [playerId, params.roomId, toast, playerTeam])

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
    const currentPlayer = players.find(player => String(player.id) === String(currentTurn))
    console.log('Current player:', currentPlayer)
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
    setSetDeclaration({})
  }

  const handleCardAssignment = (cardIndex: number, playerId: string) => {
    setSetDeclaration(prev => {
      const newDeclaration = { ...prev }
      if (!newDeclaration[playerId]) {
        newDeclaration[playerId] = []
      }
      newDeclaration[playerId][cardIndex] = getCardForSet(selectedSet!, cardIndex)
      return newDeclaration
    })
  }

  const getCardForSet = (setNumber: number, cardIndex: number): string => {
    const suits = ['Spades', 'Hearts', 'Clubs', 'Diamonds']
    if (setNumber < 4) {
      return `${cardIndex + 2} of ${suits[setNumber]}`
    } else if (setNumber < 8) {
      return `${['9', '10', 'Jack', 'Queen', 'King', 'Ace'][cardIndex]} of ${suits[setNumber - 4]}`
    } else {
      return cardIndex < 4 ? `8 of ${suits[cardIndex]}` : 'Joker'
    }
  }

  const submitSetDeclaration = () => {
    if (playerId && selectedSet !== null) {
      const declaration = Object.entries(setDeclaration).reduce((acc, [playerId, cards]) => {
        acc[playerId] = cards.filter(Boolean)
        return acc
      }, {} as Record<string, string[]>)

      declareSet(playerId, params.roomId, declaration)
      setIsSetModalOpen(false)
      setSelectedSet(null)
      setSetDeclaration({})
    }
  }

  const copyRoomId = () => {
    navigator.clipboard.writeText(params.roomId)
    toast({
      title: "Room ID Copied",
      description: "The room ID has been copied to your clipboard.",
    })
  }


  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 p-8">
      {showConfetti && <Confetti />}
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
                {String(currentTurn) === String(playerId) ? (
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

          {winningTeam !== null && (
            <Alert className="mb-6 bg-yellow-100 border-yellow-400">
              <AlertTitle className="text-2xl font-bold text-yellow-700">Game Over!</AlertTitle>
              <AlertDescription className="text-xl text-yellow-800">
                Team {winningTeam + 1} has won the game! 🎉
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-6 mb-6">
            {Object.entries(teams).map(([teamNumber, teamPlayers]) => (
              <Card key={teamNumber} className={winningTeam === parseInt(teamNumber) ? "border-4 border-yellow-400" : ""}>
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

            {gameStarted && String(currentTurn) === String(playerId) && (
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

          <h2 className="text-2xl font-semibold mb-4">Your Hand</h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {hand.map((card, index) => (
              <div
                key={index}
                className={`relative ${selectedCard === card ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => String(currentTurn) === String(playerId) && handleCardSelect(card)}
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

      <Dialog open={isSetModalOpen} onOpenChange={setIsSetModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Declare a Set</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select onValueChange={(value) => handleSetSelection(Number(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Select a set" />
              </SelectTrigger>
              <SelectContent>
                {setDescriptions.map((description, index) => (
                  <SelectItem key={index} value={index.toString()}>
                    {description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSet !== null && (
              <div className="space-y-2">
                {Array.from({ length: selectedSet === 8 ? 5 : 6 }, (_, cardIndex) => (
                  <div key={cardIndex} className="flex items-center space-x-2">
                    <span>{getCardForSet(selectedSet, cardIndex)}</span>
                    <Select onValueChange={(value) => handleCardAssignment(cardIndex, value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Assign to player" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const filteredPlayers = players.filter((player) => player.team === playerTeam);
                          // console.log("Filtered players:", filteredPlayers);

                          return filteredPlayers.length > 0 ? (
                            filteredPlayers.map((player) => (
                              <SelectItem key={player.id} value={String(player.id)}>
                                {"Player: " + player.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="" disabled>No players on your team</SelectItem>
                          );
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={submitSetDeclaration} disabled={!selectedSet}>
              Declare Set
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}