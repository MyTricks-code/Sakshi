import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Upload, FileText } from "lucide-react"

export default function Verify() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [projectId, setProjectId] = useState("")
  const [claimedCoverage, setClaimedCoverage] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !projectId) return
    setLoading(true)
    setError("")

    const form = new FormData()
    form.append("file", file)
    form.append("project_id", projectId)
    form.append("claimed_coverage", claimedCoverage || "85")

    try {
      const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000"
      const res = await fetch(`${API}/verify`, { method: "POST", body: form })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      sessionStorage.setItem("verifyResult", JSON.stringify(data))
      navigate("/results")
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="font-mono text-xs text-zinc-400 uppercase tracking-widest mb-6">
        Verification Request
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <label className="block text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2">
            Project ID
          </label>
          <input
            type="text"
            placeholder="e.g. VCS-4541"
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className="w-full border border-zinc-300 bg-white px-3 py-2 text-sm font-mono text-zinc-800 outline-none focus:border-zinc-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2">
            Claimed Tree Coverage (%)
          </label>
          <input
            type="number"
            placeholder="e.g. 85"
            min={0}
            max={100}
            value={claimedCoverage}
            onChange={e => setClaimedCoverage(e.target.value)}
            className="w-full border border-zinc-300 bg-white px-3 py-2 text-sm font-mono text-zinc-800 outline-none focus:border-zinc-500"
          />
          <p className="text-xs text-zinc-400 mt-1">Leave blank to use project registry default.</p>
        </div>

        <Separator />

        <div>
          <label className="block text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2">
            AlphaEarth Embeddings CSV
          </label>
          <div
            onClick={() => fileRef.current?.click()}
            className="border border-dashed border-zinc-300 bg-white p-8 text-center cursor-pointer hover:bg-zinc-50 transition-colors"
          >
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm font-mono text-zinc-700">
                <FileText className="w-4 h-4" />
                {file.name}
                <span className="text-zinc-400">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            ) : (
              <div>
                <Upload className="w-5 h-5 mx-auto mb-2 text-zinc-400" />
                <p className="text-sm text-zinc-500">Drop CSV or click to browse</p>
                <p className="text-xs text-zinc-400 mt-1">Expected: system:index, A00–A63, label, .geo</p>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {error && (
          <p className="text-xs font-mono text-red-600 border border-red-200 bg-red-50 px-3 py-2">
            Error: {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={loading || !file || !projectId}>
            {loading ? "Analyzing…" : "Run Verification"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
