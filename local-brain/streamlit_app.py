import json
import subprocess
import sys
from pathlib import Path

import streamlit as st


REPO_ROOT = Path(__file__).resolve().parents[1]
DRAFT_DIR = REPO_ROOT / "local-brain" / "drafts"
AUDIT_DIR = REPO_ROOT / "local-brain" / "audits"
SEEDS_FILE = REPO_ROOT / "local-brain" / "seeds.txt"
EXAMPLE_SEEDS_FILE = REPO_ROOT / "local-brain" / "seeds.example.txt"
PYTHON_EXE = sys.executable


st.set_page_config(
    page_title="Local Brain 控制台",
    page_icon="LB",
    layout="wide",
)


def rel(path):
    return str(Path(path).resolve().relative_to(REPO_ROOT)).replace("\\", "/")


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


st.title("Local Brain 合规文章生产线")
st.caption("本地运行：种子词 -> 情报画像 -> 红线审计 -> 内容铸造 -> Fail-Safe 校验 -> JSON 草稿 -> 人工确认 -> 一键发布")

with st.sidebar:
    st.header("路径")
    st.write("项目根目录")
    st.code(str(REPO_ROOT), language="text")
    st.write("草稿目录")
    st.code(rel(DRAFT_DIR), language="text")
    st.write("Python")
    st.code(PYTHON_EXE, language="text")

    st.header("安全原则")
    st.markdown(
        "- 默认只生成草稿，不自动上线。\n"
        "- Researcher / Writer / Reviewer 通过 LangGraph 状态机协作。\n"
        "- Reviewer 发现高危词会打回 Writer 重写。\n"
        "- 超过重写上限仍不合格时，Fail-Safe 才会阻断。\n"
        "- 发布按钮会触发 git commit / git push。"
    )


tab_generate, tab_review, tab_validate, tab_publish = st.tabs(
    ["1. 生产草稿", "2. 审阅草稿", "3. 校验", "4. 发布"]
)


with tab_generate:
    st.subheader("输入种子词")
    seed_mode = st.radio("生产模式", ["单个种子词", "批量种子词"], horizontal=True)

    if seed_mode == "单个种子词":
        seed = st.text_input("种子词", value="智能宠物喂食器")
        overwrite = st.checkbox("允许覆盖同名草稿", value=False)

        if st.button("生成草稿", type="primary"):
            if not seed.strip():
                st.warning("请先输入种子词。")
            else:
                args = [
                    PYTHON_EXE,
                    "scripts/local-brain/generate-insight.py",
                    "--seed",
                    seed.strip(),
                ]
                if overwrite:
                    args.append("--overwrite")
                code, output = run_command(args)
                show_command_result(code, output, "草稿已生成")
    else:
        seed_text = st.text_area(
            "批量种子词，每行一个",
            value=read_seed_text(),
            height=220,
        )
        col_save, col_run = st.columns([1, 1])
        with col_save:
            if st.button("保存到 seeds.txt"):
                SEEDS_FILE.write_text(seed_text.strip() + "\n", encoding="utf-8")
                st.success("已保存到 %s" % rel(SEEDS_FILE))
        with col_run:
            overwrite_batch = st.checkbox("批量覆盖同名草稿", value=False)
            if st.button("批量生成草稿", type="primary"):
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
                code, output = run_command(args, timeout=300)
                show_command_result(code, output, "批量草稿已生成并通过干跑校验")

    st.divider()
    st.subheader("Reviewer 重写测试")
    st.caption("这个测试会故意输入高危医疗暗示，正常结果应该是 Reviewer 打回，Writer 重写后通过。")
    if st.button("测试 Reviewer 打回重写"):
        args = [
            PYTHON_EXE,
            "scripts/local-brain/generate-insight.py",
            "--seed",
            "cure pet anxiety",
            "--draft-dir",
            "local-brain/tmp-drafts",
            "--overwrite",
        ]
        code, output = run_command(args)
        if code == 0:
            st.success("Reviewer 已按预期打回并完成安全重写")
        else:
            st.error("重写失败，Fail-Safe 已阻断")
        if output:
            st.code(output, language="text")


with tab_review:
    st.subheader("草稿列表")
    drafts = list_drafts()

    if not drafts:
        st.info("还没有草稿。先到“生产草稿”生成一篇。")
    else:
        selected = st.selectbox(
            "选择草稿",
            drafts,
            format_func=draft_label,
        )
        article = read_json(selected)

        top_left, top_right = st.columns([2, 1])
        with top_left:
            st.caption(article.get("category", "Unknown"))
            st.header(article.get("zhTitle") or article.get("title"))
            st.write(article.get("zhSummary") or article.get("summary"))
        with top_right:
            st.metric("Risk", article.get("riskLevel", "Unknown"))
            st.metric("Market", article.get("market", "Unknown"))
            st.metric("Sections", len(article.get("sections", [])))

        st.markdown("#### 红线词")
        redline_terms = article.get("redlineTerms", [])
        if redline_terms:
            st.write(" / ".join("`%s`" % term for term in redline_terms))
        else:
            st.warning("没有红线词。")

        st.markdown("#### 正文预览")
        for section in article.get("sections", []):
            st.markdown("##### %s" % (section.get("zhHeading") or section.get("heading")))
            st.write(section.get("zhBody") or section.get("body"))

        with st.expander("查看原始 JSON"):
            st.json(article)

        audit_path = AUDIT_DIR / ("%s.audit.json" % article.get("slug", selected.stem))
        if audit_path.exists():
            with st.expander("查看多智能体审计轨迹"):
                st.json(read_json(audit_path))

        st.download_button(
            "下载当前 JSON",
            data=json.dumps(article, ensure_ascii=False, indent=2),
            file_name=selected.name,
            mime="application/json",
        )


with tab_validate:
    st.subheader("Fail-Safe 与导入干跑")
    st.write("这里不会写入网站，只检查草稿是否可以进入内容库。")

    if st.button("校验全部草稿", type="primary"):
        code, output = run_command(
            ["npm.cmd", "run", "brain:add-batch", "--", "--dry-run", "local-brain/drafts"],
            timeout=180,
        )
        show_command_result(code, output, "全部草稿通过校验")

    st.divider()
    st.subheader("当前草稿概览")
    rows = []
    for path in list_drafts():
        try:
            article = read_json(path)
            rows.append(
                {
                    "slug": article.get("slug"),
                    "category": article.get("category"),
                    "risk": article.get("riskLevel"),
                    "market": article.get("market"),
                    "updated": article.get("updatedAt"),
                    "file": rel(path),
                }
            )
        except Exception as exc:
            rows.append({"slug": path.stem, "category": "INVALID", "risk": str(exc), "market": "", "updated": "", "file": rel(path)})

    if rows:
        st.dataframe(rows, use_container_width=True, hide_index=True)
    else:
        st.info("暂无草稿。")


with tab_publish:
    st.subheader("发布到网站")
    st.warning("发布会导入草稿、构建网站、生成 git commit，并推送到 GitHub。Vercel 会随后自动部署。")

    confirm = st.text_input("输入 PUBLISH 解锁发布按钮")
    no_push = st.checkbox("只提交本地 commit，不推送 GitHub", value=False)

    if st.button("发布草稿", type="primary", disabled=confirm.strip() != "PUBLISH"):
        args = [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            "scripts/publish-insights.ps1",
        ]
        if no_push:
            args.append("-NoPush")
        code, output = run_command(args, timeout=420)
        show_command_result(code, output, "发布流程完成")

    st.divider()
    st.subheader("Git 状态")
    if st.button("刷新 Git 状态"):
        code, output = run_command(["git", "status", "--short", "--branch"])
        show_command_result(code, output, "Git 状态已刷新")
