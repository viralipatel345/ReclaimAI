#!/usr/bin/env bash
# End-to-end demo of the incident verification API against a running dev server
# (DEMO_MODE=true). Usage: scripts/demo-incident.sh [path/to/image]
# With no image argument, a synthetic JPEG carrying an Adobe Firefly C2PA manifest is used.
set -euo pipefail
B=${BASE_URL:-http://localhost:3000}/api/incident
TMP=$(mktemp -d)
IMG=${1:-}
if [ -z "$IMG" ]; then
  IMG=$TMP/firefly-sample.jpg
  node -e 'const b=Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xeb]),Buffer.from("JP\x00\x01jumbjumdc2pa\x00\x00claim_generator\x71Adobe Firefly 2.0 c2pa.actions c2pa.created digitalSourceType trainedAlgorithmicMedia CN=Adobe Inc","latin1"),Buffer.from([0xff,0xd9])]);require("fs").writeFileSync(process.argv[1],b)' "$IMG"
fi
MIME=$(file --mime-type -b "$IMG" 2>/dev/null || echo image/jpeg)
[ "$MIME" = "application/octet-stream" ] && MIME=image/jpeg

j() { node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));$1"; }
step() { printf '\n\033[1;36m== %s\033[0m\n' "$1"; }

step "1. Sign-in + human check passed (demo mode) → create manual report (Branch A)"
R=$(curl -s -X POST "$B/report" -H 'Content-Type: application/json' \
  -d '{"title":"Someone posted my photos","notes":"My ex keeps posting them and says he wants money. I am scared and can'"'"'t sleep."}')
echo "$R" | j 'console.log(" case:",j.case.id,"| status:",j.case.status,"|",j.case.events[0].text)'
ID=$(echo "$R" | j 'process.stdout.write(j.case.id)')

step "2. Upload evidence → SynthID + C2PA provenance scan"
curl -s -X POST "$B/scan" -F "caseId=$ID" -F "files=@$IMG;type=$MIME" | j '
  for (const v of j.results) {
    console.log(" verdict:", v.verdict.toUpperCase());
    console.log(" synthid:", v.synthId.source==="stub" ? "detector not configured (stub)" : `${v.synthId.isGoogleAiGenerated} @ ${v.synthId.synthIdConfidence}`);
    console.log(" c2pa:   ", v.c2pa.present ? `issuer=${v.c2pa.c2paIssuer} generator="${v.c2pa.claimGenerator}" aiGenerated=${v.c2pa.aiGenerated}` : "no manifest");
    console.log(" summary:", v.summary);
  }'

step "3. Gemini orchestration → agent suggestions"
curl -s -X POST "$B/analyze" -H 'Content-Type: application/json' -d "{\"caseId\":\"$ID\"}" | j '
  const s=j.suggestions;
  console.log(" source:", s.source, s.model?`(${s.model})`:"", "| risk:", s.riskLevel.toUpperCase(), "| context rounds:", s.iterations);
  console.log(" summary:", s.summary);
  console.log(" ai:     ", s.aiGenerationAssessment);
  for (const a of s.actions) { console.log(`  [${a.priority}] ${a.type} — ${a.title}`); console.log(`           ${a.rationale}`); if (a.payload?.dispatchSummary) console.log("           "+a.payload.dispatchSummary.replace(/\n/g,"\n           ")); if (a.payload?.smsText) console.log(`           SMS: "${a.payload.smsText}"`); if (a.payload?.helplineNumber) console.log(`           call ${a.payload.helplineNumber}`); }'

step "4. Escalate → Parasell REST API"
curl -s -X POST "$B/parasell" -H 'Content-Type: application/json' -d "{\"caseId\":\"$ID\"}" | j '
  console.log(" escalation:", j.escalation.status, "| ref:", j.escalation.externalId ?? "-", "| case status:", j.case.status);
  console.log(" payload → provenance:", JSON.stringify(j.escalation.requestPayload.provenance).slice(0,140)+"…")'

step "5. Replace with original → sealed primary record"
curl -s -X POST "$B/seal" -H 'Content-Type: application/json' -d "{\"draftId\":\"$ID\"}" | j '
  console.log(" status:", j.case.status, "| draft:", j.case.isDraft, "| recordHash:", j.recordHash)'

step "6. Reports + Status tab"
curl -s "$B/status" | j 'for (const c of j.cases) console.log(` - ${c.id}  ${c.branch.padEnd(8)} ${c.status.padEnd(9)} risk=${c.riskLevel}  parasell=${c.escalation}  | ${c.latest.text}`)'
echo
echo "Live feed: curl -N -H 'Accept: text/event-stream' $B/status?stream=1"
rm -rf "$TMP"
