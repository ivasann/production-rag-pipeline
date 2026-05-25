# DocQuery Backend

Run the REST API from the project root:

```powershell
python -m uvicorn src.api:app --host 127.0.0.1 --port 8000 --reload
```

Then open:

```text
docs/demo.html
```

The demo page calls:

- `GET /api/health`
- `POST /api/index`
- `POST /api/ask`
- `POST /api/reset`

The backend needs `GOOGLE_API_KEY` in the project `.env` file for live answers.
Open `docs/demo.html?offline=1` only if you want the old simulated browser demo.
