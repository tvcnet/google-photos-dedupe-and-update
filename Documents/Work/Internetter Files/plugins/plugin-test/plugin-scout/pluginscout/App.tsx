import React, { useState } from 'react';
import { SearchBar } from './components/SearchBar';
import { AnalysisReport } from './components/AnalysisReport';
import { LoadingProgress } from './components/LoadingProgress';
import { fetchPluginInfo, fetchPluginSourceCode, processUploadedZip } from './services/wordpress';
import { analyzePluginWithGemini, performWebResearch } from './services/gemini';
import { AnalysisState } from './types';
import { CubeIcon } from '@heroicons/react/24/outline';

function App() {
  const [state, setState] = useState<AnalysisState>({
    status: 'idle',
    pluginData: null,
    aiResult: null,
  });
  const [missingKey, setMissingKey] = useState(false);

  React.useEffect(() => {
    if (!process.env.API_KEY) {
      setMissingKey(true);
    }
  }, []);

  const handleSearch = async (term: string) => {
    setState(prev => ({ ...prev, status: 'loading_metadata', error: undefined }));

    try {
      // Step 1: Get metadata from WordPress.org
      const pluginData = await fetchPluginInfo(term);

      // Step 2: Download and Extract Source Code
      setState(prev => ({
        ...prev,
        status: 'downloading_code',
        pluginData: pluginData
      }));

      // We only attempt to download source code if there is a download link
      if (pluginData.download_link) {
        const sourceFiles = await fetchPluginSourceCode(pluginData.download_link);
        pluginData.sourceCodeFiles = sourceFiles;
      }

      // Step 3: Web Research (Google Search)
      setState(prev => ({
        ...prev,
        status: 'searching_web',
        pluginData: pluginData
      }));

      const webResearch = await performWebResearch(pluginData.name, pluginData.slug);

      // Step 4: Analyze with Gemini (Metadata + Code + Web Research)
      setState(prev => ({
        ...prev,
        status: 'analyzing_ai',
        pluginData: pluginData
      }));

      const aiResult = await analyzePluginWithGemini(pluginData, webResearch);

      setState({
        status: 'complete',
        pluginData,
        aiResult,
      });

    } catch (error: any) {
      console.error(error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error.message || 'An unexpected error occurred.',
      }));
    }
  };

  const handleFileUpload = async (file: File) => {
    setState(prev => ({ ...prev, status: 'loading_metadata', error: undefined }));

    try {
      // Step 1: Process Zip Locally (Metadata & Source extraction)
      const pluginData = await processUploadedZip(file);

      // Step 2: Web Research (based on extracted Name)
      setState(prev => ({
        ...prev,
        status: 'searching_web',
        pluginData: pluginData
      }));

      const webResearch = await performWebResearch(pluginData.name, pluginData.slug);

      // Step 3: Analyze with Gemini
      setState(prev => ({
        ...prev,
        status: 'analyzing_ai',
        pluginData: pluginData
      }));

      const aiResult = await analyzePluginWithGemini(pluginData, webResearch);

      setState({
        status: 'complete',
        pluginData,
        aiResult,
      });

    } catch (error: any) {
      console.error(error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error.message || 'Failed to process uploaded file.',
      }));
    }
  };

  const handleReset = () => {
    setState({ status: 'idle', pluginData: null, aiResult: null });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Navigation / Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleReset}>
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white">
              <CubeIcon className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">PluginScout</span>
          </div>
          <a href="https://wordpress.org/plugins/" target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-500 hover:text-brand-600 transition-colors">
            WP Repository ↗
          </a>
        </div>
      </header>

      {missingKey && (
        <div className="bg-red-600 text-white px-4 py-3 text-center">
          <p className="font-bold">⚠️ Missing API Key</p>
          <p className="text-sm">Please set <code className="bg-red-700 px-1 rounded">GEMINI_API_KEY</code> in your <code className="bg-red-700 px-1 rounded">.env.local</code> file and restart the server.</p>
        </div>
      )}

      <main className="px-4 py-12">
        {state.status === 'idle' && (
          <div className="text-center max-w-2xl mx-auto mt-10 animate-fade-in">
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">
              Is that plugin <span className="text-brand-600">secure</span>?
            </h1>
            <p className="text-lg text-slate-600 mb-8">
              We perform a real-time <strong>static code analysis (SAST)</strong> combined with <strong>live web intelligence</strong> to find vulnerabilities and reputation issues.
            </p>
            <SearchBar onSearch={handleSearch} onUpload={handleFileUpload} isLoading={false} />

            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div className="p-6 bg-white rounded-xl border border-slate-100 shadow-sm">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4 font-bold">1</div>
                <h3 className="font-semibold text-slate-900 mb-2">Live Web Recon</h3>
                <p className="text-sm text-slate-500">We search security databases and blogs for known CVEs and hack reports.</p>
              </div>
              <div className="p-6 bg-white rounded-xl border border-slate-100 shadow-sm">
                <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 mb-4 font-bold">2</div>
                <h3 className="font-semibold text-slate-900 mb-2">Deep Code Scan</h3>
                <p className="text-sm text-slate-500">We download the ZIP, extract PHP files, and scan for XSS, SQLi, and other vulnerabilities.</p>
              </div>
              <div className="p-6 bg-white rounded-xl border border-slate-100 shadow-sm">
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-green-600 mb-4 font-bold">3</div>
                <h3 className="font-semibold text-slate-900 mb-2">Trust Score</h3>
                <p className="text-sm text-slate-500">Get a 0-100 security score and a list of specific vulnerable code snippets.</p>
              </div>
            </div>
          </div>
        )}

        {(state.status === 'loading_metadata' || state.status === 'downloading_code' || state.status === 'searching_web' || state.status === 'analyzing_ai') && (
          <div className="max-w-xl mx-auto mt-20 text-center">
            <SearchBar onSearch={handleSearch} onUpload={handleFileUpload} isLoading={true} />
            <LoadingProgress status={state.status} />
          </div>
        )}

        {state.status === 'error' && (
          <div className="max-w-2xl mx-auto mt-10">
            <SearchBar onSearch={handleSearch} onUpload={handleFileUpload} isLoading={false} />
            <div className="mt-8 p-6 bg-red-50 border border-red-100 rounded-xl text-center">
              <h3 className="text-red-800 font-semibold mb-2">Analysis Failed</h3>
              <p className="text-red-600 mb-4">{state.error}</p>
              <button onClick={handleReset} className="text-sm font-medium text-red-700 underline hover:text-red-800">Try again</button>
            </div>
          </div>
        )}

        {state.status === 'complete' && state.pluginData && state.aiResult && (
          <div className="animate-fade-in-up">
            <div className="flex justify-center mb-8">
              <button onClick={handleReset} className="text-sm text-slate-500 hover:text-brand-600 flex items-center gap-1">
                ← Analyze another plugin
              </button>
            </div>
            <AnalysisReport plugin={state.pluginData} analysis={state.aiResult} />
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 w-full bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 z-50">
        <p>Data provided by WordPress.org &bull; Analysis by Google Gemini &bull; This tool is for informational purposes only.</p>
      </footer>
    </div>
  );
}

export default App;