"""
Pydantic schemas for request validation.
"""

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class TransitionAction(BaseModel):
    """Schema for transition action payload."""

    type: str = Field(..., description="Type of action: click, swipe, hardware_button, auto, condition")
    description: str = Field(..., description="Transition action description")
    params: Optional[Dict[str, str]] = Field(default=None, description="Action parameters key-value map")


class TransitionUpdate(BaseModel):
    """Schema for updating an existing transition."""

    transition_id: Optional[str] = Field(default=None, description="Transition identifier (recommended)")
    from_screen: str = Field(..., description="Source screen ID")
    to_screen: str = Field(..., description="Target screen ID")
    action: Optional[TransitionAction] = Field(default=None, description="Structured action object")
    action_type: Optional[str] = Field(default=None, description="Legacy action type")
    conditionIds: Optional[List[str]] = Field(default=None, description="Optional condition IDs")
    actionParams: Optional[Dict[str, str]] = Field(default=None, description="Legacy action parameters")
    description: Optional[str] = Field(default=None, description="Legacy transition description")
    weight: int = Field(default=1, description="Edge weight for shortest path calculation")
