import { runDiscovery } from "../lib/discover";
(async () => {
  const r = await runDiscovery(["Singapore · practitioners using AI"], { maxCandidates: 14 });
  console.log(`Singapore -> ${r.candidates.length} accepted`);
  for (const c of r.candidates.slice(0, 5)) {
    console.log(`   @${c.author} ${c.solubilityScore}/${c.expectedBenefitScore} — ${c.selfBuiltSolution.slice(0,66)}`);
  }
})().catch((e) => console.error("FAILED:", e.message));
