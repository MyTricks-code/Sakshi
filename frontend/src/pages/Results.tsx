import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import "leaflet/dist/leaflet.css"

type PixelSample = { lat: number; lng: number; label: number; prob: number }
type ProbBin = { bin: number; count: number }
type TopFeature = { name: string; importance: number }

type Result = {
  project_id: string
  project_name: string
  location: string
  registry: string
  area_ha: number
  methodology: string
  coordinates: { lat: number; lng: number }
  claimed_coverage: number
  verified_coverage: number
  counterfactual_coverage: number
  additionality_claimed: number
  additionality_verified: number
  claimed_co2e: number
  verified_co2e: number
  total_pixels: number
  tree_pixels: number
  non_tree_pixels: number
  confidence: number
  verdict: "verified" | "overstated" | "fraudulent"
  verdict_label: string
  top_features: TopFeature[]
  pixel_samples: PixelSample[]
  prob_distribution: ProbBin[]
}

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

export default function Results() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError("")
      try {
        if (searchParams.get("demo") === "true") {
          const res = await fetch(`${API}/demo`)
          if (!res.ok) throw new Error(await res.text())
          setResult(await res.json())
        } else {
          const stored = sessionStorage.getItem("verifyResult")
          if (!stored) { navigate("/"); return }
          setResult(JSON.parse(stored))
        }
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [searchParams, navigate])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <p className="font-mono text-sm text-zinc-400">Running inference on satellite pixels…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        <p className="font-mono text-xs text-red-600 border border-red-200 bg-red-50 px-3 py-2">{error}</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate("/")}>Home</Button>
      </div>
    )
  }

  if (!result) return null

  const delta = result.claimed_coverage - result.verified_coverage
  const co2Delta = result.claimed_co2e - result.verified_co2e
  const maxBinCount = Math.max(...result.prob_distribution.map(b => b.count))
  const mapCenter: [number, number] = result.pixel_samples.length > 0
    ? [
        result.pixel_samples.reduce((s, p) => s + p.lat, 0) / result.pixel_samples.length,
        result.pixel_samples.reduce((s, p) => s + p.lng, 0) / result.pixel_samples.length,
      ]
    : [result.coordinates.lat, result.coordinates.lng]

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="font-mono text-xs text-zinc-400 uppercase tracking-widest mb-1">
            Verification Report
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {result.project_name}
          </h1>
          <p className="text-sm text-zinc-500 font-mono mt-1">{result.project_id}</p>
        </div>
        <Badge variant={result.verdict} className="text-sm px-3 py-1 mt-1">
          {result.verdict_label}
        </Badge>
      </div>

      <Separator className="mb-8" />

      {/* Two column: metadata + map */}
      <div className="grid grid-cols-2 gap-10 mb-10">
        <div>
          <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-3">
            Project Metadata
          </div>
          <table className="w-full text-xs font-mono border-collapse">
            <tbody>
              {[
                ["Registry", result.registry],
                ["Location", result.location],
                ["Area", `${result.area_ha.toLocaleString()} ha`],
                ["Methodology", result.methodology],
                ["Claimed Coverage", `${result.claimed_coverage}%`],
                ["Claimed CO₂e/yr", `${result.claimed_co2e.toLocaleString()} tCO₂e`],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-zinc-100">
                  <td className="py-1.5 text-zinc-400 pr-4 whitespace-nowrap">{k}</td>
                  <td className="py-1.5 text-zinc-800">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-3">
            Pixel Classification Map
            <span className="ml-3 normal-case">
              <span className="inline-block w-2 h-2 bg-emerald-500 mr-1" />tree
              <span className="inline-block w-2 h-2 bg-red-400 ml-3 mr-1" />non-tree
            </span>
          </div>
          <div className="border border-zinc-200" style={{ height: 230 }}>
            <MapContainer
              center={mapCenter}
              zoom={10}
              style={{ height: "100%", width: "100%" }}
              zoomControl={false}
              attributionControl={false}
            >
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
              {result.pixel_samples.map((px, i) => (
                <CircleMarker
                  key={i}
                  center={[px.lat, px.lng]}
                  radius={4}
                  pathOptions={{
                    color: px.label === 1 ? "#10b981" : "#f87171",
                    fillColor: px.label === 1 ? "#10b981" : "#f87171",
                    fillOpacity: 0.75,
                    weight: 0,
                  }}
                >
                  <Tooltip>
                    <span className="font-mono text-xs">
                      {px.label === 1 ? "tree" : "non-tree"} · p={px.prob.toFixed(2)}
                    </span>
                  </Tooltip>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
          <p className="text-xs text-zinc-400 font-mono mt-1">
            {result.pixel_samples.length} sampled pixels · Esri World Imagery
          </p>
        </div>
      </div>

      <Separator className="mb-8" />

      {/* Key stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {[
          { label: "Verified Coverage", value: `${result.verified_coverage}%`, sub: `claimed ${result.claimed_coverage}%`, highlight: true },
          { label: "Counterfactual Baseline", value: `${result.counterfactual_coverage}%`, sub: "without intervention", highlight: false },
          { label: "True Additionality", value: `${result.additionality_verified}%`, sub: `claimed ${result.additionality_claimed}%`, highlight: true },
        ].map(item => (
          <div key={item.label} className="border border-zinc-200 p-4">
            <div className="text-xs font-mono text-zinc-400 mb-1">{item.label}</div>
            <div className={`text-2xl font-mono font-semibold ${item.highlight ? "text-zinc-900" : "text-zinc-500"}`}>
              {item.value}
            </div>
            <div className="text-xs font-mono text-zinc-400 mt-1">{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Results table */}
      <div className="mb-10">
        <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-3">
          Verification Results
        </div>
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-zinc-200">
              {["Metric", "Claimed", "Verified", "Delta", "Status"].map(h => (
                <th key={h} className="text-left py-2 text-zinc-400 font-normal pr-6">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-zinc-100">
              <td className="py-2 text-zinc-700 pr-6">Tree Coverage</td>
              <td className="py-2 pr-6">{result.claimed_coverage}%</td>
              <td className="py-2 pr-6">{result.verified_coverage}%</td>
              <td className="py-2 pr-6 text-red-600">−{delta.toFixed(1)}%</td>
              <td className="py-2"><Badge variant={result.verdict}>{result.verdict_label}</Badge></td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2 text-zinc-700 pr-6">CO₂e Credits/yr</td>
              <td className="py-2 pr-6">{result.claimed_co2e.toLocaleString()} t</td>
              <td className="py-2 pr-6">{result.verified_co2e.toLocaleString()} t</td>
              <td className="py-2 pr-6 text-red-600">−{co2Delta.toLocaleString()} t</td>
              <td className="py-2"><Badge variant={result.verdict}>{result.verdict_label}</Badge></td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2 text-zinc-700 pr-6">Pixels Classified</td>
              <td className="py-2 pr-6">—</td>
              <td className="py-2 pr-6">{result.total_pixels.toLocaleString()}</td>
              <td className="py-2 pr-6 text-zinc-400">
                tree {result.tree_pixels} · non-tree {result.non_tree_pixels}
              </td>
              <td className="py-2"><Badge variant="neutral">XGBoost</Badge></td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2 text-zinc-700 pr-6">Mean Confidence</td>
              <td className="py-2 pr-6">—</td>
              <td className="py-2 pr-6">{(result.confidence * 100).toFixed(1)}%</td>
              <td className="py-2 pr-6 text-zinc-400">AUC 0.9610</td>
              <td className="py-2"><Badge variant="neutral">Model</Badge></td>
            </tr>
          </tbody>
        </table>
      </div>

      <Separator className="mb-8" />

      {/* Two column: features + prob distribution */}
      <div className="grid grid-cols-2 gap-10 mb-10">
        <div>
          <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-4">
            Top Embedding Dimensions
          </div>
          <div className="space-y-2.5">
            {result.top_features.map(f => (
              <div key={f.name} className="flex items-center gap-3">
                <span className="font-mono text-xs text-zinc-500 w-8">{f.name}</span>
                <div className="flex-1 bg-zinc-100 h-1.5">
                  <div
                    className="bg-zinc-800 h-1.5"
                    style={{ width: `${(f.importance / result.top_features[0].importance) * 100}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-zinc-400 w-14 text-right">
                  {f.importance.toFixed(4)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-4">
            Prediction Probability Distribution
          </div>
          <div className="flex items-end gap-1 h-20">
            {result.prob_distribution.map((b) => (
              <div key={b.bin} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className="w-full bg-zinc-800"
                  style={{ height: `${Math.round((b.count / maxBinCount) * 72)}px` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="font-mono text-xs text-zinc-400">0.0</span>
            <span className="font-mono text-xs text-zinc-400">non-tree ← · → tree</span>
            <span className="font-mono text-xs text-zinc-400">1.0</span>
          </div>
          <p className="font-mono text-xs text-zinc-400 mt-2">
            {result.total_pixels} pixels · bimodal = well-separated classes
          </p>
        </div>
      </div>

      <Separator className="mb-8" />

      {/* Finding */}
      <div className="border border-zinc-200 p-5 mb-8">
        <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-2">
          Automated Finding
        </div>
        <p className="text-sm text-zinc-700 leading-relaxed">
          Satellite pixel classification across {result.total_pixels} AlphaEarth embeddings indicates{" "}
          <strong>{result.verified_coverage}%</strong> actual tree coverage against the project's
          registered claim of <strong>{result.claimed_coverage}%</strong>. Applying a causal
          counterfactual baseline of {result.counterfactual_coverage}% (pixels below median confidence,
          representing pre-intervention vegetation density), verified additionality is{" "}
          <strong>{result.additionality_verified}%</strong> —{" "}
          {((result.additionality_claimed - result.additionality_verified) / Math.max(result.additionality_claimed, 0.01) * 100).toFixed(0)}% below
          the claimed {result.additionality_claimed}%. Estimated verifiable credits:{" "}
          <strong>{result.verified_co2e.toLocaleString()} tCO₂e/yr</strong>, a shortfall of{" "}
          {co2Delta.toLocaleString()} tCO₂e against issued credits.
        </p>
      </div>

      <div className="flex gap-3">
        <Button onClick={() => navigate("/verify")}>Verify Another Project</Button>
        <Button variant="outline" onClick={() => navigate("/")}>Home</Button>
      </div>
    </div>
  )
}
