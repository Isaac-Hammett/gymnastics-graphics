import { ShowProvider } from './context/ShowContext';
import TalentView from './views/TalentView';
import ProducerView from './views/ProducerView';
import ImportView from './views/ImportView';

function App() {
  // Simple path-based routing
  const path = window.location.pathname;

  let View;
  let needsProvider = true;

  if (path.includes('/producer') || path.includes('/show-producer')) {
    View = ProducerView;
  } else if (path.includes('/talent')) {
    View = TalentView;
  } else if (path.includes('/import')) {
    View = ImportView;
    needsProvider = false; // Import view doesn't need socket connection
  } else {
    // Default landing page
    needsProvider = false;
    View = () => (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center relative">
        <a
          href="/index-hub.html"
          className="absolute top-5 left-5 flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 text-sm hover:bg-zinc-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back to Hub
        </a>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Show Controller</h1>
          <p className="text-zinc-400 mb-8">Select your view:</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/import"
              className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors"
            >
              Import Show Plan
            </a>
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

  if (needsProvider) {
    return (
      <ShowProvider>
        <View />
      </ShowProvider>
    );
  }

  return <View />;
}

export default App;
