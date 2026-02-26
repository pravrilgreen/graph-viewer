import { ScreenDto, TransitionDto } from '../api';
import { GraphModel, GraphScreen, GraphTransition } from './types';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

const resolveImagePath = (path: string) => {
  if (!path) {
    return '';
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

const buildScreen = (screen: ScreenDto): GraphScreen => ({
  id: screen.screen_id,
  imagePath: resolveImagePath(screen.imagePath),
});

const buildTransition = (transition: TransitionDto, idx: number): GraphTransition => {
  const actionType = transition.action?.type || 'click';
  const actionDescription = transition.action?.description || '';
  const actionParams = transition.action?.params || {};
  const transitionId = transition.transition_id || `${transition.from_screen}->${transition.to_screen}::${actionType}::${idx}`;

  return {
    id: transitionId,
    from: transition.from_screen,
    to: transition.to_screen,
    action: {
      type: actionType,
      description: actionDescription,
      params: actionParams,
    },
    conditions: {
      ids: transition.conditionIds || [],
    },
    metrics: {
      weight: Number(transition.weight) || 1,
    },
  };
};

export const buildGraphModel = (screens: ScreenDto[], transitions: TransitionDto[]): GraphModel => ({
  screens: screens.map(buildScreen),
  transitions: transitions.map(buildTransition),
});
