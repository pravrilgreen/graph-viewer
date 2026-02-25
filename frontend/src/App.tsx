import { ReactFlowProvider } from 'reactflow';
import Dashboard from './pages/Dashboard';

/**
 * App Component
 *
 * Root application component
 */
function App() {
  return (
    <ReactFlowProvider>
      <Dashboard />
    </ReactFlowProvider>
  );
}

export default App;