"""
Graph service for managing transition graph using NetworkX
"""

import uuid
import networkx as nx
from typing import Any, Dict, List, Optional, Tuple, Union

from models import Screen, Transition, build_default_screen


class GraphService:
    """Service for managing the transition graph"""

    def __init__(self):
        """Initialize the graph service with a directed multigraph."""
        self.graph = nx.MultiDiGraph()
        self._screens: Dict[str, Screen] = {}
        self._transitions: Dict[str, Transition] = {}
        self._pair_index: Dict[Tuple[str, str], List[str]] = {}

    # ===================== Internal Helpers =====================

    def _new_transition_id(self) -> str:
        transition_id = uuid.uuid4().hex
        while transition_id in self._transitions:
            transition_id = uuid.uuid4().hex
        return transition_id

    def _remove_pair_reference(self, from_screen: str, to_screen: str, transition_id: str) -> None:
        key = (from_screen, to_screen)
        ids = self._pair_index.get(key, [])
        if transition_id in ids:
            ids.remove(transition_id)
        if not ids and key in self._pair_index:
            del self._pair_index[key]

    def _add_pair_reference(self, from_screen: str, to_screen: str, transition_id: str) -> None:
        key = (from_screen, to_screen)
        self._pair_index.setdefault(key, []).append(transition_id)

    # ===================== Screen Operations =====================

    def add_screen(self, screen_data: Union[str, Screen]) -> Screen:
        """Add a new screen (node) to the graph."""
        screen = screen_data if isinstance(screen_data, Screen) else build_default_screen(screen_data)
        self.graph.add_node(screen.screen_id)
        self._screens[screen.screen_id] = screen
        return screen

    def get_screen(self, screen_id: str) -> Optional[Screen]:
        """Get a screen by ID."""
        return self._screens.get(screen_id)

    def get_all_screens(self) -> List[Screen]:
        """Get all screens in the graph."""
        return [self._screens[node] for node in self.graph.nodes() if node in self._screens]

    def delete_screen(self, screen_id: str) -> bool:
        """Delete a screen and all its associated transitions."""
        if not self.graph.has_node(screen_id):
            return False

        transition_ids_to_remove = [
            transition_id
            for transition_id, transition in self._transitions.items()
            if transition.from_screen == screen_id or transition.to_screen == screen_id
        ]
        for transition_id in transition_ids_to_remove:
            transition = self._transitions.get(transition_id)
            if not transition:
                continue
            if self.graph.has_edge(transition.from_screen, transition.to_screen, key=transition_id):
                self.graph.remove_edge(transition.from_screen, transition.to_screen, key=transition_id)
            self._remove_pair_reference(transition.from_screen, transition.to_screen, transition_id)
            del self._transitions[transition_id]

        self.graph.remove_node(screen_id)
        self._screens.pop(screen_id, None)
        return True

    def rename_screen(self, old_screen_id: str, new_screen_id: str) -> bool:
        """Rename a screen while preserving incoming/outgoing transitions."""
        if old_screen_id == new_screen_id:
            return True

        if not self.graph.has_node(old_screen_id) or self.graph.has_node(new_screen_id):
            return False

        old_screen = self._screens.get(old_screen_id)
        renamed_screen = build_default_screen(new_screen_id) if old_screen is None else Screen(
            screen_id=new_screen_id,
            imagePath=old_screen.imagePath,
        )

        nx.relabel_nodes(self.graph, {old_screen_id: new_screen_id}, copy=False)
        self._screens.pop(old_screen_id, None)
        self._screens[new_screen_id] = renamed_screen

        remapped: Dict[str, Transition] = {}
        for transition_id, transition in self._transitions.items():
            remapped[transition_id] = Transition(
                transition_id=transition_id,
                from_screen=new_screen_id if transition.from_screen == old_screen_id else transition.from_screen,
                to_screen=new_screen_id if transition.to_screen == old_screen_id else transition.to_screen,
                action_type=transition.action_type,
                description=transition.description,
                weight=transition.weight,
                conditionIds=list(transition.conditionIds or []),
                actionParams=dict(transition.actionParams or {}),
            )

        self._transitions = remapped
        self._pair_index = {}
        for transition_id, transition in self._transitions.items():
            self._add_pair_reference(transition.from_screen, transition.to_screen, transition_id)

        return True

    # ===================== Transition Operations =====================

    def add_transition(self, transition: Transition) -> Transition:
        """Add a new transition (edge) between two screens."""
        if not self.graph.has_node(transition.from_screen):
            raise ValueError(f"Source screen '{transition.from_screen}' does not exist")
        if not self.graph.has_node(transition.to_screen):
            raise ValueError(f"Target screen '{transition.to_screen}' does not exist")

        transition_id = transition.transition_id or self._new_transition_id()
        if transition_id in self._transitions:
            transition_id = self._new_transition_id()

        stored = Transition(
            transition_id=transition_id,
            from_screen=transition.from_screen,
            to_screen=transition.to_screen,
            action_type=transition.action_type,
            description=transition.description,
            weight=transition.weight,
            conditionIds=list(transition.conditionIds or []),
            actionParams=dict(transition.actionParams or {}),
        )

        self.graph.add_edge(
            stored.from_screen,
            stored.to_screen,
            key=transition_id,
            weight=stored.weight,
            transition_id=transition_id,
        )
        self._transitions[transition_id] = stored
        self._add_pair_reference(stored.from_screen, stored.to_screen, transition_id)
        return stored

    def get_transition(
        self,
        from_screen: str,
        to_screen: str,
        transition_id: Optional[str] = None,
    ) -> Optional[Transition]:
        """Get a transition by transition_id or first transition between two screens."""
        if transition_id:
            transition = self._transitions.get(transition_id)
            if not transition:
                return None
            if transition.from_screen != from_screen or transition.to_screen != to_screen:
                return None
            return transition

        ids = self._pair_index.get((from_screen, to_screen), [])
        if not ids:
            return None
        return self._transitions.get(ids[0])

    def get_transitions_between(self, from_screen: str, to_screen: str) -> List[Transition]:
        """Get all transitions between two screens."""
        ids = self._pair_index.get((from_screen, to_screen), [])
        return [self._transitions[transition_id] for transition_id in ids if transition_id in self._transitions]

    def get_all_transitions(self) -> List[Transition]:
        """Get all transitions in the graph."""
        transitions = list(self._transitions.values())
        transitions.sort(key=lambda t: (t.from_screen, t.to_screen, t.transition_id or ""))
        return transitions

    def update_transition(self, transition: Transition) -> Optional[Transition]:
        """Update an existing transition."""
        transition_id = transition.transition_id

        if transition_id:
            existing = self._transitions.get(transition_id)
        else:
            existing = self.get_transition(transition.from_screen, transition.to_screen)
            transition_id = existing.transition_id if existing else None

        if not existing or not transition_id:
            return None

        if not self.graph.has_node(transition.from_screen):
            raise ValueError(f"Source screen '{transition.from_screen}' does not exist")
        if not self.graph.has_node(transition.to_screen):
            raise ValueError(f"Target screen '{transition.to_screen}' does not exist")

        if self.graph.has_edge(existing.from_screen, existing.to_screen, key=transition_id):
            self.graph.remove_edge(existing.from_screen, existing.to_screen, key=transition_id)
        self._remove_pair_reference(existing.from_screen, existing.to_screen, transition_id)

        updated = Transition(
            transition_id=transition_id,
            from_screen=transition.from_screen,
            to_screen=transition.to_screen,
            action_type=transition.action_type,
            description=transition.description,
            weight=transition.weight,
            conditionIds=list(transition.conditionIds or []),
            actionParams=dict(transition.actionParams or {}),
        )

        self.graph.add_edge(
            updated.from_screen,
            updated.to_screen,
            key=transition_id,
            weight=updated.weight,
            transition_id=transition_id,
        )
        self._transitions[transition_id] = updated
        self._add_pair_reference(updated.from_screen, updated.to_screen, transition_id)
        return updated

    def delete_transition(
        self,
        from_screen: str,
        to_screen: str,
        transition_id: Optional[str] = None,
    ) -> bool:
        """Delete a transition by transition_id or first transition between two screens."""
        target = self.get_transition(from_screen, to_screen, transition_id=transition_id)
        if not target or not target.transition_id:
            return False

        target_id = target.transition_id
        if self.graph.has_edge(target.from_screen, target.to_screen, key=target_id):
            self.graph.remove_edge(target.from_screen, target.to_screen, key=target_id)

        self._remove_pair_reference(target.from_screen, target.to_screen, target_id)
        if target_id in self._transitions:
            del self._transitions[target_id]
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
            min_total_weight = nx.shortest_path_length(
                self.graph, source=from_screen, target=to_screen, weight="weight"
            )
        except nx.NetworkXNoPath:
            return None

        shortest_edge_paths = self._find_min_weight_edge_paths(
            from_screen=from_screen,
            to_screen=to_screen,
            target_weight=min_total_weight,
            max_paths=1000,
        )
        if not shortest_edge_paths:
            return None

        path_results = [self._build_path_result_from_edge_path(edge_path) for edge_path in shortest_edge_paths]
        path_results.sort(
            key=lambda item: (
                len(item["path"]),
                tuple(transition.get("transition_id") or "" for transition in item["transitions"]),
            )
        )
        return {
            "paths": path_results,
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

        edge_paths: List[List[tuple]] = []
        try:
            for edge_path in nx.all_simple_edge_paths(
                self.graph,
                source=from_screen,
                target=to_screen,
                cutoff=max_depth,
            ):
                edge_paths.append(edge_path)
                if len(edge_paths) >= max_paths * 4:
                    break
        except nx.NetworkXNoPath:
            edge_paths = []

        # Deduplicate exact transition sequences.
        seen_signatures: set[tuple[str, ...]] = set()
        path_results: List[Dict[str, Any]] = []
        for edge_path in edge_paths:
            result = self._build_path_result_from_edge_path(edge_path)
            if not result["path"]:
                continue
            signature = tuple(
                transition.get("transition_id") or f"{transition.get('from_screen')}->{transition.get('to_screen')}"
                for transition in result["transitions"]
            )
            if signature in seen_signatures:
                continue
            seen_signatures.add(signature)
            path_results.append(result)
            if len(path_results) >= max_paths:
                break

        if not path_results:
            shortest_result = self.find_shortest_path(from_screen, to_screen)
            if not shortest_result:
                return None
            path_results = list(shortest_result.get("paths", []))

        if not path_results:
            return None

        path_results.sort(key=lambda item: (len(item["path"]), item["total_weight"]))
        return {
            "paths": path_results,
        }

    def _build_path_result(self, path: List[str]) -> Dict[str, Any]:
        """Build path result with transitions."""
        transitions_list = []
        total_weight = 0

        for i in range(len(path) - 1):
            from_screen = path[i]
            to_screen = path[i + 1]
            candidates = self.get_transitions_between(from_screen, to_screen)
            if not candidates:
                continue

            selected = sorted(
                candidates,
                key=lambda t: (t.weight, t.transition_id or ""),
            )[0]
            transitions_list.append(selected.to_dict())
            total_weight += selected.weight

        return {
            "path": path,
            "transitions": transitions_list,
            "total_weight": total_weight,
        }

    def _build_path_result_from_edge_path(self, edge_path: List[tuple]) -> Dict[str, Any]:
        """Build path result from edge path preserving exact transition_ids in multigraph."""
        if not edge_path:
            return {"path": [], "transitions": [], "total_weight": 0}

        path_nodes = [edge_path[0][0]]
        transitions_list = []
        total_weight = 0

        for step in edge_path:
            if len(step) == 3:
                from_screen, to_screen, transition_id = step
                transition = self.get_transition(from_screen, to_screen, transition_id=transition_id)
            elif len(step) == 2:
                from_screen, to_screen = step
                transition = self.get_transition(from_screen, to_screen)
            else:
                continue

            path_nodes.append(step[1])
            if transition:
                transitions_list.append(transition.to_dict())
                total_weight += transition.weight

        return {
            "path": path_nodes,
            "transitions": transitions_list,
            "total_weight": total_weight,
        }

    def _find_min_weight_edge_paths(
        self,
        from_screen: str,
        to_screen: str,
        target_weight: int,
        max_paths: int = 1000,
    ) -> List[List[tuple]]:
        """Enumerate all simple edge paths with exact total weight equal to target_weight."""
        results: List[List[tuple]] = []
        seen_signatures: set[tuple[str, ...]] = set()

        def dfs(current: str, visited: set[str], edge_path: List[tuple], total_weight: int) -> None:
            if len(results) >= max_paths:
                return

            if total_weight > target_weight:
                return

            if current == to_screen:
                if total_weight == target_weight:
                    signature = tuple(str(step[2]) for step in edge_path)
                    if signature not in seen_signatures:
                        seen_signatures.add(signature)
                        results.append(list(edge_path))
                return

            for _, next_screen, transition_id, edge_data in self.graph.out_edges(current, keys=True, data=True):
                if next_screen in visited:
                    continue

                edge_weight = int(edge_data.get("weight", 1) or 1)
                next_weight = total_weight + edge_weight
                if next_weight > target_weight:
                    continue

                visited.add(next_screen)
                edge_path.append((current, next_screen, transition_id))
                dfs(next_screen, visited, edge_path, next_weight)
                edge_path.pop()
                visited.remove(next_screen)

        dfs(from_screen, {from_screen}, [], 0)
        return results

    # ===================== Graph Import/Export =====================

    def export_graph(self) -> Dict[str, Any]:
        """Export graph as dictionary."""
        screens = [screen.to_dict() for screen in self.get_all_screens()]
        transitions = [t.to_dict() for t in self.get_all_transitions()]

        return {
            "screens": screens,
            "transitions": transitions,
        }

    def import_graph(self, data: Dict[str, Any]) -> None:
        """Import graph from dictionary. Clears existing graph first."""
        self.graph.clear()
        self._screens.clear()
        self._transitions.clear()
        self._pair_index.clear()

        for screen_data in data.get("screens", []):
            screen = Screen.from_dict(screen_data)
            self.add_screen(screen)

        for trans_data in data.get("transitions", []):
            transition = Transition.from_dict(trans_data)
            self.add_transition(transition)

    def clear_graph(self) -> None:
        """Clear the entire graph."""
        self.graph.clear()
        self._screens.clear()
        self._transitions.clear()
        self._pair_index.clear()

    # ===================== Statistics =====================

    def get_graph_stats(self) -> Dict[str, Any]:
        """Get graph statistics."""
        return {
            "num_screens": self.graph.number_of_nodes(),
            "num_transitions": self.graph.number_of_edges(),
            "density": nx.density(self.graph) if self.graph.number_of_nodes() > 0 else 0,
        }
