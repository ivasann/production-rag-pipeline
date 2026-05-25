# Deploy to GitHub Pages (github.io)

## 1. Push the repo to GitHub

```bash
cd C:\Users\Vasan\production-rag-pipeline
git init
git add .
git commit -m "Add DocQuery site and RAG pipeline"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/production-rag-pipeline.git
git push -u origin main
```

## 2. Enable Pages

1. Open the repo on GitHub → **Settings** → **Pages**
2. **Build and deployment** → Source: **Deploy from a branch**
3. Branch: **main** → Folder: **/docs** → **Save**

After 1–2 minutes the site is live at:

`https://YOUR_USERNAME.github.io/production-rag-pipeline/`

## 3. Update the footer link (optional)

In `docs/index.html`, replace `https://github.com` with your real repo URL.

## Local preview

```bash
cd docs
python -m http.server 8080
```

Open http://localhost:8080
