import argparse
import importlib.util
import json
import os
import ssl
import socket
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict


ROOT = Path.cwd()
GENERATOR_PATH = ROOT / "scripts" / "local-brain" / "generate-insight.py"


def load_generator_module():
    spec = importlib.util.spec_from_file_location("local_brain_generate_insight", GENERATOR_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load generate-insight.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


generator = load_generator_module()
PipelineError = generator.PipelineError


def read_prompt_file(file_name: str, fallback: str) -> str:
    path = ROOT / "local-brain" / "prompts" / file_name
    if not path.exists():
        return fallback
    text = path.read_text(encoding="utf-8").strip()
    return text or fallback


class RoleAwareClient:
    def __init__(self, role: str) -> None:
        generator.load_env_file(Path(".env.local"))
        generator.load_env_file(Path(".env"))
        config = generator.load_local_brain_config(Path("local-brain/config.json"))
        role_config = config.get(role) if isinstance(config.get(role), dict) else {}
        merged = {}
        if isinstance(config, dict):
            merged.update(config)
        if isinstance(role_config, dict):
            merged.update(role_config)

        provider = str(merged.get("provider") or os.environ.get("LOCAL_BRAIN_PROVIDER") or "openai").lower()
        defaults = {
            "openai": {
                "base_url": "https://api.openai.com/v1",
                "model": "gpt-4o-mini",
                "api_key_env": "OPENAI_API_KEY",
            },
            "claude": {
                "base_url": "https://api.anthropic.com/v1",
                "model": "claude-sonnet-4-5-20250929",
                "api_key_env": "ANTHROPIC_API_KEY",
            },
            "gemini": {
                "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
                "model": "gemini-2.5-flash",
                "api_key_env": "GEMINI_API_KEY",
            },
            "deepseek": {
                "base_url": "https://api.deepseek.com",
                "model": "deepseek-chat",
                "api_key_env": "DEEPSEEK_API_KEY",
            },
        }
        if provider not in defaults:
            provider = "openai"
        provider_default = defaults[provider]
        self.provider = provider
        self.base_url = str(
            merged.get("base_url")
            or os.environ.get("LOCAL_BRAIN_BASE_URL")
            or provider_default["base_url"]
        ).rstrip("/")
        self.model = str(
            merged.get("model")
            or os.environ.get("LOCAL_BRAIN_MODEL")
            or provider_default["model"]
        ).strip()
        self.api_key = str(
            merged.get("api_key")
            or os.environ.get("LOCAL_BRAIN_API_KEY")
            or os.environ.get(provider_default["api_key_env"])
            or ""
        ).strip()

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    def chat_json(self, system_prompt: str, user_prompt: str, temperature: float = 0.0) -> Dict[str, Any]:
        if not self.available:
            raise PipelineError("Reviewer model is not configured. Save Model B API settings before running AI review.")

        if self.provider == "claude":
            return self._chat_claude(system_prompt, user_prompt)
        return self._chat_openai_compatible(system_prompt, user_prompt, temperature)

    def _chat_openai_compatible(self, system_prompt: str, user_prompt: str, temperature: float) -> Dict[str, Any]:
        payload = {
            "model": self.model,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
        }
        request = urllib.request.Request(
            self.base_url.rstrip("/") + "/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": "Bearer " + self.api_key,
                "Content-Type": "application/json",
            },
            method="POST",
        )
        raw = self._perform_request(request)
        response_data = json.loads(raw)
        content = response_data["choices"][0]["message"]["content"]
        return generator.parse_json_object(content)

    def _chat_claude(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        payload = {
            "model": self.model,
            "max_tokens": 256,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        }
        request = urllib.request.Request(
            self.base_url.rstrip("/") + "/messages",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        raw = self._perform_request(request)
        response_data = json.loads(raw)
        content_items = response_data.get("content", [])
        text = ""
        if isinstance(content_items, list):
            for item in content_items:
                if isinstance(item, dict) and item.get("type") == "text":
                    text += str(item.get("text") or "")
        return generator.parse_json_object(text)

    def _perform_request(self, request: urllib.request.Request) -> str:
        transient_errors = []
        for attempt in range(1, 4):
            try:
                with urllib.request.urlopen(request, timeout=120) as response:
                    return response.read().decode("utf-8")
            except urllib.error.HTTPError as exc:
                body = exc.read().decode("utf-8", errors="replace")
                raise PipelineError("LLM request failed: HTTP %s %s" % (exc.code, body[:800]))
            except (TimeoutError, socket.timeout, ssl.SSLError, urllib.error.URLError, ConnectionResetError, OSError) as exc:
                reason = getattr(exc, "reason", exc)
                transient_errors.append(str(reason))
                if attempt >= 3:
                    raise PipelineError(
                        "LLM network request failed after 3 attempts. Check API Base URL, proxy/VPN, and provider endpoint. Details: %s"
                        % " | ".join(transient_errors[-3:])
                    )
                time.sleep(1.5 * attempt)
        raise PipelineError("LLM request failed without response.")


def parse_args():
    parser = argparse.ArgumentParser(description="Run Local Brain reviewer on an existing draft without rewriting it.")
    parser.add_argument("--slug", required=True, help="Draft slug, for example amazon-poa-root-cause-corrective-actions")
    return parser.parse_args()


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    args = parse_args()
    slug = args.slug.strip()
    draft_path = ROOT / "local-brain" / "drafts" / f"{slug}.json"
    audit_path = ROOT / "local-brain" / "audits" / f"{slug}.audit.json"
    rules_dir = ROOT / "local-brain" / "rules"

    if not draft_path.exists():
        raise PipelineError("Draft not found: %s" % draft_path)

    article = load_json(draft_path)
    profiles = load_json(rules_dir / "category-profiles.json")
    forbidden_terms = load_json(rules_dir / "forbidden-terms.json")
    existing_audit = load_json(audit_path) if audit_path.exists() else {}
    seed = str(existing_audit.get("seed") or article.get("zhTitle") or article.get("title") or slug).strip()
    profile_key, profile = generator.select_profile(seed, profiles, str(article.get("category") or ""))
    strict_terms = list(profile.get("strict_terms", []))
    strict_terms.extend(profile.get("forbidden_terms", []))
    strict_terms.extend(forbidden_terms.get("global_forbidden_terms", []))
    strict_terms.extend(forbidden_terms.get(profile_key, []))
    strict_terms = sorted({str(term).strip() for term in strict_terms if str(term).strip()})

    state: Dict[str, Any] = {
        "seed": seed,
        "article": article,
        "profile_key": profile_key,
        "profile": profile,
        "strict_terms": strict_terms,
        "redline_terms": article.get("redlineTerms", []) if isinstance(article.get("redlineTerms"), list) else [],
        "review_feedback": "",
        "review_passed": False,
        "review_findings": [],
        "revision_count": int(existing_audit.get("revision_count", 0)),
        "blocked": False,
        "trace": existing_audit.get("trace", []) if isinstance(existing_audit.get("trace"), list) else [],
        "use_llm": True,
        "llm": RoleAwareClient("modelB"),
    }

    generator.emit_progress(seed, "Pipeline", "running", "review_only_started", {"slug": slug})
    result = generator.reviewer_agent(state)
    state.update(result)

    audit_payload = {
        "seed": seed,
        "runtime": existing_audit.get("runtime", "review-only"),
        "llm_enabled": True,
        "llm_provider": state["llm"].provider,
        "llm_model": state["llm"].model,
        "profile": profile_key,
        "review_passed": state.get("review_passed"),
        "review_findings": state.get("review_findings", []),
        "review_feedback": state.get("review_feedback", ""),
        "revision_count": state.get("revision_count", 0),
        "source_snippets": existing_audit.get("source_snippets", []),
        "review_snippets": existing_audit.get("review_snippets", []),
        "draft": str(draft_path),
        "trace": state.get("trace", []),
        "review_only": True,
    }
    audit_path.write_text(json.dumps(audit_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    generator.emit_progress(seed, "Pipeline", "completed", "review_only_completed", {"slug": slug, "audit": str(audit_path)})

    print("Local Brain review completed:")
    print("  slug: %s" % slug)
    print("  review_passed: %s" % state.get("review_passed"))
    print("  findings: %s" % len(state.get("review_findings", [])))
    print("  audit: %s" % audit_path)


if __name__ == "__main__":
    try:
        main()
    except PipelineError as exc:
        print("Review blocked:")
        print(exc)
        sys.exit(1)
