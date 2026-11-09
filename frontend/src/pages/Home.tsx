import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-2 font-mono text-xs text-zinc-400 uppercase tracking-widest">
        Open Verification Platform · v0.1
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-3">
        Carbon Credit Integrity Check
      </h1>
      <p className="text-zinc-500 text-sm leading-relaxed max-w-xl mb-8">
        Upload AlphaEarth pixel embeddings for a registered forest carbon project.
        Our XGBoost classifier estimates actual tree coverage and compares it to
        the project's claimed additionality using causal counterfactuals.
      </p>

      <div className="flex gap-3 mb-12">
        <Button onClick={() => navigate("/verify")}>Verify a Project</Button>
        <Button variant="outline" onClick={() => navigate("/results?demo=true")}>
          Demo — VCS-4541 Sundarbans
        </Button>
      </div>

      <Separator className="mb-10" />

      <div className="grid grid-cols-3 gap-8 mb-12">
        {[
          { step: "01", label: "Upload Embeddings", desc: "Provide a CSV of AlphaEarth 64-dim pixel embeddings for the project polygon." },
          { step: "02", label: "Classify Pixels", desc: "XGBoost model (trained on Western Ghats + Mangrove data) predicts tree vs. non-tree per pixel." },
          { step: "03", label: "Verify Additionality", desc: "Counterfactual baseline from control region estimates what would have occurred without intervention." },
        ].map((item) => (
          <div key={item.step}>
            <div className="font-mono text-xs text-zinc-400 mb-1">{item.step}</div>
            <div className="text-sm font-medium text-zinc-800 mb-1">{item.label}</div>
            <div className="text-xs text-zinc-500 leading-relaxed">{item.desc}</div>
          </div>
        ))}
      </div>

      <Separator className="mb-10" />

      <div className="mb-6">
        <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-4">Model Performance</div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="text-left py-2 font-mono text-xs text-zinc-500 font-normal">Metric</th>
              <th className="text-left py-2 font-mono text-xs text-zinc-500 font-normal">Value</th>
              <th className="text-left py-2 font-mono text-xs text-zinc-500 font-normal">Notes</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {[
              ["ROC-AUC (test)", "0.9610", "held-out 20% split"],
              ["5-fold CV AUC", "0.9651 ± 0.0096", "stratified k-fold"],
              ["Accuracy", "89.0%", "balanced classes"],
              ["Training samples", "2,000", "Western Ghats + Mangroves"],
              ["Features", "64", "AlphaEarth embedding dims"],
            ].map(([metric, value, notes]) => (
              <tr key={metric} className="border-b border-zinc-100">
                <td className="py-2 text-zinc-700">{metric}</td>
                <td className="py-2 text-zinc-900 font-semibold">{value}</td>
                <td className="py-2 text-zinc-400">{notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
