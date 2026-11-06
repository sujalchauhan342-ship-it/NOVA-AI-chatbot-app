
from pathlib import Path

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from main import app

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
INDEX_FILE = FRONTEND_DIR / "index.html"

if not INDEX_FILE.exists():
    raise RuntimeError("Frontend index.html was not found.")

# Remove the old JSON homepage
for route in list(app.router.routes):
    if (
        getattr(route, "path", None) == "/"
        and "GET" in (getattr(route, "methods", None) or set())
    ):
        app.router.routes.remove(route)

@app.get("/", include_in_schema=False)
def frontend_home():
    return FileResponse(INDEX_FILE)

# Serve CSS, JavaScript and other frontend files
app.mount(
    "/",
    StaticFiles(directory=str(FRONTEND_DIR), html=True),
    name="frontend"
)
