'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Plus } from "lucide-react"
import { createRoom, joinRoom } from "@/app/utils/api"
import { useToast } from "@/components/ui/use-toast"
import { connectToSocket } from "@/app/utils/socketio"

export default function Home() {
  const [username, setUsername] = useState("")
  const [roomId, setRoomId] = useState("")
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false)
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleJoinRoom = async () => {
    if (roomId) {
      setShowUsernamePrompt(true)
      setIsCreatingRoom(false)
    }
  }

  const handleCreateRoom = () => {
    setShowUsernamePrompt(true)
    setIsCreatingRoom(true)
  }

  const handleUsernameSubmit = async () => {
    if (username) {
      try {
        if (isCreatingRoom) {
          const { room_id: newRoomId, player_id: playerId } = await createRoom(username)
          connectToSocket(newRoomId, playerId)
          router.push(`/${newRoomId}?playerId=${playerId}`)
        } else if (roomId) {
          const { player_id: playerId, room_id: joinedRoomId } = await joinRoom(roomId, username)
          connectToSocket(joinedRoomId, playerId)
          router.push(`/${joinedRoomId}?playerId=${playerId}`)
        }
      } catch (error) {
        console.error("Failed to create/join room:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: isCreatingRoom ? "Failed to create room" : "Failed to join room",
        })
      }
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-r from-blue-100 to-purple-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center text-gray-800">LITERATURE</CardTitle>
          <CardDescription className="text-center text-gray-600">Join a room or create a new one</CardDescription>
        </CardHeader>
        <CardContent>
          {!showUsernamePrompt ? (
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Enter Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full"
              />
              <div className="grid grid-cols-2 gap-4">
                <Button onClick={handleJoinRoom} className="w-full" variant="default">
                  Join Room
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button onClick={handleCreateRoom} className="w-full" variant="outline">
                  Create Room
                  <Plus className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Enter Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full"
              />
              <Button onClick={handleUsernameSubmit} className="w-full">
                {isCreatingRoom ? "Create Room" : "Join Room"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}