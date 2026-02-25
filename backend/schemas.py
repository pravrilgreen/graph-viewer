"""
Pydantic schemas for request/response validation.
"""

from typing import Dict, List, Optional, Union

from pydantic import BaseModel, Field


class ScreenCreate(BaseModel):
    """Schema for creating a screen"""
    screen_id: str = Field(..., description="Unique identifier for the screen")


class ScreenRename(BaseModel):
    """Schema for renaming a screen"""
    old_screen_id: str = Field(..., description="Existing screen ID")
    new_screen_id: str = Field(..., description="New screen ID")


class Screen(ScreenCreate):
    """Schema for screen response."""
    imagePath: str = Field(..., description="Screen image path")


class ConditionCreate(BaseModel):
    """Schema for creating a condition"""
    condition_id: str = Field(..., description="Unique identifier for the condition")
    name: str = Field(..., description="Condition name")
    type: str = Field(..., description="Type: boolean, string, number, expression")
    value: Optional[str] = Field(default=None, description="Expected value")
    operator: Optional[str] = Field(default=None, description="Operator: ==, !=, >, <, >=, <=, contains, startsWith")
    description: Optional[str] = Field(default=None, description="Description")


class Condition(ConditionCreate):
    """Schema for condition response"""
    pass


class TransitionAction(BaseModel):
    """Schema for transition action payload."""

    type: str = Field(..., description="Type of action: click, swipe, hardware_button, auto, condition")
    description: str = Field(..., description="Transition action description")
    params: Optional[Dict[str, str]] = Field(default=None, description="Action parameters key-value map")


class TransitionCreate(BaseModel):
    """Schema for creating a transition"""
    from_screen: str = Field(..., description="Source screen ID")
    to_screen: str = Field(..., description="Target screen ID")
    action: Optional[TransitionAction] = Field(default=None, description="Structured action object")
    action_type: Optional[str] = Field(default=None, description="Legacy action type")
    conditionIds: Optional[List[str]] = Field(default=None, description="Optional condition IDs")
    actionParams: Optional[Dict[str, str]] = Field(default=None, description="Legacy action parameters")
    description: Optional[str] = Field(default=None, description="Legacy transition description")
    weight: int = Field(default=1, description="Edge weight for shortest path calculation")


class TransitionUpdate(BaseModel):
    """Schema for updating a transition"""
    from_screen: str = Field(..., description="Source screen ID")
    to_screen: str = Field(..., description="Target screen ID")
    action: Optional[TransitionAction] = Field(default=None, description="Structured action object")
    action_type: Optional[str] = Field(default=None, description="Legacy action type")
    conditionIds: Optional[List[str]] = Field(default=None, description="Optional condition IDs")
    actionParams: Optional[Dict[str, str]] = Field(default=None, description="Legacy action parameters")
    description: Optional[str] = Field(default=None, description="Legacy transition description")
    weight: int = Field(default=1, description="Edge weight for shortest path calculation")


class Transition(TransitionCreate):
    """Schema for transition response"""
    pass


class PathResult(BaseModel):
    """Schema for path finding result"""
    path: List[str] = Field(..., description="List of screen IDs in the path")
    transitions: List[dict] = Field(..., description="List of transitions along the path")
    total_weight: int = Field(..., description="Total weight of the path")


class TriggerTransition(BaseModel):
    """Schema for triggering a transition"""
    from_screen: str = Field(..., description="Current screen ID")
    to_screen: str = Field(..., description="Target screen ID")


class GraphExport(BaseModel):
    """Schema for graph export/import"""
    screens: Optional[List[Union[str, dict]]] = Field(default=None, description="Optional list of screens")
    transitions: List[dict] = Field(..., description="List of transitions")
    conditions: Optional[List[dict]] = Field(default=None, description="List of conditions")


class ErrorResponse(BaseModel):
    """Schema for error responses"""
    detail: str = Field(..., description="Error message")
