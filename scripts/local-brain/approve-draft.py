import argparse
import datetime
import json
import sys
from pathlib import Path


ROOT = Path.cwd()


class PipelineError(Exception):
    pass


def parse_args():
    parser = argparse.ArgumentParser(description="Mark a reviewed Local Brain draft as approved for publishing.")
    parser.add_argument("--slug", required=True, help="Draft slug")
    return parser.parse_args()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    args = parse_args()
    slug = args.slug.strip()
    audit_path = ROOT / "local-brain" / "audits" / f"{slug}.audit.json"
    if not audit_path.exists():
        raise PipelineError("Audit not found: %s" % audit_path)

    audit = load_json(audit_path)
    if not bool(audit.get("review_passed")):
        findings = audit.get("review_findings", [])
        if isinstance(findings, list) and findings:
            raise PipelineError("Cannot approve draft before AI review passes: %s" % ", ".join(str(item) for item in findings))
        raise PipelineError("Cannot approve draft before AI review passes.")

    audit["approved"] = True
    audit["approved_at"] = datetime.datetime.utcnow().isoformat() + "Z"
    audit["approval_source"] = "local-brain-manual-approve"
    audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print("Local Brain approval completed:")
    print("  slug: %s" % slug)
    print("  audit: %s" % audit_path)


if __name__ == "__main__":
    try:
        main()
    except PipelineError as exc:
        print("Approval blocked:")
        print(exc)
        sys.exit(1)
