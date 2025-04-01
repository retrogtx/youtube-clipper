import { useState } from 'react'
import './App.css'

function App() {
  const [url, setUrl] = useState('')
  const [startTime, setStartTime] = useState('00:00:00')
  const [endTime, setEndTime] = useState('00:00:00')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('http://localhost:3000/api/clip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          startTime,
          endTime,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to process video')
      }

      // Create a blob from the response and download it
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = 'video-clip.mp4'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-md">
      <h1 className="text-2xl font-bold mb-4">YouTube Video Clipper</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="url" className="block text-sm font-medium mb-1">
            YouTube URL
          </label>
          <input
            type="text"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div>
          <label htmlFor="startTime" className="block text-sm font-medium mb-1">
            Start Time (HH:MM:SS)
          </label>
          <input
            type="text"
            id="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
            placeholder="00:00:00"
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div>
          <label htmlFor="endTime" className="block text-sm font-medium mb-1">
            End Time (HH:MM:SS)
          </label>
          <input
            type="text"
            id="endTime"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
            placeholder="00:00:00"
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loading ? 'Processing...' : 'Clip Video'}
        </button>
        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}
      </form>
    </div>
  )
}

export default App
