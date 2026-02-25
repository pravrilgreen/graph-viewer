"""
Graph service for managing transition graph using NetworkX
"""

import networkx as nx
from typing import Any, Dict, List, Optional, Tuple, Union

from models import Screen, Transition, build_default_screen


class GraphService:
    """Service for managing the transition graph"""

    def __init__(self):
        """Initialize the graph service with a directed graph"""
        self.graph = nx.DiGraph()
        self._screens: Dict[str, Screen] = {}
        self._transitions: Dict[Tuple[str, str], Transition] = {}

    # ===================== Screen Operations =====================

    def add_screen(self, screen_data: Union[str, Screen]) -> Screen:
        """Add a new screen (node) to the graph."""
        screen = screen_data if isinstance(screen_data, Screen) else build_default_screen(screen_data)
        self.graph.add_node(screen.screen_id)
        self._screens[screen.screen_id] = screen
        return screen

    def get_screen(self, screen_id: str) -> Optional[Screen]:
        """Get a screen by ID"""
        return self._screens.get(screen_id)

    def get_all_screens(self) -> List[Screen]:
        """Get all screens in the graph"""
        return [self._screens[node] for node in self.graph.nodes() if node in self._screens]

    def delete_screen(self, screen_id: str) -> bool:
        """Delete a screen and all its associated transitions"""
        if not self.graph.has_node(screen_id):
            return False

        # Remove all transitions connected to this screen
        transitions_to_remove = [
            (u, v)
            for u, v in list(self._transitions.keys())
            if u == screen_id or v == screen_id
        ]
        for u, v in transitions_to_remove:
            del self._transitions[(u, v)]

        self.graph.remove_node(screen_id)
        self._screens.pop(screen_id, None)
        return True

    def rename_screen(self, old_screen_id: str, new_screen_id: str) -> bool:
        """Rename a screen while preserving incoming/outgoing transitions"""
        if old_screen_id == new_screen_id:
            return True

        if not self.graph.has_node(old_screen_id) or self.graph.has_node(new_screen_id):
            return False

        old_screen = self._screens.get(old_screen_id)
        renamed_screen = build_default_screen(new_screen_id) if old_screen is None else Screen(
            screen_id=new_screen_id,
            imagePath=old_screen.imagePath,
        )

        # Create the new screen first.
        self.graph.add_node(new_screen_id)
        self._screens[new_screen_id] = renamed_screen

        # Re-map transitions that reference old_screen_id.
        remapped_transitions: Dict[Tuple[str, str], Transition] = {}
        for (source, target), transition in self._transitions.items():
            new_source = new_screen_id if source == old_screen_id else source
            new_target = new_screen_id if target == old_screen_id else target
            remapped = Transition(
                from_screen=new_source,
                to_screen=new_target,
                action_type=transition.action_type,
                description=transition.description,
                weight=transition.weight,
                conditionIds=transition.conditionIds,
                actionParams=transition.actionParams,
            )
            remapped_transitions[(new_source, new_target)] = remapped

        # Remove old screen and rebuild edges from remapped transitions.
        if self.graph.has_node(old_screen_id):
            self.graph.remove_node(old_screen_id)
        self._screens.pop(old_screen_id, None)

        self._transitions = {}
        for transition in remapped_transitions.values():
            self.add_transition(transition)

        return True

    # ===================== Transition Operations =====================

    def add_transition(self, transition: Transition) -> Transition:
        """Add a new transition (edge) between two screens"""
        # Ensure both screens exist
        if not self.graph.has_node(transition.from_screen):
            self.add_screen(transition.from_screen)
        if not self.graph.has_node(transition.to_screen):
            self.add_screen(transition.to_screen)

        # Add edge with weight
        self.graph.add_edge(
            transition.from_screen,
            transition.to_screen,
            weight=transition.weight,
        )

        # Store transition details
        self._transitions[(transition.from_screen, transition.to_screen)] = transition
        return transition

    def get_transition(self, from_screen: str, to_screen: str) -> Optional[Transition]:
        """Get a transition between two screens"""
        key = (from_screen, to_screen)
        return self._transitions.get(key)

    def get_all_transitions(self) -> List[Transition]:
        """Get all transitions in the graph"""
        return list(self._transitions.values())

    def update_transition(self, transition: Transition) -> Optional[Transition]:
        """Update an existing transition"""
        key = (transition.from_screen, transition.to_screen)

        if key not in self._transitions:
            return None

        # Update edge weight
        self.graph[transition.from_screen][transition.to_screen]["weight"] = transition.weight

        # Update transition details
        self._transitions[key] = transition
        return transition

    def delete_transition(self, from_screen: str, to_screen: str) -> bool:
        """Delete a transition between two screens"""
        key = (from_screen, to_screen)

        if key not in self._transitions:
            return False

        if self.graph.has_edge(from_screen, to_screen):
            self.graph.remove_edge(from_screen, to_screen)

        del self._transitions[key]
        return True

    # ===================== Path Finding =====================

    def find_shortest_path(
        self, from_screen: str, to_screen: str
    ) -> Optional[Dict[str, Any]]:
        """
        Find shortest path using Dijkstra's algorithm (considers weights).
        Returns path with transitions or None if no path exists.
        """
        if not self.graph.has_node(from_screen) or not self.graph.has_node(to_screen):
            return None

        try:
            path = nx.shortest_path(
                self.graph, source=from_screen, target=to_screen, weight="weight"
            )
        except nx.NetworkXNoPath:
            return None

        primary = self._build_path_result(path)
        return {
            "paths": [primary],
            # Compatibility fields for existing clients.
            "path": primary["path"],
            "transitions": primary["transitions"],
            "total_weight": primary["total_weight"],
        }

    def find_simple_path(
        self,
        from_screen: str,
        to_screen: str,
        max_depth: Optional[int] = None,
        max_paths: int = 100,
    ) -> Optional[Dict[str, Any]]:
        """
        Find simple paths from source to target.

        max_depth counts the number of transitions (edges).
        max_paths limits how many routes are returned.
        """
        if not self.graph.has_node(from_screen) or not self.graph.has_node(to_screen):
            return None

        if max_paths < 1:
            max_paths = 1

        if max_depth is None:
            try:
                shortest_hops = nx.shortest_path_length(
                    self.graph, source=from_screen, target=to_screen
                )
                max_depth = max(shortest_hops + 2, shortest_hops)
            except nx.NetworkXNoPath:
                return None

        max_depth = max(1, min(max_depth, max(self.graph.number_of_nodes() - 1, 1)))

        paths: List[List[str]] = []
        try:
            for path in nx.all_simple_paths(
                self.graph,
                source=from_screen,
                target=to_screen,
                cutoff=max_depth,
            ):
                paths.append(path)
                if len(paths) >= max_paths:
                    break
        except nx.NetworkXNoPath:
            paths = []

        # Defensive fallback: if all_simple_paths yields no results but a shortest
        # path exists, return that shortest path instead of None.
        shortest_result = self.find_shortest_path(from_screen, to_screen)
        if shortest_result:
            shortest_path = shortest_result.get("path") or []
            if shortest_path and shortest_path not in paths:
                paths.append(shortest_path)

        if not paths:
            return None

        path_results = [self._build_path_result(path) for path in paths]
        path_results.sort(key=lambda item: (len(item["path"]), item["total_weight"]))
        primary = path_results[0]
        return {
            "paths": path_results,
            # Keep compatibility fields for existing clients.
            "path": primary["path"],
            "transitions": primary["transitions"],
            "total_weight": primary["total_weight"],
        }

    def _build_path_result(self, path: List[str]) -> Dict[str, Any]:
        """Build path result with transitions"""
        transitions_list = []
        total_weight = 0

        for i in range(len(path) - 1):
            from_screen = path[i]
            to_screen = path[i + 1]

            transition = self.get_transition(from_screen, to_screen)
            if transition:
                transitions_list.append(transition.to_dict())
                total_weight += transition.weight

        return {
            "path": path,
            "transitions": transitions_list,
            "total_weight": total_weight,
        }

    # ===================== Graph Import/Export =====================

    def export_graph(self) -> Dict[str, Any]:
        """Export graph as dictionary"""
        screens = [screen.to_dict() for screen in self.get_all_screens()]
        transitions = [t.to_dict() for t in self.get_all_transitions()]

        return {
            "screens": screens,
            "transitions": transitions,
        }

    def import_graph(self, data: Dict[str, Any]) -> None:
        """
        Import graph from dictionary.
        Clears existing graph first.
        """
        self.graph.clear()
        self._screens.clear()
        self._transitions.clear()

        # Add screens
        for screen_data in data.get("screens", []):
            screen = Screen.from_dict(screen_data)
            self.add_screen(screen)

        # Add transitions
        for trans_data in data.get("transitions", []):
            transition = Transition.from_dict(trans_data)
            self.add_transition(transition)

    def clear_graph(self) -> None:
        """Clear the entire graph"""
        self.graph.clear()
        self._screens.clear()
        self._transitions.clear()

    # ===================== Statistics =====================

    def get_graph_stats(self) -> Dict[str, Any]:
        """Get graph statistics"""
        return {
            "num_screens": self.graph.number_of_nodes(),
            "num_transitions": self.graph.number_of_edges(),
            "density": nx.density(self.graph) if self.graph.number_of_nodes() > 0 else 0,
        }
