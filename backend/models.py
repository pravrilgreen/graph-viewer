"""
Data models for the transition graph.
"""

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class Condition:
    """Represents a condition for a transition"""
    condition_id: str
    name: str
    type: str  # boolean | string | number | expression
    value: Optional[str] = None
    operator: Optional[str] = None  # ==, !=, >, <, >=, <=, contains, startsWith
    description: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert condition to dictionary"""
        return {
            "condition_id": self.condition_id,
            "name": self.name,
            "type": self.type,
            "value": self.value,
            "operator": self.operator,
            "description": self.description,
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "Condition":
        """Create condition from dictionary"""
        return Condition(
            condition_id=data.get("condition_id"),
            name=data.get("name"),
            type=data.get("type"),
            value=data.get("value"),
            operator=data.get("operator"),
            description=data.get("description"),
        )


@dataclass
class Transition:
    """Represents an edge (transition) in the graph"""
    from_screen: str
    to_screen: str
    action_type: str  # click | swipe | hardware_button | auto | condition
    description: str
    weight: int = 1
    conditionIds: Optional[List[str]] = field(default=None)
    actionParams: Optional[Dict[str, str]] = field(default=None)
    transition_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert transition to dictionary"""
        return {
            "transition_id": self.transition_id,
            "from_screen": self.from_screen,
            "to_screen": self.to_screen,
            "conditionIds": self.conditionIds or [],
            "weight": self.weight,
            "action": {
                "type": self.action_type,
                "description": self.description,
                "params": self.actionParams or {},
            },
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "Transition":
        """Create transition from dictionary"""
        action = data.get("action") or {}
        conditions = data.get("conditions") or {}
        metrics = data.get("metrics") or {}

        legacy_condition_id = data.get("condition_id")
        condition_ids = conditions.get("ids") or data.get("conditionIds") or []
        if legacy_condition_id and legacy_condition_id not in condition_ids:
            condition_ids.append(legacy_condition_id)

        raw_params = action.get("params")
        if raw_params is None:
            raw_params = data.get("actionParams")
        action_params: Dict[str, str] = {}
        if isinstance(raw_params, dict):
            action_params = {str(key): str(value) for key, value in raw_params.items()}
        elif isinstance(raw_params, list):
            for item in raw_params:
                if not isinstance(item, str) or "=" not in item:
                    continue
                key, value = item.split("=", 1)
                key = key.strip()
                value = value.strip()
                if key:
                    action_params[key] = value
        action_type = action.get("type") or data.get("action_type")
        description = action.get("description") or data.get("description")
        weight = metrics.get("weight") if metrics.get("weight") is not None else data.get("weight", 1)

        return Transition(
            transition_id=data.get("transition_id"),
            from_screen=data.get("from_screen"),
            to_screen=data.get("to_screen"),
            action_type=action_type,
            description=description,
            weight=weight,
            conditionIds=condition_ids,
            actionParams=action_params,
        )


@dataclass
class Screen:
    """Represents a node (screen) in the graph"""
    screen_id: str
    imagePath: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert screen to dictionary"""
        return {
            "screen_id": self.screen_id,
            "imagePath": self.imagePath,
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "Screen":
        """Create screen from dictionary"""
        if isinstance(data, str):
            raise ValueError("Screen entry must be an object with 'screen_id' and 'imagePath'")

        screen_id = data.get("screen_id")
        media = data.get("media") or {}
        image_path = data.get("imagePath") or media.get("imageUrl")
        if not screen_id:
            raise ValueError("Screen entry is missing 'screen_id'")
        if not image_path:
            raise ValueError(f"Screen '{screen_id}' is missing 'imagePath'")
        return Screen(
            screen_id=screen_id,
            imagePath=image_path,
        )


def _to_slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9_]+", "_", value.lower()).strip("_")
    return slug or "screen"


def build_default_screen(screen_id: str) -> Screen:
    slug = _to_slug(screen_id)
    return Screen(
        screen_id=screen_id,
        imagePath=f"/mock-screens/{slug}.svg",
    )
