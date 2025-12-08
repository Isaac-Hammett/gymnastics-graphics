import { ShowProvider } from './context/ShowContext';
import TalentView from './views/TalentView';
import ProducerView from './views/ProducerView';

function App() {
  // Simple path-based routing
  const path = window.location.pathname;

  let View;
  if (path.includes('/producer') || path.includes('/show-producer')) {
    View = ProducerView;
  } else if (path.includes('/talent')) {
    View = TalentView;
  } else {
    // Default landing page
    View = () => (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Show Controller</h1>
          <p className="text-zinc-400 mb-8">Select your view:</p>
          <div className="flex gap-4 justify-center">
            <a
              href="/talent"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
            >
              Talent View
            </a>
            <a
              href="/producer"
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors"
            >
              Producer View
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ShowProvider>
      <View />
    </ShowProvider>
  );
}

export default App;
