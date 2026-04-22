import json
import os
import subprocess
import sys
from pathlib import Path

import streamlit as st


REPO_ROOT = Path(__file__).resolve().parents[1]
DRAFT_DIR = REPO_ROOT / "local-brain" / "drafts"
AUDIT_DIR = REPO_ROOT / "local-brain" / "audits"
KNOWLEDGE_DIR = REPO_ROOT / "local-brain" / "knowledge"
REVIEWS_DIR = REPO_ROOT / "local-brain" / "reviews"
TMP_DIR = REPO_ROOT / "local-brain" / "tmp"
SEEDS_FILE = REPO_ROOT / "local-brain" / "seeds.txt"
EXAMPLE_SEEDS_FILE = REPO_ROOT / "local-brain" / "seeds.example.txt"
PYTHON_EXE = sys.executable


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

env_values = local_brain_env()
llm_ready = bool(env_values.get("LOCAL_BRAIN_OPENAI_API_KEY") or env_values.get("OPENAI_API_KEY"))
model_name = env_values.get("LOCAL_BRAIN_OPENAI_MODEL") or env_values.get("OPENAI_MODEL") or "gpt-4o-mini"

with st.sidebar:
    st.header("运行环境")
    st.write("Python")
    st.code(PYTHON_EXE, language="text")
    st.write("LLM")
    st.code("%s / %s" % ("READY" if llm_ready else "NOT CONFIGURED", model_name), language="text")
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
    use_llm = st.checkbox("启用 LLM 生成与审稿", value=llm_ready, disabled=not llm_ready)
    operator_notes = st.text_area(
        "补充资料 / 运营备注，可留空",
        value="",
        height=120,
        placeholder="例如：目标市场、竞品链接摘录、支付网关通知、差评关键词、必须避开的表达。",
    )

    if seed_mode == "单个种子词":
        seed = st.text_input("种子词", value="智能宠物喂食器")
        overwrite = st.checkbox("允许覆盖同名草稿", value=False)
        if st.button("运行 Researcher -> Writer -> Reviewer", type="primary"):
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
                if not use_llm:
                    args.append("--no-llm")
                code, output = run_command(args, timeout=360)
                show_command_result(code, output, "生产线已完成，草稿已生成")
    else:
        seed_text = st.text_area("批量种子词，每行一个", value=read_seed_text(), height=220)
        overwrite_batch = st.checkbox("批量覆盖同名草稿", value=False)
        if st.button("批量运行生产线", type="primary"):
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
            if not use_llm:
                args.append("-NoLlm")
            code, output = run_command(args, timeout=600)
            show_command_result(code, output, "批量生产完成并通过干跑校验")

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
    st.subheader("LLM 环境变量")
    st.write("写入 `.env.local` 后重启控制台即可。")
    st.code(
        "LOCAL_BRAIN_OPENAI_API_KEY=sk-...\nLOCAL_BRAIN_OPENAI_MODEL=gpt-4o-mini\nLOCAL_BRAIN_OPENAI_BASE_URL=https://api.openai.com/v1",
        language="bash",
    )
