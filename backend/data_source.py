"""
Graph data source adapters (JSON file and MongoDB).
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional


GraphPayload = Dict[str, Any]


class GraphDataSourceError(RuntimeError):
    """Raised when a graph data source cannot load/save data."""


class GraphDataSource:
    """Minimal interface for graph persistence backends."""

    name: str = "unknown"

    def load_graph(self) -> GraphPayload:
        raise NotImplementedError

    def save_graph(self, graph: GraphPayload) -> None:
        raise NotImplementedError


@dataclass
class JsonGraphDataSource(GraphDataSource):
    """Read/write graph data from/to local JSON file."""

    path: Path
    name: str = "json"

    def load_graph(self) -> GraphPayload:
        if not self.path.exists():
            raise GraphDataSourceError(f"Graph file not found: {self.path}")

        try:
            with open(self.path, "r", encoding="utf-8-sig") as handle:
                return json.load(handle)
        except Exception as exc:  # pragma: no cover - message wrapping
            raise GraphDataSourceError(f"Error loading graph file '{self.path}': {exc}") from exc

    def save_graph(self, graph: GraphPayload) -> None:
        try:
            with open(self.path, "w", encoding="utf-8") as handle:
                json.dump(graph, handle, indent=2)
        except Exception as exc:  # pragma: no cover - message wrapping
            raise GraphDataSourceError(f"Error saving graph file '{self.path}': {exc}") from exc


@dataclass
class MongoGraphDataSource(GraphDataSource):
    """Read/write graph data in a MongoDB collection."""

    uri: str
    database: str
    collection: str
    graph_id: str
    name: str = "mongodb"

    def _collection(self):
        try:
            from pymongo import MongoClient
        except ImportError as exc:
            raise GraphDataSourceError(
                "pymongo is required for GRAPH_DATA_SOURCE=mongodb. Install backend dependencies again."
            ) from exc

        client = MongoClient(self.uri)
        return client[self.database][self.collection]

    def load_graph(self) -> GraphPayload:
        coll = self._collection()
        doc = coll.find_one({"graph_id": self.graph_id})
        if not doc:
            raise GraphDataSourceError(
                f"No graph document found for graph_id='{self.graph_id}' in {self.database}.{self.collection}"
            )
        return {
            "screens": doc.get("screens", []),
            "transitions": doc.get("transitions", []),
            "conditions": doc.get("conditions", []),
        }

    def save_graph(self, graph: GraphPayload) -> None:
        coll = self._collection()
        coll.update_one(
            {"graph_id": self.graph_id},
            {
                "$set": {
                    "screens": graph.get("screens", []),
                    "transitions": graph.get("transitions", []),
                    "conditions": graph.get("conditions", []),
                }
            },
            upsert=True,
        )


def build_graph_data_source(default_graph_file: Path) -> GraphDataSource:
    """
    Build graph data source from env config.

    Supported values:
    - GRAPH_DATA_SOURCE=json (default)
    - GRAPH_DATA_SOURCE=mongodb
    """

    source_kind = (os.getenv("GRAPH_DATA_SOURCE") or "json").strip().lower()
    if source_kind not in {"json", "mongodb"}:
        raise GraphDataSourceError("GRAPH_DATA_SOURCE must be either 'json' or 'mongodb'")

    if source_kind == "json":
        graph_file_env = os.getenv("GRAPH_FILE")
        graph_file = Path(graph_file_env).resolve() if graph_file_env else default_graph_file
        return JsonGraphDataSource(path=graph_file)

    mongo_uri = os.getenv("MONGO_URI", "").strip()
    mongo_db = os.getenv("MONGO_DB", "").strip()
    mongo_collection = os.getenv("MONGO_COLLECTION", "").strip()
    mongo_graph_id = os.getenv("MONGO_GRAPH_ID", "default").strip() or "default"
    if not mongo_uri or not mongo_db or not mongo_collection:
        raise GraphDataSourceError(
            "MongoDB source requires MONGO_URI, MONGO_DB and MONGO_COLLECTION to be set"
        )

    return MongoGraphDataSource(
        uri=mongo_uri,
        database=mongo_db,
        collection=mongo_collection,
        graph_id=mongo_graph_id,
    )
