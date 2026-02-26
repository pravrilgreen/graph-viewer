import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface ScreenDto {
  screen_id: string;
  imagePath: string;
}

export interface TransitionDto {
  transition_id?: string;
  from_screen: string;
  to_screen: string;
  action: {
    type: string;
    description: string;
    params: Record<string, string>;
  };
  weight: number;
  conditionIds?: string[];
}

export interface GraphStatsDto {
  num_screens: number;
  num_transitions: number;
  density: number;
}

// ===================== Screen Endpoints =====================

export const screenAPI = {
  /**
   * Get all screens
   */
  getAllScreens: async (): Promise<ScreenDto[]> => {
    const response = await api.get('/screens');
    return response.data;
  },

  /**
   * Get a specific screen
   */
  getScreen: async (screenId: string): Promise<ScreenDto> => {
    const response = await api.get(`/screens/${screenId}`);
    return response.data;
  },

};

// ===================== Transition Endpoints =====================

export const transitionAPI = {
  /**
   * Get all transitions
   */
  getAllTransitions: async (): Promise<TransitionDto[]> => {
    const response = await api.get('/transitions');
    return response.data;
  },

  /**
   * Get a specific transition
   */
  getTransition: async (fromScreen: string, toScreen: string): Promise<TransitionDto> => {
    const response = await api.get(`/transitions/${fromScreen}/${toScreen}`);
    return response.data;
  },

  /**
   * Update an existing transition
   */
  updateTransition: async (data: {
    transition_id?: string;
    from_screen: string;
    to_screen: string;
    action: {
      type: string;
      description: string;
      params: Record<string, string>;
    };
    weight?: number;
    conditionIds?: string[];
  }): Promise<TransitionDto> => {
    const response = await api.put('/transitions', data);
    return response.data;
  },

};

// ===================== Path Finding Endpoints =====================

export const pathAPI = {
  /**
   * Find shortest path (weighted by edge weights)
   */
  findShortestPath: async (fromScreen: string, toScreen: string) => {
    const response = await api.get('/path/shortest', {
      params: {
        from_screen: fromScreen,
        to_screen: toScreen,
      },
    });
    return response.data;
  },

  /**
   * Find simplest path (minimum transitions)
   */
  findSimplePath: async (fromScreen: string, toScreen: string) => {
    const response = await api.get('/path/simple', {
      params: {
        from_screen: fromScreen,
        to_screen: toScreen,
        max_paths: 100,
      },
    });
    return response.data;
  },
};

// ===================== Graph Import/Export Endpoints =====================

export const graphAPI = {
  /**
   * Get graph statistics
   */
  getStats: async (): Promise<GraphStatsDto> => {
    const response = await api.get('/graph/stats');
    return response.data;
  },
};

export default api;
