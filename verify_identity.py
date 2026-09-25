"""
Identity verification for Reclaim takedown requests.

Usage:
    python verify_identity.py --image <path_to_id_image> --name "First Last"

What it does:
    1. Sends the ID document image to Google Cloud Document AI (ID_PROOFING_PROCESSOR)
    2. Extracts the name printed on the ID from raw OCR text
    3. Checks fraud signals returned by the processor
    4. Compares the extracted name against the claimed name
    5. Returns PASS / FAIL with a reason

Supported documents: passports, US driver's licenses, residency cards.
"""

import argparse
import base64
import json
import re
import sys
import unicodedata
import urllib.error
import urllib.request
import subprocess


PROCESSOR_ENDPOINT = (
    "https://us-documentai.googleapis.com/v1/projects/376592949990"
    "/locations/us/processors/67f11544406fec10:process"
)


def get_access_token() -> str:
    result = subprocess.run(
        ["gcloud", "auth", "print-access-token"],
        capture_output=True, text=True, check=True
    )
    return result.stdout.strip()


def encode_image(path: str) -> tuple[str, str]:
    with open(path, "rb") as f:
        data = f.read()
    mime = "image/jpeg"
    if path.lower().endswith(".png"):
        mime = "image/png"
    elif path.lower().endswith(".pdf"):
        mime = "application/pdf"
    return base64.b64encode(data).decode("utf-8"), mime


def call_document_ai(image_path: str) -> dict:
    token = get_access_token()
    content, mime_type = encode_image(image_path)
    payload = json.dumps({
        "rawDocument": {"content": content, "mimeType": mime_type}
    }).encode("utf-8")
    req = urllib.request.Request(
        PROCESSOR_ENDPOINT,
        data=payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^a-z0-9 ]", " ", text.lower())  # replace non-alphanum with space, not empty
    return " ".join(text.split())


def extract_name_from_text(text: str) -> str:
    """
    US driver's licenses use 'FN <given>' and 'LN <family>' labels.
    Passports use 'SURNAME' / 'GIVEN NAMES' labels.
    """
    # Use [A-Z ]+ (space only, not \s) to stay on one line
    fn_match = re.search(r"\bFN\s+([A-Z][A-Z ]+)", text)
    ln_match = re.search(r"\bLN\s+([A-Z][A-Z ]+)", text)
    if fn_match and ln_match:
        return f"{fn_match.group(1).strip()} {ln_match.group(1).strip()}"

    surname = re.search(r"SURNAME[: ]+([A-Z]+)", text)
    given   = re.search(r"GIVEN\s+NAMES?[: ]+([A-Z ]+)", text)
    if surname and given:
        return f"{given.group(1).strip()} {surname.group(1).strip()}"

    return ""


def check_fraud_signals(entities: list) -> list[str]:
    """Return signal names where the processor returned FAIL."""
    return [
        e["type"].replace("fraud_signals_", "").replace("_", " ")
        for e in entities
        if e.get("type", "").startswith("fraud_signals_") and e.get("mentionText") == "FAIL"
    ]


def verify(image_path: str, claimed_name: str) -> dict:
    print("  Sending document to Document AI...")
    response = call_document_ai(image_path)

    doc = response.get("document", {})
    entities = doc.get("entities", [])
    text = doc.get("text", "")

    fraud_flags = check_fraud_signals(entities)
    extracted_name = extract_name_from_text(text)

    claimed_tokens = set(normalize(claimed_name).split())
    extracted_tokens = set(normalize(extracted_name).split())
    overlap = claimed_tokens & extracted_tokens
    match_score = len(overlap) / max(len(claimed_tokens), 1)
    name_match = match_score >= 0.75

    result = {
        "claimed_name": claimed_name,
        "extracted_name": extracted_name or "(not found)",
        "fraud_flags": fraud_flags,
        "match_score": round(match_score, 2),
        "verdict": None,
        "reason": None,
    }

    if fraud_flags:
        result["verdict"] = "FAIL"
        result["reason"] = f"Document fraud signals detected: {'; '.join(fraud_flags)}"
    elif not extracted_name:
        result["verdict"] = "FAIL"
        result["reason"] = "Could not read a name from the document. Try a clearer photo."
    elif not name_match:
        result["verdict"] = "FAIL"
        result["reason"] = (
            f"Name on ID ('{extracted_name}') doesn't match claimed name ('{claimed_name}') "
            f"— {match_score:.0%} overlap."
        )
    else:
        result["verdict"] = "PASS"
        result["reason"] = (
            f"Identity verified — '{extracted_name}' matches '{claimed_name}' "
            f"with {match_score:.0%} confidence. No fraud signals."
        )

    return result


def main():
    parser = argparse.ArgumentParser(description="Verify ID document against claimed name.")
    parser.add_argument("--image", required=True, help="Path to ID image (jpg/png/pdf)")
    parser.add_argument("--name",  required=True, help='Claimed full name e.g. "Virali Patel"')
    args = parser.parse_args()

    print(f"\nVerifying identity...")
    print(f"  Claimed name : {args.name}")
    print(f"  Document     : {args.image}\n")

    try:
        result = verify(args.image, args.name)
    except urllib.error.HTTPError as e:
        print(f"Document AI error: {e.code} {e.reason}")
        print(e.read().decode())
        sys.exit(1)
    except FileNotFoundError:
        print(f"File not found: {args.image}")
        sys.exit(1)

    print("=" * 55)
    print(f"  VERDICT      : {result['verdict']}")
    print(f"  Reason       : {result['reason']}")
    print("-" * 55)
    print(f"  Name on ID   : {result['extracted_name']}")
    print(f"  Match score  : {result['match_score']:.0%}")
    if result["fraud_flags"]:
        print(f"  Fraud flags  : {', '.join(result['fraud_flags'])}")
    print("=" * 55)

    sys.exit(0 if result["verdict"] == "PASS" else 1)


if __name__ == "__main__":
    main()
