"""Shared Streamlit theme tokens and CSS."""

# Sage & stone palette
BG = "#F3F6F4"
SURFACE = "#FFFFFF"
TEXT = "#1A2421"
MUTED = "#5F7168"
ACCENT = "#3F6B5C"
ACCENT_HOVER = "#345C4F"
ACCENT_SOFT = "#E4EFE9"
BORDER = "#D5E0DA"
WARN = "#B45309"
WARN_BG = "#FEF3C7"

THEME_CSS = f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');

html, body, [class*="css"] {{
    font-family: "DM Sans", system-ui, sans-serif;
}}

.stApp {{
    background: linear-gradient(165deg, {BG} 0%, #EEF2EF 45%, {BG} 100%);
}}

.block-container {{
    max-width: 720px;
    padding-top: 2rem;
    padding-bottom: 3rem;
}}

#MainMenu, footer, header {{
    visibility: hidden;
}}

.hero {{
    text-align: center;
    margin-bottom: 2rem;
}}

.hero-badge {{
    display: inline-block;
    background: {ACCENT_SOFT};
    color: {ACCENT};
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0.35rem 0.85rem;
    border-radius: 999px;
    margin-bottom: 0.75rem;
}}

.hero h1 {{
    font-size: 1.85rem;
    font-weight: 700;
    color: {TEXT};
    margin: 0 0 0.4rem 0;
    letter-spacing: -0.02em;
}}

.hero p {{
    color: {MUTED};
    font-size: 0.95rem;
    margin: 0;
    line-height: 1.5;
}}

.card {{
    background: {SURFACE};
    border: 1px solid {BORDER};
    border-radius: 16px;
    padding: 1.25rem 1.35rem;
    margin-bottom: 1rem;
    box-shadow: 0 1px 2px rgba(26, 36, 33, 0.04);
}}

.card-label {{
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: {MUTED};
    margin-bottom: 0.5rem;
}}

.status-row {{
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.75rem;
}}

.pill {{
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.78rem;
    font-weight: 500;
    padding: 0.3rem 0.65rem;
    border-radius: 999px;
    background: {ACCENT_SOFT};
    color: {ACCENT};
}}

.pill-muted {{
    background: #EDF1EE;
    color: {MUTED};
}}

.pill-warn {{
    background: {WARN_BG};
    color: {WARN};
}}

.answer-box {{
    background: {SURFACE};
    border: 1px solid {BORDER};
    border-left: 4px solid {ACCENT};
    border-radius: 12px;
    padding: 1.1rem 1.2rem;
    color: {TEXT};
    line-height: 1.65;
    font-size: 0.95rem;
}}

.source-chip {{
    display: inline-block;
    font-size: 0.72rem;
    color: {MUTED};
    background: #EDF1EE;
    padding: 0.2rem 0.55rem;
    border-radius: 6px;
    margin: 0.15rem 0.25rem 0.15rem 0;
}}

.step {{
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
    justify-content: center;
}}

.step-item {{
    font-size: 0.8rem;
    font-weight: 500;
    color: {MUTED};
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    background: transparent;
}}

.step-item.active {{
    background: {ACCENT};
    color: white;
}}

.step-item.done {{
    background: {ACCENT_SOFT};
    color: {ACCENT};
}}

.step-line {{
    width: 28px;
    height: 2px;
    background: {BORDER};
    border-radius: 1px;
}}

div[data-testid="stFileUploader"] section {{
    border: 1.5px dashed {BORDER};
    border-radius: 12px;
    background: {SURFACE};
    padding: 0.5rem;
}}

div[data-testid="stFileUploader"] section:hover {{
    border-color: {ACCENT};
}}

.stButton > button[kind="primary"] {{
    background: {ACCENT} !important;
    border: none !important;
    color: white !important;
    border-radius: 10px !important;
    font-weight: 600 !important;
    padding: 0.55rem 1.25rem !important;
    box-shadow: 0 1px 2px rgba(63, 107, 92, 0.2);
}}

.stButton > button[kind="primary"]:hover {{
    background: {ACCENT_HOVER} !important;
}}

.stTextInput input, .stChatInput textarea {{
    border-radius: 10px !important;
    border-color: {BORDER} !important;
}}

section[data-testid="stSidebar"] {{
    background: {SURFACE};
    border-right: 1px solid {BORDER};
}}

section[data-testid="stSidebar"] .block-container {{
    padding-top: 1.5rem;
}}
</style>
"""
