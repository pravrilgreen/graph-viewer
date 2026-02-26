"""
FastAPI backend for Graph Viewer
"""

import os
import logging
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from typing import List
from dotenv import load_dotenv

from graph_service import GraphService
from models import Transition, Screen
from data_source import build_graph_data_source, GraphDataSourceError
from schemas import (
    TransitionUpdate,
)

# Reduce logging verbosity
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
logging.getLogger("uvicorn").setLevel(logging.WARNING)

# ===================== Application Setup =====================

app = FastAPI(
    title="Graph Viewer API",
    description="API for managing and visualizing automotive screen transitions",
    version="1.0.0",
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize graph service
graph_service = GraphService()

# Configuration
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
DEFAULT_GRAPH_FILE = Path(__file__).resolve().parent / "graph_data.json"
graph_data_source = build_graph_data_source(DEFAULT_GRAPH_FILE)
MOCK_SCREENS_DIR = os.path.join(os.path.dirname(__file__), "mock-screens")

if os.path.isdir(MOCK_SCREENS_DIR):
    app.mount("/mock-screens", StaticFiles(directory=MOCK_SCREENS_DIR), name="mock-screens")


# ===================== Utility Functions =====================


def load_graph_from_file():
    """Load graph from configured data source."""
    try:
        data = graph_data_source.load_graph()
        graph_service.import_graph(data)
    except GraphDataSourceError as exc:
        raise RuntimeError(str(exc)) from exc


def save_graph_to_file():
    """Save graph to configured data source."""
    try:
        graph_data_source.save_graph(graph_service.export_graph())
    except GraphDataSourceError as exc:
        print(f"Error saving graph: {exc}")


# Load graph on startup
load_graph_from_file()


# ===================== Root Endpoint =====================


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Graph Viewer API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "graph-viewer", "data_source": graph_data_source.name}


# ===================== Screen Endpoints =====================


@app.get("/screens", response_model=List[Screen])
async def get_screens():
    """Get all screens"""
    return graph_service.get_all_screens()


@app.get("/screens/{screen_id}", response_model=Screen)
async def get_screen(screen_id: str):
    """Get a specific screen by ID"""
    screen = graph_service.get_screen(screen_id)
    if not screen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Screen '{screen_id}' not found",
        )
    return screen


# ===================== Transition Endpoints =====================


@app.get("/transitions", response_model=List[dict])
async def get_transitions():
    """Get all transitions"""
    return [t.to_dict() for t in graph_service.get_all_transitions()]


@app.get("/transitions/{from_screen}/{to_screen}", response_model=dict)
async def get_transition(from_screen: str, to_screen: str, transition_id: str | None = Query(default=None)):
    """Get a specific transition (must provide transition_id when multiple transitions exist)."""
    candidates = graph_service.get_transitions_between(from_screen, to_screen)
    if len(candidates) > 1 and not transition_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Multiple transitions exist from '{from_screen}' to '{to_screen}'. "
                "Provide transition_id or use /transitions/{from_screen}/{to_screen}/all."
            ),
        )

    transition = graph_service.get_transition(from_screen, to_screen, transition_id=transition_id)
    if not transition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"Transition '{transition_id}' not found"
                if transition_id
                else f"Transition from '{from_screen}' to '{to_screen}' not found"
            ),
        )
    return transition.to_dict()


@app.get("/transitions/{from_screen}/{to_screen}/all", response_model=List[dict])
async def get_transitions_between(from_screen: str, to_screen: str):
    """Get all transitions between two screens."""
    return [t.to_dict() for t in graph_service.get_transitions_between(from_screen, to_screen)]


@app.get("/transitions/grouped", response_model=List[dict])
async def get_transitions_grouped():
    """Get transitions grouped by (from_screen, to_screen)."""
    groups: dict[tuple[str, str], list[dict]] = {}
    for transition in graph_service.get_all_transitions():
        key = (transition.from_screen, transition.to_screen)
        groups.setdefault(key, []).append(transition.to_dict())

    return [
        {
            "from_screen": from_screen,
            "to_screen": to_screen,
            "transitions": transitions,
            "count": len(transitions),
        }
        for (from_screen, to_screen), transitions in sorted(groups.items(), key=lambda item: (item[0][0], item[0][1]))
    ]


@app.get("/transitions/id/{transition_id}", response_model=dict)
async def get_transition_by_id(transition_id: str):
    """Get a specific transition by transition_id."""
    transition = next(
        (item for item in graph_service.get_all_transitions() if item.transition_id == transition_id),
        None,
    )
    if not transition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transition '{transition_id}' not found",
        )
    return transition.to_dict()


@app.put("/transitions", response_model=dict)
async def update_transition(transition: TransitionUpdate):
    """
    Update an existing transition

    - **from_screen**: Source screen ID
    - **to_screen**: Target screen ID
    - **action_type**: Type of action (click, swipe, hardware_button, auto, condition)
    - **description**: Description of the transition
    - **weight**: Edge weight for path calculation
    - **conditionIds**: Optional array of condition IDs
    - **actionParams**: Optional array of action parameters
    """
    if transition.weight < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="weight must be >= 1",
        )

    action_type = (transition.action.type if transition.action else transition.action_type or "").strip()
    description = (transition.action.description if transition.action else transition.description or "").strip()
    action_params = transition.action.params if transition.action else (transition.actionParams or {})

    if not action_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="action.type is required",
        )

    if not transition.transition_id:
        candidates = graph_service.get_transitions_between(transition.from_screen, transition.to_screen)
        if len(candidates) > 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Multiple transitions exist from '{transition.from_screen}' to '{transition.to_screen}'. "
                    "Provide transition_id to update a specific transition."
                ),
            )

    trans_model = Transition(
        transition_id=transition.transition_id,
        from_screen=transition.from_screen,
        to_screen=transition.to_screen,
        action_type=action_type,
        description=description,
        weight=transition.weight,
        conditionIds=transition.conditionIds,
        actionParams=action_params,
    )

    try:
        result = graph_service.update_transition(trans_model)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transition from '{transition.from_screen}' to '{transition.to_screen}' not found",
        )

    save_graph_to_file()
    return result.to_dict()


# ===================== Path Finding Endpoints =====================


@app.get("/path/shortest", response_model=dict)
async def find_shortest_path(from_screen: str, to_screen: str):
    """
    Find shortest path between two screens (weighted by edge weights)

    Uses Dijkstra's algorithm considering edge weights.

    - **from_screen**: Source screen ID
    - **to_screen**: Target screen ID
    """
    result = graph_service.find_shortest_path(from_screen, to_screen)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No path found from '{from_screen}' to '{to_screen}'",
        )
    return result


@app.get("/path/simple", response_model=dict)
async def find_simple_path(
    from_screen: str,
    to_screen: str,
    max_depth: int | None = Query(default=None, ge=1, le=50),
    max_paths: int = Query(default=100, ge=1, le=1000),
):
    """
    Find simplest path (minimum transitions) between two screens

    Returns simple routes up to max_depth transitions.

    - **from_screen**: Source screen ID
    - **to_screen**: Target screen ID
    - **max_depth**: Optional max number of transitions per route
    - **max_paths**: Max number of routes to return
    """
    result = graph_service.find_simple_path(
        from_screen,
        to_screen,
        max_depth=max_depth,
        max_paths=max_paths,
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No path found from '{from_screen}' to '{to_screen}'",
        )
    return result


# ===================== Statistics Endpoints =====================


@app.get("/graph/stats", response_model=dict)
async def get_graph_stats():
    """Get graph statistics"""
    return graph_service.get_graph_stats()


# ===================== Error Handlers =====================


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Custom HTTP exception handler"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "status_code": exc.status_code},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
