import { useState } from 'react'
import './App.css'

function App() {
  const [url, setUrl] = useState('')
  const [startTime, setStartTime] = useState('00:00:00')
  const [endTime, setEndTime] = useState('00:00:00')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [clipPath, setClipPath] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setClipPath('');

    try {
      const downloadResponse = await fetch('http://localhost:3000/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!downloadResponse.ok) {
        const errorData = await downloadResponse.json();
        throw new Error(errorData.error || 'Failed to download video');
      }

      const downloadData = await downloadResponse.json();
      const downloadedFilePath = downloadData.filePath;

      if (!downloadedFilePath) {
        throw new Error('Download succeeded but did not return a file path.');
      }

      const clipResponse = await fetch('http://localhost:3000/api/clip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: downloadedFilePath,
          startTime,
          endTime,
        }),
      })

      if (!clipResponse.ok) {
        const errorData = await clipResponse.json();
        throw new Error(errorData.error || 'Failed to clip video');
      }

      const clipData = await clipResponse.json();
      console.log('Clip successful:', clipData);
      setClipPath(clipData.filePath);

    } catch (err) {
      console.error('Error in handleSubmit:', err);
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
          <div className="text-red-500 text-sm mt-2">{error}</div>
        )}
        {clipPath && (
          <div className="text-green-500 text-sm mt-2">
            Clip created successfully! Server path: {clipPath}
          </div>
        )}
      </form>
    </div>
  )
}

export default App
