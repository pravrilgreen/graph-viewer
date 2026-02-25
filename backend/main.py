"""
FastAPI backend for Graph Viewer
"""

import json
import os
import logging
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from typing import List

from graph_service import GraphService
from models import Transition, Screen
from seed import SEED_DATA
from schemas import (
    ScreenCreate,
    ScreenRename,
    TransitionCreate,
    TransitionUpdate,
    PathResult,
    GraphExport,
    ErrorResponse,
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
GRAPH_FILE = os.getenv("GRAPH_FILE", "graph_data.json")
MOCK_SCREENS_DIR = os.path.join(os.path.dirname(__file__), "mock-screens")

if os.path.isdir(MOCK_SCREENS_DIR):
    app.mount("/mock-screens", StaticFiles(directory=MOCK_SCREENS_DIR), name="mock-screens")


# ===================== Utility Functions =====================


def load_graph_from_file():
    """Load graph from file if it exists, fallback to seed data otherwise."""
    if os.path.exists(GRAPH_FILE):
        try:
            with open(GRAPH_FILE, "r") as f:
                data = json.load(f)
                graph_service.import_graph(data)

            stats = graph_service.get_graph_stats()
            if stats["num_screens"] == 0:
                graph_service.import_graph(SEED_DATA)
                save_graph_to_file()
        except Exception as e:
            print(f"Error loading graph: {e}")
            graph_service.import_graph(SEED_DATA)
            save_graph_to_file()
    else:
        graph_service.import_graph(SEED_DATA)
        save_graph_to_file()


def save_graph_to_file():
    """Save graph to file"""
    try:
        with open(GRAPH_FILE, "w") as f:
            json.dump(graph_service.export_graph(), f, indent=2)
    except Exception as e:
        print(f"Error saving graph: {e}")


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
    return {"status": "healthy", "service": "graph-viewer"}


# ===================== Screen Endpoints =====================


@app.post("/screens", response_model=Screen, status_code=status.HTTP_201_CREATED)
async def create_screen(screen: ScreenCreate):
    """
    Create a new screen

    - **screen_id**: Unique identifier for the screen
    """
    screen_id = screen.screen_id.strip()
    if not screen_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="screen_id cannot be empty",
        )

    # Check if screen already exists
    if graph_service.get_screen(screen_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Screen with ID '{screen_id}' already exists",
        )

    result = graph_service.add_screen(screen_id)
    save_graph_to_file()
    return result


@app.put("/screens/rename", response_model=Screen)
async def rename_screen(payload: ScreenRename):
    """Rename a screen and keep its related transitions."""
    old_screen_id = payload.old_screen_id.strip()
    new_screen_id = payload.new_screen_id.strip()

    if not old_screen_id or not new_screen_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="old_screen_id and new_screen_id cannot be empty",
        )

    if not graph_service.get_screen(old_screen_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Screen '{old_screen_id}' not found",
        )

    if old_screen_id != new_screen_id and graph_service.get_screen(new_screen_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Screen with ID '{new_screen_id}' already exists",
        )

    if not graph_service.rename_screen(old_screen_id, new_screen_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to rename screen",
        )

    save_graph_to_file()
    return graph_service.get_screen(new_screen_id)


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


@app.delete("/screens/{screen_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_screen(screen_id: str):
    """Delete a screen and all its associated transitions"""
    if not graph_service.delete_screen(screen_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Screen '{screen_id}' not found",
        )
    save_graph_to_file()


# ===================== Transition Endpoints =====================


@app.post("/transitions", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_transition(transition: TransitionCreate):
    """
    Create a new transition between two screens

    - **from_screen**: Source screen ID
    - **to_screen**: Target screen ID
    - **action_type**: Type of action (click, swipe, hardware_button, auto, condition)
    - **description**: Description of the transition
    - **weight**: Edge weight for path calculation (default: 1)
    - **conditionIds**: Optional array of condition IDs
    - **actionParams**: Optional array of action parameters
    """
    from_screen = transition.from_screen.strip()
    to_screen = transition.to_screen.strip()
    action_type = (transition.action.type if transition.action else transition.action_type or "").strip()
    description = (transition.action.description if transition.action else transition.description or "").strip()
    action_params = transition.action.params if transition.action else (transition.actionParams or {})

    if not from_screen or not to_screen:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="from_screen and to_screen are required",
        )

    if not action_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="action_type is required",
        )

    if transition.weight < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="weight must be >= 1",
        )

    # Ensure screens exist
    if not graph_service.get_screen(from_screen):
        graph_service.add_screen(from_screen)

    if not graph_service.get_screen(to_screen):
        graph_service.add_screen(to_screen)

    # Check if transition already exists
    if graph_service.get_transition(from_screen, to_screen):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Transition from '{from_screen}' to '{to_screen}' already exists",
        )

    trans_model = Transition(
        from_screen=from_screen,
        to_screen=to_screen,
        action_type=action_type,
        description=description,
        weight=transition.weight,
        conditionIds=transition.conditionIds,
        actionParams=action_params,
    )

    result = graph_service.add_transition(trans_model)
    save_graph_to_file()
    return result.to_dict()


@app.get("/transitions", response_model=List[dict])
async def get_transitions():
    """Get all transitions"""
    return [t.to_dict() for t in graph_service.get_all_transitions()]


@app.get("/transitions/{from_screen}/{to_screen}", response_model=dict)
async def get_transition(from_screen: str, to_screen: str):
    """Get a specific transition"""
    transition = graph_service.get_transition(from_screen, to_screen)
    if not transition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transition from '{from_screen}' to '{to_screen}' not found",
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

    trans_model = Transition(
        from_screen=transition.from_screen,
        to_screen=transition.to_screen,
        action_type=action_type,
        description=description,
        weight=transition.weight,
        conditionIds=transition.conditionIds,
        actionParams=action_params,
    )

    result = graph_service.update_transition(trans_model)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transition from '{transition.from_screen}' to '{transition.to_screen}' not found",
        )

    save_graph_to_file()
    return result.to_dict()


@app.delete("/transitions/{from_screen}/{to_screen}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transition(from_screen: str, to_screen: str):
    """Delete a transition"""
    if not graph_service.delete_transition(from_screen, to_screen):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transition from '{from_screen}' to '{to_screen}' not found",
        )
    save_graph_to_file()


# ===================== Transition Trigger Endpoint =====================


@app.post("/transitions/trigger")
async def trigger_transition(trigger: dict):
    """
    Trigger a transition
    
    - **from_screen**: Current screen ID
    - **to_screen**: Target screen ID
    """
    from_screen = trigger.get("from_screen")
    to_screen = trigger.get("to_screen")
    
    if not from_screen or not to_screen:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="from_screen and to_screen are required",
        )
    
    transition = graph_service.get_transition(from_screen, to_screen)
    if not transition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transition from '{from_screen}' to '{to_screen}' not found",
        )
    
    return {
        "success": True,
        "from_screen": from_screen,
        "to_screen": to_screen,
        "transition": transition.to_dict(),
        "message": f"Transitioned from {from_screen} to {to_screen}",
    }


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


# ===================== Graph Import/Export Endpoints =====================


@app.get("/graph/export", response_model=GraphExport)
async def export_graph():
    """Export entire graph as JSON"""
    return graph_service.export_graph()


@app.post("/graph/import", status_code=status.HTTP_200_OK)
async def import_graph(data: GraphExport):
    """
    Import graph from JSON

    This will replace the entire current graph.
    """
    try:
        graph_service.import_graph(data.dict())
        save_graph_to_file()
        return {"message": "Graph imported successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error importing graph: {str(e)}",
        )


@app.post("/graph/clear", status_code=status.HTTP_204_NO_CONTENT)
async def clear_graph():
    """Clear the entire graph"""
    graph_service.clear_graph()
    save_graph_to_file()


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
