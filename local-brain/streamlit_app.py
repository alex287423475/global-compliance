import json
import os
import queue
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

import streamlit as st


REPO_ROOT = Path(__file__).resolve().parents[1]
DRAFT_DIR = REPO_ROOT / "local-brain" / "drafts"
AUDIT_DIR = REPO_ROOT / "local-brain" / "audits"
KNOWLEDGE_DIR = REPO_ROOT / "local-brain" / "knowledge"
REVIEWS_DIR = REPO_ROOT / "local-brain" / "reviews"
TMP_DIR = REPO_ROOT / "local-brain" / "tmp"
CONFIG_PATH = REPO_ROOT / "local-brain" / "config.json"
SEEDS_FILE = REPO_ROOT / "local-brain" / "seeds.txt"
EXAMPLE_SEEDS_FILE = REPO_ROOT / "local-brain" / "seeds.example.txt"
PYTHON_EXE = sys.executable
PROGRESS_PREFIX = "[LOCAL_BRAIN_PROGRESS] "


st.set_page_config(page_title="Local Brain 控制台", page_icon="LB", layout="wide")


def rel(path):
    return str(Path(path).resolve().relative_to(REPO_ROOT)).replace("\\", "/")


def load_env_file(path):
    if not path.exists():
        return {}
    values = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def local_brain_env():
    values = {}
    values.update(load_env_file(REPO_ROOT / ".env"))
    values.update(load_env_file(REPO_ROOT / ".env.local"))
    values.update(os.environ)
    return values


PROVIDER_DEFAULTS = {
    "openai": {
        "label": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-4o-mini",
    },
    "claude": {
        "label": "Claude",
        "base_url": "https://api.anthropic.com/v1/",
        "model": "claude-sonnet-4-5-20250929",
    },
    "gemini": {
        "label": "Gemini",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "model": "gemini-2.5-flash",
    },
    "deepseek": {
        "label": "DeepSeek",
        "base_url": "https://api.deepseek.com",
        "model": "deepseek-chat",
    },
}


def load_llm_config():
    if CONFIG_PATH.exists():
        try:
            data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = {}
    else:
        data = {}

    provider = str(data.get("provider") or "openai").lower()
    if provider not in PROVIDER_DEFAULTS:
        provider = "openai"
    defaults = PROVIDER_DEFAULTS[provider]
    return {
        "provider": provider,
        "base_url": data.get("base_url") or defaults["base_url"],
        "model": data.get("model") or defaults["model"],
        "api_key": data.get("api_key") or "",
    }


def save_llm_config(config):
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def effective_llm_config():
    config = load_llm_config()
    env_values = local_brain_env()
    provider = config.get("provider") or env_values.get("LOCAL_BRAIN_PROVIDER") or "openai"
    provider = provider.lower()
    if provider not in PROVIDER_DEFAULTS:
        provider = "openai"
    defaults = PROVIDER_DEFAULTS[provider]
    return {
        "provider": provider,
        "base_url": config.get("base_url") or env_values.get("LOCAL_BRAIN_BASE_URL") or defaults["base_url"],
        "model": config.get("model") or env_values.get("LOCAL_BRAIN_MODEL") or defaults["model"],
        "api_key": config.get("api_key") or env_values.get("LOCAL_BRAIN_API_KEY") or "",
    }


def masked(value):
    if not value:
        return "NOT CONFIGURED"
    if len(value) <= 8:
        return "*" * len(value)
    return value[:4] + "..." + value[-4:]


def run_command(args, timeout=180):
    completed = subprocess.run(
        args,
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        shell=False,
    )
    output = "\n".join(part for part in [completed.stdout, completed.stderr] if part)
    return completed.returncode, output.strip()


def render_workflow_progress(events, output_lines, progress_box, log_box):
    agent_order = ["Pipeline", "Researcher Agent", "Writer Agent", "Reviewer Agent", "Fail-Safe"]
    labels = {
        "Pipeline": "Pipeline",
        "Researcher Agent": "Researcher",
        "Writer Agent": "Writer",
        "Reviewer Agent": "Reviewer",
        "Fail-Safe": "Fail-Safe",
    }
    icons = {
        "pending": "[ ]",
        "running": "[RUNNING]",
        "completed": "[DONE]",
        "rejected": "[REWRITE]",
        "blocked": "[BLOCKED]",
        "failed": "[FAILED]",
    }
    states = {
        agent: {"status": "pending", "message": "等待", "time": "", "seed": ""}
        for agent in agent_order
    }
    for event in events:
        agent = event.get("agent")
        if agent in states:
            states[agent] = {
                "status": event.get("status", "running"),
                "message": event.get("message", ""),
                "time": event.get("time", ""),
                "seed": event.get("seed", ""),
            }

    rows = []
    for index, agent in enumerate(agent_order, start=1):
        state = states[agent]
        status = state["status"]
        rows.append(
            {
                "Step": "%02d" % index,
                "Agent": labels[agent],
                "Status": icons.get(status, status),
                "Message": state["message"],
                "Time": state["time"],
                "Article": state["seed"],
            }
        )
    progress_box.dataframe(rows, use_container_width=True, hide_index=True)
    if output_lines:
        log_box.code("\n".join(output_lines[-18:]), language="text")


def run_command_stream(args, timeout=600):
    env = os.environ.copy()
    env["LOCAL_BRAIN_PROGRESS"] = "1"
    env["PYTHONUNBUFFERED"] = "1"
    output_lines = []
    events = []
    progress_box = st.empty()
    log_box = st.empty()
    render_workflow_progress(events, output_lines, progress_box, log_box)

    process = subprocess.Popen(
        args,
        cwd=str(REPO_ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
        shell=False,
        env=env,
    )
    line_queue = queue.Queue()

    def read_output():
        assert process.stdout is not None
        for raw_line in iter(process.stdout.readline, ""):
            line_queue.put(raw_line)
        process.stdout.close()

    reader = threading.Thread(target=read_output, daemon=True)
    reader.start()
    start = time.monotonic()

    while True:
        timed_out = time.monotonic() - start > timeout
        if timed_out and process.poll() is None:
            process.kill()
            output_lines.append("Command timed out after %s seconds." % timeout)
            render_workflow_progress(events, output_lines, progress_box, log_box)
            return 124, "\n".join(output_lines).strip()

        try:
            line = line_queue.get(timeout=0.2).rstrip()
        except queue.Empty:
            if process.poll() is not None and line_queue.empty():
                break
            continue

        if not line:
            continue
        if line.startswith(PROGRESS_PREFIX):
            try:
                events.append(json.loads(line[len(PROGRESS_PREFIX) :]))
            except json.JSONDecodeError:
                output_lines.append(line)
        else:
            output_lines.append(line)
        render_workflow_progress(events, output_lines, progress_box, log_box)

    return_code = process.wait()
    render_workflow_progress(events, output_lines, progress_box, log_box)
    return return_code, "\n".join(output_lines).strip()


def test_llm_connection(config, timeout=30):
    api_key = (config.get("api_key") or "").strip()
    if not api_key:
        return False, "API Key 为空。请先填写并保存 API Key。"

    base_url = (config.get("base_url") or "").strip().rstrip("/")
    model = (config.get("model") or "").strip()
    if not base_url or not model:
        return False, "API Base URL 或模型为空。请先选择提供商，或点击恢复默认 URL / 模型。"

    payload = {
        "model": model,
        "temperature": 0,
        "max_tokens": 16,
        "messages": [
            {"role": "system", "content": "Reply with OK only."},
            {"role": "user", "content": "Connection test."},
        ],
    }
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        base_url + "/chat/completions",
        data=data,
        headers={
            "Authorization": "Bearer " + api_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response_data = json.loads(response.read().decode("utf-8"))
    except TimeoutError:
        return False, "请求超过 %s 秒未返回。请检查代理、Base URL 或模型服务是否可达。" % timeout
    except socket.timeout:
        return False, "请求超过 %s 秒未返回。请检查代理、Base URL 或模型服务是否可达。" % timeout
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return False, "HTTP %s: %s" % (exc.code, body[:800])
    except urllib.error.URLError as exc:
        return False, "网络连接失败：%s" % exc
    except Exception as exc:
        return False, "测试失败：%s" % exc

    content = (
        response_data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
        .strip()
    )
    return True, "API 连通成功。provider=%s, model=%s, response=%s" % (
        config.get("provider", "unknown"),
        model,
        content[:80] or "EMPTY",
    )


def list_drafts():
    DRAFT_DIR.mkdir(parents=True, exist_ok=True)
    return sorted(DRAFT_DIR.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True)


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def read_seed_text():
    if SEEDS_FILE.exists():
        return SEEDS_FILE.read_text(encoding="utf-8")
    if EXAMPLE_SEEDS_FILE.exists():
        return EXAMPLE_SEEDS_FILE.read_text(encoding="utf-8")
    return "智能宠物喂食器\nPayPal Stripe account review\nAmazon POA root cause"


def show_command_result(return_code, output, success_label):
    if return_code == 0:
        st.success(success_label)
    else:
        st.error("命令执行失败")
    if output:
        st.code(output, language="text")


def draft_label(path):
    try:
        article = read_json(path)
        return "%s / %s / %s" % (
            article.get("slug", path.stem),
            article.get("category", "Unknown"),
            article.get("riskLevel", "Unknown"),
        )
    except Exception:
        return path.name


def audit_for_article(article, fallback_path):
    slug = article.get("slug", fallback_path.stem)
    path = AUDIT_DIR / ("%s.audit.json" % slug)
    return path if path.exists() else None


def latest_audit_file():
    if not AUDIT_DIR.exists():
        return None
    candidates = list(AUDIT_DIR.glob("*.audit.json"))
    if not candidates:
        return None
    return sorted(candidates, key=lambda item: item.stat().st_mtime, reverse=True)[0]


def write_temp_notes(text):
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    path = TMP_DIR / "operator-notes.txt"
    path.write_text(text.strip(), encoding="utf-8")
    return path


def render_audit_trace(audit):
    trace = audit.get("trace", [])
    if not trace:
        st.info("暂无审计轨迹。")
        return
    for index, item in enumerate(trace, start=1):
        agent = item.get("agent", "Unknown")
        action = item.get("action", "")
        data = item.get("data", {})
        with st.container(border=True):
            st.markdown("**%02d · %s**" % (index, agent))
            st.write(action)
            if data:
                st.json(data)


st.title("Local Brain 合规文章自动化生产线")
st.caption("真实生产流程：本地 RAG / VOC -> Researcher -> Writer -> Reviewer -> Fail-Safe -> JSON 草稿")

llm_config = effective_llm_config()
llm_ready = bool(llm_config.get("api_key"))
provider_label = PROVIDER_DEFAULTS[llm_config["provider"]]["label"]
model_name = llm_config["model"]

with st.sidebar:
    st.header("运行环境")
    st.write("Python")
    st.code(PYTHON_EXE, language="text")
    st.write("LLM")
    st.code("%s / %s / %s" % ("READY" if llm_ready else "NOT CONFIGURED", provider_label, model_name), language="text")
    st.write("草稿目录")
    st.code(rel(DRAFT_DIR), language="text")

    st.header("生产线规则")
    st.markdown(
        "- 默认生成草稿，不自动上线。\n"
        "- Researcher 读取本地 RAG 与 VOC。\n"
        "- Writer 按红线与审稿意见重写。\n"
        "- Reviewer 拒绝后会打回 Writer。\n"
        "- 发布需要手动输入 `PUBLISH`。"
    )


tab_generate, tab_review, tab_validate, tab_publish, tab_config = st.tabs(
    ["1. 生产草稿", "2. 审阅草稿", "3. 校验", "4. 发布", "5. 配置"]
)


with tab_generate:
    st.subheader("启动多智能体生产")
    seed_mode = st.radio("生产模式", ["单个种子词", "批量种子词"], horizontal=True)
    if llm_ready:
        st.success("LLM 已配置。生产线将强制使用 Researcher / Writer / Reviewer 模型协作。")
    else:
        st.error("LLM 未配置。生产线已锁定，禁止无 LLM 干跑。请先到“5. 配置”填写并测试 API Key。")
    operator_notes = st.text_area(
        "补充资料 / 运营备注，可留空",
        value="",
        height=120,
        placeholder="例如：目标市场、竞品链接摘录、支付网关通知、差评关键词、必须避开的表达。",
    )

    if seed_mode == "单个种子词":
        seed = st.text_input("种子词", value="智能宠物喂食器")
        overwrite = st.checkbox("允许覆盖同名草稿", value=False)
        if st.button("运行 Researcher -> Writer -> Reviewer", type="primary", disabled=not llm_ready):
            if not seed.strip():
                st.warning("请先输入种子词。")
            else:
                args = [
                    PYTHON_EXE,
                    "scripts/local-brain/generate-insight.py",
                    "--seed",
                    seed.strip(),
                    "--source-dir",
                    "local-brain/knowledge",
                    "--reviews-dir",
                    "local-brain/reviews",
                ]
                if operator_notes.strip():
                    args.extend(["--notes-file", rel(write_temp_notes(operator_notes))])
                if overwrite:
                    args.append("--overwrite")
                code, output = run_command_stream(args, timeout=420)
                show_command_result(code, output, "生产线已完成，草稿已生成")
    else:
        seed_text = st.text_area("批量种子词，每行一个", value=read_seed_text(), height=220)
        overwrite_batch = st.checkbox("批量覆盖同名草稿", value=False)
        if st.button("批量运行生产线", type="primary", disabled=not llm_ready):
            SEEDS_FILE.write_text(seed_text.strip() + "\n", encoding="utf-8")
            args = [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                "scripts/run-local-brain.ps1",
            ]
            if overwrite_batch:
                args.append("-Overwrite")
            code, output = run_command_stream(args, timeout=900)
            show_command_result(code, output, "批量生产完成并通过导入校验")

    st.divider()
    st.subheader("最近一次审计")
    latest = latest_audit_file()
    if latest:
        audit = read_json(latest)
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Runtime", audit.get("runtime", "unknown"))
        col2.metric("LLM", "ON" if audit.get("llm_enabled") else "OFF")
        col3.metric("Revisions", audit.get("revision_count", 0))
        col4.metric("Review", "PASS" if audit.get("review_passed") else "REJECT")
        st.caption(rel(latest))
        render_audit_trace(audit)
    else:
        st.info("暂无审计记录。运行一次生产线后会显示。")


with tab_review:
    st.subheader("草稿审阅")
    drafts = list_drafts()
    if not drafts:
        st.info("还没有草稿。先到“生产草稿”运行一次。")
    else:
        selected = st.selectbox("选择草稿", drafts, format_func=draft_label)
        article = read_json(selected)
        left, right = st.columns([2, 1])
        with left:
            st.caption(article.get("category", "Unknown"))
            st.header(article.get("zhTitle") or article.get("title"))
            st.write(article.get("zhSummary") or article.get("summary"))
        with right:
            st.metric("Risk", article.get("riskLevel", "Unknown"))
            st.metric("Market", article.get("market", "Unknown"))
            st.metric("Sections", len(article.get("sections", [])))

        st.markdown("#### 红线词")
        st.write(" / ".join("`%s`" % term for term in article.get("redlineTerms", [])))
        st.markdown("#### 正文预览")
        for section in article.get("sections", []):
            st.markdown("##### %s" % (section.get("zhHeading") or section.get("heading")))
            st.write(section.get("zhBody") or section.get("body"))

        with st.expander("原始 JSON"):
            st.json(article)
        audit_path = audit_for_article(article, selected)
        if audit_path:
            with st.expander("多智能体审计日志"):
                render_audit_trace(read_json(audit_path))


with tab_validate:
    st.subheader("Fail-Safe 校验")
    st.write("只做导入干跑，不写入网站。")
    if st.button("校验全部草稿", type="primary"):
        code, output = run_command(["npm.cmd", "run", "brain:add-batch", "--", "--dry-run", "local-brain/drafts"], timeout=180)
        show_command_result(code, output, "全部草稿通过校验")
    rows = []
    for path in list_drafts():
        try:
            article = read_json(path)
            rows.append({"slug": article.get("slug"), "category": article.get("category"), "risk": article.get("riskLevel"), "market": article.get("market"), "updated": article.get("updatedAt"), "file": rel(path)})
        except Exception as exc:
            rows.append({"slug": path.stem, "category": "INVALID", "risk": str(exc), "market": "", "updated": "", "file": rel(path)})
    if rows:
        st.dataframe(rows, use_container_width=True, hide_index=True)


with tab_publish:
    st.subheader("发布到网站")
    st.warning("发布会导入草稿、构建网站、生成 git commit，并推送到 GitHub。Vercel 会随后自动部署。")
    confirm = st.text_input("输入 PUBLISH 解锁发布按钮")
    no_push = st.checkbox("只提交本地 commit，不推送 GitHub", value=False)
    if st.button("发布草稿", type="primary", disabled=confirm.strip() != "PUBLISH"):
        args = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/publish-insights.ps1"]
        if no_push:
            args.append("-NoPush")
        code, output = run_command(args, timeout=420)
        show_command_result(code, output, "发布流程完成")


with tab_config:
    st.subheader("本地知识库与差评资料")
    st.write("Researcher 会读取这些目录中的 `.md`、`.txt`、`.json`、`.csv` 文件。")
    st.code(rel(KNOWLEDGE_DIR), language="text")
    st.code(rel(REVIEWS_DIR), language="text")
    st.divider()
    st.subheader("LLM 提供商配置")
    st.caption("配置会保存到本地 local-brain/config.json，该文件已加入 .gitignore，不会提交到 GitHub。")

    current_config = load_llm_config()
    provider_options = list(PROVIDER_DEFAULTS.keys())

    def apply_provider_defaults():
        defaults = PROVIDER_DEFAULTS[st.session_state.llm_provider]
        st.session_state.llm_base_url = defaults["base_url"]
        st.session_state.llm_model = defaults["model"]

    if "llm_provider" not in st.session_state:
        st.session_state.llm_provider = current_config["provider"]
    if "llm_base_url" not in st.session_state:
        st.session_state.llm_base_url = current_config.get("base_url") or PROVIDER_DEFAULTS[current_config["provider"]]["base_url"]
    if "llm_model" not in st.session_state:
        st.session_state.llm_model = current_config.get("model") or PROVIDER_DEFAULTS[current_config["provider"]]["model"]
    if "llm_api_key" not in st.session_state:
        st.session_state.llm_api_key = current_config.get("api_key") or ""

    provider = st.selectbox(
        "提供商",
        provider_options,
        index=provider_options.index(st.session_state.llm_provider),
        format_func=lambda item: PROVIDER_DEFAULTS[item]["label"],
        key="llm_provider",
        on_change=apply_provider_defaults,
    )
    provider_defaults = PROVIDER_DEFAULTS[provider]
    st.info("切换提供商会自动填入官方 OpenAI-compatible Base URL 与推荐默认模型；仍可手动覆盖。")
    if st.button("恢复该提供商默认 URL / 模型"):
        apply_provider_defaults()
        st.rerun()

    base_url = st.text_input("API Base URL", key="llm_base_url")
    model = st.text_input("模型", key="llm_model")
    api_key = st.text_input("API Key", type="password", key="llm_api_key")

    col_save, col_test = st.columns([1, 1])
    with col_save:
        if st.button("保存 LLM 配置", type="primary"):
            save_llm_config(
                {
                    "provider": provider,
                    "base_url": st.session_state.llm_base_url.strip() or provider_defaults["base_url"],
                    "model": st.session_state.llm_model.strip() or provider_defaults["model"],
                    "api_key": st.session_state.llm_api_key.strip(),
                }
            )
            st.success("已保存。请重新运行一次生产任务以使用新配置。")
    with col_test:
        if st.button("测试 LLM 配置"):
            config = {
                "provider": provider,
                "base_url": st.session_state.llm_base_url.strip() or provider_defaults["base_url"],
                "model": st.session_state.llm_model.strip() or provider_defaults["model"],
                "api_key": st.session_state.llm_api_key.strip(),
            }
            save_llm_config(config)
            with st.spinner("正在测试 API 连通性，最多等待 30 秒..."):
                ok, message = test_llm_connection(config, timeout=30)
            if ok:
                st.success(message)
            else:
                st.error(message)

    st.write("当前生效配置")
    active_config = effective_llm_config()
    st.json(
        {
            "provider": active_config["provider"],
            "base_url": active_config["base_url"],
            "model": active_config["model"],
            "api_key": masked(active_config["api_key"]),
        }
    )
